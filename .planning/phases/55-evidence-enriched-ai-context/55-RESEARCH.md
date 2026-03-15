# Phase 55: Evidence-Enriched AI Context - Research

**Researched:** 2026-03-16
**Domain:** TypeScript interface extension + shared module extraction (no new dependencies)
**Confidence:** HIGH

## Summary

Phase 55 is a pure codebase refactoring phase with two tightly coupled tasks: (1) extract a duplicated `loadProjectSender` function into a single shared module, and (2) extend the `OutreachContext` interface with optional evidence and hypothesis fields so all AI email generation can draw on prospect-specific pain points. Both tasks are additive and non-breaking — existing callers are unchanged.

The duplication of `loadProjectSender` is fully mapped: the logic appears in three locations — as a named function in `lib/automation/processor.ts` (takes `prisma` global, no `db` param), as a named function in `server/routers/outreach.ts` (takes `db: PrismaClient` param, adds `languageOverride`), and as inline logic in `lib/cadence/engine.ts` lines 411-429 (no named function, same pattern). The three implementations have slight divergences: only the router version accepts a language override, and only the cadence engine version is inline rather than a function. The shared module must reconcile these.

The `OutreachContext` extension adds two optional arrays: `evidence` (abbreviated evidence items) and `hypotheses` (hypothesis title + problem statement). Optional means zero existing callers break. The `buildIntroEmailPrompt` and `buildFollowUpPrompt` functions in `outreach-prompts.ts` gain new conditional blocks that inject evidence when present. The planner will want to know the exact token budget for evidence injection (research recommends capping at 5-8 items, ~300 tokens) to avoid prompt bloat with Gemini Flash.

**Primary recommendation:** Create `lib/outreach/sender.ts` as the single shared module. Export `loadProjectSender(db: PrismaClient, projectId: string, languageOverride?: 'nl' | 'en'): Promise<OutreachSender>`. Then update `OutreachContext` in `outreach-prompts.ts` with the two optional fields, and add conditional prompt blocks in `buildIntroEmailPrompt` and `buildFollowUpPrompt`.

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                          | Research Support                                                                                                                                                               |
| ------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CNSL-01 | loadProjectSender consolidated into single shared module (currently duplicated in 3 files)           | Three locations fully mapped: `processor.ts:14`, `outreach.ts:188`, `engine.ts:411-429` (inline). Shared module signature reconciled.                                          |
| CNSL-02 | OutreachContext extended with optional evidence fields (non-breaking, enriches all email generation) | `OutreachContext` in `outreach-prompts.ts:11-35`. Extension pattern is a TypeScript optional field addition. `EvidenceItem` and `WorkflowHypothesis` schema fields documented. |

</phase_requirements>

## Standard Stack

### Core

| Library                 | Version         | Purpose                                        | Why Standard                                  |
| ----------------------- | --------------- | ---------------------------------------------- | --------------------------------------------- |
| TypeScript              | project default | Interface extension, type safety               | All project code is TypeScript                |
| `@prisma/client`        | project default | `PrismaClient` type for shared sender function | Already used in all three duplicate locations |
| `@google/generative-ai` | 0.24.1          | Gemini 2.0 Flash — AI email generation         | Already in production; no change needed       |

### Supporting

| Library                      | Version | Purpose                                               | When to Use                                            |
| ---------------------------- | ------- | ----------------------------------------------------- | ------------------------------------------------------ |
| `lib/ai/outreach-prompts.ts` | current | Holds `OutreachContext` interface and prompt builders | The only file to edit for context extension            |
| `lib/outreach/sender.ts`     | new     | Shared `loadProjectSender` module                     | Created in this phase; imported by the three consumers |

### Alternatives Considered

| Instead of                                 | Could Use                                           | Tradeoff                                                                                                                            |
| ------------------------------------------ | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `lib/outreach/sender.ts`                   | Adding `loadProjectSender` to `outreach-prompts.ts` | Mixing DB-read logic into a pure prompt-building module violates separation of concerns — keep DB in `lib/outreach/`                |
| Optional `evidence[]` on `OutreachContext` | Separate `EvidenceEnrichedContext` type             | Discriminated union creates two incompatible types; all callers would need to be updated. Optional fields preserve backward compat. |

**Installation:** No new packages required.

## Architecture Patterns

### Recommended Project Structure

```
lib/
├── ai/
│   ├── outreach-prompts.ts    # EDIT: add evidence/hypotheses fields to OutreachContext
│   └── generate-outreach.ts   # no changes needed
├── outreach/
│   ├── sender.ts              # NEW: shared loadProjectSender
│   ├── quality.ts             # existing
│   └── send-email.ts          # existing
├── automation/
│   └── processor.ts           # EDIT: import loadProjectSender from lib/outreach/sender
├── cadence/
│   └── engine.ts              # EDIT: replace inline sender block with loadProjectSender import
server/
└── routers/
    └── outreach.ts            # EDIT: replace local loadProjectSender with shared import
```

### Pattern 1: Shared Sender Module Signature

**What:** Single exported async function covering all call-site variants
**When to use:** Any file that needs to build an `OutreachSender` from a project's DB settings

```typescript
// lib/outreach/sender.ts
// Source: reconciled from processor.ts:14-30 and outreach.ts:188-208

import type { PrismaClient } from '@prisma/client';
import type { OutreachSender } from '@/lib/ai/outreach-prompts';

export async function loadProjectSender(
  db: PrismaClient,
  projectId: string,
  languageOverride?: 'nl' | 'en',
): Promise<OutreachSender> {
  const project = await db.project.findFirst({
    where: { id: projectId },
    select: { metadata: true, brandName: true },
  });
  const meta = (project?.metadata ?? {}) as Record<string, unknown>;
  const o = (meta.outreach ?? {}) as Record<string, string>;
  return {
    fromName: o.fromName || 'Romano Kanters',
    company: (project?.brandName as string) || 'Klarifai',
    language: languageOverride ?? (o.language as 'nl' | 'en') ?? 'nl',
    tone: o.tone || '',
    companyPitch: o.companyPitch || '',
    signatureHtml: o.signatureHtml || '',
    signatureText: o.signatureText || '',
  };
}
```

**Note:** `processor.ts` currently uses the module-level `prisma` singleton instead of a `db` param. After migrating, it will pass `prisma` (the singleton) as the `db` argument — a compatible call.

### Pattern 2: OutreachContext Extension (non-breaking)

**What:** Two optional fields on the existing interface; prompt builders inject them conditionally
**When to use:** Any email generation call site that has loaded evidence/hypotheses

```typescript
// lib/ai/outreach-prompts.ts — EDIT: add to existing OutreachContext interface

export interface EvidenceContext {
  sourceType: string;
  snippet: string; // key 1-2 sentence excerpt
  title: string | null;
}

export interface HypothesisContext {
  title: string;
  problemStatement: string;
}

export interface OutreachContext {
  // ... existing fields unchanged ...
  /** Optional: top evidence items from most recent ResearchRun */
  evidence?: EvidenceContext[];
  /** Optional: confirmed hypotheses (title + problem) for this prospect */
  hypotheses?: HypothesisContext[];
}
```

### Pattern 3: Prompt Injection Block (conditional)

**What:** Inject evidence into prompt only when present; existing callers pass no evidence and see identical output
**When to use:** In `buildIntroEmailPrompt` and `buildFollowUpPrompt`

```typescript
// Source: adapted from existing signal injection pattern at outreach-prompts.ts:135

// In buildIntroEmailPrompt and buildFollowUpPrompt:
${ctx.evidence && ctx.evidence.length > 0 ? `
${isNl ? 'BEWIJS UIT PROSPECT-ONDERZOEK' : 'EVIDENCE FROM PROSPECT RESEARCH'}:
${ctx.evidence.slice(0, 8).map(e => `- [${e.sourceType}] ${e.title ? e.title + ': ' : ''}${e.snippet.slice(0, 200)}`).join('\n')}
` : ''}
${ctx.hypotheses && ctx.hypotheses.length > 0 ? `
${isNl ? 'PIJNPUNTEN (GEVALIDEERDE HYPOTHESEN)' : 'PAIN POINTS (VALIDATED HYPOTHESES)'}:
${ctx.hypotheses.map(h => `- ${h.title}: ${h.problemStatement}`).join('\n')}
` : ''}
```

### Anti-Patterns to Avoid

- **Adding DB reads to `outreach-prompts.ts`:** This is a pure prompt-building module. All DB access belongs in the caller or the new `sender.ts`. Do not add Prisma imports to `outreach-prompts.ts`.
- **Passing raw `EvidenceItem` DB objects into `OutreachContext`:** The DB `EvidenceItem` has many fields (confidenceScore, isApproved, workflowTag, etc.) that the prompt doesn't need and that inflate token count. Use the slim `EvidenceContext` interface.
- **Changing the function signature of `generateIntroEmail` or `generateFollowUp`:** These functions take `OutreachContext` — adding optional fields to the interface means no signature change is needed. Do not add parameters to these functions.
- **Making evidence fields required:** Any caller that doesn't load evidence (most existing callers) must continue to work unchanged. Fields must remain optional with `?`.

## Don't Hand-Roll

| Problem                             | Don't Build                    | Use Instead                                                                           | Why                                                                                                                                           |
| ----------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Snippet truncation for token budget | Custom token counter           | `.slice(0, 200)` on snippet string + `.slice(0, 8)` on array                          | Gemini Flash context window is 1M tokens; the constraint is prompt quality, not hard limits. A simple character slice keeps evidence focused. |
| Language-aware evidence injection   | Separate NL/EN prompt builders | Single conditional block using `isNl` (already used throughout `outreach-prompts.ts`) | The existing pattern is established and sufficient.                                                                                           |

**Key insight:** This phase has no algorithmic complexity — it is pure TypeScript refactoring. The only risk is breaking existing callers through signature changes or import cycles. Both are avoided by using optional fields and a separate `sender.ts` module.

## Common Pitfalls

### Pitfall 1: processor.ts Uses Global Prisma Singleton

**What goes wrong:** `processor.ts` has `import prisma from '@/lib/prisma'` at the top and calls `loadProjectSender(prospect.projectId)` with one argument. After extraction, the shared function takes `(db, projectId, langOverride?)` — two required args. If the migration changes only the function file without updating the call site, TypeScript will catch it, but if `as any` is used, it silently breaks.

**Why it happens:** The three duplicate implementations have inconsistent signatures — the processor version hides the `db` param by closing over the global singleton.

**How to avoid:** When updating `processor.ts`, change `loadProjectSender(prospect.projectId)` to `loadProjectSender(prisma, prospect.projectId)` where `prisma` is the already-imported singleton. No new import needed.

**Warning signs:** TypeScript error "Expected 2 arguments, but got 1" on the processor call site.

### Pitfall 2: Import Cycle Between outreach-prompts.ts and sender.ts

**What goes wrong:** `sender.ts` imports `OutreachSender` from `outreach-prompts.ts`. If `outreach-prompts.ts` were to import anything from `sender.ts`, a cycle forms and Next.js/Node module resolution fails at runtime.

**Why it happens:** Easy to accidentally reach for a utility function defined in `sender.ts` from within `outreach-prompts.ts`.

**How to avoid:** `outreach-prompts.ts` imports nothing from `lib/outreach/`. It is a zero-dependency prompt builder. `sender.ts` imports the `OutreachSender` type from `outreach-prompts.ts` (type-only import, no runtime cycle risk).

**Warning signs:** TypeScript/ESLint circular dependency warning, or `ReferenceError: Cannot access before initialization` at runtime.

### Pitfall 3: Prompt Bloat From Too Many Evidence Items

**What goes wrong:** Loading all 83 evidence items for Nedri and injecting all into the prompt produces a ~5000 token evidence block. Gemini Flash quality degrades with very long prompts; the model may fail to focus on the most relevant pain points.

**Why it happens:** Easy to pass `ctx.evidence` without capping.

**How to avoid:** Slice to top 8 items (`.slice(0, 8)`). If a caller wants to be more selective, pre-filter evidence by `confidenceScore >= 0.7` or `sourceType` before building the context. For v8.0 Phase 55, just cap at 8 — the caller in Phase 56 will decide which evidence to load.

**Warning signs:** Email output is generically long and unfocused; AI token cost spikes noticeably.

### Pitfall 4: cadence/engine.ts Has Inline Sender Code, Not a Function

**What goes wrong:** The pitfall table in SUMMARY.md says "3 files" but `engine.ts` does not have a named `loadProjectSender` function — the logic is inline in `processDueCadenceSteps` at lines 411-429. A grep for `loadProjectSender` in `lib/cadence/` returns no results. The planner must address the inline block, not a function reference.

**Why it happens:** The cadence engine was written after the other two files and the author inlined the logic instead of reusing.

**How to avoid:** In the engine.ts migration, replace the inline block (lines 411-429: `const senderProject = await db.project.findFirst(...)` through the `sender` object literal) with a single call to `loadProjectSender(db, step.sequence.prospect.projectId)`.

**Warning signs:** If only the two named-function files are updated and engine.ts is skipped, the consolidation is incomplete — CNSL-01 fails its success criteria.

## Code Examples

Verified patterns from direct codebase analysis:

### Current cadence engine inline sender block (to be replaced)

```typescript
// Source: lib/cadence/engine.ts lines 411-429 (inline, no function name)
const senderProject = await db.project.findFirst({
  where: { id: step.sequence.prospect.projectId },
  select: { metadata: true, brandName: true },
});
const sMeta = (senderProject?.metadata ?? {}) as Record<string, unknown>;
const sOutreach = (sMeta.outreach ?? {}) as Record<string, string>;
const sender: OutreachSender = {
  fromName: sOutreach.fromName || 'Romano Kanters',
  company: (senderProject?.brandName as string) || 'Klarifai',
  language: (sOutreach.language as 'nl' | 'en') ?? 'nl',
  tone: sOutreach.tone || '',
  companyPitch: sOutreach.companyPitch || '',
  signatureHtml: sOutreach.signatureHtml || '',
  signatureText: sOutreach.signatureText || '',
};
// → replace with: const sender = await loadProjectSender(db, step.sequence.prospect.projectId);
```

### Existing signal injection pattern (model for evidence injection)

```typescript
// Source: lib/ai/outreach-prompts.ts line 135
${ctx.signal ? `${isNl ? 'TRIGGER SIGNAAL' : 'TRIGGER SIGNAL'}:\n- Type: ${ctx.signal.signalType}\n- ${ctx.signal.title}\n- ${ctx.signal.description ?? ''}\n` : ''}
```

### Existing OutreachContext interface (the interface to extend)

```typescript
// Source: lib/ai/outreach-prompts.ts lines 11-35
export interface OutreachContext {
  contact: {
    firstName: string;
    lastName: string;
    jobTitle: string | null;
    seniority: string | null;
    department: string | null;
  };
  company: {
    companyName: string;
    domain: string;
    industry: string | null;
    employeeRange: string | null;
    technologies: string[];
    description: string | null;
  };
  signal?: { signalType: string; title: string; description: string | null };
  sender?: OutreachSender;
  discoverUrl?: string;
  // Add here: evidence?: EvidenceContext[]; hypotheses?: HypothesisContext[];
}
```

## State of the Art

| Old Approach                                            | Current Approach                                         | When Changed | Impact                                                                                                 |
| ------------------------------------------------------- | -------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------ |
| Duplicate `loadProjectSender` in 3 locations            | Single shared `lib/outreach/sender.ts`                   | Phase 55     | Sender config changes propagate to all consumers from one file                                         |
| Generic outreach prompts with company/contact data only | Evidence-enriched prompts referencing actual pain points | Phase 55     | Intro and follow-up emails reference specific observed workflow issues rather than generic value props |

**Deprecated/outdated:**

- Inline sender block in `engine.ts` lines 411-429: replaced by `loadProjectSender(db, projectId)` call

## Open Questions

1. **Should `buildOutreachContext` also be consolidated in this phase?**
   - What we know: PITFALLS.md flags `buildOutreachContext` as duplicated in `routers/outreach.ts` and `cadence/engine.ts`
   - What's unclear: CNSL-01/CNSL-02 scope says only `loadProjectSender` and `OutreachContext` extension — not context builder consolidation
   - Recommendation: Do NOT consolidate `buildOutreachContext` in Phase 55. It belongs to Phase 56 (unified intro draft creator). Stay in scope.

2. **Which evidence items should the Phase 55 prompt injection use?**
   - What we know: Phase 55 only extends the interface; Phase 56 will be the first caller that passes evidence. Phase 55 does not need to decide the loading strategy.
   - What's unclear: Whether evidence should be filtered by `confidenceScore` or `sourceType` before injection
   - Recommendation: Phase 55 documents the cap (8 items, 200 char snippet) in code comments. Filtering strategy is Phase 56's concern.

## Sources

### Primary (HIGH confidence)

- Direct codebase analysis: `lib/automation/processor.ts:14-30` — first `loadProjectSender` implementation (global prisma, no languageOverride)
- Direct codebase analysis: `server/routers/outreach.ts:188-208` — second `loadProjectSender` implementation (db param, languageOverride)
- Direct codebase analysis: `lib/cadence/engine.ts:411-429` — third (inline) duplicate
- Direct codebase analysis: `lib/ai/outreach-prompts.ts:11-35` — `OutreachContext` interface to extend
- Direct codebase analysis: `prisma/schema.prisma:440-495` — `EvidenceItem` and `WorkflowHypothesis` schema fields
- Direct codebase analysis: `lib/analysis/types.ts:46-50` — `EvidenceItem` type (analysis layer, distinct from DB model)
- Project research: `SUMMARY.md` — architecture decisions and pitfall catalog for v8.0

### Secondary (N/A)

No external sources required — this is pure internal refactoring with no new libraries.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages, all findings from direct codebase analysis
- Architecture: HIGH — all three duplicate locations confirmed by grep + file read; interface extension pattern established in same file
- Pitfalls: HIGH — pitfall 4 (inline vs function) is a novel finding from direct code inspection not visible in earlier summary

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable internal codebase; no external dependencies to expire)

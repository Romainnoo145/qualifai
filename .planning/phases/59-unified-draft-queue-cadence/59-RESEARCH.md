# Phase 59: Unified Draft Queue + Cadence — Research

**Researched:** 2026-03-16
**Domain:** Outreach queue UI, cadence follow-up AI generation, bidirectional prospect linking
**Confidence:** HIGH (full codebase read; all upstream phases confirmed shipped)

---

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                        | Research Support                                                                                                                                                                                              |
| ------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PIPE-02 | All drafts (intro, follow-up, signal-triggered) appear in one unified draft queue on outreach page | `getDecisionInbox` already fetches all `status: 'draft'` OutreachLogs. All three draft kinds (`intro_draft`, `cadence_draft`, `signal_draft`) land in OutreachLog with `status: 'draft'`. Query is unified.   |
| PIPE-03 | Draft queue groups drafts by scheduled send date with date section headers                         | Currently no `scheduledSendAt` field on OutreachLog — grouping must use `createdAt` as proxy, OR add a `scheduledSendAt` column. The queue currently orders by `createdAt desc` with no date grouping.        |
| PIPE-04 | Prospect detail shows outreach status and links to related drafts in the queue                     | `getDraftsForProspect` query exists (returns `status: 'draft'` logs by `prospectId`). Prospect detail `outreach-preview-section.tsx` shows existing draft with "View in Queue" link. Needs full status panel. |
| CDNC-01 | Cadence follow-ups are generated via AI with actual email body text (not empty placeholders)       | `processDueCadenceSteps` already calls `generateFollowUp` and stores bodyHtml/bodyText. It falls back to empty body on AI error. The current `generateFollowUp` does NOT pass evidence/hypotheses context.    |
| CDNC-02 | Follow-ups use evidence from ProspectAnalysis narrative and recent signals for enriched content    | `generateFollowUp` takes `OutreachContext`. `OutreachContext` has optional `evidence` and `hypotheses` fields. `processDueCadenceSteps` builds context without loading ProspectAnalysis — this is the gap.    |
| CDNC-03 | Follow-ups appear in the unified draft queue for review before sending                             | `processDueCadenceSteps` creates OutreachLog with `status: 'draft'` and `kind: 'cadence_draft'`. They land in `getDecisionInbox` automatically. Queue UI shows them — no structural gap, just UI labeling.    |
| CDNC-04 | Cadence automatically pauses when prospect replies (existing behavior preserved)                   | `applyReplyTriage` in `lib/outreach/reply-workflow.ts` updates sequence status on reply. `markSequenceStepAfterSend` evaluates cadence after send. Existing behavior is intact — must not break it.           |

</phase_requirements>

---

## Summary

Phase 59 has two distinct workstreams delivered by two plans.

**Plan 59-01 (AI cadence enrichment):** The cadence engine already calls `generateFollowUp` but builds a minimal `OutreachContext` — company name, description, industry. It does not load ProspectAnalysis narrative or recent evidence items. The fix is to enrich `buildCadenceOutreachContext` in `lib/cadence/engine.ts` to load the latest `ProspectAnalysis` for the prospect, extract `executiveSummary` and up to 3 `sections[].body` passages as evidence context, and also load recent signals (last 30 days) to add a `signal` context when relevant. The `generateFollowUp` function already accepts `evidence` and `hypotheses` in `OutreachContext` and the prompt uses them — the engine just needs to pass them.

**Plan 59-02 (unified queue UI + bidirectional linking):** The queue UI (`app/admin/outreach/page.tsx`) currently renders all drafts in a flat list ordered by `createdAt`. Two UI changes are needed: (1) date-group the drafts by scheduled send date with Dutch section headers ("Vandaag", "Morgen", day+date), and (2) each draft card needs a link to its prospect detail page. The prospect detail (`outreach-preview-section.tsx`) needs to show a richer outreach status panel — how many drafts are pending in the queue, what stage the sequence is at, with a direct link to `/admin/outreach?prospect=<id>` (or a hash anchor). No schema change is required for date grouping — `createdAt` is the correct grouping dimension since drafts are created when they are due to be sent.

**Primary recommendation:** CDNC-01/02 are solved by enriching `processDueCadenceSteps` context loading. PIPE-02/03 are solved by reworking the `DraftQueue` component's render logic. PIPE-04 is solved by upgrading `OutreachPreviewSection`. All changes stay within existing files — no schema migrations needed.

---

## Standard Stack

### Core (all already installed)

| Library          | Version                   | Purpose                           | Why Standard                          |
| ---------------- | ------------------------- | --------------------------------- | ------------------------------------- |
| Prisma           | ^7.3.0                    | DB queries for analysis, evidence | Project ORM — all data access uses it |
| tRPC v11         | ^11.x                     | Router mutations/queries          | Project API layer — no REST endpoints |
| React            | ^18                       | UI state, client components       | Next.js app router                    |
| Gemini 2.0 Flash | via @google/generative-ai | AI text generation for follow-ups | Already used in generate-outreach.ts  |
| date-fns         | check package.json        | Date formatting for Dutch headers | Likely available; if not, use Intl    |

### No New Dependencies

All capabilities needed (AI generation, DB queries, UI patterns) already exist in the project. Date formatting for "Vandaag"/"Morgen" can use JavaScript `Intl.DateTimeFormat` with `nl-NL` locale — no additional package needed.

---

## Architecture Patterns

### Files to Modify

```
lib/cadence/
└── engine.ts              # MODIFY — enrich buildCadenceOutreachContext with ProspectAnalysis + signals

server/routers/
└── outreach.ts            # MODIFY — getDecisionInbox: add prospect link data to draft items

app/admin/outreach/
└── page.tsx               # MODIFY — DraftQueue: add date grouping + prospect link per draft card

components/features/prospects/
└── outreach-preview-section.tsx   # MODIFY — richer outreach status panel with queue link
```

### Pattern 1: Evidence Enrichment in buildCadenceOutreachContext

**What:** Load `ProspectAnalysis` for the prospect and extract narrative sections as `EvidenceContext[]` items.
**When to use:** Inside `processDueCadenceSteps` before calling `generateFollowUp`.
**Example:**

```typescript
// In processDueCadenceSteps, after loading sequence/contact/prospect:
const analysis = await db.prospectAnalysis.findFirst({
  where: { prospectId: step.sequence.prospectId },
  orderBy: { createdAt: 'desc' },
  select: { content: true, version: true },
});

// Extract evidence from analysis-v2 narrative
let evidenceItems: EvidenceContext[] = [];
if (analysis?.content && typeof analysis.content === 'object') {
  const content = analysis.content as Record<string, unknown>;
  if (content.version === 'analysis-v2') {
    const sections =
      (content.sections as
        | Array<{ title?: string; body?: string }>
        | undefined) ?? [];
    evidenceItems = sections.slice(0, 3).map((s) => ({
      sourceType: 'ANALYSIS',
      snippet: s.body?.slice(0, 200) ?? '',
      title: s.title ?? null,
    }));
    // Also add executiveSummary as first item
    if (typeof content.executiveSummary === 'string') {
      evidenceItems.unshift({
        sourceType: 'ANALYSIS',
        snippet: content.executiveSummary.slice(0, 200),
        title: 'Samenvatting',
      });
    }
  }
}
```

### Pattern 2: Date Grouping in DraftQueue

**What:** Group drafts by their "send date" bucket — today, tomorrow, or day+date — using `createdAt` as the bucket dimension.
**When to use:** Inside `DraftQueue` render, before mapping over drafts.
**Example:**

```typescript
// Client-side grouping, pure function
function groupByDate(
  drafts: DraftItem[],
): { label: string; items: DraftItem[] }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const buckets = new Map<string, DraftItem[]>();

  for (const draft of drafts) {
    const date = new Date(draft.createdAt);
    date.setHours(0, 0, 0, 0);
    let label: string;
    if (date.getTime() === today.getTime()) {
      label = 'Vandaag';
    } else if (date.getTime() === tomorrow.getTime()) {
      label = 'Morgen';
    } else {
      label = date.toLocaleDateString('nl-NL', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      });
      // Capitalize first letter: "woensdag 18 mrt" → "Woensdag 18 mrt"
      label = label.charAt(0).toUpperCase() + label.slice(1);
    }
    const existing = buckets.get(label) ?? [];
    existing.push(draft);
    buckets.set(label, existing);
  }

  return Array.from(buckets.entries()).map(([label, items]) => ({
    label,
    items,
  }));
}
```

### Pattern 3: Draft Card Prospect Link

**What:** Each draft in the queue links to its prospect detail page.
**The data already exists:** `draft.contact.prospect.id` is available in the `getDecisionInbox` response. Link to `/admin/prospects/<prospectId>`.
**Example:**

```tsx
import Link from 'next/link';
// Inside the draft row button, add a prospect link:
<Link
  href={`/admin/prospects/${draft.contact.prospect.id}`}
  onClick={(e) => e.stopPropagation()}
  className="text-[11px] font-bold text-[#007AFF] hover:underline truncate"
>
  {companyName}
</Link>;
```

### Pattern 4: OutreachPreviewSection Status Panel

**What:** Replace the minimal sequence status indicator with a full panel showing: active sequence stage, pending drafts count, last email sent date, and a link to the outreach queue filtered/anchored to this prospect's drafts.
**Data sources:** `getDraftsForProspect` (already called), `sequences.list` (already called).
**Example:**

```tsx
// Status pill row at top of section
<div className="flex flex-wrap gap-2">
  {activeSeq && (
    <span className="admin-state-pill admin-state-neutral">
      {activeSeq.steps?.length ?? 0} stap
      {activeSeq.steps?.length !== 1 ? 'pen' : ''}
    </span>
  )}
  {pendingDrafts > 0 && (
    <Link href="/admin/outreach">
      <span className="admin-state-pill bg-amber-50 text-amber-700">
        {pendingDrafts} concept{pendingDrafts !== 1 ? 'en' : ''} in wachtrij
      </span>
    </Link>
  )}
</div>
```

### Anti-Patterns to Avoid

- **Loading full `bodyHtml` in cadence context query:** Only load `content` from ProspectAnalysis. Don't load `inputSnapshot` (large JSON) unless needed.
- **Grouping drafts server-side in `getDecisionInbox`:** Keep grouping purely client-side — no schema change, no new query param. Server returns flat list; client groups.
- **Breaking `generateFollowUp` signature:** The function already accepts `OutreachContext` — just enrich the context object. No signature change needed.
- **Cadence reply-pause logic:** `applyReplyTriage` and sequence status updates are upstream of cadence generation. Do not touch reply-workflow.ts in this phase.

---

## Don't Hand-Roll

| Problem             | Don't Build                          | Use Instead                                                                                                       | Why                                               |
| ------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Dutch date labels   | Custom date formatter                | `Intl.DateTimeFormat('nl-NL', ...)` built-in                                                                      | Already used in `page.tsx` for sent history dates |
| AI follow-up body   | Template string follow-up            | `generateFollowUp` in `lib/ai/generate-outreach.ts`                                                               | Already handles HTML/text, signature, CTA         |
| Prospect name data  | Extra query for company name         | `draft.contact.prospect.companyName` already in `getDecisionInbox` response                                       | Already included in include                       |
| Analysis extraction | Re-implementing analysis type guards | Cast content as `Record<string, unknown>`, check `version === 'analysis-v2'` per `master-analyzer.ts:113` pattern | Already validated in codebase                     |

---

## Common Pitfalls

### Pitfall 1: cadence_draft Missing prospectId on OutreachLog

**What goes wrong:** `processDueCadenceSteps` creates `OutreachLog` with only `contactId` — no `prospectId`. The `getDecisionInbox` accesses `draft.contact.prospectId` via join, not direct column. `getDraftsForProspect` queries `prospectId` directly on OutreachLog (direct column). Cadence drafts would be invisible in `getDraftsForProspect`.

**Why it happens:** Phase 56 (PIPE-05) added `prospectId` denormalization to `OutreachLog` and set it on intro drafts (`generateIntroDraft` sets `prospectId` directly). But `processDueCadenceSteps` never sets `prospectId`. Same issue for `processSignal` in `processor.ts`.

**How to avoid:** In Plan 59-01, when creating the cadence OutreachLog, add `prospectId: step.sequence.prospectId` to the create call. In the same plan or a note to the planner, flag that `processSignal` in `processor.ts` also does not set `prospectId` on the OutreachLog — that should be fixed simultaneously.

**Warning signs:** `getDraftsForProspect` returns empty for prospects with only cadence/signal drafts.

### Pitfall 2: ProspectAnalysis content is Prisma Json — needs type narrowing

**What goes wrong:** `analysis.content` is typed as `Prisma.JsonValue` which is `null | string | number | boolean | object | array`. Direct property access fails TypeScript checks.

**Why it happens:** Prisma Json fields always return `JsonValue`, not concrete types.

**How to avoid:** Cast to `Record<string, unknown>` after null check, then check `content.version === 'analysis-v2'` before accessing `sections` and `executiveSummary`. Follow the existing pattern in `master-analyzer.ts` line 113.

### Pitfall 3: Date grouping shows "Vandaag" for all old drafts

**What goes wrong:** The queue currently shows all unreviewed drafts regardless of age. Grouping by `createdAt` with today/tomorrow labels would show most existing drafts under their creation date, not a "send today" label.

**Why it happens:** Drafts accumulate over time; they don't have a `scheduledSendAt` field. There is no field representing "when should this be sent."

**How to avoid:** For now, treat all drafts as "ready to send" — group by actual date, sorted oldest-first. The "Vandaag" label means "created today (review now)." Drafts from previous days show their creation date. Do NOT add a `scheduledSendAt` column in Phase 59 (no schema change needed per success criteria).

### Pitfall 4: generateFollowUp evidence enrichment causes AI errors on missing analysis

**What goes wrong:** If a prospect has no ProspectAnalysis (e.g., Klarifai prospects vs Atlantis prospects), loading evidence from analysis fails silently or throws.

**Why it happens:** `ProspectAnalysis` is optional — not all research runs produce one if `generateMasterAnalysis` was not called.

**How to avoid:** Always default `evidenceItems = []` and wrap the ProspectAnalysis load in try/catch or optional chaining. The existing fallback in `processDueCadenceSteps` (`bodyText = ''` on error) already handles AI failures — just ensure the context building never throws.

### Pitfall 5: Prospect link in draft card needs stopPropagation

**What goes wrong:** The draft row is a `<button>` that toggles expansion. A `<Link>` inside it would trigger both the expand toggle and navigation.

**Why it happens:** Nested interactive elements — button contains Link.

**How to avoid:** Use `onClick={(e) => e.stopPropagation()}` on the `<Link>` wrapper, or restructure the row to use `<div>` with `role="button"` pattern like outreach settings cards.

---

## Code Examples

Verified patterns from existing codebase:

### Loading ProspectAnalysis in cadence engine

```typescript
// Source: prisma/schema.prisma — ProspectAnalysis has prospectId index
const analysis = await db.prospectAnalysis.findFirst({
  where: { prospectId: step.sequence.prospectId },
  orderBy: { createdAt: 'desc' },
  select: { content: true },
});
const content = analysis?.content as Record<string, unknown> | null;
// Version guard pattern from master-analyzer.ts:113
if (content?.version === 'analysis-v2') {
  // safe to access content.sections, content.executiveSummary
}
```

### Reading recent signals for cadence context

```typescript
// Source: prisma/schema.prisma — Signal has prospectId index
const recentSignals = await db.signal.findMany({
  where: {
    prospectId: step.sequence.prospectId,
    detectedAt: { gte: new Date(Date.now() - 30 * 86400000) },
  },
  orderBy: { detectedAt: 'desc' },
  take: 1,
  select: { signalType: true, title: true, description: true },
});
const latestSignal = recentSignals[0];
// Use in OutreachContext.signal if present
```

### Setting prospectId on cadence OutreachLog

```typescript
// Source: lib/outreach/generate-intro.ts:178 — intro draft already sets prospectId
newLog = await db.outreachLog.create({
  data: {
    contactId,
    prospectId: step.sequence.prospectId, // ADD THIS — fixes getDraftsForProspect
    type: 'FOLLOW_UP',
    channel: 'email',
    status: 'draft',
    // ... rest of fields
  },
});
```

### Dutch date header formatting

```typescript
// Source: app/admin/outreach/page.tsx:415 — existing nl-NL locale pattern
const label = date.toLocaleDateString('nl-NL', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
});
// Result: "woensdag 18 mrt" — capitalize first letter manually
```

### Draft kind chip in queue UI

```typescript
// Source: classifyDraftRisk in outreach.ts:109 — kind values
const KIND_LABELS: Record<string, string> = {
  intro_draft: 'Intro',
  cadence_draft: 'Follow-up',
  signal_draft: 'Signaal',
};
const kind = (draft.metadata as Record<string, unknown>)?.kind as
  | string
  | undefined;
const label = kind ? (KIND_LABELS[kind] ?? kind) : 'Email';
```

---

## State of the Art

| Old Approach                                    | Current Approach                             | When Changed | Impact                                          |
| ----------------------------------------------- | -------------------------------------------- | ------------ | ----------------------------------------------- |
| Template-based WorkflowLossMap drafts           | AI-generated intro/follow-up/signal drafts   | Phase 56     | All three draft kinds now AI-generated          |
| Signal table empty (dead code)                  | Signals populated from evidence diffs        | Phase 57     | Signal-triggered drafts now functional          |
| generateMasterAnalysis v1                       | `KlarifaiNarrativeAnalysis` v2 (Gemini)      | Phase 55/56  | Analysis has `executiveSummary` + `sections`    |
| Cadence follow-ups use minimal company context  | (Phase 59 target) evidence-enriched context  | Phase 59     | Follow-ups reference actual pain points         |
| Flat draft queue, no date grouping              | (Phase 59 target) date-grouped with headers  | Phase 59     | Queue feels like a scheduled inbox              |
| Prospect detail shows "view in queue" link only | (Phase 59 target) full outreach status panel | Phase 59     | Admin can see outreach stage from prospect page |

**Important upstream fact:** `processDueCadenceSteps` generates follow-ups but the `buildCadenceOutreachContext` function (lines 305-343 of `engine.ts`) builds a minimal context — `contact` and `company` fields only. No `evidence`, no `hypotheses`, no `signal`. This is the specific gap CDNC-02 targets.

**Cadence reply-pause:** Already implemented. `applyReplyTriage` in `reply-workflow.ts` sets sequence status to `CLOSED_LOST` or `REPLIED` on reply. `evaluateCadence` checks for pending steps before creating a new one. Nothing in Phase 59 touches this path.

---

## Open Questions

1. **Should `processSignal` in `processor.ts` also set `prospectId` on OutreachLog?**
   - What we know: Signal-triggered drafts from `processor.ts` do not set `prospectId` (only `contactId`). Intro drafts from `generate-intro.ts` do set `prospectId` (PIPE-05, Phase 56).
   - What's unclear: Whether signal drafts should also appear in `getDraftsForProspect`.
   - Recommendation: Yes — fix `processSignal` to set `prospectId` in Plan 59-01 alongside the cadence fix. One-line change, same root cause.

2. **Date grouping: `createdAt` or a new `scheduledSendAt` field?**
   - What we know: No `scheduledSendAt` field exists on OutreachLog. Adding it requires a schema migration.
   - What's unclear: Whether the success criteria "groups by scheduled send date" means a new DB field or using `createdAt`.
   - Recommendation: Use `createdAt` as the proxy. Cadence drafts are created when they are due (checked by `nextStepReadyAt <= now`), so `createdAt` accurately represents "ready to send at this date." No schema change needed.

3. **Prospect detail link: direct `/admin/outreach` link or filtered view?**
   - What we know: The outreach queue has no URL-based filter. Linking to `/admin/outreach` shows all drafts.
   - What's unclear: Whether PIPE-04 requires per-prospect filtering in the queue URL.
   - Recommendation: Link to `/admin/outreach` generically from prospect detail. The prospect detail shows a count of pending drafts as the primary status indicator — the link is secondary navigation, not a filtered view. Filtered queue is deferred complexity.

---

## Sources

### Primary (HIGH confidence)

- Full read of `lib/cadence/engine.ts` — cadence draft creation, `buildCadenceOutreachContext`, `processDueCadenceSteps`
- Full read of `lib/outreach/generate-intro.ts` — `generateIntroDraft`, `prospectId` on OutreachLog pattern
- Full read of `lib/automation/processor.ts` — signal draft creation (missing `prospectId`)
- Full read of `server/routers/outreach.ts` — `getDecisionInbox`, `approveDraft`, `getDraftsForProspect`
- Full read of `app/admin/outreach/page.tsx` — `DraftQueue`, current rendering
- Full read of `components/features/prospects/outreach-preview-section.tsx` — current status panel
- Full read of `lib/ai/outreach-prompts.ts` — `OutreachContext`, `buildFollowUpPrompt` evidence usage
- Full read of `lib/analysis/types.ts` — `KlarifaiNarrativeAnalysis`, `NarrativeSection` shapes
- Full read of `prisma/schema.prisma` — `OutreachLog`, `ProspectAnalysis`, `Signal` models

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — requirements PIPE-02 through CDNC-04 definitions
- `.planning/STATE.md` — accumulated architectural decisions from v8.0 phases

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries already in project, no new dependencies
- Architecture: HIGH — all modification targets identified, patterns from existing code
- Pitfalls: HIGH — gaps identified by reading actual code (missing `prospectId` on cadence/signal drafts confirmed)

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable codebase, no fast-moving dependencies)

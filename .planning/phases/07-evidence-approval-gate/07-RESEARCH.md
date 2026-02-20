# Phase 7: Evidence Approval Gate - Research

**Researched:** 2026-02-20
**Domain:** Prisma schema extension, tRPC mutation gate pattern, existing hypothesis workflow, admin UI review flow
**Confidence:** HIGH

---

## Summary

Phase 7 adds a "Hypothesis" concept that pairs each `WorkflowHypothesis` with its matched use cases (via `ProofMatch`) and supporting `EvidenceItem` records, exposes that pairing in a dedicated admin review UI, and blocks `OutreachSequence` generation until at least one hypothesis has been approved.

The key insight from reading the codebase: **Phase 7 does not need a new DB model.** The schema already has everything required. `WorkflowHypothesis` has a `status HypothesisStatus` field with enum values `DRAFT | ACCEPTED | REJECTED`. `ProofMatch` already links to `WorkflowHypothesis` via `workflowHypothesisId` and to `UseCase` via `useCaseId`. `EvidenceItem` links to `ProofMatch` via `evidenceItemId`. The `hypothesesRouter` already has `listByProspect` (returns hypotheses with `proofMatches` included) and `setStatus` (approve/reject). The term "hypothesis" in the requirements maps directly to `WorkflowHypothesis` — no new table, no rename.

The only new backend work is: (1) a guard in `assets.queueOutreachDraft` (and `campaigns.runAutopilot`) that throws `TRPCError({ code: 'PRECONDITION_FAILED' })` if no `WorkflowHypothesis` with `status: 'ACCEPTED'` exists for the prospect, and (2) enriching `hypotheses.listByProspect` to include `evidenceItem` data for the review UI. The majority of Phase 7 is UI work: a dedicated `/admin/hypotheses` list page and an enhanced review tab in the prospect detail page.

The "AI generates hypothesis" requirement (HYPO-01) is already satisfied by `generateHypothesisDrafts()` in `lib/workflow-engine.ts` + `hypotheses.regenerateForRun`. The gap is that the current `regenerateForRun` mutation does not call `matchProofs()` to attach use case matches — it creates `WorkflowHypothesis` rows but no `ProofMatch` rows. Phase 7 must fix this so the review UI can display matched use cases alongside each hypothesis.

**Primary recommendation:** Wire `matchProofs()` inside `hypotheses.regenerateForRun`, add an evidence-backed hypothesis gate to `assets.queueOutreachDraft` and `campaigns.runAutopilot`, build `/admin/hypotheses/[id]/page.tsx` as the review UI, and enhance the `HypothesesTab` in the prospect detail page to show evidence sources and use case matches.

---

## Standard Stack

### Core (all already installed — no new npm installs required)

| Library             | Version   | Purpose                                     | Why Standard                |
| ------------------- | --------- | ------------------------------------------- | --------------------------- |
| `prisma`            | `^7.3.0`  | Schema query, Prisma Client                 | Already used for all models |
| `@prisma/client`    | `^7.3.0`  | DB queries in tRPC routers                  | Already used everywhere     |
| `zod`               | `^4.3.6`  | Input validation in tRPC procedures         | Already used in all routers |
| `@trpc/server`      | `11.9.0`  | Router/procedure definition, TRPCError      | Already used in all routers |
| `@anthropic-ai/sdk` | `^0.73.0` | Claude semantic scoring via `matchProofs()` | Already wired in Phase 6    |

### No New Dependencies Required

This phase is pure wiring + UI — no npm installs needed. The gate pattern uses existing `TRPCError` from `@trpc/server`.

**Installation:**

```bash
# No new packages — everything already in package.json
```

---

## Architecture Patterns

### Recommended Project Structure

```
server/routers/
├── hypotheses.ts          # MODIFIED: regenerateForRun wires matchProofs(), listByProspect includes evidenceItem
├── assets.ts              # MODIFIED: queueOutreachDraft adds approved hypothesis gate
├── campaigns.ts           # MODIFIED: runAutopilot already has gate logic; add hypothesis gate
app/admin/
├── hypotheses/            # NEW: standalone hypothesis review page
│   └── page.tsx
├── prospects/[id]/
│   └── page.tsx           # MODIFIED: HypothesesTab enriched with evidence + use case display
```

No new Prisma model needed. No migration needed. The schema is already complete.

### Pattern 1: Approved Hypothesis Gate in tRPC Mutations

**What:** Before creating an `OutreachSequence`, check that at least one `WorkflowHypothesis` with `status: 'ACCEPTED'` exists for the prospect. Throw `TRPCError({ code: 'PRECONDITION_FAILED' })` if not.

**When to use:** Any mutation that generates or queues outreach — `assets.queueOutreachDraft` and `campaigns.runAutopilot`.

**Example:**

```typescript
// Source: assets.ts pattern — already has a gate for research quality
// The approved hypothesis gate follows the same throw pattern

async function assertApprovedHypothesisExists(
  db: PrismaClient,
  prospectId: string,
): Promise<void> {
  const count = await db.workflowHypothesis.count({
    where: {
      prospectId,
      status: 'ACCEPTED',
    },
  });
  if (count === 0) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message:
        'Outreach blocked: approve at least one hypothesis before generating sequences.',
    });
  }
}

// Call inside assets.queueOutreachDraft before sequence creation:
await assertApprovedHypothesisExists(ctx.db, map.prospect.id);

// Call inside campaigns.runAutopilot per-prospect loop, surfaced as status:
const approvedCount = await ctx.db.workflowHypothesis.count({
  where: { prospectId: prospect.id, status: 'ACCEPTED' },
});
if (approvedCount === 0) {
  results.push({
    prospectId: prospect.id,
    company,
    status: 'blocked_hypothesis',
    detail: 'No approved hypothesis — approve at least one before outreach',
  });
  continue;
}
```

**Critical:** `assets.queueOutreachDraft` is the primary gate for manual outreach queueing. `campaigns.runAutopilot` loops per-prospect — add the check inside the per-prospect `try` block and surface it as a new `'blocked_hypothesis'` result status (same pattern as `'blocked_gate'` and `'no_contact'`).

### Pattern 2: Enriching regenerateForRun with matchProofs()

**What:** After creating `WorkflowHypothesis` rows in `hypotheses.regenerateForRun`, call `matchProofs()` for each hypothesis and create `ProofMatch` records linking the hypothesis to use cases.

**When to use:** Inside `hypotheses.regenerateForRun`, after the hypothesis create loop.

**Example:**

```typescript
// Source: server/routers/hypotheses.ts — regenerateForRun
// Source: server/routers/proof.ts lines 31, 57 — existing matchProofs call pattern

import { matchProofs } from '@/lib/workflow-engine';

// After creating each hypothesis:
for (const hypothesis of hypotheses) {
  const created = await ctx.db.workflowHypothesis.create({ data: { ... } });

  // NEW: Match use cases and create ProofMatch records
  const matches = await matchProofs(
    ctx.db,
    `${hypothesis.title} ${hypothesis.problemStatement}`,
    4,
  );
  for (const match of matches) {
    await ctx.db.proofMatch.create({
      data: {
        prospectId: run.prospectId,
        workflowHypothesisId: created.id,
        sourceType: match.sourceType,
        proofId: match.proofId,
        proofTitle: match.proofTitle,
        proofSummary: match.proofSummary,
        proofUrl: match.proofUrl,
        score: match.score,
        isRealShipped: match.isRealShipped,
        isCustomPlan: match.isCustomPlan,
        useCaseId: match.isCustomPlan ? undefined : match.proofId,
      },
    });
  }
}
```

**Note:** The `campaigns.runAutopilot` already does this exact pattern for its proof matching step (lines 277–302 in campaigns.ts). Copy that pattern verbatim.

### Pattern 3: Enriched listByProspect with Evidence Sources

**What:** Update `hypotheses.listByProspect` to include `evidenceItem` data on `ProofMatch` records and the full `EvidenceItem` snippets for the hypothesis's `evidenceRefs` JSON field.

**When to use:** The review UI needs to display supporting evidence alongside each hypothesis.

**Example:**

```typescript
// Source: server/routers/hypotheses.ts — listByProspect
// BEFORE: proofMatches: true (includes all ProofMatch fields)
// AFTER:
proofMatches: {
  include: {
    useCase: {
      select: { id: true, title: true, summary: true, category: true },
    },
    evidenceItem: {
      select: { id: true, sourceUrl: true, snippet: true, sourceType: true, workflowTag: true },
    },
  },
  orderBy: { score: 'desc' },
  take: 6,
},
```

Plus a new query to fetch evidence items by the `evidenceRefs` JSON array (which stores EvidenceItem IDs):

```typescript
// In listByProspect, after fetching hypotheses:
// Collect all evidenceRef IDs from hypotheses' evidenceRefs JSON field
// Then fetch those EvidenceItem records in a single query
const allEvidenceIds = hypotheses.flatMap((h) =>
  Array.isArray(h.evidenceRefs) ? (h.evidenceRefs as string[]) : [],
);
const evidenceMap =
  allEvidenceIds.length > 0
    ? await ctx.db.evidenceItem.findMany({
        where: { id: { in: allEvidenceIds } },
        select: {
          id: true,
          sourceUrl: true,
          snippet: true,
          sourceType: true,
          workflowTag: true,
          title: true,
        },
      })
    : [];
```

Return shape for each hypothesis:

```typescript
{
  ...hypothesis,
  proofMatches: [...], // with useCase and evidenceItem included
  evidenceItems: evidenceMap.filter(e => (hypothesis.evidenceRefs as string[]).includes(e.id)),
}
```

### Pattern 4: Hypothesis Review UI Page

**What:** `/admin/hypotheses/page.tsx` — a `'use client'` list page showing all hypotheses across all prospects, filterable by status. Each card shows: hypothesis title, problem statement, matched use cases (from ProofMatch), evidence sources, and approve/reject buttons.

**When to use:** New standalone admin review screen for Phase 7.

**Example structure (follows app/admin/use-cases/page.tsx pattern):**

```typescript
'use client';

import { api } from '@/components/providers';
// No new imports needed — CheckCircle2, XCircle, Eye from lucide-react (already used in project)

export default function HypothesesReviewPage() {
  // Filter state: 'all' | 'DRAFT' | 'ACCEPTED' | 'REJECTED'
  const [statusFilter, setStatusFilter] = useState<string>('DRAFT');

  // Fetches all prospects with hypothesis data
  // Option A: new hypotheses.listAll procedure (simple DB query across all prospects)
  // Option B: use existing hypotheses.listByProspect per prospect (requires prospect list)
  // Recommendation: add hypotheses.listAll adminProcedure for the standalone page

  const setStatus = api.hypotheses.setStatus.useMutation({
    onSuccess: () => utils.hypotheses.listAll.invalidate(),
  });
```

**Key design decision:** A new `hypotheses.listAll` procedure is simpler than calling `listByProspect` for each prospect. It fetches `workflowHypothesis.findMany` with prospect and proofMatch includes — no nested per-prospect loop.

### Pattern 5: Enhanced HypothesesTab in Prospect Detail

**What:** The existing `HypothesesTab` in `app/admin/prospects/[id]/page.tsx` already shows hypotheses with approve/reject buttons. Enhance it to show matched use cases and evidence snippets from `listByProspect`'s new include structure.

**When to use:** Prospect detail view — the primary review surface for a single prospect's hypotheses.

**Example enhancement (within existing HypothesesTab function):**

```typescript
// Each hypothesis card expansion:
{item.proofMatches?.length > 0 && (
  <div className="mt-3 pt-3 border-t border-slate-100">
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
      Matched Use Cases
    </p>
    {item.proofMatches.map((match: any) => (
      <div key={match.id} className="flex items-center gap-2 text-xs text-slate-600 mb-1">
        <span className="text-emerald-600 font-bold">{match.score.toFixed(2)}</span>
        <span>{match.useCase?.title ?? match.proofTitle}</span>
      </div>
    ))}
  </div>
)}
{item.evidenceItems?.length > 0 && (
  <div className="mt-3 pt-3 border-t border-slate-100">
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
      Supporting Evidence
    </p>
    {item.evidenceItems.map((ev: any) => (
      <div key={ev.id} className="text-xs text-slate-500 mb-1">
        <a href={ev.sourceUrl} target="_blank" className="text-klarifai-blue hover:underline">
          {ev.title ?? ev.sourceUrl}
        </a>
        {': '}{ev.snippet.slice(0, 120)}…
      </div>
    ))}
  </div>
)}
```

### Anti-Patterns to Avoid

- **Adding a new `Hypothesis` model:** `WorkflowHypothesis` is the model. Do not create a parallel model. The enum is already `HypothesisStatus { DRAFT, ACCEPTED, REJECTED }`.
- **Gating only on hypothesis existence (not approval):** The gate must check `status: 'ACCEPTED'`, not just existence of any `WorkflowHypothesis`. A prospect with only DRAFT or REJECTED hypotheses must be blocked.
- **Throwing `Error` instead of `TRPCError`:** The existing gate in `assets.ts` (line 101) throws a plain `Error`. For Phase 7's gate, use `TRPCError({ code: 'PRECONDITION_FAILED' })` so the client receives a structured error response with the correct HTTP status code and can display a meaningful message. (Note: the existing `Error` throw on line 101 is a pre-existing pattern inconsistency — match the pattern in `server/trpc.ts` which uses `TRPCError`.)
- **Blocking `assets.generate` (loss map generation) with the gate:** The gate applies to **sequence generation and outreach queueing** only (`assets.queueOutreachDraft`, `campaigns.runAutopilot`). Loss map generation (`assets.generate`) may remain ungated — it only requires hypotheses to exist, not to be approved. This matches success criterion 4 precisely.
- **Fetching evidence for every hypothesis in N+1 queries:** Collect all `evidenceRefs` IDs first, then fetch in a single `evidenceItem.findMany({ where: { id: { in: allIds } } })`. Do not loop per hypothesis.
- **Displaying `proofId` as the use case reference when `useCaseId` is set:** When rendering matched use cases, prefer `match.useCase?.title` over `match.proofTitle`. The `proofTitle` is denormalized and may be stale if the use case title was edited.

---

## Don't Hand-Roll

| Problem                      | Don't Build            | Use Instead                                                                     | Why                                                                           |
| ---------------------------- | ---------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Outreach gate enforcement    | Custom middleware      | `TRPCError({ code: 'PRECONDITION_FAILED' })` in mutation body                   | Exact pattern used in `adminProcedure` middleware in trpc.ts                  |
| Hypothesis status tracking   | New status field/table | Existing `HypothesisStatus` enum on `WorkflowHypothesis`                        | Already DRAFT/ACCEPTED/REJECTED — no migration needed                         |
| Use case matching for review | Custom scoring logic   | Existing `matchProofs(db, query, limit)` from Phase 6                           | Already wired — just call it in regenerateForRun                              |
| Evidence display             | Custom evidence fetch  | Include `evidenceItem` in `proofMatches` include + bulk fetch by `evidenceRefs` | Already stored in `EvidenceItem` table linked via `ProofMatch.evidenceItemId` |
| Status filter in review list | Custom query builder   | Prisma `where: { status: input.status }`                                        | Standard Prisma filter — no abstraction needed                                |

**Key insight:** Phase 7 is almost entirely wiring and UI. The schema, the status enum, the matching engine, and the approval mutation (`hypotheses.setStatus`) all exist. The work is connecting them and surfacing them in a dedicated review UI.

---

## Common Pitfalls

### Pitfall 1: regenerateForRun Does Not Currently Call matchProofs()

**What goes wrong:** The current `hypotheses.regenerateForRun` creates `WorkflowHypothesis` and `AutomationOpportunity` rows but does NOT create `ProofMatch` records. The existing `HypothesesTab` shows hypotheses without any matched use cases. If Phase 7 builds a review UI that displays `proofMatches`, it will always show empty results until this is fixed.

**Why it happens:** `regenerateForRun` was written before Phase 6 established the DB-backed `matchProofs()`. The proof matching was done separately via `api.proof.matchForRun` (a separate button in the Research tab UI).

**How to avoid:** Add `matchProofs()` calls inside `regenerateForRun` after creating each `WorkflowHypothesis`. Delete existing `ProofMatch` rows for the hypothesis before recreating (same pattern as `proof.matchForRun` in proof.ts lines 35–46).

**Warning signs:** Review UI shows "No matched use cases" for all hypotheses even after running research.

### Pitfall 2: Gate Applied to Loss Map Generation Instead of Outreach

**What goes wrong:** Phase 7 requirement says "outreach is blocked until at least one hypothesis is approved." If the gate is mistakenly placed on `assets.generate` (loss map generation), the admin cannot generate a loss map without approving first — breaking the workflow order: Research → Generate Loss Map → Approve Hypothesis → Queue Outreach.

**Why it happens:** Confusion between "generating outreach content" (loss map) and "queueing outreach to send" (sequence).

**How to avoid:** Read the success criterion carefully: "Attempting to generate or send outreach for a prospect with no approved hypothesis is blocked." The correct gate points are `assets.queueOutreachDraft` and `campaigns.runAutopilot`. Do not touch `assets.generate`.

**Warning signs:** Admin cannot generate a loss map for a prospect with only DRAFT hypotheses — should be possible.

### Pitfall 3: Gate Not Added to runAutopilot Per-Prospect Loop

**What goes wrong:** Adding the gate only to `assets.queueOutreachDraft` (manual flow) but missing `campaigns.runAutopilot` (automated batch flow). Autopilot then generates sequences for prospects with no approved hypotheses.

**Why it happens:** `runAutopilot` is a complex function (500+ lines) with its own gate chain (`blocked_gate`, `no_hypotheses`, `no_contact`). The hypothesis approval gate is a new addition to this chain.

**How to avoid:** Add the gate as the first check after the research gate in `runAutopilot`'s per-prospect loop. The result status should be `'blocked_hypothesis'` (new status value) so the autopilot summary can report it. Update the result type union to include this new status.

**Warning signs:** `runAutopilot` returns `completed` for prospects where no hypothesis was ever approved.

### Pitfall 4: HypothesesTab Data Shape Mismatch After Include Enrichment

**What goes wrong:** The existing `HypothesesTab` receives `data: any` and accesses `data.hypotheses` and `data.opportunities`. After enriching `listByProspect` to include `evidenceItems`, the return shape changes. If the UI component accesses fields that were not previously in the shape, TypeScript's `any` cast hides errors but runtime failures occur.

**Why it happens:** The prospect detail page uses `as any` extensively (acknowledged in the code with `// eslint-disable-next-line @typescript-eslint/no-explicit-any`). This suppresses TS errors but allows runtime shape mismatches.

**How to avoid:** When adding `evidenceItems` to the `listByProspect` return, add it to a separate key at the hypothesis level (e.g., `hypothesis.evidenceItems: EvidenceItem[]`). The UI accesses it as `item.evidenceItems ?? []`. Test the data shape by logging it in the browser console after the change.

**Warning signs:** `Cannot read properties of undefined (reading 'slice')` or similar runtime errors in HypothesesTab after enrichment.

### Pitfall 5: Standalone Hypotheses Page Requires a New listAll Procedure

**What goes wrong:** The standalone `/admin/hypotheses` page needs to fetch hypotheses across ALL prospects, but `hypotheses.listByProspect` requires a `prospectId`. If the page tries to call `listByProspect` without a prospect ID (or loops over all prospects), it either throws a Zod validation error or fires N queries.

**Why it happens:** `listByProspect` was designed for the per-prospect detail view. A list-all view requires a different query.

**How to avoid:** Add `hypotheses.listAll` to the router — a simple `workflowHypothesis.findMany` with `prospect: { select: { companyName, domain } }` included, filtered by optional `status` input. This is a 20-line addition to `server/routers/hypotheses.ts`.

**Warning signs:** TypeScript error "Required field prospectId missing" when calling `listByProspect` without the ID.

### Pitfall 6: evidenceRefs is JSON, Not a Prisma Relation

**What goes wrong:** `WorkflowHypothesis.evidenceRefs` is stored as `Json?` (an array of EvidenceItem IDs as strings), not as a Prisma relation. You cannot use `include: { evidenceRefs: true }` — that will throw a Prisma compile error. The IDs must be extracted from the JSON value and used in a separate `evidenceItem.findMany`.

**Why it happens:** The original schema stored evidence references as a JSON array rather than a join table, likely for flexibility. This is the established pattern in the codebase.

**How to avoid:** In `listByProspect`, after fetching hypotheses, extract all evidence IDs from `h.evidenceRefs` JSON fields, deduplicate, and fetch in one `evidenceItem.findMany({ where: { id: { in: allIds } } })`. Return the results as a separate `evidenceItems` map grouped by hypothesis ID.

**Warning signs:** `The provided path is not valid for Prisma Client. It must start with a valid relation` TypeScript error when trying to include `evidenceRefs`.

---

## Code Examples

Verified patterns from the existing codebase:

### TRPCError Throw Pattern (from server/trpc.ts)

```typescript
// Source: server/trpc.ts — adminProcedure middleware
import { TRPCError } from '@trpc/server';

throw new TRPCError({
  code: 'PRECONDITION_FAILED',
  message:
    'Outreach blocked: approve at least one hypothesis before generating sequences.',
});
```

### Hypothesis Approval Check Query

```typescript
// Source: prisma/schema.prisma — WorkflowHypothesis.status is HypothesisStatus enum
// HypothesisStatus { DRAFT, ACCEPTED, REJECTED }

const approvedCount = await ctx.db.workflowHypothesis.count({
  where: {
    prospectId: prospectId,
    status: 'ACCEPTED',
  },
});
```

### ProofMatch Create with useCaseId (from campaigns.ts lines 287–302)

```typescript
// Source: server/routers/campaigns.ts — runAutopilot proof matching loop
await ctx.db.proofMatch.create({
  data: {
    prospectId: prospect.id,
    workflowHypothesisId: hypothesis.id,
    sourceType: match.sourceType,
    proofId: match.proofId,
    proofTitle: match.proofTitle,
    proofSummary: match.proofSummary,
    proofUrl: match.proofUrl,
    score: match.score,
    isRealShipped: match.isRealShipped,
    isCustomPlan: match.isCustomPlan,
    useCaseId: match.isCustomPlan ? undefined : match.proofId,
  },
});
```

### Existing setStatus Mutation (from server/routers/hypotheses.ts)

```typescript
// Source: server/routers/hypotheses.ts lines 37–56
// Already exists — Phase 7 UI calls this exact procedure
setStatus: adminProcedure
  .input(
    z.object({
      kind: z.enum(['hypothesis', 'opportunity']),
      id: z.string(),
      status: z.enum(['DRAFT', 'ACCEPTED', 'REJECTED']),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    if (input.kind === 'hypothesis') {
      return ctx.db.workflowHypothesis.update({
        where: { id: input.id },
        data: { status: input.status },
      });
    }
    // ...
  });
```

### Gate Check in assets.ts (existing pattern to extend)

```typescript
// Source: server/routers/assets.ts lines 96–103 — research quality gate
const strictGateEnabled = run.campaign?.strictGate ?? true;
if (strictGateEnabled) {
  const gate = extractGateFromSummary(run.summary);
  if (!gate?.passed) {
    const reasons =
      gate?.reasons?.join('; ') ?? 'evidence quality gate not met';
    throw new Error(`Cannot generate assets before gate passes: ${reasons}`);
  }
}
// EXTEND: After this block, add the hypothesis approval gate:
await assertApprovedHypothesisExists(ctx.db, run.prospectId);
```

### Evidence Refs JSON Extraction Pattern

```typescript
// Source: server/routers/hypotheses.ts — evidenceRefs stored as Json?
// Extract IDs from JSON array and bulk-fetch EvidenceItems

const allEvidenceIds = [
  ...hypotheses.flatMap((h) =>
    Array.isArray(h.evidenceRefs) ? (h.evidenceRefs as string[]) : [],
  ),
  ...opportunities.flatMap((o) =>
    Array.isArray(o.evidenceRefs) ? (o.evidenceRefs as string[]) : [],
  ),
];

const dedupedIds = [...new Set(allEvidenceIds)];

const evidenceItems =
  dedupedIds.length > 0
    ? await ctx.db.evidenceItem.findMany({
        where: { id: { in: dedupedIds } },
        select: {
          id: true,
          sourceUrl: true,
          title: true,
          snippet: true,
          sourceType: true,
          workflowTag: true,
          confidenceScore: true,
        },
      })
    : [];

const evidenceById = new Map(evidenceItems.map((e) => [e.id, e]));

// Per hypothesis:
const hypothesesWithEvidence = hypotheses.map((h) => ({
  ...h,
  evidenceItems: (Array.isArray(h.evidenceRefs)
    ? (h.evidenceRefs as string[])
    : []
  )
    .map((id) => evidenceById.get(id))
    .filter(Boolean),
}));
```

### New hypotheses.listAll Procedure Pattern

```typescript
// Source: follows hypotheses.listByProspect pattern in server/routers/hypotheses.ts

listAll: adminProcedure
  .input(
    z.object({
      status: z.enum(['DRAFT', 'ACCEPTED', 'REJECTED']).optional(),
      limit: z.number().min(1).max(200).default(100),
    }).optional(),
  )
  .query(async ({ ctx, input }) => {
    const hypotheses = await ctx.db.workflowHypothesis.findMany({
      where: input?.status ? { status: input.status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: input?.limit ?? 100,
      include: {
        prospect: {
          select: { id: true, companyName: true, domain: true },
        },
        proofMatches: {
          include: {
            useCase: {
              select: { id: true, title: true, category: true },
            },
          },
          orderBy: { score: 'desc' },
          take: 4,
        },
      },
    });
    return hypotheses;
  }),
```

---

## State of the Art

| Old Approach                                              | Current Approach                                                            | When Changed | Impact                                                            |
| --------------------------------------------------------- | --------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------- |
| Hypothesis review only on prospect detail page            | Dedicated `/admin/hypotheses` review list (Phase 7)                         | Phase 7      | Admin can batch-review hypotheses across all prospects            |
| regenerateForRun creates hypotheses without proof matches | regenerateForRun also calls matchProofs() (Phase 7)                         | Phase 7      | Review UI can show matched use cases immediately after generation |
| Outreach generation not gated on hypothesis approval      | `queueOutreachDraft` + `runAutopilot` gate on ACCEPTED hypothesis (Phase 7) | Phase 7      | Prevents sending evidence-free outreach sequences                 |

**Already complete (no change needed in Phase 7):**

- `WorkflowHypothesis.status` enum: already `DRAFT | ACCEPTED | REJECTED`
- `hypotheses.setStatus`: already wired; the existing approve/reject buttons in HypothesesTab call it
- `ProofMatch` schema with `workflowHypothesisId`, `useCaseId`, `evidenceItemId`: all present and indexed

---

## Open Questions

1. **Should loss map generation (`assets.generate`) also be gated on hypothesis approval?**
   - What we know: Success criterion 4 says "generate or send outreach" is blocked. Loss map is outreach content.
   - What's unclear: Whether the admin workflow expects to generate the loss map before or after approving hypotheses. The existing `assets.generate` already gates on the research quality gate (`gate.passed`).
   - Recommendation: Do NOT gate `assets.generate` on hypothesis approval. The loss map is a review artifact that the admin may use to decide which hypothesis to approve. Gate only `assets.queueOutreachDraft` and `campaigns.runAutopilot`. This matches the phrasing "generate or send outreach for a prospect" — loss map generation is content creation, not outreach dispatch.

2. **Should the `/admin/hypotheses` page be a standalone list or redirect to prospect detail?**
   - What we know: The prospect detail page already has a HypothesesTab. A standalone page would require `hypotheses.listAll` (new procedure).
   - What's unclear: How much of the review UI should be inline vs. deep-linked.
   - Recommendation: Build the standalone `/admin/hypotheses` page as a filterable list with inline approve/reject buttons (no separate detail page needed). Each row links to the prospect detail for full context. This matches the pattern of `/admin/research` which shows all research runs with direct actions.

3. **Should `runAutopilot` skip gating if run in `dryRun` mode?**
   - What we know: `runAutopilot` has `dryRun: boolean` that short-circuits before any actual work. The `blocked_gate` status is only added when `dryRun: false`.
   - What's unclear: Whether the hypothesis gate should appear in dry-run output as a preview of what would happen.
   - Recommendation: Include the hypothesis check in dry-run output as `'blocked_hypothesis'` — it helps the admin see which prospects need hypothesis approval before running live. This is low-risk: the dry-run result type already has an open union for status values.

4. **What happens to outreach already queued when a hypothesis is retroactively rejected?**
   - What we know: The gate only prevents creating NEW sequences. Existing `OutreachSequence` records are not affected by hypothesis status changes.
   - What's unclear: Whether this is the intended behavior.
   - Recommendation: Do not retroactively block existing sequences. The gate is prospective only. Document this in the plan as an explicit design decision. If retroactive blocking is needed, it is a future Phase 9+ concern.

---

## Sources

### Primary (HIGH confidence — read directly from codebase)

- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/hypotheses.ts` — `listByProspect`, `setStatus`, `regenerateForRun` full implementations; `WorkflowHypothesis` field names confirmed
- `/home/klarifai/Documents/klarifai/projects/qualifai/prisma/schema.prisma` — `WorkflowHypothesis` model (lines 375–404), `HypothesisStatus` enum (lines 73–77), `ProofMatch` model (lines 436–465), `EvidenceItem` model (lines 350–373), `OutreachSequence` model (lines 522–547), `UseCase` model (lines 467–487)
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/assets.ts` — `queueOutreachDraft` mutation (lines 244–300), `generate` mutation (lines 41–177), existing research gate pattern (lines 96–103)
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/campaigns.ts` — `runAutopilot` mutation (lines 173–500), gate pattern with `blocked_gate` status, `matchProofs()` call pattern (lines 277–302, 305–331)
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/_app.ts` — router registration pattern
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/trpc.ts` — `TRPCError` usage, `adminProcedure` middleware
- `/home/klarifai/Documents/klarifai/projects/qualifai/app/admin/prospects/[id]/page.tsx` — `HypothesesTab` component (lines 853–954), `setHypothesisStatus` mutation call pattern, existing tab structure
- `/home/klarifai/Documents/klarifai/projects/qualifai/app/admin/layout.tsx` — nav structure, Intelligence group pattern
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/workflow-engine.ts` — `matchProofs(db, query, limit)` (lines 1031–1083), `generateHypothesisDrafts()` (lines 414–493), `HypothesisStatus` uses `HypothesisStatus` enum
- `/home/klarifai/Documents/klarifai/projects/qualifai/.planning/phases/06-use-cases-foundation/06-03-SUMMARY.md` — confirmed: matchProofs() wired, lazy Anthropic client, fallback pattern established
- `/home/klarifai/Documents/klarifai/projects/qualifai/.planning/phases/06-use-cases-foundation/06-VERIFICATION.md` — confirmed: Phase 6 complete, 17/17 truths verified

### Secondary (MEDIUM confidence — cross-reference within same codebase)

- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/proof.ts` — `matchForRun` mutation as reference for ProofMatch delete-then-recreate pattern
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/sequences.ts` — `OutreachSequence` query patterns

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages; confirmed in package.json and Phase 6 summaries
- Architecture: HIGH — `WorkflowHypothesis.status`, `ProofMatch`, `EvidenceItem`, `TRPCError` all read from source; gate pattern confirmed from assets.ts
- Pitfalls: HIGH — derived from direct code reading; `evidenceRefs` JSON pattern confirmed from schema; `regenerateForRun` gap confirmed by reading the full function
- UI patterns: HIGH — `HypothesesTab` read in full; admin layout nav pattern read in full; `'use client'` + `api.useUtils()` pattern confirmed

**Research date:** 2026-02-20
**Valid until:** 2026-03-22 (30 days — stack is stable; no external service changes)

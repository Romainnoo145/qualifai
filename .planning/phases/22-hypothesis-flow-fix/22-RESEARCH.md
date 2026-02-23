# Phase 22: Hypothesis Flow Fix — Research

**Researched:** 2026-02-23
**Domain:** tRPC mutation side-effects, Prisma updateMany, tRPC cache invalidation
**Confidence:** HIGH — the fix is fully identified in the codebase, no external libraries involved

---

## Summary

Phase 22 closes a single, surgical integration gap: the `approveQuality` mutation in `server/routers/research.ts` updates `ResearchRun.qualityApproved` but never transitions associated `workflowHypothesis` records from `DRAFT` to `PENDING`. The consequence is that the /voor/ dashboard query (which filters for `status IN ['ACCEPTED', 'PENDING']`) returns zero rows, so the validation section never renders and the prospect cannot confirm or decline hypotheses.

The fix is three lines of Prisma code added inside `approveQuality`: a conditional `workflowHypothesis.updateMany` that fires only when `input.approved === true`. All consuming code — the /voor/ page query, the `DashboardClient` validation UI, the `validateByProspect` mutation, the `AnalysisSection` status display, and the five `ACCEPTED/PENDING` gates in `assets.ts` — is already wired correctly and requires no changes.

There is one secondary finding: the `approveQuality` `onSuccess` callback in `quality-chip.tsx` does not currently invalidate `hypotheses.listByProspect`, so the Analysis section status badges will not update live in the admin UI after the quality approval writes the PENDING status. Adding that cache invalidation is a low-risk two-line improvement that completes HYPO-07 without any additional backend work.

**Primary recommendation:** Add `workflowHypothesis.updateMany` to `approveQuality` in `server/routers/research.ts`. Optionally add `hypotheses.listByProspect` cache invalidation to `quality-chip.tsx` `onSuccess`. No schema changes, no migrations, no new files.

---

## Standard Stack

### Core (no new dependencies needed)

| Library | Version | Purpose                                  | Why Standard                    |
| ------- | ------- | ---------------------------------------- | ------------------------------- |
| Prisma  | ^7.3.0  | `updateMany` batch write                 | Already used throughout routers |
| tRPC    | 11.9.0  | Mutation definition + cache invalidation | Established project pattern     |
| Next.js | 16.1.6  | /voor/ Server Component page             | Already using `force-dynamic`   |

### No New Dependencies

This phase introduces zero new packages. All required primitives (Prisma `updateMany`, tRPC `useUtils().invalidate()`) are already present in the codebase and used in adjacent mutations.

---

## Architecture Patterns

### Recommended Project Structure

No new files needed. Changes are localized to:

```
server/
└── routers/
    └── research.ts          # approveQuality mutation — add updateMany here
components/
└── features/
    └── prospects/
        └── quality-chip.tsx # onSuccess cache invalidation — add hypotheses.listByProspect
```

### Pattern 1: Conditional Batch Write in Mutation

**What:** When a mutation has side-effects on related records, apply them in the same async function before returning. Prisma `updateMany` is appropriate when the filter is a foreign key (`researchRunId`) and a status guard (`status: 'DRAFT'`) is needed to avoid overwriting already-PENDING or ACCEPTED records.

**When to use:** Any time one record's state change should cascade to a set of related records.

**Exact fix (server/routers/research.ts lines 198-207):**

```typescript
// Source: codebase inspection — research.ts approveQuality mutation
.mutation(async ({ ctx, input }) => {
  const run = await ctx.db.researchRun.update({
    where: { id: input.runId },
    data: {
      qualityApproved: input.approved,
      qualityReviewedAt: new Date(),
      qualityNotes: input.notes ?? null,
    },
  });

  // NEW: transition DRAFT hypotheses to PENDING when quality is approved
  if (input.approved) {
    await ctx.db.workflowHypothesis.updateMany({
      where: { researchRunId: input.runId, status: 'DRAFT' },
      data: { status: 'PENDING' },
    });
  }

  return run;
}),
```

**Why `status: 'DRAFT'` guard is required:** Hypotheses can be ACCEPTED (prospect validated on /voor/) or DECLINED between research runs. The guard ensures already-validated hypotheses are never reset to PENDING.

**Why return `run` (the ResearchRun):** The existing mutation return type is the ResearchRun. The `updateMany` result (`{ count: number }`) should not be returned — callers don't use it. Assigning `researchRun.update` to `run` and returning it preserves the API contract.

### Pattern 2: tRPC Cache Invalidation on Mutation Success

**What:** After a mutation writes new data, the `onSuccess` callback should invalidate any query caches that could show stale data.

**Existing pattern in quality-chip.tsx (lines 61-67):**

```typescript
const approveQuality = api.research.approveQuality.useMutation({
  onSuccess: () => {
    void utils.admin.listProspects.invalidate();
    void utils.research.listRuns.invalidate();
    void utils.research.getRun.invalidate({ runId: runId ?? '' });
    // MISSING: void utils.hypotheses.listByProspect.invalidate();
  },
});
```

**Addition needed:** `void utils.hypotheses.listByProspect.invalidate();` — causes the Analysis section to immediately reflect the DRAFT→PENDING status change in the admin UI after quality approval.

**Note:** This invalidation does not have access to `prospectId` at the call site (QualityChip only receives `runId`). Two options:

1. Invalidate all `hypotheses.listByProspect` queries (no args = invalidates all): `utils.hypotheses.listByProspect.invalidate()`
2. Add `prospectId` prop to QualityChip — check what props it receives

From the existing code, `quality-chip.tsx` receives `runId` prop. The full invalidate (option 1) is the simpler and correct approach here — it matches the pattern used for `utils.research.listRuns.invalidate()` (no args = all).

### Pattern 3: /voor/ Query Already Correct

**What:** The /voor/ page.tsx at line 47 already filters `{ status: { in: ['ACCEPTED', 'PENDING'] } }`. No changes needed to the page or client. Once hypotheses reach PENDING status via the fix, the server render will include them.

**Key insight:** The /voor/ page uses `export const dynamic = 'force-dynamic'` — every request hits the DB fresh. There is no stale cache issue on the prospect-facing side.

### Anti-Patterns to Avoid

- **Returning `updateMany` result:** `ctx.db.workflowHypothesis.updateMany` returns `{ count: number }`. Do NOT replace the `return ctx.db.researchRun.update(...)` with the `updateMany` result — callers expect a ResearchRun object. Assign the `researchRun.update` result to a variable first, then run `updateMany`, then return the variable.
- **Migrating existing DRAFT hypotheses:** Do NOT write a migration or script to fix existing DRAFT hypotheses in production. The fix is forward-only: future quality approvals will PENDING-ify their DRAFTs. Existing legacy prospects (pre-v2.0) use ACCEPTED status directly and are unaffected.
- **Adding PENDING to `setStatus` mutation:** The `setStatus` admin mutation (hypotheses.ts line 151-170) currently only accepts `['DRAFT', 'ACCEPTED', 'REJECTED']`. Do NOT add PENDING to this — PENDING is reserved as a system-set status via `approveQuality`, not a manual admin action.

---

## Don't Hand-Roll

| Problem                      | Don't Build                                | Use Instead                                    | Why                                                 |
| ---------------------------- | ------------------------------------------ | ---------------------------------------------- | --------------------------------------------------- |
| Batch status update          | Custom loop with individual `update` calls | `workflowHypothesis.updateMany`                | Single DB roundtrip, atomic, already used elsewhere |
| Cache refresh after mutation | `router.refresh()` or page reload          | `utils.hypotheses.listByProspect.invalidate()` | Established tRPC pattern throughout the codebase    |

---

## Common Pitfalls

### Pitfall 1: Breaking the Return Type

**What goes wrong:** The current `approveQuality` returns the Prisma ResearchRun object. If the developer changes `return ctx.db.researchRun.update(...)` to `return await ctx.db.workflowHypothesis.updateMany(...)`, the mutation's inferred return type changes and TypeScript callers break.

**Why it happens:** The easiest mistake when adding a follow-up write is to just append it to the existing return statement.

**How to avoid:** Assign the ResearchRun update to a `const run = await ...`, then run `updateMany`, then `return run`.

**Warning signs:** TypeScript errors in quality-chip.tsx after the change — `approveQuality.data` would have wrong shape.

### Pitfall 2: Overwriting Non-DRAFT Hypotheses

**What goes wrong:** `updateMany({ where: { researchRunId: input.runId } })` without the `status: 'DRAFT'` guard would reset ACCEPTED or DECLINED hypotheses back to PENDING.

**Why it happens:** The guard is easy to omit when the primary goal is "set all to PENDING."

**How to avoid:** Always include `status: 'DRAFT'` in the `where` clause.

**Warning signs:** Integration test catching unexpected status changes, or prospect seeing already-confirmed hypotheses revert to unvalidated state.

### Pitfall 3: Missing Cache Invalidation Causes Stale Analysis Section

**What goes wrong:** Admin approves quality, the status transition fires correctly, but the Analysis section still shows "Pending validation" badges because `hypotheses.listByProspect` hasn't been invalidated.

**Why it happens:** The `approveQuality` `onSuccess` only invalidates research-related queries, not hypothesis queries.

**How to avoid:** Add `void utils.hypotheses.listByProspect.invalidate()` to the `onSuccess` callback.

**Warning signs:** Admin sees "Pending validation" on all badges immediately after quality approval until page refresh.

### Pitfall 4: TypeScript compile error from `async` pattern

**What goes wrong:** The current mutation body uses `return ctx.db.researchRun.update(...)` directly (implicit return of Promise). When we assign to `run = await ...`, the function must be explicitly `async`. The mutation callback already uses `async ({ ctx, input }) => {` — verify it does before submitting.

**How to avoid:** Check that the function signature already has `async` keyword (line 198: `.mutation(async ({ ctx, input }) => {` — confirmed YES).

---

## Code Examples

Verified patterns from the codebase:

### approveQuality — Current (broken)

```typescript
// server/routers/research.ts lines 198-207
.mutation(async ({ ctx, input }) => {
  return ctx.db.researchRun.update({
    where: { id: input.runId },
    data: {
      qualityApproved: input.approved,
      qualityReviewedAt: new Date(),
      qualityNotes: input.notes ?? null,
    },
  });
}),
```

### approveQuality — Fixed

```typescript
// server/routers/research.ts
.mutation(async ({ ctx, input }) => {
  const run = await ctx.db.researchRun.update({
    where: { id: input.runId },
    data: {
      qualityApproved: input.approved,
      qualityReviewedAt: new Date(),
      qualityNotes: input.notes ?? null,
    },
  });

  if (input.approved) {
    await ctx.db.workflowHypothesis.updateMany({
      where: { researchRunId: input.runId, status: 'DRAFT' },
      data: { status: 'PENDING' },
    });
  }

  return run;
}),
```

### Cache Invalidation — Current (incomplete)

```typescript
// components/features/prospects/quality-chip.tsx lines 61-67
const approveQuality = api.research.approveQuality.useMutation({
  onSuccess: () => {
    void utils.admin.listProspects.invalidate();
    void utils.research.listRuns.invalidate();
    void utils.research.getRun.invalidate({ runId: runId ?? '' });
  },
});
```

### Cache Invalidation — Fixed

```typescript
// components/features/prospects/quality-chip.tsx
const approveQuality = api.research.approveQuality.useMutation({
  onSuccess: () => {
    void utils.admin.listProspects.invalidate();
    void utils.research.listRuns.invalidate();
    void utils.research.getRun.invalidate({ runId: runId ?? '' });
    void utils.hypotheses.listByProspect.invalidate();
  },
});
```

### Prisma Model Reference

```prisma
// prisma/schema.prisma
enum HypothesisStatus {
  DRAFT
  ACCEPTED
  REJECTED
  PENDING   // quality-approved, awaiting client validation on /voor/
  DECLINED  // client declined the hypothesis on /voor/ (Phase 19)
}

model WorkflowHypothesis {
  id            String           @id @default(cuid())
  status        HypothesisStatus @default(DRAFT)
  researchRunId String
  researchRun   ResearchRun @relation(fields: [researchRunId], references: [id], onDelete: Cascade)
  prospectId    String
  ...
  @@index([researchRunId])
  @@index([prospectId, status])
}
```

---

## Downstream Consumers — No Changes Required

The following code is already correct and requires no modifications:

| File                                                 | What it does                                          | Why it's already correct                                          |
| ---------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------- |
| `app/voor/[slug]/page.tsx` line 47                   | Queries `{ status: { in: ['ACCEPTED', 'PENDING'] } }` | PENDING filter already present                                    |
| `app/voor/[slug]/dashboard-client.tsx` line 263-265  | Shows validation section for SENT+ prospects          | Logic is status-independent — works with PENDING hypotheses       |
| `server/routers/hypotheses.ts` line 329-332          | `validateByProspect` sets ACCEPTED or DECLINED        | Already handles PENDING→ACCEPTED and PENDING→DECLINED transitions |
| `server/routers/assets.ts` line 69,74,280,421,429    | Five gates using `['ACCEPTED', 'PENDING']`            | PENDING already accepted at all gates                             |
| `components/features/prospects/analysis-section.tsx` | Displays status badges with correct PENDING label     | PENDING case handled, sorts with ACCEPTED at top                  |

---

## State Machine Summary

```
Research runs → hypotheses created as DRAFT
        ↓
Admin approves quality (approveQuality, approved=true)
        ↓
[MISSING STEP] updateMany DRAFT → PENDING   ← THIS IS THE FIX
        ↓
/voor/ page query returns PENDING hypotheses
        ↓
Prospect sees validation section (showValidation = SENT+ status)
        ↓
Prospect clicks "Ja, herkenbaar" → validateByProspect → ACCEPTED
Prospect clicks "Nee" → validateByProspect → DECLINED
        ↓
Admin Analysis section shows "Confirmed by prospect" / "Declined by prospect"
on next page load (hypotheses.listByProspect refetches)
```

---

## Open Questions

1. **Should `approveQuality(approved: false)` transition PENDING hypotheses back to DRAFT?**
   - What we know: The current code only updates the ResearchRun record. The /voor/ dashboard is only shown for SENT+ prospects (after first outreach email). In practice, a "reject quality" action would likely happen before outreach is sent.
   - What's unclear: Is there a scenario where an admin approves quality, hypotheses become PENDING, then the admin rejects quality? If so, PENDING hypotheses remain visible on /voor/ even though quality was re-rejected.
   - Recommendation: For this phase, handle the reverse transition (`approved: false` → set PENDING back to DRAFT) with an `else if` branch. This prevents a data consistency edge case with minimal code cost. Add `else if (!input.approved)` → `updateMany({ where: { researchRunId: input.runId, status: 'PENDING' }, data: { status: 'DRAFT' } })`.

2. **Should `hypotheses.listByProspect` invalidation in quality-chip.tsx be scoped to a specific prospect?**
   - What we know: `quality-chip.tsx` receives `runId` but not `prospectId`. Calling `utils.hypotheses.listByProspect.invalidate()` without args invalidates all cached queries for this endpoint.
   - What's unclear: Whether the admin ever has multiple prospect Analysis sections open simultaneously (unlikely — it's a detail page).
   - Recommendation: Invalidate without args (broad invalidation). Cost is negligible — React Query will only refetch queries that have active subscribers. No prop changes needed.

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection: `server/routers/research.ts` — `approveQuality` mutation body
- Direct codebase inspection: `app/voor/[slug]/page.tsx` — hypothesis query with status filter
- Direct codebase inspection: `app/voor/[slug]/dashboard-client.tsx` — validation UI and `validateByProspect` call
- Direct codebase inspection: `server/routers/hypotheses.ts` — `validateByProspect` mutation
- Direct codebase inspection: `server/routers/assets.ts` — five ACCEPTED/PENDING gates
- Direct codebase inspection: `components/features/prospects/analysis-section.tsx` — status badges
- Direct codebase inspection: `components/features/prospects/quality-chip.tsx` — mutation + cache invalidation
- Direct codebase inspection: `prisma/schema.prisma` — `HypothesisStatus` enum and `WorkflowHypothesis` model
- `.planning/v2.0-MILESTONE-AUDIT.md` — exact gap description and fix prescription

### Secondary (MEDIUM confidence)

- tRPC v11 pattern: `useUtils().invalidate()` — confirmed from existing codebase usage patterns

---

## Metadata

**Confidence breakdown:**

- Root cause identification: HIGH — confirmed by direct code read + audit document
- Fix implementation: HIGH — standard Prisma updateMany, established project pattern
- Downstream consumers (no change needed): HIGH — all five gates verified by grep
- Cache invalidation secondary fix: HIGH — pattern used elsewhere in quality-chip.tsx

**Research date:** 2026-02-23
**Valid until:** 60 days (stable domain — no external library dependencies)

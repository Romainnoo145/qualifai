# Phase 20: One-Click Send Queue + Pipeline View — Research

**Researched:** 2026-02-23
**Domain:** tRPC mutations, Prisma atomic updates, React state management, admin queue UI
**Confidence:** HIGH

---

## Summary

Phase 20 has two distinct halves that share no code but must ship together: (1) a one-click send queue with an idempotency guard on `approveDraft`, and (2) a pipeline stage chip on every prospect row and detail header. Both halves are achievable with the existing stack — no new dependencies are needed.

The send queue already exists (`outreach.getDecisionInbox` + `outreach.approveDraft` in `server/routers/outreach.ts`). The critical gap is that `approveDraft` has **no idempotency guard**: two simultaneous clicks or two-tab double-sends will both execute `sendOutreachEmail` before either has a chance to update the DB status. The fix is a single atomic `updateMany` that claims the draft as `'sending'` before any email is sent, using Prisma's `where: { id, status: 'draft' }` check. If 0 rows are affected, the draft was already claimed — throw an early "already sending" error.

The pipeline stage chip (Imported → Researching → Reviewed → Ready → Sending → Engaged → Booked) is a **computed** value derived entirely from existing `Prospect` model fields and relations — no schema change is needed. The derivation logic maps the current `ProspectStatus` enum values plus research run state and outreach activity to one of seven named stages. The chip appears on the `AllCompanies` list row (alongside the existing `statusColors` badge) and in the prospect detail header, derived client-side from data already fetched by `listProspects` and `getProspect`.

The action queue filter improvement (PIPE-02 — hide Researching-stage prospects from the queue) requires a small extension to `getActionQueue` in `server/routers/admin.ts`: the four existing parallel queries already filter by status, but they need an additional join to exclude prospects whose latest research run has `status: 'PENDING' | 'CRAWLING' | 'EXTRACTING' | 'HYPOTHESIS' | 'BRIEFING'` (i.e., still processing). The simplest approach: add `prospect: { researchRuns: { none: { status: { in: ['PENDING', 'CRAWLING', 'EXTRACTING', 'HYPOTHESIS', 'BRIEFING'] } } } }` to the `where` clause of each of the three `outreachLog` queries, and exclude `workflowHypothesis` rows similarly.

The engagement-based ranking (PIPE-03) requires adding a `recentEngagementAt` field to each queue item derived from `WizardSession.createdAt`, `WizardSession.pdfDownloadedAt`, and `WizardSession.callBookedAt`. The latest of these timestamps is compared to the item's `createdAt` and used as a secondary sort key — engaged prospects surface first within the same urgency tier.

**Primary recommendation:** Implement the idempotency guard as the very first task in a separate plan, validate it works, then ship the pipeline chip and queue enhancements. Do not ship a one-click send UI before the guard is in place.

---

## Standard Stack

### Core (no new packages needed)

| Library      | Version    | Purpose                  | Relevance                                                             |
| ------------ | ---------- | ------------------------ | --------------------------------------------------------------------- |
| Prisma       | `^7.3.0`   | DB access + atomic claim | `updateMany` with conditional `where` for idempotency                 |
| tRPC         | `11.9.0`   | API mutations            | `approveDraft` mutation — add guard at top                            |
| React        | `19.2.3`   | UI state                 | `isPending` from `useMutation` disables button during in-flight       |
| lucide-react | `^0.563.0` | Icons                    | `Send`, `CheckCircle2`, `Loader2` — already imported in outreach page |
| Tailwind CSS | `^4`       | Chip styling             | Existing `statusColors` map pattern — extend for pipeline stages      |
| zod          | `^4.3.6`   | Input validation         | No new schemas needed                                                 |

### Supporting (already in project)

| Library                 | Version    | Purpose                 | When to Use                                                                   |
| ----------------------- | ---------- | ----------------------- | ----------------------------------------------------------------------------- |
| `@tanstack/react-query` | `^5.59.15` | Query invalidation      | `useUtils().outreach.getDecisionInbox.invalidate()` after send — already used |
| `framer-motion`         | `^12.29.2` | Optional chip animation | Only if pipeline chip needs a subtle transition on status change              |

### Alternatives Considered

| Instead of                                   | Could Use                              | Tradeoff                                                                                                                                 |
| -------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic `updateMany` where `status = 'draft'` | Redis lock / DB advisory lock          | `updateMany` is simpler and sufficient at this volume (20-50 prospects); advisory locks add complexity with no benefit                   |
| Computed pipeline stage client-side          | Add `pipelineStage` column to Prospect | No schema migration required, thresholds can be adjusted in code without migrations                                                      |
| Inline send button on dashboard rows         | Separate send queue page               | Inline on dashboard is faster UX but risks accidental clicks — inline preview + send on same row satisfies SEND-01 without separate page |

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure

No new files strictly required. Changes are additive edits to existing files:

```
server/routers/
  outreach.ts          ← approveDraft: add idempotency guard (atomic claim)
  admin.ts             ← getActionQueue: add research-in-progress filter + engagement ranking
lib/
  pipeline-stage.ts    ← NEW: computePipelineStage() pure function (reused by list + detail)
components/features/prospects/
  pipeline-chip.tsx    ← NEW: PipelineChip component (stage label + color)
app/admin/
  page.tsx             ← getActionQueue already shown — add engagementAt ranking display
  prospects/page.tsx   ← Add PipelineChip to AllCompanies list row
  prospects/[id]/page.tsx ← Add PipelineChip to detail header
  outreach/page.tsx    ← DraftQueue: existing Approve & Send button is already per-row — verify guard works
```

### Pattern 1: Idempotency Guard via Atomic Status Claim

**What:** Before calling `sendOutreachEmail`, attempt to claim the draft by atomically transitioning its status from `'draft'` to `'sending'`. If zero rows are updated, the draft was already claimed (double-send prevented).

**When to use:** Any mutation that calls `sendOutreachEmail` — currently `approveDraft` and `bulkApproveLowRisk`. Both need the guard.

```typescript
// Source: Prisma updateMany with conditional where — HIGH confidence pattern
// In server/routers/outreach.ts, approveDraft mutation

// Step 1: Atomic claim — prevents double-send
const claimed = await ctx.db.outreachLog.updateMany({
  where: { id: input.id, status: 'draft' },  // only claim if still 'draft'
  data: { status: 'sending' },
});

if (claimed.count === 0) {
  // Already claimed by another request — idempotency guard triggered
  throw new TRPCError({
    code: 'CONFLICT',
    message: 'Draft is already being sent. Please refresh.',
  });
}

// Step 2: Fetch full draft now that we own it
const draft = await ctx.db.outreachLog.findUniqueOrThrow({
  where: { id: input.id },
  include: { contact: { select: { ... } } },
});

// Step 3: Send email (draft.status is now 'sending', not 'draft')
// ... existing send logic ...

// Step 4: On success, delete the log (existing behavior)
// Step 5: On failure, revert status back to 'draft' so admin can retry
await ctx.db.outreachLog.update({
  where: { id: input.id },
  data: { status: 'draft' }, // revert so it reappears in queue
});
```

**Key insight:** The `updateMany` with `where: { id, status: 'draft' }` is the entire guard. If `count === 0`, another request already moved the status to `'sending'`. No locks, no external dependencies.

**Error handling on rollback:** If `sendOutreachEmail` throws, the status must be reverted from `'sending'` back to `'draft'` in a `finally` block or explicit catch, otherwise the draft disappears from the queue silently. The current `approveDraft` moves to `'manual_review'` on failure — that behavior should be preserved, just applied to `'sending'` instead of `'draft'`.

### Pattern 2: Pipeline Stage Computation

**What:** A pure function that maps prospect fields to one of seven named pipeline stages. No DB field needed — computed at render time.

**Stage mapping:**

| Stage         | Condition                                                                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Imported`    | `prospect.status === 'DRAFT'` — just created, not yet enriched                                                                                       |
| `Researching` | `prospect.status === 'ENRICHED' or 'GENERATING'` OR latest `researchRun.status` in `['PENDING', 'CRAWLING', 'EXTRACTING', 'HYPOTHESIS', 'BRIEFING']` |
| `Reviewed`    | Latest `researchRun.qualityApproved === true` (or `false` but proceeded-anyway) AND `prospect.status !== 'SENT'`                                     |
| `Ready`       | `prospect.status === 'READY'` AND research run completed AND no active send                                                                          |
| `Sending`     | `prospect.status === 'SENT'` AND no `WizardSession` yet                                                                                              |
| `Engaged`     | `prospect.status === 'VIEWED' or 'ENGAGED'` OR any `WizardSession` exists                                                                            |
| `Booked`      | Any `WizardSession.callBooked === true` OR `prospect.status === 'CONVERTED'` OR any `OutreachSequence.status === 'BOOKED'`                           |

**Note on data available in `listProspects`:** Currently, `listProspects` returns `prospect.status`, `_count.sessions`, and the latest `researchRun` (with `qualityApproved` and `_count.evidenceItems`). To compute pipeline stage accurately, we also need:

- Whether any session has `callBooked: true` — requires including `sessions: { where: { callBooked: true }, take: 1, select: { id: true } }` in `listProspects`
- Latest research run `status` field (currently only `qualityApproved` is selected) — add `status: true` to the researchRuns include

```typescript
// Source: lib/pipeline-stage.ts — pure function, no side effects
export type PipelineStage =
  | 'Imported'
  | 'Researching'
  | 'Reviewed'
  | 'Ready'
  | 'Sending'
  | 'Engaged'
  | 'Booked';

interface ProspectForStage {
  status: string; // ProspectStatus
  researchRun?: {
    status: string; // ResearchStatus
    qualityApproved: boolean | null;
  } | null;
  hasSession: boolean; // _count.sessions > 0
  hasBookedSession: boolean; // any session with callBooked === true
}

export function computePipelineStage(p: ProspectForStage): PipelineStage {
  if (p.hasBookedSession || p.status === 'CONVERTED') return 'Booked';
  if (p.status === 'VIEWED' || p.status === 'ENGAGED' || p.hasSession)
    return 'Engaged';
  if (p.status === 'SENT') return 'Sending';
  if (p.status === 'READY') return 'Ready';
  if (
    p.researchRun?.qualityApproved === true &&
    p.status !== 'DRAFT' &&
    p.status !== 'GENERATING'
  )
    return 'Reviewed';
  if (
    p.status === 'ENRICHED' ||
    p.status === 'GENERATING' ||
    (p.researchRun?.status &&
      ['PENDING', 'CRAWLING', 'EXTRACTING', 'HYPOTHESIS', 'BRIEFING'].includes(
        p.researchRun.status,
      ))
  )
    return 'Researching';
  return 'Imported';
}
```

### Pattern 3: PipelineChip Component

**What:** A small colored chip matching the existing `statusColors` pattern in `prospects/page.tsx`.

```typescript
// Source: components/features/prospects/pipeline-chip.tsx
// Matches existing chip style at app/admin/prospects/page.tsx line 183-189

const STAGE_COLORS: Record<PipelineStage, string> = {
  Imported:    'bg-slate-50 text-slate-500 border-slate-100',
  Researching: 'bg-blue-50 text-blue-600 border-blue-100',
  Reviewed:    'bg-indigo-50 text-indigo-600 border-indigo-100',
  Ready:       'bg-emerald-50 text-emerald-600 border-emerald-100',
  Sending:     'bg-amber-50 text-amber-600 border-amber-100',
  Engaged:     'bg-purple-50 text-purple-600 border-purple-100',
  Booked:      'bg-yellow-50 text-yellow-700 border-yellow-100',
};

export function PipelineChip({ stage }: { stage: PipelineStage }) {
  return (
    <span className={cn(
      'text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border',
      STAGE_COLORS[stage],
    )}>
      {stage}
    </span>
  );
}
```

### Pattern 4: Engagement Ranking in getActionQueue

**What:** Add `recentEngagementAt` to each queue item by joining `WizardSession` data per prospect, then use it as a secondary sort key.

**Data join strategy:** The four parallel queries in `getActionQueue` use `contact.prospect` or `hypothesis.prospect`. Extend the prospect select to include the latest `WizardSession`:

```typescript
// In getActionQueue — extend prospect select in outreachLog queries
prospect: {
  select: {
    id: true,
    companyName: true,
    domain: true,
    sessions: {
      orderBy: { updatedAt: 'desc' },
      take: 1,
      select: { createdAt: true, pdfDownloadedAt: true, callBookedAt: true, updatedAt: true },
    },
  },
},

// Compute engagement signal per item
function latestEngagementAt(sessions: { createdAt: Date; pdfDownloadedAt: Date | null; callBookedAt: Date | null; updatedAt: Date }[]): Date | null {
  if (sessions.length === 0) return null;
  const s = sessions[0]!;
  const candidates = [s.updatedAt, s.pdfDownloadedAt, s.callBookedAt].filter(Boolean) as Date[];
  return candidates.length > 0 ? new Date(Math.max(...candidates.map(d => d.getTime()))) : s.createdAt;
}
```

**Sort order:** overdue first → then by `recentEngagementAt DESC` (most recently engaged) → then by `createdAt ASC` (oldest first within same engagement tier).

### Pattern 5: Research-In-Progress Filter (PIPE-02)

**What:** Exclude prospects from the action queue whose latest research run is still in-progress.

**Implementation:** Add a subquery to the `workflowHypothesis` and `outreachLog` queries. The simplest approach — add a Prisma nested filter on `prospect` to exclude rows where any research run is still in a processing state:

```typescript
// In getActionQueue — add to workflowHypothesis query where clause
where: {
  status: 'DRAFT',
  prospect: {
    researchRuns: {
      // none in-progress means the prospect's latest run is done
      none: {
        status: { in: ['PENDING', 'CRAWLING', 'EXTRACTING', 'HYPOTHESIS', 'BRIEFING'] },
      },
    },
  },
},

// Same filter added to each outreachLog query's contact.prospect subfilter
where: {
  status: 'draft',
  contact: {
    prospect: {
      researchRuns: {
        none: {
          status: { in: ['PENDING', 'CRAWLING', 'EXTRACTING', 'HYPOTHESIS', 'BRIEFING'] },
        },
      },
    },
  },
},
```

**Caveat:** `none` means no research run exists in that state — this correctly excludes actively researching prospects. If a prospect has no runs at all, `none` still returns `true` (no runs, so none are in-progress), which is correct (they'd be `Imported`, filtered out at a different layer via stage visibility).

### Anti-Patterns to Avoid

- **Skipping idempotency on `bulkApproveLowRisk`:** This mutation sends up to 25 emails in a loop. It also needs the atomic claim guard on each individual draft before calling `sendOutreachEmail`. Without it, bulk approval in two tabs sends every email twice.
- **Adding `pipelineStage` as a DB column:** Computed columns become stale and require triggers or manual updates. The pipeline stage logic is cheap to compute at render time for 20-50 prospects.
- **Hard-blocking on research-in-progress:** The PIPE-02 filter hides these prospects from the action queue, but they must still appear in `listProspects`. The filter is only for `getActionQueue`, not for the companies list.
- **`research.none` filter performance:** At 20-50 prospects, this subquery is negligible. If the table grows to thousands, this would need indexing on `researchRun.status`. Document the scaling caveat but do not optimize prematurely.
- **Making the inline send preview require a separate page load:** SEND-01 requires inline preview without page navigation. The email body is already in the `outreachLog.bodyHtml` field and is already rendered inline in the current `DraftQueue` component in `outreach/page.tsx`. The one-click button belongs on the same row as the preview.

---

## Don't Hand-Roll

| Problem                    | Don't Build                      | Use Instead                                        | Why                                                                      |
| -------------------------- | -------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------ |
| Idempotency guard          | Redis/Memcached distributed lock | Prisma `updateMany` with conditional `where`       | Sufficient at this volume, no new dependency, single atomic DB operation |
| Pipeline stage computation | Store computed stage in DB       | Pure `computePipelineStage()` function             | No migration, adjustable thresholds, re-runs on every render (cheap)     |
| "Already sent" detection   | Check email provider logs        | Check `outreachLog.status !== 'draft'` before send | Already in DB, no external call                                          |
| Engagement ranking         | External scoring service         | Latest `WizardSession` timestamp per prospect      | Already in DB, O(1) lookup                                               |

**Key insight:** The idempotency guard is the entire safety mechanism. It is three lines of Prisma code. Any solution that is more than ~10 lines is over-engineered for this volume.

---

## Common Pitfalls

### Pitfall 1: approveDraft Fails to Revert Status on Email Send Error

**What goes wrong:** Draft status is moved to `'sending'` (atomic claim), email send fails, status is not reverted to `'draft'`. The draft silently disappears from the queue even though it was never sent.

**Why it happens:** The current `approveDraft` code sets status to `'manual_review'` on failure, but with the new guard, the status is already `'sending'` when the send attempt starts. If the send throws and the catch block checks `status === 'draft'` (it doesn't — it updates regardless), the behavior depends on the existing catch logic.

**How to avoid:** The catch block must explicitly `update` the status to `'draft'` (revert) so the draft reappears in the queue for retry. Do not set `'manual_review'` for transient network failures — only use `'manual_review'` for true quality-blocked cases. Alternatively, keep the existing `'manual_review'` behavior but ensure the admin can see `'manual_review'` items in the queue with a retry button.

**Warning signs:** Draft count in `getActionQueue` drops without a corresponding sent email appearing in `getHistory`.

### Pitfall 2: bulkApproveLowRisk Has No Idempotency Guard

**What goes wrong:** Two admins trigger bulk approve simultaneously. Each fetches the same set of low-risk drafts (Prisma `findMany` with `status: 'draft'`), then both loop over the same IDs and send each email twice.

**Why it happens:** `bulkApproveLowRisk` fetches then sends in a loop — there is no atomic claim before each send.

**How to avoid:** Apply the same `updateMany` guard to each individual draft inside the `bulkApproveLowRisk` loop. If `claimed.count === 0`, skip that draft (it was claimed by the concurrent request) — do not throw, just continue.

**Warning signs:** `approved` count + `failed` count < `lowRiskFound` count — claimed-by-other items were skipped correctly.

### Pitfall 3: listProspects Missing Fields for Pipeline Stage

**What goes wrong:** `computePipelineStage` is called with a prospect that lacks `researchRun.status` or `hasBookedSession`, returning `'Imported'` for all prospects.

**Why it happens:** The current `listProspects` select does not include `researchRun.status` or sessions with `callBooked` flag. Adding `PipelineChip` to the list without extending the query produces stale/wrong stages.

**How to avoid:** Before adding `PipelineChip` to `prospects/page.tsx`, extend `listProspects` include:

- Add `status: true` to the `researchRuns` select (alongside existing `qualityApproved: true`)
- Add `sessions: { where: { callBooked: true }, take: 1, select: { id: true } }` to include

**Warning signs:** Every prospect shows `Imported` stage regardless of actual status.

### Pitfall 4: Pipeline Chip Duplicates the Existing Status Badge

**What goes wrong:** The pipeline chip (Imported/Researching/Ready/etc.) and the existing status badge (DRAFT/ENRICHED/READY/etc.) both appear on the list row, causing visual confusion.

**Why it happens:** The existing `AllCompanies` list has a `statusColors` chip showing `prospect.status` (DRAFT, ENRICHED, GENERATING, etc.). The pipeline chip shows a human-readable label derived from that same status.

**How to avoid:** The pipeline chip **replaces** the existing raw `ProspectStatus` chip on the admin list — the internal enum labels (DRAFT, ENRICHED, GENERATING) are replaced by the seven meaningful pipeline stage labels. The `statusColors` map in `prospects/page.tsx` can be removed from the list row (it can stay on the detail header or be removed entirely). The pipeline chip IS the new status indicator.

**Warning signs:** Both chips appear side by side, both saying essentially the same thing in different vocabularies.

### Pitfall 5: PIPE-02 Filter Hides All Prospects with No Research Runs

**What goes wrong:** Prospects that have never been through the research pipeline (DRAFT status, no `ResearchRun` rows) are hidden from the action queue entirely by the `researchRuns: { none: ... }` filter.

**Why it happens:** Prisma `none` semantics: `researchRuns: { none: { status: { in: [...] } } }` means "no research run with an in-progress status exists". For a prospect with zero research runs, this evaluates to `true` — no runs, so none are in-progress. This means DRAFT prospects with no runs DO pass the filter.

**Verification needed:** Confirm this Prisma behavior in the current version (7.3.0). `none` with no matching rows should return `true` — this is standard Prisma semantics. If it behaves differently, an alternative is to check `researchRuns: { every: { status: { in: ['FAILED', 'COMPLETED'] } } }` (empty set satisfies `every`).

**Warning signs:** After adding PIPE-02 filter, previously visible draft items disappear from the action queue for prospects that have never been researched.

### Pitfall 6: Inline Send Button in Dashboard vs. Outreach Page

**What goes wrong:** Phase 20 adds inline send to the action queue dashboard, but the existing `DraftQueue` on `/admin/outreach` is unchanged. Admin sends from both places without knowing — the idempotency guard catches the double-send, but the error message is confusing.

**Why it happens:** Two UIs for the same action — the dashboard (new, inline) and `/admin/outreach` (existing, full page).

**How to avoid:** The dashboard action queue `draft` rows currently link to `/admin/outreach`. Phase 20 replaces those links with an inline send button. The `/admin/outreach` DraftQueue remains for detailed review, but the dashboard is the primary one-click path. Both call `approveDraft` — idempotency ensures safety. The error message should say "Draft already sent or being sent — refresh outreach page."

---

## Code Examples

Verified patterns from the codebase:

### Existing approveDraft (server/routers/outreach.ts, lines 496-588) — Current State

```typescript
// Current approveDraft — NO idempotency guard
approveDraft: adminProcedure
  .input(z.object({ id: z.string(), subject, bodyHtml, bodyText }))
  .mutation(async ({ ctx, input }) => {
    // PROBLEM: This findUniqueOrThrow does NOT claim the draft atomically.
    // Two simultaneous calls both pass here.
    const draft = await ctx.db.outreachLog.findUniqueOrThrow({
      where: { id: input.id },
      include: { contact: { select: { ... } } },
    });

    // Quality check happens AFTER fetch — no atomic claim before send
    const quality = scoreContactForOutreach(draft.contact);
    if (quality.status === 'blocked') { ... }

    // sendOutreachEmail called with NO prior status claim
    result = await sendOutreachEmail({ ... });

    // On success: delete the log
    await ctx.db.outreachLog.delete({ where: { id: input.id } });
  })
```

### Fixed approveDraft with Idempotency Guard

```typescript
// FIXED approveDraft — WITH idempotency guard
approveDraft: adminProcedure
  .input(z.object({ id: z.string(), subject, bodyHtml, bodyText }))
  .mutation(async ({ ctx, input }) => {
    // Step 1: Atomic claim — transition 'draft' → 'sending'
    const claimed = await ctx.db.outreachLog.updateMany({
      where: { id: input.id, status: 'draft' },
      data: { status: 'sending' },
    });

    if (claimed.count === 0) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Draft is already being sent. Please refresh the queue.',
      });
    }

    // Step 2: Fetch full draft (now 'sending', we own it)
    const draft = await ctx.db.outreachLog.findUniqueOrThrow({
      where: { id: input.id },
      include: { contact: { select: { ... } } },
    });

    // Step 3: Quality check (unchanged)
    const quality = scoreContactForOutreach(draft.contact);
    if (quality.status === 'blocked') {
      // Revert claim before throwing quality block
      await ctx.db.outreachLog.update({
        where: { id: input.id },
        data: { status: 'manual_review', metadata: { ... } as never },
      });
      throw new Error(...);
    }

    let result;
    try {
      result = await sendOutreachEmail({ ... });
    } catch (error) {
      // Revert to 'draft' on transient failure so it reappears in queue
      await ctx.db.outreachLog.update({
        where: { id: input.id },
        data: { status: 'draft' },
      });
      throw error;
    }

    // Step 4: On success delete (or on failure mark retry) — existing behavior
    await markSequenceStepAfterSend(ctx.db, draft, result.success);
    if (result.success) {
      await ctx.db.outreachLog.delete({ where: { id: input.id } });
    } else {
      await ctx.db.outreachLog.update({
        where: { id: input.id },
        data: { status: 'retry' },
      });
    }

    return result;
  })
```

### Extending listProspects Include for Pipeline Stage

```typescript
// In server/routers/admin.ts — listProspects include extension
include: {
  _count: { select: { sessions: true, contacts: true } },
  researchRuns: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: {
      id: true,
      status: true,          // ← ADD THIS for Researching stage detection
      qualityApproved: true,
      qualityReviewedAt: true,
      _count: {
        select: { evidenceItems: true, workflowHypotheses: true },
      },
    },
  },
  sessions: {              // ← ADD THIS for Booked stage detection
    where: { callBooked: true },
    take: 1,
    select: { id: true },
  },
},
```

### Existing WizardSession Fields (prisma/schema.prisma, lines 621-646)

```prisma
model WizardSession {
  // ... (engagement tracking fields)
  pdfDownloaded    Boolean   @default(false)
  pdfDownloadedAt  DateTime?
  callBooked       Boolean   @default(false)
  callBookedAt     DateTime?
  // prospectId relation → used for PIPE-03 engagement join in getActionQueue
}
```

---

## State of the Art

| Old Approach                                | Current Approach                              | When Changed | Impact                                                |
| ------------------------------------------- | --------------------------------------------- | ------------ | ----------------------------------------------------- |
| Dashboard links to outreach page for drafts | Inline send button on dashboard queue row     | Phase 20     | Eliminates page navigation for the most common action |
| `approveDraft` with no guard                | `approveDraft` with atomic `updateMany` claim | Phase 20     | Prevents double-sends — critical safety fix           |
| Action queue shows all prospects            | Action queue filters out Researching-stage    | Phase 20     | Reduces noise for the admin's queue-first workflow    |
| No pipeline stage concept                   | 7-stage pipeline chip on list + detail        | Phase 20     | Admin sees state at a glance without opening records  |

**Deprecated/outdated:**

- Raw `ProspectStatus` chip on list rows (DRAFT, ENRICHED, GENERATING...): replaced by the 7-stage pipeline chip with human-readable labels
- `getActionQueue` returning research-in-progress prospects as actionable items: filtered out in Phase 20

---

## Open Questions

1. **Should the inline send button on the dashboard show the full email body preview or just a subject preview?**
   - What we know: `outreachLog.bodyHtml` is available in `getActionQueue` items if we add it to the select. The current `DraftQueue` in `outreach/page.tsx` renders `dangerouslySetInnerHTML` of `bodyHtml` — this works. Adding `bodyHtml` to `getActionQueue` response increases payload size.
   - What's unclear: Whether a truncated subject preview is sufficient for one-click approve, or whether the admin needs to see the full body.
   - Recommendation: Show subject + first ~200 chars of `bodyText` as an inline preview (no HTML rendering needed). Full body preview stays on `/admin/outreach`. This keeps the dashboard queue compact.

2. **What happens to the `'sending'` status if the server crashes mid-send?**
   - What we know: If the tRPC handler crashes between the atomic claim (`status = 'sending'`) and the delete/revert, the draft is stuck in `'sending'` forever. The queue filter looks for `status: 'draft'`, so a stuck `'sending'` draft becomes invisible.
   - What's unclear: Whether a recovery mechanism is needed (cron job that reverts `'sending'` rows older than N minutes to `'draft'`).
   - Recommendation: For Phase 20, accept the risk — at 20-50 prospects, a stuck `'sending'` draft can be manually fixed via DB or by running a one-off script. Document as a known limitation. A recovery cron is Phase 21+ work.

3. **Should the existing raw `statusColors` ProspectStatus badge be removed from the list, or shown alongside the pipeline chip?**
   - What we know: Both chips would show on the same row, using similar vocabulary. The user's preference is compact UI.
   - Recommendation: Remove the raw `statusColors` badge from the `AllCompanies` list and replace with the `PipelineChip`. Keep it only in the detail header for internal debugging if needed, or remove it there too. The seven pipeline stages provide a superset of the information.

4. **Does `outreachLog` need a `'sending'` status added to the existing filter in `getQueue` and `getDecisionInbox`?**
   - What we know: `getDecisionInbox` queries `where: { status: 'draft' }`. If a draft is briefly in `'sending'` state, it disappears from the inbox during the send operation, which is correct.
   - What's unclear: Whether the `getHistory` query or any other consumer expects to see `'sending'` as a transient status.
   - Recommendation: No change needed to existing queries. `'sending'` is a transient state lasting milliseconds. No UI component needs to display it.

---

## Task Map for Planner

| Task                                                                                                                | Files Affected                                                                                                               | Complexity      |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 20-01: Idempotency guard on `approveDraft` + `bulkApproveLowRisk`                                                   | `server/routers/outreach.ts`                                                                                                 | Low — ~20 lines |
| 20-02: `computePipelineStage()` helper + extend `listProspects` include                                             | `lib/pipeline-stage.ts` (new), `server/routers/admin.ts`                                                                     | Low             |
| 20-03: `PipelineChip` component + add to `AllCompanies` list + prospect detail header                               | `components/features/prospects/pipeline-chip.tsx` (new), `app/admin/prospects/page.tsx`, `app/admin/prospects/[id]/page.tsx` | Medium          |
| 20-04: Extend `getActionQueue` — research-in-progress filter + engagement ranking + inline content preview fields   | `server/routers/admin.ts`                                                                                                    | Medium          |
| 20-05: Update dashboard `ActionRow` for drafts — replace link-to-outreach with inline content preview + send button | `app/admin/page.tsx`                                                                                                         | Medium          |

---

## Sources

### Primary (HIGH confidence)

- Codebase inspection: `server/routers/outreach.ts` lines 496-588 — confirmed `approveDraft` has no idempotency guard (`findUniqueOrThrow` is not atomic, `updateMany` not used)
- Codebase inspection: `server/routers/outreach.ts` lines 590-685 — confirmed `bulkApproveLowRisk` also has no guard
- Codebase inspection: `server/routers/admin.ts` lines 489-646 — confirmed `getActionQueue` structure: 4 parallel queries, merge + sort, no research-in-progress filter, no engagement ranking
- Codebase inspection: `server/routers/admin.ts` lines 382-424 — confirmed `listProspects` current include (missing `researchRun.status` and `sessions.callBooked`)
- Codebase inspection: `prisma/schema.prisma` — confirmed `WizardSession` engagement fields: `pdfDownloaded`, `pdfDownloadedAt`, `callBooked`, `callBookedAt`
- Codebase inspection: `prisma/schema.prisma` — confirmed `ProspectStatus` enum (DRAFT, ENRICHED, GENERATING, READY, SENT, VIEWED, ENGAGED, CONVERTED, ARCHIVED) and `ResearchStatus` enum (PENDING, CRAWLING, EXTRACTING, HYPOTHESIS, BRIEFING, FAILED, COMPLETED)
- Codebase inspection: `app/admin/prospects/page.tsx` lines 32-42, 181-189 — confirmed existing `statusColors` map and chip pattern for phase 20 to replace
- Codebase inspection: `app/admin/page.tsx` — confirmed `ActionRow` links drafts to `/admin/outreach` (target to replace with inline button)
- Codebase inspection: `app/admin/outreach/page.tsx` lines 130-351 — confirmed existing `DraftQueue` renders full `bodyHtml` inline — same pattern for dashboard row preview
- Phase 15-01-PLAN.md — confirmed `getActionQueue` uses Promise.all for four parallel Prisma queries
- Phase 18-RESEARCH.md — confirmed `QualityChip` pattern and `computeTrafficLight` pattern to follow for `PipelineChip`

### Secondary (MEDIUM confidence)

- Prisma docs pattern: `updateMany` with conditional `where` for atomic status claim — standard Prisma idempotency pattern; verified as supported in Prisma 7.x
- MEMORY.md: "approveDraft has no idempotency guard currently — critical fix needed in Phase 20" — confirms the problem statement
- MEMORY.md: "No kanban board — list with stage chips at current volumes (20-50 prospects)" — confirms pipeline chip over kanban

### Tertiary (LOW confidence — needs validation during implementation)

- Prisma `none` semantics with empty relation: confirmed in Prisma docs that `none` on an empty set returns `true` — but should be verified with a `prisma migrate dev` dry run in the dev environment to confirm the generated SQL is correct.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages, all existing
- Architecture (idempotency guard): HIGH — based on direct code inspection, standard Prisma pattern
- Architecture (pipeline stage): HIGH — based on direct inspection of ProspectStatus enum and existing field set
- Architecture (engagement ranking): HIGH — WizardSession fields confirmed in schema
- Pitfalls: HIGH — based on direct code path tracing through approveDraft and bulkApproveLowRisk
- Open questions: MEDIUM — UX decisions not yet made (inline preview depth, badge removal)

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (stable stack, 30-day window)

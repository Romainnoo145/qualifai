---
phase: 20-one-click-send-queue-pipeline-view
plan: '03'
subsystem: api, admin-ui
tags: [trpc, prisma, action-queue, dashboard, send-button, engagement-ranking]

# Dependency graph
requires:
  - phase: 20-01
    provides: Idempotency guard on approveDraft — prevents double-sends on concurrent clicks
  - phase: 20-02
    provides: Pipeline stage infrastructure — context for getActionQueue filtering logic

provides:
  - getActionQueue with PIPE-02 research-in-progress filter (excludes prospects with active research runs)
  - getActionQueue with PIPE-03 engagement ranking (engaged prospects surface above unengaged)
  - getActionQueue with inline bodyText preview on draft items (first 200 chars)
  - Dashboard ActionRow split: draft rows as <div>+Send button, non-draft rows as <Link>
  - One-click Send button on draft rows calling approveDraft mutation with queue invalidation

affects:
  - Phase 21 (discovery + cleanup) — action queue now filters noise, admin sees cleaner signal

# Tech tracking
tech-stack:
  added: []
  patterns:
    - latestEngagementAt helper function computing max(updatedAt, pdfDownloadedAt, callBookedAt) from sessions
    - Prisma none filter on researchRuns.status to exclude in-progress research prospects
    - ActionRow dual render path — draft vs non-draft — avoids invalid <button> inside <Link> nesting
    - onSendDraft + isSendPending prop chain: AdminDashboard → ActionSection → ActionRow

key-files:
  created: []
  modified:
    - server/routers/admin.ts
    - app/admin/page.tsx

key-decisions:
  - "researchInProgressStatuses uses per-element 'as const' (not array 'as const') to remain assignable to mutable ResearchStatus[] for Prisma's { in: [...] } filter"
  - 'ActionRow split: draft items render as <div> container with inline Send button, non-draft items keep <Link> wrapper — avoids invalid nested interactive HTML'
  - 'approveDraft onError also invalidates the cache — if the draft was already sent (idempotency conflict), the stale row disappears on refresh'
  - 'isSendPending is shared across all draft rows — clicking any Send button disables all buttons until the mutation resolves'

patterns-established:
  - 'latestEngagementAt pattern: take 1 session ordered by updatedAt desc, compute max over nullable date fields'
  - 'Prisma none filter for relation exclusion: researchRuns: { none: { status: { in: [...] } } } — excludes prospects with ANY matching run'

# Metrics
duration: ~4 min
completed: 2026-02-23
---

# Phase 20 Plan 03: Action Queue Enhancements + Inline Send Summary

**getActionQueue now filters out researching-stage prospects, surfaces engaged leads first, and the dashboard shows inline draft previews with a one-click Send button that calls the idempotency-guarded approveDraft mutation.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-23T01:57:32Z
- **Completed:** 2026-02-23T02:01:09Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- PIPE-02 filter: all four getActionQueue parallel queries now exclude prospects where any researchRun has status PENDING/CRAWLING/EXTRACTING/HYPOTHESIS/BRIEFING — admin sees only actionable-stage items
- PIPE-03 ranking: latestEngagementAt helper reads the most recent prospect session engagement signal (pdfDownloadedAt, callBookedAt, updatedAt); engaged prospects sort above unengaged within each urgency tier
- SEND-01 send button: draft rows render as a <div> (not a <Link>) with an inline Send button that calls approveDraft.mutate({id}), which then calls the Phase 20 Plan 01 idempotency guard — second click is a no-op at the DB level; queue refreshes on success or conflict

## Task Commits

Each task was committed atomically:

1. **Task 1: Enhance getActionQueue — research filter, engagement ranking, and draft preview data** — `85d7cb0` (feat)
2. **Task 2: Update dashboard UI with inline send button for draft rows** — `6e52066` (feat)

## Files Created/Modified

- `server/routers/admin.ts` — Added latestEngagementAt helper function; added researchInProgressStatuses array; extended all four queries with none filter on researchRuns + sessions select for engagement; added preview field to draftItems; updated sort with engagement tier
- `app/admin/page.tsx` — Extended ActionItem type with preview and engagementAt fields; added approveDraft useMutation with cache invalidation; refactored ActionRow into draft/<div>+Send vs non-draft/<Link> render paths; added Active indicator for engaged prospects; threaded onSendDraft and isSendPending through ActionSection

## Decisions Made

- Used per-element `as const` on the researchInProgressStatuses array (not `as const` on the whole array literal) — making the array readonly causes TS2322 when assigning to Prisma's `ResearchStatus[]` mutable type for `{ in: [...] }` filter
- ActionRow dual render path (draft = div+button, non-draft = Link) — placing a `<button>` inside a `<Link>` is invalid HTML; clicks propagate to the Link and navigate instead of firing the mutation
- approveDraft `onError` also calls invalidate — if the draft was already sent (idempotency CONFLICT), the stale row vanishes on refresh rather than staying stuck
- isSendPending shared across all draft rows — avoids concurrent sends in a single session, complements the DB-level idempotency guard

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed readonly array causing TS2322 on Prisma status filter**

- **Found during:** Task 1 (TypeScript check after implementing research filter)
- **Issue:** `as const` on the entire array made it `readonly ["PENDING", ...]` — not assignable to `ResearchStatus[]` (mutable) which Prisma's `{ in: [] }` requires
- **Fix:** Changed to per-element `as const` on each string literal, keeping the array itself mutable
- **Files modified:** server/routers/admin.ts
- **Verification:** `npx tsc --noEmit` zero errors after fix
- **Committed in:** 85d7cb0 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — readonly array type mismatch)
**Impact on plan:** Single-line fix, zero behavior change. No scope creep.

## Issues Encountered

None beyond the readonly array fix above. Both files compiled cleanly on first attempt after the fix.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 20 is COMPLETE — all three plans shipped: idempotency guards (Plan 01), pipeline stage chips (Plan 02), and action queue enhancements + inline send (Plan 03)
- Phase 21 (Prospect Discovery + Cleanup) can begin: Apollo sector search for discovery, removal of dead/legacy pages
- Admin workflow is now queue-first with full one-click send capability: check queue → see engaged prospects first → send drafts inline without navigation

---

_Phase: 20-one-click-send-queue-pipeline-view_
_Completed: 2026-02-23_

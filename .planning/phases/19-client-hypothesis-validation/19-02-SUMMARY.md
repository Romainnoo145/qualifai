---
phase: 19-client-hypothesis-validation
plan: '02'
subsystem: ui
tags: [react, trpc, optimistic-update, hypothesis-validation, voor-dashboard]

# Dependency graph
requires:
  - phase: 19-client-hypothesis-validation
    plan: '01'
    provides: validateByProspect mutation and prospectProcedure middleware
provides:
  - Hypothesis validation card UI in Step 1 of /voor/ dashboard with confirm/decline buttons
  - Optimistic update state management for instant visual feedback
  - SENT+ visibility gate so validation only appears after first outreach
  - Pre-population of confirmed/declined state from server hypothesis status
affects:
  - 20-01 (send queue can now surface hypothesis confirmation rates as engagement signal)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Optimistic update pattern: setValidationState before mutate() call — instant UI feedback without waiting for server response
    - Server-to-client status hydration: useEffect pre-populates local state from Prisma-fetched hypothesis.status on mount
    - Fragment wrapping for ternary multi-children: React Fragment (<>) wraps grid + conditional validation section in hypotheses.length > 0 branch

key-files:
  created: []
  modified:
    - app/voor/[slug]/page.tsx
    - app/voor/[slug]/dashboard-client.tsx

key-decisions:
  - 'HypothesisData.status typed as full enum union (DRAFT | ACCEPTED | REJECTED | PENDING | DECLINED) not subset — Prisma returns the full HypothesisStatus enum and narrowing to subset caused TS2322 type incompatibility'
  - 'Task 1 and Task 2 committed together as one atomic feat commit — prospectStatus declared in Task 1 is consumed in Task 2; splitting at TypeScript level would cause TS6133 unused-var in the intermediate state'
  - 'Validation section placed below hypothesis grid as sibling, not inside each card — keeps the cards clean (discovery content) and the validation section as a separate action zone'

patterns-established:
  - 'Optimistic mutation pattern for /voor/ dashboard: update local Record<id, state> before calling tRPC mutation; buttons disappear instantly on click'

# Metrics
duration: 3min
completed: 2026-02-22
---

# Phase 19 Plan 02: Hypothesis Validation UI on /voor/ Dashboard

**Prospect-facing confirm/decline buttons in Step 1 (Pijnpunten) with optimistic state management, SENT+ visibility gate, and Dutch NL labels ("Ja, herkenbaar" / "Nee")**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-22T17:23:44Z
- **Completed:** 2026-02-22T17:27:23Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `status: true` to the `workflowHypotheses` Prisma select in page.tsx so each hypothesis's validation status is fetched server-side
- Passed `prospectStatus={prospect.status}` from page.tsx to DashboardClient to enable the SENT+ visibility gate
- Extended `HypothesisData` and `DashboardClientProps` interfaces in dashboard-client.tsx with the new typed fields
- Added `validateByProspect` mutation with optimistic update handler — clicking confirm/decline updates local state immediately before the server call fires
- Added `showValidation` gate computed from `prospectStatus` — only shows for SENT/VIEWED/ENGAGED/CONVERTED prospects
- Added validation card section below hypothesis grid in Step 1 with per-hypothesis confirm/decline buttons; confirmed shows green "Bevestigd" chip; declined shows dimmed "Niet van toepassing"; pre-populates from server status on mount

## Task Commits

Tasks 1 and 2 committed together as one atomic feat commit (TypeScript constraint: prospectStatus declared in Task 1 consumed in Task 2, splitting would cause TS6133):

1. **Task 1 + Task 2: Data plumbing + validation UI** - `ba2117e` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `app/voor/[slug]/page.tsx` - Added `status: true` to workflowHypotheses select; passed `prospectStatus={prospect.status}` prop to DashboardClient
- `app/voor/[slug]/dashboard-client.tsx` - Extended HypothesisData and DashboardClientProps interfaces; added validationState useState, pre-population useEffect, validateByProspect mutation, handleValidate handler, showValidation gate, and validation card UI in Step 1

## Decisions Made

- `HypothesisData.status` typed as full Prisma enum union (`DRAFT | ACCEPTED | REJECTED | PENDING | DECLINED`) because Prisma returns the complete `HypothesisStatus` enum — narrowing to a subset caused TS2322 type incompatibility at the `hypotheses={prospect.workflowHypotheses}` prop site
- Tasks 1 and 2 committed together: declaring `prospectStatus` in Task 1 without using it in Task 2 causes TS6133; the TypeScript-level atomicity makes a single feat commit the correct approach
- Validation section placed as a sibling block below the grid (not embedded in each hypothesis card) — keeps the discovery cards clean and creates a clear action zone for prospect input

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Broadened HypothesisData.status type to match full Prisma enum**

- **Found during:** Task 1 (adding status field to HypothesisData interface)
- **Issue:** Plan specified `'ACCEPTED' | 'PENDING' | 'DECLINED'` but Prisma's `HypothesisStatus` enum includes `DRAFT` and `REJECTED` as well. TypeScript raised TS2322 on the `hypotheses={prospect.workflowHypotheses}` prop.
- **Fix:** Changed type to `'DRAFT' | 'ACCEPTED' | 'REJECTED' | 'PENDING' | 'DECLINED'` to match the full Prisma enum.
- **Files modified:** app/voor/[slug]/dashboard-client.tsx
- **Verification:** `npx tsc --noEmit` passed with zero errors
- **Committed in:** ba2117e (Task 1+2 commit)

**2. [Rule 1 - Bug] Wrapped ternary true-branch in React Fragment to allow sibling nodes**

- **Found during:** Task 2 (adding validation section after hypothesis grid)
- **Issue:** JSX ternary true-branch had two sibling nodes (`<div className="grid">` and `{showValidation && ...}`) — TS1005 syntax error "')' expected"
- **Fix:** Wrapped both nodes in a React Fragment (`<>...</>`) so the ternary evaluates to a single expression
- **Files modified:** app/voor/[slug]/dashboard-client.tsx
- **Verification:** `npx tsc --noEmit` passed with zero errors
- **Committed in:** ba2117e (Task 1+2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bugs in plan's type/JSX specification)
**Impact on plan:** Essential fixes — plan's type spec was too narrow and JSX structure was syntactically invalid. No scope creep.

## Issues Encountered

- Prisma `HypothesisStatus` enum has 5 values (DRAFT, ACCEPTED, REJECTED, PENDING, DECLINED) but plan spec only listed 3 — caught immediately by TypeScript, fixed inline.
- JSX ternary branches cannot have multiple siblings — React Fragment wrapper required.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Prospects visiting `/voor/[slug]` with status SENT/VIEWED/ENGAGED/CONVERTED now see the "Herkent u deze pijnpunten?" validation section in Step 1
- Clicking "Ja, herkenbaar" fires `validateByProspect` with action: 'confirm' → sets hypothesis to ACCEPTED in DB
- Clicking "Nee" fires `validateByProspect` with action: 'decline' → sets hypothesis to DECLINED (final state)
- Admin analysis section (from Phase 19 Plan 01) already shows "Confirmed by prospect" (green) / "Declined by prospect" for the updated statuses
- Phase 19 is complete — hypothesis validation loop is closed from admin quality gate through prospect confirmation back to admin view

---

## Self-Check: PASSED

- FOUND: app/voor/[slug]/page.tsx
- FOUND: app/voor/[slug]/dashboard-client.tsx
- FOUND: .planning/phases/19-client-hypothesis-validation/19-02-SUMMARY.md
- FOUND commit: ba2117e

---

_Phase: 19-client-hypothesis-validation_
_Completed: 2026-02-22_

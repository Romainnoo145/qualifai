---
phase: 19-client-hypothesis-validation
plan: '01'
subsystem: api
tags: [trpc, prisma, hypotheses, authorization, middleware]

# Dependency graph
requires:
  - phase: 18-research-quality-gate
    provides: PENDING/DECLINED HypothesisStatus enum values in schema
provides:
  - prospectProcedure middleware: slug-scoped tRPC auth for /voor/ routes
  - validateByProspect mutation: confirms or declines a hypothesis via prospect slug
  - Updated outreach gates: PENDING hypotheses accepted alongside ACCEPTED
  - Updated admin STATUS_LABELS: ACCEPTED now means "Confirmed by prospect"
affects:
  - 19-02 (client /voor/ dashboard UI uses validateByProspect)
  - 20-01 (send queue reads hypothesis validation status)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - prospectProcedure middleware pattern: getRawInput() extracts slug before input parsing, validates prospect exists and is publicly visible, injects prospectId into context
    - Slug-scoped authorization: mutations validate ownership via prospectId injected by middleware

key-files:
  created: []
  modified:
    - server/trpc.ts
    - server/routers/hypotheses.ts
    - server/routers/assets.ts
    - server/routers/wizard.ts
    - components/features/prospects/analysis-section.tsx

key-decisions:
  - 'prospectProcedure uses getRawInput() (async) not rawInput — tRPC v11 middleware API requires async getRawInput call before input parsing'
  - "validateByProspect uses (ctx as unknown as { prospectId: string }).prospectId cast — base tRPC context type doesn't include prospectId, middleware injects it at runtime"
  - 'DECLINED is final state: re-submitting confirm/decline on a DECLINED hypothesis is a no-op'
  - 'All outreach gates (assets.ts x5, wizard.ts x1) now accept PENDING alongside ACCEPTED — PENDING = quality-approved, prospect validation is not a prerequisite for initial outreach'
  - "ACCEPTED STATUS_LABEL changed to 'Confirmed by prospect' (green) — accurately reflects Phase 19 flow where validation happens on /voor/ dashboard"

patterns-established:
  - 'prospectProcedure: slug-scoped middleware pattern for /voor/ dashboard mutations, parallel to adminProcedure for admin routes'

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 19 Plan 01: Backend Infrastructure for Prospect Hypothesis Validation

**slug-scoped prospectProcedure middleware + validateByProspect mutation enabling /voor/ dashboard to confirm or decline hypotheses with authorization, and PENDING hypotheses now accepted across all outreach gates**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-22T17:18:52Z
- **Completed:** 2026-02-22T17:21:25Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added `prospectProcedure` middleware to `server/trpc.ts`: validates nanoid slug maps to a publicly-visible prospect, injects `prospectId` into downstream context
- Added `validateByProspect` mutation to hypotheses router: confirms or declines a hypothesis owned by the slug's prospect, with DECLINED as final no-op state
- Updated 6 outreach gates (assets.ts x5, wizard.ts x1) to accept `{ in: ['ACCEPTED', 'PENDING'] }` instead of bare `'ACCEPTED'`
- Extended `listAll` enum in hypotheses.ts to include `PENDING` and `DECLINED` values
- Updated admin `STATUS_LABELS` and `STATUS_PILL` so ACCEPTED shows "Confirmed by prospect" in green (emerald), accurately reflecting Phase 19 validation flow

## Task Commits

Each task was committed atomically:

1. **Task 1: Add prospectProcedure middleware + validateByProspect mutation** - `35d4171` (feat)
2. **Task 2: Update ACCEPTED status references + admin STATUS_LABELS** - `af828a2` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `server/trpc.ts` - Added `prospectProcedure` middleware with slug validation and prospectId injection
- `server/routers/hypotheses.ts` - Added `validateByProspect` mutation; extended `listAll` enum; imported `TRPCError` and `prospectProcedure`
- `server/routers/assets.ts` - 5 hypothesis/opportunity status gates updated to include PENDING
- `server/routers/wizard.ts` - `requestQuote` hypothesis filter updated to include PENDING
- `components/features/prospects/analysis-section.tsx` - STATUS_LABELS ACCEPTED -> 'Confirmed by prospect'; STATUS_PILL ACCEPTED -> emerald green

## Decisions Made

- `getRawInput()` (async) required in tRPC v11 middleware instead of `rawInput` property — the v11 API changed the middleware signature so raw input must be fetched asynchronously
- `(ctx as unknown as { prospectId: string }).prospectId` cast used in validateByProspect — base TRPCContext type doesn't include prospectId, it's injected at runtime by prospectProcedure; consistent with how Phase 13 pattern handles enriched context
- DECLINED is final: no-op on re-confirm/re-decline of an already-declined hypothesis prevents accidental state reversals
- PENDING hypotheses are outreach-eligible — quality-approved hypotheses should not require prospect confirmation before initial outreach is generated; prospect validation is an additional signal, not a gate

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed tRPC v11 rawInput API usage**

- **Found during:** Task 1 (prospectProcedure middleware)
- **Issue:** Plan specified `rawInput` as a parameter but tRPC v11 exposes `getRawInput` (async function) instead — `rawInput` doesn't exist on the middleware opts type
- **Fix:** Changed `async ({ ctx, rawInput, next })` to `async ({ ctx, getRawInput, next })` and added `const rawInput = await getRawInput()`
- **Files modified:** server/trpc.ts
- **Verification:** `npx tsc --noEmit` passed with zero errors
- **Committed in:** 35d4171 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in plan's API usage, tRPC v11 async getRawInput)
**Impact on plan:** Essential fix to match actual tRPC v11 API. No scope creep.

## Issues Encountered

- tRPC v11 middleware uses `getRawInput()` async function, not `rawInput` direct property — caught immediately by TypeScript, fixed inline.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend mutation `hypotheses.validateByProspect` is ready to be called from the /voor/ dashboard UI
- `prospectProcedure` middleware can be reused for any other slug-scoped /voor/ mutations in Plan 02
- All outreach gates accept PENDING hypotheses — system works correctly for the new status flow
- Admin analysis section correctly shows "Confirmed by prospect" (green) for validated hypotheses

---

_Phase: 19-client-hypothesis-validation_
_Completed: 2026-02-22_

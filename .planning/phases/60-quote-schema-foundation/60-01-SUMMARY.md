---
phase: 60-quote-schema-foundation
plan: 01
subsystem: api
tags: [trpc, prisma, state-machine, prospect-status, vitest, foundation]

# Dependency graph
requires:
  - phase: 59-unified-outreach-pipeline
    provides: ProspectStatus enum (DRAFT..ARCHIVED), admin.updateProspect mutation, prospectProcedure
provides:
  - typed ProspectStatus constant arrays (single source of truth)
  - prospect state-machine helper assertValidProspectTransition reusable by Plan 04 transitionQuote
  - admin.updateProspect now refuses invalid transitions with PRECONDITION_FAILED
affects:
  [
    60-02,
    60-03,
    60-04,
    61-quote-pdf-render,
    future plans touching ProspectStatus,
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Typed `as const` constant arrays for status literals — keep in lib/constants/<entity>-statuses.ts'
    - 'State machine = pure function (current, next) -> void, throws TRPCError, no DB'
    - 'tRPC mutation guards: load current state, assert transition, then write — never write blindly'

key-files:
  created:
    - lib/constants/prospect-statuses.ts
    - lib/constants/prospect-statuses.test.ts
    - lib/state-machines/prospect.ts
    - lib/state-machines/prospect.test.ts
    - server/routers/admin.updateProspect.test.ts
  modified:
    - server/routers/admin.ts
    - server/routers/wizard.ts
    - server/trpc.ts
    - components/public/prospect-dashboard-client.tsx

key-decisions:
  - 'Pre-stage QUOTE_SENT in constants array via `as const` (Plan 02 had already shipped the Prisma enum extension, so the post-task-03 cleanup added `satisfies readonly ProspectStatus[]` on every constant array and swapped the state-machine import to `@prisma/client` — drift is now a build error)'
  - 'VALID_PROSPECT_TRANSITIONS allows ARCHIVED only as terminal sink; QUOTE_SENT can fall back to ENGAGED if a quote is rejected'
  - "Single-value status writes (e.g. `data: { status: 'ENGAGED' }`) deliberately left as inline literals; only array filters are constant-extracted"
  - 'admin.updateProspect Zod input enum keeps the 9-value list — QUOTE_SENT is reachable only through transitionQuote (Plan 04), never via manual admin edit'

patterns-established:
  - 'Pattern: status constants module — entity-statuses.ts exporting `as const` arrays + named types per use case'
  - 'Pattern: state-machine module — pure (current, next) function throwing PRECONDITION_FAILED, reused by every entrypoint that mutates the status'
  - 'Pattern: tRPC mutation guard — load current row with `select: { status: true }`, call assert helper, then update'

requirements-completed: [FOUND-01, FOUND-02, TEST-01]

# Metrics
duration: 22min
completed: 2026-04-13
---

# Phase 60 Plan 01: Foundation Refactors Summary

**Typed ProspectStatus constants module + prospect state-machine helper wired into admin.updateProspect with PRECONDITION_FAILED guard, replacing scattered inline status arrays across the wizard, trpc, dashboard, and admin routers.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-04-13T11:00:00Z
- **Completed:** 2026-04-13T11:22:00Z
- **Tasks:** 3
- **Files modified:** 4 (admin.ts, wizard.ts, trpc.ts, prospect-dashboard-client.tsx)
- **Files created:** 5 (2 source + 3 test)

## Accomplishments

- Single source of truth for all ProspectStatus literal arrays in `lib/constants/prospect-statuses.ts` — six named arrays (`ALL_PROSPECT_STATUSES`, `PUBLIC_VISIBLE_STATUSES`, `POST_FIRST_VIEW_STATUSES`, `QUOTE_SENDABLE_STATUSES`, `DASHBOARD_VISIBLE_STATUSES`, `READY_FOR_OUTREACH_STATUSES`) plus matching named types
- `assertValidProspectTransition(current, next)` helper in `lib/state-machines/prospect.ts` — pure function, no DB, throws `TRPCError('PRECONDITION_FAILED')` on invalid moves, idempotent on self-transitions, ARCHIVED as terminal sink
- `admin.updateProspect` now loads current status before writing and rejects illegal transitions before any Prisma `update` call
- `findScopedProspectOrThrow` widened to return `{ id, status }` (was `void`) so callers can read the current status without a second query
- `server/trpc.ts` `prospectProcedure`, `server/routers/wizard.ts`, and `components/public/prospect-dashboard-client.tsx` all reference the typed constant arrays instead of inline `['READY','SENT',...]` literals
- 14 vitest assertions across 3 test files cover the constants, the state machine, and the admin router guard end-to-end

## Task Commits

Each task was committed atomically:

1. **Task 1: Create typed prospect status constants module** — `12dfd54`
2. **Task 2: Create prospect state machine module + tests** — `1e2b3ac`
3. **Task 3: Wire admin.updateProspect + sweep ProspectStatus literals** — `e7c0b09`

_Plan 02's parallel executor (commit `890d200`) subsequently tightened `lib/constants/prospect-statuses.ts` and `lib/state-machines/prospect.ts` to use `satisfies readonly ProspectStatus[]` and `import type { ProspectStatus } from '@prisma/client'` once Plan 02's migration applied the enum extension to the dev DB. This was the cross-plan handoff anticipated in Plan 01's `<behavior>` notes._

_Note: Task 1 and Task 2 are both TDD-style but bundled the test + source into a single commit per the plan's `<action>` block (one file pair, one passing run, one commit). Task 3 contains both the production refactor and the new regression test file in a single commit because the test is meaningless without the wired guard._

## Files Created/Modified

- `lib/constants/prospect-statuses.ts` — typed `as const` arrays + named types
- `lib/constants/prospect-statuses.test.ts` — 5 vitest cases on shape/order/membership
- `lib/state-machines/prospect.ts` — `VALID_PROSPECT_TRANSITIONS` map + `assertValidProspectTransition`
- `lib/state-machines/prospect.test.ts` — 7 vitest cases (3 valid paths, 1 canonical invalid, 1 terminal, 1 idempotent, 1 shape)
- `server/routers/admin.ts` — wired `assertValidProspectTransition` into `updateProspect`, widened `findScopedProspectOrThrow`, replaced inline `['READY','ENRICHED']` filter with `READY_FOR_OUTREACH_STATUSES`
- `server/routers/wizard.ts` — replaced two inline status arrays with `PUBLIC_VISIBLE_STATUSES` and `POST_FIRST_VIEW_STATUSES`
- `server/trpc.ts` — `prospectProcedure` allowlist now uses `PUBLIC_VISIBLE_STATUSES`
- `components/public/prospect-dashboard-client.tsx` — validation block uses `DASHBOARD_VISIBLE_STATUSES`
- `server/routers/admin.updateProspect.test.ts` — 2 router-level cases (invalid CONVERTED → DRAFT rejected, valid ENRICHED → READY persisted)

## Decisions Made

- **Pre-staged `QUOTE_SENT` in constants without `satisfies` clause** — Plan 60-02 had already shipped (`460613f`) so the Prisma enum already contained `QUOTE_SENT`, but the plan instructed `as const` only to keep the constants module Plan-02-independent. Followed the plan as written; no `satisfies` added.
- **Did NOT widen the `admin.updateProspect` Zod input enum to include `QUOTE_SENT`** — explicitly per plan. `QUOTE_SENT` is reachable only via Plan 60-04's `transitionQuote` helper, never via a direct admin edit.
- **Used `as readonly string[]` casts at call sites** instead of widening the constant types to `ProspectStatus[]` — preserves narrow inference on the constants while satisfying `Array.includes` against `prospect.status: string`.
- **Added two new constants beyond the plan's literal list:** `DASHBOARD_VISIBLE_STATUSES` (for the discover page validation block) and `READY_FOR_OUTREACH_STATUSES` (for the admin action queue's `['READY','ENRICHED']` filter). Both were called out in the plan's Step 6/8 instructions as expected additions.

## Deviations from Plan

None within Plan 01's task scope - plan executed exactly as written.

**Cross-plan handoff (not a deviation):** the plan deliberately shipped `lib/constants/prospect-statuses.ts` with `as const` only and `lib/state-machines/prospect.ts` keyed on `AllProspectStatus` (the local type alias) on the assumption that Plan 60-02 would later extend the Prisma enum with `QUOTE_SENT`. Plan 60-02's executor (running in parallel in Wave 1) finalized that handoff in commit `890d200` by re-adding `satisfies readonly ProspectStatus[]` and swapping the state-machine import to `@prisma/client`. Both halves of the handoff were anticipated in Plan 01's `<behavior>` notes.

The pre-existing tsc errors in `lib/enrichment/sitemap.test.ts` (unrelated test type drift) and `scripts/tmp-run-analysis-nedri.ts` (temporary debug script using deprecated APIs) are out of scope per the executor's scope-boundary rule. Verified via `git stash`/`tsc` that the count is identical (10 errors) before and after this plan's edits — none of them are in files touched by Plan 60-01.

The plan listed `server/routers/campaigns.ts`, `lib/pipeline-stage.ts`, `lib/outreach/reply-workflow.ts`, `app/discover/[slug]/page.tsx`, and `app/api/webhooks/calcom/route.ts` as candidate sites. Inspection confirmed each contains only **single-value** status comparisons (e.g. `prospect.status === 'CONVERTED'`) or non-ProspectStatus literals (e.g. `EMAILED_SEQUENCE_STATUSES` is sequence status, `outreachStep.status` is step status). Per the plan's "single-value writes / comparisons stay literal" rule, these files were not modified.

## Issues Encountered

- **Test bootstrap failure on first run of `admin.updateProspect.test.ts`** — Importing `appRouter` triggered `new Resend(env.RESEND_API_KEY)` at module load (via `server/routers/outreach.ts → lib/outreach/send-email.ts`), throwing because the test env had no Resend key. Fix: copy the full `vi.mock` hoisted-mock set from `lib/outreach/send-email.test.ts` (env, send-email, cadence engine, prospect-url, generate-outreach, automation processor, reply-workflow). 7 module mocks total. Same convention as the existing test in the codebase.
- **`findScopedProspectOrThrow` was returning `void`** — needed to widen its return type to `{ id; status }` and add `select: { id: true, status: true }` so the new state-machine assertion has a current value to compare against. Other call sites of the helper (Task 1 grep: lines 279 and 673 in admin.ts) only consume the throw behavior, so the wider return is additive and safe.

## User Setup Required

None — no external service configuration introduced.

## Next Phase Readiness

- **Plan 60-04 (`transitionQuote`)** can now `import { assertValidProspectTransition } from '@/lib/state-machines/prospect'` and reuse the same guard inside its Quote → Prospect auto-sync transaction. The state machine already lists `QUOTE_SENT` as a legal target from `ENGAGED`/`VIEWED` and `CONVERTED`/`ENGAGED` as legal targets from `QUOTE_SENT`, matching the locked Q13 decision.
- **Plan 60-02 (already shipped)** introduced `QUOTE_SENT` to the Prisma enum. The follow-up cleanup commit at the end of Plan 60-01 retroactively added `satisfies readonly ProspectStatus[]` to every constant array and swapped the state-machine type import to `@prisma/client`. No outstanding drift between the constants module and the live enum.
- **No blockers** for Plan 60-03 / 60-04 / 60-05.

## Self-Check: PASSED

Verified all artifacts exist and tests pass:

- `lib/constants/prospect-statuses.ts` — FOUND (commit 12dfd54)
- `lib/constants/prospect-statuses.test.ts` — FOUND (commit 12dfd54)
- `lib/state-machines/prospect.ts` — FOUND (commit 1e2b3ac)
- `lib/state-machines/prospect.test.ts` — FOUND (commit 1e2b3ac)
- `server/routers/admin.updateProspect.test.ts` — FOUND (commit e7c0b09)
- Commit `12dfd54` (task-01) — FOUND in git log
- Commit `1e2b3ac` (task-02) — FOUND in git log
- Commit `e7c0b09` (task-03) — FOUND in git log
- `npm run test -- lib/constants/prospect-statuses.test.ts` — 5/5 PASS
- `npm run test -- lib/state-machines/prospect.test.ts` — 7/7 PASS
- `npm run test -- server/routers/admin.updateProspect.test.ts` — 2/2 PASS
- `npx tsc --noEmit` — 10 errors, all pre-existing, none in files touched by this plan
- `npx eslint <touched files>` — clean

---

_Phase: 60-quote-schema-foundation_
_Completed: 2026-04-13_

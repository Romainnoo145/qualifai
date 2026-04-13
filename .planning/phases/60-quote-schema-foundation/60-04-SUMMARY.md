---
phase: 60-quote-schema-foundation
plan: 04
subsystem: api
tags:
  [
    trpc,
    state-machine,
    quote,
    multi-tenant,
    vitest,
    foundation,
    snapshot-freeze,
  ]

# Dependency graph
requires:
  - phase: 60-quote-schema-foundation/60-01
    provides: 'assertValidProspectTransition helper (reused in Quote -> Prospect sync)'
  - phase: 60-quote-schema-foundation/60-02
    provides: 'Quote, QuoteLine, QuoteStatus, SnapshotStatus, ProspectStatus.QUOTE_SENT via @prisma/client'
  - phase: 60-quote-schema-foundation/60-03
    provides: 'QuoteSnapshotSchema (Zod 4) + QuoteSnapshot type'
provides:
  - 'lib/state-machines/quote.ts — VALID_QUOTE_TRANSITIONS map, QUOTE_TO_PROSPECT_SYNC map, transitionQuote helper, buildSnapshotFromQuote helper'
  - 'transitionQuote is the ONLY authorised path for mutating Quote.status (runtime invariant enforced by router)'
  - 'server/routers/quotes.ts — 5 tRPC procedures (list, get, create, update, transition) using projectAdminProcedure'
  - 'Multi-tenant scope via prospect.projectId join — Quote has no direct projectId column, preventing duplicate-column drift'
  - 'Q9 immutability gate: quotes.update rejects non-DRAFT quotes with PRECONDITION_FAILED'
  - 'Snapshot freeze on DRAFT -> SENT: snapshotData (Zod-validated), snapshotAt, templateVersion, snapshotStatus all persisted inside the same Prisma $transaction as the status update'
  - 'TEST-02 coverage (12 cases) + TEST-03 coverage (7 cases) = 19 new vitest assertions'
affects:
  - 60-05 (YAML import script will use the new Quote/QuoteLine models + quotes router is now live)
  - 61-quote-pdf-render (PDF worker can call quotes.get / quotes.transition via tRPC)
  - 62-client-proposal-page (client-facing dashboard can delegate status mutations to the router)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'State machine helper runs read + validate + write + cascade inside a single Prisma $transaction — partial failure rolls back both Quote and Prospect updates'
    - 'Snapshot freeze is transactional: QuoteSnapshotSchema.parse throws BEFORE any Prisma write, so invalid snapshots never reach the DB'
    - 'Router `update` Zod input deliberately OMITS status/snapshot*/replacesId — the only mutation path for those fields is transitionQuote via the dedicated `transition` procedure'
    - 'Multi-tenant scope via relation filter (prospect.projectId) rather than a duplicate column on Quote — the Prospect FK IS the tenancy boundary'
    - 'assertQuoteInProject / assertProspectInProject helpers pattern: load {id, status} scoped to ctx.projectId, throw NOT_FOUND on miss, return narrowed row for follow-up checks'
    - 'tRPC router test pattern: vi.mock() the env + every side-effect module BEFORE importing appRouter (Pitfall 7), then use appRouter.createCaller with mocked Prisma + adminToken'

key-files:
  created:
    - 'server/routers/quotes.ts (Task 2 — 248 lines, 5 procedures + 2 scope helpers)'
    - 'server/routers/quotes.test.ts (Task 3 — 7 vitest cases across 3 describe blocks)'
    - '.planning/phases/60-quote-schema-foundation/60-04-SUMMARY.md (this file)'
  modified:
    - 'server/routers/_app.ts (register quotes: quotesRouter in alphabetical order)'
  shipped_before_this_session:
    - 'lib/state-machines/quote.ts (Task 1 — 179 lines, commit 0231a05)'
    - 'lib/state-machines/quote.test.ts (Task 1 — 289 lines, 12 vitest cases, commit 0231a05)'

key-decisions:
  - 'Kept the partial `server/routers/quotes.ts` left by the previous (rate-limited) executor. Verified against the plan spec clause by clause — all 5 procedures present, scope helpers correct, Zod inputs match the locked immutability rule (status/snapshot*/replacesId deliberately omitted from update). Only change needed was registration in _app.ts and a separate router test file.'
  - 'The existing router uses a typed `ScopedCtx` interface with `as unknown as ScopedCtx` casts at each helper call site instead of the plan`s `ctx: { db: any; projectId: string }` signature. This is a strict improvement (no `any` escape hatch) and still compiles cleanly against tRPC context types, so it was kept.'
  - 'Router test file stubs `@/lib/state-machines/quote` via vi.mock so the router test covers only router concerns (input shape, scope checks, error codes, delegation). The state machine itself is already covered by lib/state-machines/quote.test.ts (TEST-02). This also avoids needing a full Prisma transaction mock inside the router test.'
  - 'Used the 7-mock hoisted-import pattern from admin.updateProspect.test.ts (env + send-email + cadence + prospect-url + generate-outreach + automation processor + reply-workflow) to bootstrap appRouter cleanly. One additional vi.mock for the state machine brings the total to 8.'
  - 'TEST-03 multi-project isolation test uses an empty findMany return to prove the Project A caller sees 0 rows, AND asserts the findMany was called with the `prospect.projectId = proj-a` filter. Both together close the gate: the filter is literal in the call AND the return is empty.'
  - 'Added a second negative test for quotes.transition: cross-project id throws NOT_FOUND BEFORE transitionQuote is called (assertQuoteInProject runs first). This belts the Q9 / Q13 invariant that the state machine is only ever invoked on rows scoped to the active project.'

patterns-established:
  - 'Pattern: state-machine + router pair per entity — state machine owns the mutation, router is a thin scope-check + delegate. Quote is the first entity in the codebase to follow this pattern (Prospect has the state machine but admin router still updates directly).'
  - 'Pattern: `update` Zod input omits mutation-controlled fields — any field that goes through a separate guarded path (status, snapshots, versioning FKs) is absent from the Zod schema rather than being accepted-and-ignored.'
  - 'Pattern: router test setup with 8 hoisted vi.mocks for appRouter bootstrap (env + Resend + cadence + AI helpers + automation + reply-workflow + state machine under test).'

requirements-completed:
  - DATA-08
  - DATA-09
  - DATA-10
  - TEST-02
  - TEST-03

# Metrics
duration: ~12min (continuation session; Task 1 already shipped in 0231a05)
completed: 2026-04-13
---

# Phase 60 Plan 04: Quote Router + State Machine Summary

**Runtime layer for Quote/Prospect status mutations: `transitionQuote` helper owns the Quote -> Prospect sync + snapshot freeze inside a single Prisma `$transaction`, and `quotes.*` tRPC router (5 procedures on projectAdminProcedure) routes every status change through it while scoping every query via `prospect: { projectId: ctx.projectId }` — closes the Phase 60 loop with 19 new vitest assertions.**

## Performance

- **Duration:** ~12 min (continuation session)
- **Started:** 2026-04-13T15:04:00Z (continuation)
- **Completed:** 2026-04-13T15:16:00Z
- **Tasks this session:** 2 (Task 2 router + registration, Task 3 router tests)
- **Tasks total:** 3 (Task 1 was shipped in an earlier session as commit 0231a05)
- **Files created this session:** 2 (server/routers/quotes.test.ts, this SUMMARY.md)
- **Files modified this session:** 1 (server/routers/\_app.ts)
- **Files shipped before this session:** 3 (lib/state-machines/quote.ts, lib/state-machines/quote.test.ts, server/routers/quotes.ts left UNTRACKED by the interrupted executor)

## Accomplishments

- **`lib/state-machines/quote.ts` (Task 1, shipped in commit 0231a05 before this session):**
  - `VALID_QUOTE_TRANSITIONS` map covering all 7 `QuoteStatus` values with `ARCHIVED` as terminal sink.
  - `QUOTE_TO_PROSPECT_SYNC` partial map encoding the locked Q13 cascade: `SENT -> QUOTE_SENT`, `ACCEPTED -> CONVERTED`, `REJECTED -> ENGAGED` (VIEWED/EXPIRED/ARCHIVED intentionally unmapped).
  - `transitionQuote(db, quoteId, newStatus)` helper opens a Prisma `$transaction`, loads the quote with prospect + lines, validates the quote-side transition (throws `PRECONDITION_FAILED`), freezes the snapshot on DRAFT -> SENT (Zod-validated), updates the Quote, then calls `assertValidProspectTransition` + updates the Prospect — all inside one atomic transaction.
  - `buildSnapshotFromQuote` pure helper computes `netto = sum(uren * tarief)`, `btw = netto * btwPercentage / 100`, `bruto = netto + btw` and constructs a `QuoteSnapshot` payload.
  - 12 vitest cases cover the state-machine shape, sync mapping, OFF001 totals math, DRAFT -> SENT cascade + snapshot freeze, ACCEPTED + REJECTED + VIEWED transitions, invalid ACCEPTED -> DRAFT rejection, and NOT_FOUND propagation.

- **`server/routers/quotes.ts` (Task 2, Task-02 commit e0c3eb6):**
  - 5 procedures on `projectAdminProcedure`: `list`, `get`, `create`, `update`, `transition`.
  - `assertQuoteInProject` + `assertProspectInProject` scope helpers query through `prospect: { projectId: ctx.projectId }` (for Quote) or `projectId: ctx.projectId` (for Prospect), throwing `NOT_FOUND` when the row is invisible.
  - `list` filters by `prospect: { projectId: ctx.projectId }` and optionally by `status`; includes lines + denormalised prospect metadata.
  - `get` runs the scope assertion BEFORE `findUniqueOrThrow`, so cross-project ids surface as `NOT_FOUND` instead of returning a row or throwing the raw Prisma error.
  - `create` validates the prospect is in scope BEFORE `quote.create`, then creates the Quote + nested QuoteLines in one call with `position` defaulting to array index.
  - `update` Zod input OMITS `status`, `snapshotData`, `snapshotHtml`, `snapshotAt`, `templateVersion`, `snapshotStatus`, `snapshotPdfUrl`, `replacesId`. Rejects non-DRAFT quotes with `PRECONDITION_FAILED` (Q9 immutability). Runs the line-item replace inside a `$transaction`.
  - `transition` runs the scope assertion and then delegates to `transitionQuote(ctx.db, id, newStatus)` — a thin pass-through per the plan.

- **`server/routers/_app.ts` (Task 2 commit e0c3eb6):**
  - Imports `quotesRouter` from `./quotes`.
  - Registers `quotes: quotesRouter` alphabetically between `proof` and `research` — matching the existing alphabetical convention.

- **`server/routers/quotes.test.ts` (Task 3, commit 975f426):**
  - 7 vitest cases across 3 describe blocks:
    1. **Multi-project isolation (TEST-03 / DATA-10):** Project A admin sees 0 quotes when Project B has them; `quotes.get` throws NOT_FOUND for cross-project rows without ever reaching `findUniqueOrThrow`; `quotes.create` throws NOT_FOUND when the prospect is in a different project and `quote.create` is never called.
    2. **Immutability (DATA-08 / Q9):** `quotes.update` on SENT throws `PRECONDITION_FAILED` with a message containing "DRAFT" and `$transaction` is never invoked; `quotes.update` on DRAFT runs inside `$transaction`.
    3. **Transition delegation:** `quotes.transition` calls `transitionQuote(db, id, newStatus)` after the scope check; cross-project id throws `NOT_FOUND` without invoking the helper.
  - Mock surface: 8 hoisted `vi.mock` calls to bootstrap `appRouter` cleanly (env + Resend + cadence + AI helpers + automation + reply-workflow + state machine under test).

## Task Commits

1. **Task 1 (shipped before this session): add quote state machine + transitionQuote helper** — `0231a05` (feat, 2026-04-13 13:37 UTC)
2. **Task 2 (this session): add quotes tRPC router + register in \_app** — `e0c3eb6` (feat, 2026-04-13 15:06 UTC)
3. **Task 3 (this session): add quotes router tests (TEST-03 multi-project isolation)** — `975f426` (test, 2026-04-13 15:08 UTC)

## Files Created/Modified

- `lib/state-machines/quote.ts` — 179 lines, state machine map + sync map + transitionQuote + buildSnapshotFromQuote (Task 1, commit 0231a05)
- `lib/state-machines/quote.test.ts` — 289 lines, 12 vitest cases (Task 1, commit 0231a05)
- `server/routers/quotes.ts` — 248 lines, 5 procedures + 2 scope helpers (Task 2, commit e0c3eb6)
- `server/routers/_app.ts` — +2 lines, import + register `quotes: quotesRouter` (Task 2, commit e0c3eb6)
- `server/routers/quotes.test.ts` — 305 lines, 7 vitest cases across 3 describe blocks (Task 3, commit 975f426)

## Decisions Made

- **Kept the partial router file left by the previous session.** The interrupted executor had committed Task 1 cleanly but left `server/routers/quotes.ts` UNTRACKED. I read the file line-by-line against the plan spec and confirmed every procedure, Zod schema, and scope check matched the plan intent — the only gap was registration in `_app.ts` and a separate test file. No rewrite needed.
- **Preferred the existing router's `ScopedCtx` interface over the plan's `any` signature.** The previous executor used a narrow `ScopedCtx` interface + `as unknown as ScopedCtx` casts at each helper call site instead of the plan's `ctx: { db: any; projectId: string }`. This is strictly safer (no `any` escape hatch), compiles cleanly, and keeps the router surface typed. Left as-is.
- **Stubbed `@/lib/state-machines/quote` in the router test via `vi.mock`.** The router test file should only exercise router concerns (input Zod, scope checks, error codes, delegation). The state machine is already covered by `lib/state-machines/quote.test.ts` (TEST-02, 12 cases). Stubbing avoids having to build a full Prisma transaction mock inside the router test.
- **Extended TEST-03 beyond the plan's 5-test minimum to 7 cases.** The plan specified 5 required cases; I added (a) a positive test that DRAFT updates DO reach `$transaction` (balances the negative immutability test), and (b) a cross-project `transition` test that confirms `transitionQuote` is never called when the scope check fails. Both were cheap and close a tiny remaining invariant gap.
- **Used the 8-mock hoisted bootstrap pattern.** Matches `admin.updateProspect.test.ts` + `send-email.test.ts` conventions, with one extra mock for `@/lib/state-machines/quote`. Without the mock set, importing `appRouter` triggers `new Resend(...)` at module load.

## Deviations from Plan

None within this session's scope — Tasks 2 and 3 shipped exactly as written.

**Prior-session handoff (not a deviation):** The previous (rate-limited) executor shipped Task 1 cleanly as commit `0231a05` and had written `server/routers/quotes.ts` but not committed it (UNTRACKED in git). The continuation task 2 commit picked up that file verbatim after line-by-line verification against the plan. No edits were needed to the router file itself — only registration in `_app.ts`.

**Out-of-scope tsc errors:** `npx tsc --noEmit` reports 10 errors, all in files untouched by Plan 60-04:

- `lib/enrichment/sitemap.test.ts` — Buffer typing drift (pre-existing, 1 error)
- `scripts/tmp-run-analysis-nedri.ts` — stale debug script against deprecated `generateMasterAnalysis` / `retrieveRagChunks` APIs (pre-existing, 9 errors)

These are logged as pre-existing tech debt in the 60-01 and 60-02 summaries and are explicitly NOT in Plan 60-04's scope (per the executor scope-boundary rule).

## Issues Encountered

- **Pre-commit hook `husky` DEPRECATED warning.** The project's `.husky/pre-commit` uses the v9 shebang + source lines that will fail in husky v10. Pre-existing tech debt, logged here for the next maintenance sweep. The hook still functions correctly (lint-staged runs eslint + prettier on staged files, both clean).
- **Prettier reformatting.** Task 3 commit's lint-staged stage reflowed one `vi.mock` call onto a single line; the semantics are unchanged and the tests still pass.

## Verification

- `npm run test -- lib/state-machines/quote.test.ts --run` — ✅ 12/12 PASS (TEST-02)
- `npm run test -- server/routers/quotes.test.ts --run` — ✅ 7/7 PASS (TEST-03)
- `npm run test -- lib/state-machines lib/schemas lib/constants server/routers/quotes.test.ts --run` — ✅ 39/39 PASS across Waves 1-3 (prospect-statuses 5, prospect state machine 7, quote-snapshot 8, quote state machine 12, quotes router 7)
- `npx tsc --noEmit` — ✅ 10 pre-existing errors, 0 new errors, none in Phase 60-04 files
- `rg "prisma\\.quote\\.update.*status" server/ lib/` — ✅ 0 matches (transitionQuote is the single mutation path)
- `rg "snapshotData" server/routers/quotes.ts` — ✅ 0 matches (router never touches snapshot payload directly)
- Grep `quotes: quotesRouter` in `server/routers/_app.ts` — ✅ 1 match
- Grep `from './quotes'` in `server/routers/_app.ts` — ✅ 1 match
- Grep `prospect: { projectId: ctx.projectId }` in `server/routers/quotes.ts` — ✅ 2 matches (list + assertQuoteInProject)
- Grep `transitionQuote` in `server/routers/quotes.ts` — ✅ 2 matches (import + delegation call)
- Grep `Cannot update quote in status` in `server/routers/quotes.ts` — ✅ 1 match (Q9 immutability message)
- Grep `projectId` on `Quote` or `QuoteLine` model in `prisma/schema.prisma` — ✅ 0 matches (no duplicate column)
- ESLint + Prettier (via lint-staged pre-commit) — ✅ clean on all 3 touched files across both commits

## User Setup Required

None — no external service configuration introduced. The `QUOTE_TEMPLATE_VERSION` env var is optional (falls back to today's ISO date).

## Next Phase Readiness

- **Plan 60-05 (`scripts/import-klarifai-yaml.ts`)** can now `import { prisma } from '@/lib/prisma'` and use `prisma.quote.create({ data: { ..., lines: { create: [...] } } })` against the new tables. Multi-tenant isolation works through `prospect.projectId`. The import script will ALSO be able to call the new `quotes.*` router via `appRouter.createCaller({ ... })` if it wants router-level validation instead of direct Prisma writes — but Plan 60-05 may prefer direct Prisma for speed and to bypass the Zod idempotency rewriting.
- **Phase 61 (PDF worker + versioning):** The `replacesId` self-FK is already in the schema (Plan 60-02 pre-emptive addition), and the `transition` procedure will happily accept `ARCHIVED` as a target for any non-terminal status — so versioning ships without a second migration AND without a router change.
- **Phase 62 (client `/voorstel/[slug]` page):** The public proposal page will call `quotes.transition({ id, newStatus: 'VIEWED' })` on first render and `quotes.transition({ id, newStatus: 'ACCEPTED' | 'REJECTED' })` on button click. Multi-tenant isolation is already baked in.
- **No blockers** for Plan 60-05 — Tasks 2 and 3 close the Phase 60 runtime loop as planned.
- **No tech debt added this session.** The only repo-level warning (husky v10 deprecation) is pre-existing and unrelated.

## Self-Check: PASSED

Files verified on disk:

- ✅ `lib/state-machines/quote.ts` (Task 1, shipped in 0231a05)
- ✅ `lib/state-machines/quote.test.ts` (Task 1, shipped in 0231a05)
- ✅ `server/routers/quotes.ts` (Task 2, commit e0c3eb6)
- ✅ `server/routers/_app.ts` (Task 2 registration, commit e0c3eb6)
- ✅ `server/routers/quotes.test.ts` (Task 3, commit 975f426)
- ✅ `.planning/phases/60-quote-schema-foundation/60-04-SUMMARY.md` (this file)

Commits verified in git history:

- ✅ `0231a05` — Task 1 (prior session): add quote state machine + transitionQuote helper
- ✅ `e0c3eb6` — Task 2 (this session): add quotes tRPC router + register in \_app
- ✅ `975f426` — Task 3 (this session): add quotes router tests (TEST-03 multi-project isolation)

Test runs verified:

- ✅ `npm run test -- lib/state-machines/quote.test.ts --run` — 12/12 PASS
- ✅ `npm run test -- server/routers/quotes.test.ts --run` — 7/7 PASS
- ✅ Combined plan-wave run — 39/39 PASS

Type check verified:

- ✅ `npx tsc --noEmit` — 10 pre-existing errors, 0 new errors (baseline unchanged)

---

_Phase: 60-quote-schema-foundation_
_Plan: 04_
_Completed: 2026-04-13_

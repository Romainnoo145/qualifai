---
phase: 60-quote-schema-foundation
verified: 2026-04-13
status: human_needed
score: 4/5 success criteria verified automatically, 1 needs human smoke check
re_verification: false
human_verification:
  - test: 'Romano runs `tsx scripts/import-klarifai-yaml.ts --apply` against the dev/staging DB and inspects Prisma Studio'
    expected: 'Quote table shows 3 rows (OFF001 / OFF002 / OFF003) linked to one Prospect with readableSlug=marfa, bruto totals €7.816,60 / €11.495,00 / €13.285,80'
    why_human: 'The automated TEST-04 suite proves the script correctness end-to-end against a mocked Prisma (7/7 green including idempotent second-apply), AND dry-run against real klarifai-core fixtures logged the three correct totals during 60-05. But ROADMAP success criterion #1 is explicitly written as "Romano runs ... sees the 3 Marfa quotes appear in the Qualifai DB" — that is an operator-level verification gate, not a unit test. The script already has an EXPECTED_TOTALS oracle that throws in --apply mode on mismatch, so the human check is belt-and-braces.'
---

# Phase 60: Quote Schema Foundation Verification Report

**Phase Goal:** The Qualifai database and tRPC API fully support quotes, with typed state machines for both Prospect and Quote, and the 3 existing klarifai-core Marfa quotes imported and accessible in Qualifai.
**Verified:** 2026-04-13
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement — 5 ROADMAP Success Criteria

| #   | Criterion                                                                                             | Status       | Evidence                                                                                                                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Romano `--apply` run produces 3 Marfa quotes in DB with correct totals                                | HUMAN_NEEDED | TEST-04 (7/7 green) proves script logic + EXPECTED_TOTALS oracle. Dry-run against real klarifai-core fixtures in 60-05 logged `OFF001 7816.60 / OFF002 11495.00 / OFF003 13285.80 — OK`. Manual gate remains per ROADMAP wording.                                                                                                         |
| 2   | `quotes.transition(id, ACCEPTED)` sets Quote.ACCEPTED + Prospect.CONVERTED in a single DB transaction | PASS         | `lib/state-machines/quote.test.ts:191-211` — mock `$transaction` passthrough + explicit assertion `prospect.update called with {status: 'CONVERTED'}` and `quote.update called with {status: 'ACCEPTED'}` inside the same `$transaction` wrapper. `lib/state-machines/quote.ts:115` wraps read+validate+write+cascade in `tx => { ... }`. |
| 3   | `admin.updateProspect` with CONVERTED → DRAFT returns typed error without writing                     | PASS         | `server/routers/admin.updateProspect.test.ts:82-99` asserts `code === 'PRECONDITION_FAILED'`. `server/routers/admin.ts:684` calls `assertValidProspectTransition` BEFORE `prisma.prospect.update`. Transition map in `lib/state-machines/prospect.ts:31` has `CONVERTED: ['ARCHIVED']` (no DRAFT).                                        |
| 4   | Zod parse of malformed `snapshotData` throws before Prisma reached                                    | PASS         | `lib/schemas/quote-snapshot.test.ts:56` "reject malformed: missing required field nummer throws ZodError". `lib/state-machines/quote.ts:147` calls `QuoteSnapshotSchema.parse(...)` BEFORE `tx.quote.update` (throw-on-fail semantics, not safeParse).                                                                                    |
| 5   | Multi-project isolation: Project A quotes.list returns 0 when only Project B has quotes               | PASS         | `server/routers/quotes.test.ts:135-155` "Project A admin sees zero quotes when only Project B has quotes" with double-gate assertion: (a) `findMany` called with `prospect: { projectId: 'proj-a' }` AND (b) returns empty array. `server/routers/quotes.ts:89` literal filter in router code.                                            |

**Automated score:** 4/5 PASS · 1/5 HUMAN_NEEDED (intentional, per ROADMAP phrasing)

---

## Required Artifacts

| Artifact                                                    | Expected                                               | Status   | Details                                                                                                                                                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                                      | Quote + QuoteLine + enums + QUOTE_SENT                 | VERIFIED | Line 753 Quote, 802 QuoteLine, 26 QuoteStatus (7 values), 36 SnapshotStatus (4), ProspectStatus.QUOTE_SENT line 21                                                                                                            |
| `prisma/migrations/20260413_quote_foundation/migration.sql` | Additive-only migration                                | VERIFIED | 87 lines, grep for DROP/RENAME returns 0 matches                                                                                                                                                                              |
| `lib/constants/prospect-statuses.ts`                        | Typed `as const satisfies`                             | VERIFIED | 6 arrays, all with `satisfies readonly ProspectStatus[]`, `import type { ProspectStatus } from '@prisma/client'`                                                                                                              |
| `lib/state-machines/prospect.ts`                            | assertValidProspectTransition                          | VERIFIED | Pure fn, TRPCError PRECONDITION_FAILED, CONVERTED only transitions to ARCHIVED                                                                                                                                                |
| `lib/state-machines/quote.ts`                               | transitionQuote + snapshot freeze                      | VERIFIED | `$transaction` wrap at line 115, Zod parse at line 147, Q13 sync map at line 42                                                                                                                                               |
| `lib/schemas/quote-snapshot.ts`                             | QuoteSnapshotSchema + parseSnapshot + getSnapshotField | VERIFIED | Signed `tarief` line 21 (no `.nonnegative()`), NO `snapshotHtml`/`snapshotPdfUrl` in schema (Q14 compliant)                                                                                                                   |
| `server/routers/quotes.ts`                                  | 5 procedures on projectAdminProcedure                  | VERIFIED | list/get/create/update/transition; `update` omits status/snapshot\*/replacesId from Zod; rejects non-DRAFT with PRECONDITION_FAILED                                                                                           |
| `server/routers/_app.ts`                                    | quotesRouter registered                                | VERIFIED | Line 11 import, line 29 registration (alphabetical)                                                                                                                                                                           |
| `server/routers/admin.ts`                                   | updateProspect wired to state machine                  | VERIFIED | Line 17 import, line 684 guard before prisma write                                                                                                                                                                            |
| `scripts/import-klarifai-yaml.ts`                           | Idempotent --dry default + --apply flag                | VERIFIED | `import { prisma } from '@/lib/prisma'` (no `new PrismaClient`), `dotenv/config`, `parseAllDocuments` from eemeli yaml, `apply: boolean` threaded 4×, EXPECTED_TOTALS oracle, matches on `readableSlug` (8 refs) and `nummer` |
| Test files (7)                                              | Vitest co-located next to source                       | VERIFIED | All 7 test files exist and 48/48 tests green in 1.58s                                                                                                                                                                         |

---

## Key Link Verification

| From                                              | To                                            | Via                                                        | Status |
| ------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------- | ------ |
| `server/routers/quotes.ts`                        | `prisma.quote` (project-scoped)               | `where: { prospect: { projectId: ctx.projectId } }`        | WIRED  |
| `server/routers/quotes.ts` `transition`           | `lib/state-machines/quote.ts` transitionQuote | `import { transitionQuote }` + delegation call             | WIRED  |
| `lib/state-machines/quote.ts`                     | `lib/state-machines/prospect.ts`              | `assertValidProspectTransition` imported + called line 167 | WIRED  |
| `lib/state-machines/quote.ts` snapshot freeze     | `lib/schemas/quote-snapshot.ts`               | `QuoteSnapshotSchema.parse(...)` line 147                  | WIRED  |
| `server/routers/admin.ts` updateProspect          | `lib/state-machines/prospect.ts`              | imported line 17, called line 684 BEFORE prisma write      | WIRED  |
| `server/routers/wizard.ts`                        | `lib/constants/prospect-statuses.ts`          | `PUBLIC_VISIBLE_STATUSES`, `POST_FIRST_VIEW_STATUSES`      | WIRED  |
| `server/trpc.ts`                                  | `lib/constants/prospect-statuses.ts`          | `PUBLIC_VISIBLE_STATUSES`                                  | WIRED  |
| `components/public/prospect-dashboard-client.tsx` | `lib/constants/prospect-statuses.ts`          | `DASHBOARD_VISIBLE_STATUSES`                               | WIRED  |
| `scripts/import-klarifai-yaml.ts`                 | `lib/prisma` singleton                        | `import { prisma } from '@/lib/prisma'`                    | WIRED  |
| `server/routers/_app.ts`                          | `quotesRouter`                                | `quotes: quotesRouter` registration                        | WIRED  |

All 10 key links verified WIRED — the goal-backward trace from `quotes.transition → transitionQuote → $transaction → (quote.update + prospect.update)` has zero gaps.

---

## Requirements Coverage

| Req ID    | Description                                                       | Source Plan | Status                               | Evidence                                                                                                  |
| --------- | ----------------------------------------------------------------- | ----------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| DATA-01   | Quote model with narrative fields                                 | 60-02       | PASS                                 | `prisma/schema.prisma:753-800` all narrative + commercial fields present                                  |
| DATA-02   | QuoteLine model with uren/tarief FK                               | 60-02       | PASS                                 | `prisma/schema.prisma:802-820` FK + signed tarief comment                                                 |
| DATA-03   | QuoteStatus enum 7 values                                         | 60-02       | PASS                                 | `prisma/schema.prisma:26-34` exactly 7: DRAFT/SENT/VIEWED/ACCEPTED/REJECTED/EXPIRED/ARCHIVED              |
| DATA-04   | ProspectStatus extended with QUOTE_SENT between ENGAGED/CONVERTED | 60-02       | PASS                                 | `prisma/schema.prisma:13-24` QUOTE_SENT between ENGAGED and CONVERTED                                     |
| DATA-05   | Quote 6 snapshot fields                                           | 60-02       | PASS                                 | `prisma/schema.prisma:779-784` all 6 present + nullable                                                   |
| DATA-06   | Quote → Prospect FK cascade                                       | 60-02       | PASS                                 | `prisma/schema.prisma:793` onDelete: Restrict                                                             |
| DATA-07   | Migration clean on shadow DB, nullable cols                       | 60-02       | PASS                                 | `prisma/migrations/20260413_quote_foundation/migration.sql` 0 DROP/RENAME, applied + recorded per summary |
| DATA-08   | tRPC quotes router with 5 ops                                     | 60-04       | PASS                                 | `server/routers/quotes.ts` list/get/create/update/transition all on projectAdminProcedure                 |
| DATA-09   | transitionQuote transactional Q → P sync                          | 60-04       | PASS                                 | `lib/state-machines/quote.ts:109-179` + 12 TEST-02 cases                                                  |
| DATA-10   | Multi-tenant via prospect.projectId join, no duplicate column     | 60-04       | PASS                                 | grep `projectId` on Quote/QuoteLine = 0 matches; router uses relation filter                              |
| FOUND-01  | Typed status constants, literals replaced                         | 60-01       | PASS                                 | `lib/constants/prospect-statuses.ts` + 3 call sites updated (wizard.ts, trpc.ts, dashboard)               |
| FOUND-02  | admin.updateProspect rejects invalid transitions                  | 60-01       | PASS                                 | `server/routers/admin.ts:684` + 2 TEST-01 cases                                                           |
| FOUND-03  | Zod snapshot schema + write-time validation                       | 60-03       | PASS                                 | `lib/schemas/quote-snapshot.ts` + `.parse` called in `lib/state-machines/quote.ts:147`                    |
| FOUND-04  | Type-safe getSnapshotField accessor                               | 60-03       | PASS                                 | `lib/schemas/quote-snapshot.ts:82` generic `K extends keyof QuoteSnapshot`                                |
| IMPORT-01 | Import matches Prospect on readableSlug                           | 60-05       | PASS                                 | `scripts/import-klarifai-yaml.ts:339` `where: { readableSlug: client.slug }`                              |
| IMPORT-02 | Import creates Quote+QuoteLine, idempotent on nummer              | 60-05       | PASS                                 | Matched on nummer, TEST-04 idempotent-second-run assertion green                                          |
| IMPORT-03 | --dry default, --apply explicit                                   | 60-05       | PASS                                 | `argv.includes('--apply')` line 508; dry-run test asserts zero writes                                     |
| IMPORT-04 | 3 Marfa quotes with correct totals                                | 60-05       | PASS (auto) / HUMAN_NEEDED (ROADMAP) | EXPECTED_TOTALS oracle + real-fixture dry run + TEST-04, see success criterion #1                         |
| TEST-01   | Prospect state machine + router guard tests                       | 60-01       | PASS                                 | 7 `lib/state-machines/prospect.test.ts` + 2 `admin.updateProspect.test.ts`                                |
| TEST-02   | Quote state machine + auto-sync tests                             | 60-04       | PASS                                 | 12 cases `lib/state-machines/quote.test.ts`                                                               |
| TEST-03   | Multi-project isolation tests                                     | 60-04       | PASS                                 | 7 cases `server/routers/quotes.test.ts`                                                                   |
| TEST-04   | YAML import integration test                                      | 60-05       | PASS                                 | 7 cases `scripts/import-klarifai-yaml.test.ts` including OFF003 negative-tarief regression                |
| TEST-05   | Snapshot Zod validation tests                                     | 60-03       | PASS                                 | 8 cases `lib/schemas/quote-snapshot.test.ts`                                                              |

**23/23 requirements PASS** (IMPORT-04 dual-status reflects ROADMAP wording: unit-test side green, operator-level smoke check remains).

No orphaned requirements. REQUIREMENTS.md mapping table lists exactly the 23 IDs Phase 60 plans claimed, all marked Complete.

---

## Locked Decision Compliance

| Decision | Requirement                                                                  | Status | Evidence                                                                                                                                             |
| -------- | ---------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q5       | No puppeteer/chromium in main app (PDF rendering is Phase 61 worker concern) | PASS   | `grep "puppeteer\|chromium" package.json` → 0 matches                                                                                                |
| Q8       | Import script path + idempotency + --dry default + real totals               | PASS   | `scripts/import-klarifai-yaml.ts` — all 4 sub-requirements verified above                                                                            |
| Q9       | Versioning (replacesId) + snapshot freeze on SENT + update rejects non-DRAFT | PASS   | `schema.prisma:787` replacesId self-FK, `quote.ts:146-154` freeze on DRAFT→SENT, `quotes.ts:200-205` PRECONDITION_FAILED                             |
| Q12      | snapshotAt + templateVersion fields, no `version: Int` counter               | PASS   | `schema.prisma:779-780` present. `grep "version\s*Int" schema.prisma` in Quote model → 0 matches                                                     |
| Q13      | 7 QuoteStatus, 1 new ProspectStatus, full sync mapping                       | PASS   | enum counts verified, `QUOTE_TO_PROSPECT_SYNC` map in `quote.ts:42-49` covers SENT/ACCEPTED/REJECTED, VIEWED/EXPIRED/ARCHIVED intentionally unmapped |
| Q14      | QuoteSnapshotSchema omits snapshotHtml/snapshotPdfUrl (those on Quote row)   | PASS   | `lib/schemas/quote-snapshot.ts` — grep `snapshotHtml\|snapshotPdfUrl` → 0 matches inside the Zod schema                                              |

**6/6 locked decisions honored.**

---

## Test Suite Execution

```
npm run test -- lib/constants/prospect-statuses.test.ts \
                lib/state-machines/prospect.test.ts \
                lib/state-machines/quote.test.ts \
                lib/schemas/quote-snapshot.test.ts \
                server/routers/quotes.test.ts \
                server/routers/admin.updateProspect.test.ts \
                scripts/import-klarifai-yaml.test.ts --run
```

| Result     | Value                                               |
| ---------- | --------------------------------------------------- |
| Test Files | 7 passed                                            |
| Tests      | **48 passed** (summaries claimed ≥46, actual is 48) |
| Duration   | 1.58s                                               |
| Exit code  | 0                                                   |

Breakdown:

- `lib/constants/prospect-statuses.test.ts` — 5 passed
- `lib/state-machines/prospect.test.ts` — 7 passed
- `lib/state-machines/quote.test.ts` — 12 passed
- `lib/schemas/quote-snapshot.test.ts` — 8 passed
- `server/routers/quotes.test.ts` — 7 passed
- `server/routers/admin.updateProspect.test.ts` — 2 passed
- `scripts/import-klarifai-yaml.test.ts` — 7 passed

---

## TypeScript Baseline Comparison

```
npx tsc --noEmit
```

**Result:** 10 pre-existing errors, **0 new errors** in Phase 60 touch-set.

Pre-existing baseline errors (unchanged):

- `lib/enrichment/sitemap.test.ts` — 1 Buffer typing drift (Node Buffer vs BodyInit, unrelated)
- `scripts/tmp-run-analysis-nedri.ts` — 9 stale-API errors in temporary debug script (unrelated)

Zero tsc errors in any of:

- `prisma/schema.prisma` / generated Prisma client
- `lib/constants/prospect-statuses.ts`
- `lib/state-machines/prospect.ts`
- `lib/state-machines/quote.ts`
- `lib/schemas/quote-snapshot.ts`
- `server/routers/quotes.ts`
- `server/routers/admin.ts`
- `scripts/import-klarifai-yaml.ts`

---

## Anti-Pattern Scan

| Severity | Finding                                                                            | File                                          | Impact                                                                                                                                                             |
| -------- | ---------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Info     | `ScopedCtx` interface uses `as unknown as ScopedCtx` cast at each helper call site | `server/routers/quotes.ts:110, 148, 194, 245` | Intentional — strictly safer than plan's `any` signature per 60-04 key-decisions. Not a stub, not a bug.                                                           |
| Info     | `updateData.snapshotData as unknown as Prisma.InputJsonValue` cast                 | `lib/state-machines/quote.ts:148`             | Required because the Zod-inferred `QuoteSnapshot` type isn't directly assignable to `Prisma.InputJsonValue`. Typed on both sides of the cast, not an escape hatch. |
| Info     | `as AllProspectStatus` cast in admin.updateProspect guard call                     | `server/routers/admin.ts:685-686`             | Bridge between the Zod-input enum and the state machine's `ProspectStatus` type. Runtime-safe because the enum is a strict subset.                                 |

**No blocker anti-patterns.** No TODO/FIXME/placeholder in Phase 60 files. No empty-return stubs. No `return <div>placeholder</div>` patterns. No unwired dead code.

---

## Gaps Summary

**None blocking.** The only open item is the manual smoke check for ROADMAP success criterion #1 — and that's by design: the criterion is literally phrased as "Romano runs ... and sees" which is an operator-level confirmation, not a machine-verifiable truth.

Supporting evidence for success criterion #1 that makes the manual check low-risk:

1. Script already performs an in-process totals oracle against hardcoded EXPECTED_TOTALS and throws in --apply mode on mismatch.
2. TEST-04 (7 cases green) covers: totals math, OFF003 negative-tarief regression, dry-run zero-writes, apply-mode create counts, second-apply idempotency — all against the real klarifai-core fixtures.
3. Plan 60-05 summary documents that a dry run against the real klarifai-core repo logged `OFF001 7816.60 / OFF002 11495.00 / OFF003 13285.80 — three OK` before ship.
4. The script matches on natural keys (`readableSlug`, `nummer`), so a second apply is a proven no-op.

**Recommendation:** Romano runs `tsx scripts/import-klarifai-yaml.ts --dry` first (should log three OK), then `tsx scripts/import-klarifai-yaml.ts --apply`, then opens Prisma Studio. Expected result: 1 Prospect row with `readableSlug=marfa`, 3 Quote rows with correct bruto totals.

---

## Overall Status: `human_needed`

- 4/5 ROADMAP success criteria PASS automatically (criteria #2, #3, #4, #5)
- 1/5 ROADMAP success criterion (#1 Marfa import totals) requires Romano to run `--apply` against the staging DB
- 23/23 requirements PASS
- 6/6 locked decisions honored
- 48/48 tests green
- 0 new tsc errors
- 0 blocker anti-patterns
- All 10 key links wired

Phase 60 is code-complete and ready for the operator gate. Once Romano confirms the 3 Marfa quotes are visible in Prisma Studio with correct totals, this phase is DONE and v9.0 Phase 61 (admin quote UI) unblocks.

---

_Verified: 2026-04-13_
_Verifier: Claude (gsd-verifier)_

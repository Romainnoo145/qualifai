---
phase: 60
slug: quote-schema-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 60 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from RESEARCH.md `## Validation Architecture` section.

---

## Test Infrastructure

| Property                       | Value                                                                                    |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| **Framework**                  | Vitest 4.0.18 + jsdom + @vitejs/plugin-react                                             |
| **Config file**                | `vitest.config.ts` (exists, no Wave 0 install work)                                      |
| **Globals**                    | Enabled (`describe`, `it`, `expect`, `vi` auto-available)                                |
| **Setup file**                 | `vitest.setup.ts` (mocks `next/navigation`, `next/config`)                               |
| **Co-location**                | `*.test.ts` lives next to source file (per `lib/outreach/send-email.test.ts` convention) |
| **Quick run command**          | `npm run test -- <path-or-pattern>`                                                      |
| **Full suite command**         | `npm run test`                                                                           |
| **Coverage**                   | `npm run test:coverage`                                                                  |
| **Estimated runtime (scoped)** | ~30 seconds for Phase 60 touch-set                                                       |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- <changed-test-file>` (sub-second)
- **After every plan wave:** Run `npm run test -- lib/state-machines lib/schemas lib/constants server/routers/quotes.test.ts scripts/import-klarifai-yaml.test.ts` (target: < 30 seconds)
- **Before `/gsd:verify-work`:** Full `npm run test` green + `npx tsc --noEmit` clean + `npx prisma format` clean + `npm run lint` clean
- **Manual smoke check at phase gate:** Romano runs `tsx scripts/import-klarifai-yaml.ts --apply` against staging DB and verifies in Prisma Studio that the 3 Marfa quotes exist with correct totals (OFF001 €7.816,60 / OFF002 €11.495,00 / OFF003 €13.285,80). This is ROADMAP Phase 60 success criterion #1.
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

_Wave/Plan assignments are preliminary — will be finalized by gsd-planner. Task IDs follow `{phase}-{plan}-{task}` convention._

| Req ID    | Behavior                                                                              | Test Type             | Automated Command                                                                 | File Exists | Status     |
| --------- | ------------------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------- | ----------- | ---------- |
| DATA-01   | Quote model has narrative + meta fields                                               | schema check          | `npm run db:generate && npx tsc --noEmit`                                         | ❌ W0       | ⬜ pending |
| DATA-02   | QuoteLine model has all line fields + FK                                              | schema check          | `npm run db:generate && npx tsc --noEmit`                                         | ❌ W0       | ⬜ pending |
| DATA-03   | QuoteStatus enum has 7 values                                                         | type check            | `npx tsc --noEmit`                                                                | ❌ W0       | ⬜ pending |
| DATA-04   | ProspectStatus extended with QUOTE_SENT between ENGAGED and CONVERTED                 | type check            | `npx tsc --noEmit`                                                                | ❌ W0       | ⬜ pending |
| DATA-05   | Quote has 6 snapshot fields                                                           | schema check          | `npm run db:generate && npx tsc --noEmit`                                         | ❌ W0       | ⬜ pending |
| DATA-06   | Quote → Prospect FK cascade rule reviewed                                             | manual review         | inspect generated migration SQL                                                   | ❌ W0       | ⬜ pending |
| DATA-07   | Migration runs cleanly on shadow DB; new cols nullable                                | migration run         | `DATABASE_URL=$SHADOW_DB npm run db:migrate -- --name quote_foundation`           | ❌ W0       | ⬜ pending |
| DATA-08   | tRPC `quotes.create` works                                                            | unit                  | `npm run test -- server/routers/quotes.test.ts -t 'create'`                       | ❌ W0       | ⬜ pending |
| DATA-08   | tRPC `quotes.list` works                                                              | unit                  | `npm run test -- server/routers/quotes.test.ts -t 'list'`                         | ❌ W0       | ⬜ pending |
| DATA-08   | tRPC `quotes.get` works                                                               | unit                  | `npm run test -- server/routers/quotes.test.ts -t 'get'`                          | ❌ W0       | ⬜ pending |
| DATA-08   | tRPC `quotes.update` rejects status in input                                          | unit                  | `npm run test -- server/routers/quotes.test.ts -t 'update.*status'`               | ❌ W0       | ⬜ pending |
| DATA-09   | `transitionQuote(SENT)` writes Quote.SENT + Prospect.QUOTE_SENT in one tx             | unit                  | `npm run test -- lib/state-machines/quote.test.ts -t 'transitionQuote.*SENT'`     | ❌ W0       | ⬜ pending |
| DATA-09   | `transitionQuote(ACCEPTED)` writes Quote.ACCEPTED + Prospect.CONVERTED in one tx      | unit                  | `npm run test -- lib/state-machines/quote.test.ts -t 'ACCEPTED.*CONVERTED'`       | ❌ W0       | ⬜ pending |
| DATA-09   | `transitionQuote(REJECTED)` writes Quote.REJECTED + Prospect.ENGAGED in one tx        | unit                  | `npm run test -- lib/state-machines/quote.test.ts -t 'REJECTED.*ENGAGED'`         | ❌ W0       | ⬜ pending |
| DATA-09   | `transitionQuote(VIEWED)` does NOT change Prospect.status                             | unit                  | `npm run test -- lib/state-machines/quote.test.ts -t 'VIEWED.*no prospect'`       | ❌ W0       | ⬜ pending |
| DATA-09   | Snapshot frozen on DRAFT → SENT (snapshotData, snapshotAt, templateVersion populated) | unit                  | `npm run test -- lib/state-machines/quote.test.ts -t 'snapshot frozen'`           | ❌ W0       | ⬜ pending |
| DATA-10   | Multi-tenant: `quotes.list` from Project A returns 0 when only Project B has quotes   | unit (TEST-03)        | `npm run test -- server/routers/quotes.test.ts -t 'multi-project isolation'`      | ❌ W0       | ⬜ pending |
| FOUND-01  | All ProspectStatus literals sourced from `lib/constants/prospect-statuses.ts`         | static + unit         | `npm run test -- lib/constants/prospect-statuses.test.ts` + grep regression check | ❌ W0       | ⬜ pending |
| FOUND-02  | `admin.updateProspect(CONVERTED → DRAFT)` returns PRECONDITION_FAILED, no DB write    | unit (TEST-01)        | `npm run test -- lib/state-machines/prospect.test.ts -t 'invalid transition'`     | ❌ W0       | ⬜ pending |
| FOUND-02  | `admin.updateProspect(DRAFT → ENRICHED)` succeeds                                     | unit (TEST-01)        | `npm run test -- lib/state-machines/prospect.test.ts -t 'valid transition'`       | ❌ W0       | ⬜ pending |
| FOUND-03  | Malformed snapshotData rejected by Zod                                                | unit (TEST-05)        | `npm run test -- lib/schemas/quote-snapshot.test.ts -t 'reject malformed'`        | ❌ W0       | ⬜ pending |
| FOUND-03  | Valid snapshotData accepted (including OFF003 negative tarief)                        | unit (TEST-05)        | `npm run test -- lib/schemas/quote-snapshot.test.ts -t 'accept negative tarief'`  | ❌ W0       | ⬜ pending |
| FOUND-04  | `getSnapshotField()` returns typed value with fallback                                | unit                  | `npm run test -- lib/schemas/quote-snapshot.test.ts -t 'accessor'`                | ❌ W0       | ⬜ pending |
| FOUND-04  | `parseSnapshot(null)` returns null without throwing                                   | unit                  | `npm run test -- lib/schemas/quote-snapshot.test.ts -t 'parse null'`              | ❌ W0       | ⬜ pending |
| IMPORT-01 | Import creates/updates Prospect by readableSlug                                       | integration (TEST-04) | `npm run test -- scripts/import-klarifai-yaml.test.ts -t 'client import'`         | ❌ W0       | ⬜ pending |
| IMPORT-02 | Import creates 3 Quote rows + line items, idempotent on `nummer`                      | integration (TEST-04) | `npm run test -- scripts/import-klarifai-yaml.test.ts -t 'quote import'`          | ❌ W0       | ⬜ pending |
| IMPORT-03 | `--dry` (default) performs no writes; `--apply` writes                                | integration (TEST-04) | `npm run test -- scripts/import-klarifai-yaml.test.ts -t 'dry vs apply'`          | ❌ W0       | ⬜ pending |
| IMPORT-04 | 3 Marfa quotes with correct totals after `--apply`                                    | integration + manual  | `tsx scripts/import-klarifai-yaml.ts --apply` + Prisma Studio check               | ❌ W0       | ⬜ pending |
| TEST-01   | Prospect state machine transition tests (valid + invalid)                             | unit                  | `npm run test -- lib/state-machines/prospect.test.ts`                             | ❌ W0       | ⬜ pending |
| TEST-02   | Quote state machine transition tests incl. auto-sync                                  | unit                  | `npm run test -- lib/state-machines/quote.test.ts`                                | ❌ W0       | ⬜ pending |
| TEST-03   | Multi-project isolation for quotes.\* endpoints                                       | unit                  | `npm run test -- server/routers/quotes.test.ts -t 'isolation'`                    | ❌ W0       | ⬜ pending |
| TEST-04   | YAML import integration test (3 Marfa fixtures)                                       | integration           | `npm run test -- scripts/import-klarifai-yaml.test.ts`                            | ❌ W0       | ⬜ pending |
| TEST-05   | Snapshot Zod validation tests                                                         | unit                  | `npm run test -- lib/schemas/quote-snapshot.test.ts`                              | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

All test and source files are NEW. No existing tests cover Quote, state machines, prospect status constants, or the import script. Wave 0 must create (before other waves depend on them):

- [ ] `lib/constants/prospect-statuses.ts` — typed `as const` status arrays (FOUND-01)
- [ ] `lib/constants/prospect-statuses.test.ts` — type-level + array shape tests
- [ ] `lib/state-machines/prospect.ts` — transition validator used by `admin.updateProspect` (FOUND-02)
- [ ] `lib/state-machines/prospect.test.ts` — TEST-01 coverage (valid + invalid transitions)
- [ ] `lib/state-machines/quote.ts` — `transitionQuote` helper executing Quote → Prospect sync in one Prisma transaction (DATA-09)
- [ ] `lib/state-machines/quote.test.ts` — TEST-02 coverage (state machine + auto-sync + snapshot freeze on SENT)
- [ ] `lib/schemas/quote-snapshot.ts` — Zod schema + `parseSnapshot` + `getSnapshotField` accessor (FOUND-03, FOUND-04)
- [ ] `lib/schemas/quote-snapshot.test.ts` — TEST-05 coverage (reject malformed, accept valid incl. negative tarief)
- [ ] `server/routers/quotes.ts` — new tRPC router with create/list/get/update/transition (DATA-08, DATA-09, DATA-10)
- [ ] `server/routers/quotes.test.ts` — TEST-03 coverage (CRUD smoke + multi-project isolation)
- [ ] `scripts/import-klarifai-yaml.ts` — idempotent import script with `--dry` (default) and `--apply` (IMPORT-01..04)
- [ ] `scripts/import-klarifai-yaml.test.ts` — TEST-04 coverage (real klarifai-core fixtures)
- [ ] `prisma/migrations/<timestamp>_quote_foundation/migration.sql` — generated via `npm run db:migrate` against shadow DB (DATA-01..07)
- [ ] `package.json` — add `yaml` (eemeli/yaml) dependency for the import script

**Framework install:** None — Vitest already configured. Only library addition is `npm install yaml`.

**No shared conftest / fixtures needed:** Each test file follows the existing co-located pattern with top-of-file mock factories (per `lib/outreach/send-email.test.ts` convention).

---

## Manual-Only Verifications

| Behavior                                                       | Requirement                              | Why Manual                                                                                                                                                                                                                      | Test Instructions                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3 Marfa quotes appear in Prisma Studio with correct totals     | IMPORT-04 / ROADMAP success criterion #1 | Validates the script behaves correctly against staging DB (not mock), confirms totals survive round-trip through Prisma types. Automated test covers the unit-level correctness but manual smoke is the final gate per ROADMAP. | 1. `tsx scripts/import-klarifai-yaml.ts --apply` against staging DB<br>2. Open Prisma Studio (`npx prisma studio`)<br>3. Verify 3 Quote rows: OFF001 total €7.816,60 · OFF002 €11.495,00 · OFF003 €13.285,80<br>4. Verify 1 Prospect row matching `readableSlug: marfa` exists |
| Migration SQL is review-safe (no rename/drop of existing cols) | DATA-07                                  | Generated SQL needs human eyes to confirm it matches Prisma v7 + adapter-pg conventions and contains no drop/rename statements that could lose data                                                                             | 1. Run `npm run db:migrate` against shadow DB<br>2. Open `prisma/migrations/<timestamp>_quote_foundation/migration.sql`<br>3. Confirm: all new columns NULL-able, no `DROP`/`RENAME`, only `CREATE TABLE` / `ALTER TABLE ADD COLUMN` / `CREATE TYPE` / `ALTER TYPE ADD VALUE`  |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies listed above
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all ❌ W0 entries above
- [ ] No watch-mode flags in commands (scoped runs only)
- [ ] Feedback latency < 30s (scoped test runs verified against existing Vitest configuration)
- [ ] `nyquist_compliant: true` set in frontmatter once planner confirms every task maps into this document

**Approval:** pending

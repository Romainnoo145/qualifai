---
phase: 60-quote-schema-foundation
plan: 02
subsystem: database
tags: [prisma, postgresql, schema, quote, marfa, migration, multi-tenant]

requires:
  - phase: 60-quote-schema-foundation/60-01
    provides: 'lib/constants/prospect-statuses.ts and lib/state-machines/prospect.ts (Plan 02 retypes them against @prisma/client)'
provides:
  - 'Quote and QuoteLine Prisma models matching klarifai-core YAML shape'
  - 'QuoteStatus enum (7 values: DRAFT/SENT/VIEWED/ACCEPTED/REJECTED/EXPIRED/ARCHIVED)'
  - 'SnapshotStatus enum (4 values: PENDING/RENDERING/READY/FAILED)'
  - 'ProspectStatus extended with QUOTE_SENT between ENGAGED and CONVERTED'
  - 'Quote.replacesId self-FK for versioning (added in Phase 60 to avoid Phase 61 migration)'
  - 'prisma/migrations/20260413_quote_foundation/migration.sql (additive-only DDL)'
  - '@prisma/client exports for Quote, QuoteLine, QuoteStatus, SnapshotStatus, extended ProspectStatus'
  - 'lib/constants/prospect-statuses.ts now compiler-checked against the live Prisma enum via `satisfies readonly ProspectStatus[]`'
  - 'lib/state-machines/prospect.ts now imports ProspectStatus from @prisma/client'
affects:
  - 60-03 (Zod snapshot schema can `import { Quote, SnapshotStatus } from "@prisma/client"`)
  - 60-04 (tRPC quotes router + transitionQuote helper can build directly on the Prisma models)
  - 60-05 (YAML import script can `prisma.quote.create({ data })` against the new tables)
  - 61 (versioning groundwork via replacesId self-FK)

tech-stack:
  added: []
  patterns:
    - 'Manual migration authoring when prisma migrate dev cannot be used due to pre-existing dev DB drift'
    - '`as const satisfies readonly ProspectStatus[]` to compiler-check status literal arrays against the live Prisma enum'
    - 'Quote -> Prospect FK uses ON DELETE RESTRICT (legally meaningful documents preserved)'
    - 'Quote -> Quote (replacesId) self-FK uses ON DELETE SET NULL (versioning chain survives parent deletion)'
    - 'Multi-tenant isolation via Prospect.projectId join, no duplicate column on Quote/QuoteLine'

key-files:
  created:
    - 'prisma/migrations/20260413_quote_foundation/migration.sql'
    - '.planning/phases/60-quote-schema-foundation/60-02-SUMMARY.md'
  modified:
    - 'prisma/schema.prisma'
    - 'lib/constants/prospect-statuses.ts'
    - 'lib/state-machines/prospect.ts'

key-decisions:
  - 'Migration authored manually because dev DB has pre-existing drift (IntentExtraction missing migration file, ProjectDocumentChunk_embedding_hnsw_idx phantom). prisma migrate dev would have demanded a reset that destroys 7 prospects of real data. Verified clean on a shadow DB pre-loaded with the dev schema dump, then applied via psql and recorded in _prisma_migrations.'
  - 'Quote.replacesId self-FK added now (Q9 / research recommendation #5) so Phase 61 versioning work needs no second migration.'
  - 'ALTER TYPE "ProspectStatus" ADD VALUE QUOTE_SENT BEFORE CONVERTED — explicit positioning to satisfy plan ordering requirement and keep the enum tidy.'
  - 'Pre-existing dev DB drift items (IntentExtraction, embedding_hnsw_idx) left untouched — out of scope for Plan 02 and unrelated to Quote work.'

patterns-established:
  - 'Manually-authored migration with shadow-db verification: dump dev schema, recreate shadow, replay migration, sanity-check tables/enums via psql \\d before touching prod path.'
  - 'Status array tightening: `as const satisfies readonly ProspectStatus[]` makes typo drift a build error.'

requirements-completed:
  - DATA-01
  - DATA-02
  - DATA-03
  - DATA-04
  - DATA-05
  - DATA-06
  - DATA-07

duration: 30min
completed: 2026-04-13
---

# Phase 60 Plan 02: Quote Schema Foundation Summary

**Quote and QuoteLine Prisma models with QuoteStatus + SnapshotStatus enums, ProspectStatus extended with QUOTE_SENT, manually-authored additive migration applied to dev DB without losing any existing data.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-04-13T10:55:00Z (approx)
- **Completed:** 2026-04-13T11:23:38Z
- **Tasks:** 2 (Task 1 schema edit, Task 2 migration + type tightening)
- **Files modified:** 4 (prisma/schema.prisma, prisma/migrations/.../migration.sql, lib/constants/prospect-statuses.ts, lib/state-machines/prospect.ts)

## Accomplishments

- Added Quote model with all 17 narrative/commercial/snapshot fields verified against `klarifai-core/data/quotes/2026/*.yaml` (Marfa OFF001/OFF002/OFF003).
- Added QuoteLine model with signed `tarief Int` (negative allowed for OFF003 Pakketkorting line).
- Added QuoteStatus enum (7 values) and SnapshotStatus enum (4 values) per Q5/Q13 locked decisions.
- Extended ProspectStatus with QUOTE_SENT positioned between ENGAGED and CONVERTED via `ALTER TYPE ... ADD VALUE ... BEFORE 'CONVERTED'`.
- Pre-emptively added `Quote.replacesId` self-FK (research recommendation #5) so Phase 61 versioning ships without a second migration.
- Authored migration manually and verified against a shadow DB pre-loaded from the dev schema; applied to dev DB and recorded in `_prisma_migrations`.
- Plan 01's constants and state machine modules are now compiler-checked against the live Prisma enum (`satisfies readonly ProspectStatus[]`, `import type { ProspectStatus } from '@prisma/client'`).

## Task Commits

1. **Task 1: Edit prisma/schema.prisma — add enums, Quote, QuoteLine, extend ProspectStatus** — `460613f` (feat)
2. **Task 2: Generate migration and tighten prospect status types** — `890d200` (feat)

_Note: Plan 01 ran in parallel and committed `12dfd54` (constants) and `1e2b3ac` (state machine) before Task 2; Plan 02 then re-typed both files against the live Prisma enum._

## Files Created/Modified

- `prisma/schema.prisma` — Added `QuoteStatus`, `SnapshotStatus` enums; extended `ProspectStatus` with `QUOTE_SENT`; added `Quote` and `QuoteLine` models with all locked-decision fields; added `quotes Quote[]` back-relation on `Prospect`.
- `prisma/migrations/20260413_quote_foundation/migration.sql` — Additive-only DDL: 2 CREATE TYPE, 1 ALTER TYPE ADD VALUE, 2 CREATE TABLE, 5 CREATE INDEX, 3 ADD CONSTRAINT (FK). Zero DROP/RENAME, all new optional columns nullable.
- `lib/constants/prospect-statuses.ts` — Re-added `as const satisfies readonly ProspectStatus[]` on every status array now that QUOTE_SENT exists in the live enum; imports `ProspectStatus` from `@prisma/client`.
- `lib/state-machines/prospect.ts` — Swapped type import from `AllProspectStatus` (constants module) to `ProspectStatus` (`@prisma/client`); transition map and `assertValidProspectTransition` now compiler-checked against the database enum.

## Decisions Made

- **Manual migration authoring instead of `prisma migrate dev`.** The dev DB has pre-existing drift (`IntentExtraction` table created without a migration file; `ProjectDocumentChunk_embedding_hnsw_idx` phantom in migration history). `prisma migrate dev` would have demanded a destructive reset. The migration was instead authored manually using `prisma migrate diff` against a fresh shadow DB, applied to a shadow DB pre-loaded from the dev schema dump for verification, then applied to dev via `docker exec psql` and recorded in `_prisma_migrations` with a sha256 checksum.
- **`ALTER TYPE ... ADD VALUE 'QUOTE_SENT' BEFORE 'CONVERTED'`** — explicit positioning so the enum reads naturally and matches plan ordering. Prisma's diff would have appended at the end.
- **Pre-existing dev DB drift left untouched.** `IntentExtraction` and `ProjectDocumentChunk_embedding_hnsw_idx` are pre-existing tech debt, not in Plan 02 scope. Logging only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Manually-authored migration to bypass dev DB drift**

- **Found during:** Task 2 (Generate migration against shadow DB)
- **Issue:** `npm run db:migrate -- --name quote_foundation` aborted with "We need to reset the public schema" because the dev DB has pre-existing drift (`IntentExtraction` table created out-of-band, `ProjectDocumentChunk_embedding_hnsw_idx` phantom). A reset would destroy 7 prospects of real data.
- **Fix:** Generated migration SQL via `prisma migrate diff --from-migrations --to-schema --script` against a fresh shadow DB, hand-extracted only the Quote-related additive DDL into `prisma/migrations/20260413_quote_foundation/migration.sql`, verified clean by replaying it on a shadow DB pre-loaded with `pg_dump --schema-only` of the dev DB, applied to dev via `docker exec psql -v ON_ERROR_STOP=1`, and recorded in `_prisma_migrations` with a sha256 checksum. Pre-existing drift items are explicitly NOT in the migration file.
- **Files modified:** `prisma/migrations/20260413_quote_foundation/migration.sql`
- **Verification:** Shadow DB replay applied cleanly (CREATE TYPE x2, ALTER TYPE, CREATE TABLE x2, CREATE INDEX x5, ADD CONSTRAINT x3). `\d "Quote"` and `\d "QuoteLine"` show all expected columns and FK rules. `enum_range` confirms `ProspectStatus` ends with `…ENGAGED, QUOTE_SENT, CONVERTED, ARCHIVED`, `QuoteStatus` has 7 values, `SnapshotStatus` has 4 values.
- **Committed in:** `890d200` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for correctness — without manual migration authoring the only alternative was destroying production-like dev data. No scope creep; all schema content matches the plan exactly.

## Issues Encountered

- **Pre-existing TypeScript errors in unrelated files:** `lib/enrichment/sitemap.test.ts` has a Buffer typing error (`TS2345: Buffer<ArrayBufferLike> not assignable to BodyInit`); several `scripts/tmp-*.ts` debug scripts have stale type errors against `RagRetrievedPassage` and `master-analyzer` exports. These are pre-existing and not caused by Plan 02 — confirmed by `git stash && tsc` reproducing the exact same errors. Logged here for the next maintenance sweep, not fixed.
- **Plan 01 ran in parallel and was still in progress when Plan 02 started.** Plan 01 committed Tasks 1 and 2 (`12dfd54`, `1e2b3ac`) before Plan 02's Task 2 reached Step 5. Plan 02's Step 5 then proceeded as planned: re-added the `satisfies readonly ProspectStatus[]` clause and swapped the state-machine type import to `@prisma/client`. No coordination conflicts because Plan 01 explicitly deferred those exact changes to Plan 02 in source comments.

## Verification

- `npx prisma validate` — ✅ clean
- `npx prisma format && diff` — ✅ idempotent (no further changes)
- `npm run db:generate` — ✅ Prisma Client regenerated, exports `Quote`, `QuoteLine`, `QuoteStatus`, `SnapshotStatus`, extended `ProspectStatus`
- `node -e "console.log(Object.keys(require('@prisma/client').QuoteStatus))"` — ✅ 7 values
- `node -e "console.log(Object.keys(require('@prisma/client').SnapshotStatus))"` — ✅ 4 values
- `node -e "console.log(Object.keys(require('@prisma/client').ProspectStatus))"` — ✅ 10 values, QUOTE_SENT between ENGAGED and CONVERTED
- `npx tsc --noEmit` — ✅ clean (only pre-existing unrelated errors remain, all in tmp scripts and one Buffer typing issue in sitemap.test.ts; none in Phase 60 touch-set)
- `npm run test -- lib/constants lib/state-machines --run` — ✅ 12/12 passing (5 prospect-statuses, 7 prospect state machine)
- Migration SQL grep: 0 DROP, 0 RENAME, 12 additive statements
- `grep -i "puppeteer\|chromium" package.json` — ✅ NOT FOUND (Q5 honored — no PDF rendering deps in main app)
- Migration applied to dev DB and recorded in `_prisma_migrations`

## User Setup Required

None — no external service configuration required for Plan 02.

## Next Phase Readiness

- **Plan 03 (Zod snapshot schema):** Can `import { Quote, SnapshotStatus } from '@prisma/client'`. Snapshot fields (`snapshotData Json?`, `snapshotHtml String? @db.Text`, `snapshotPdfUrl String?`, `snapshotStatus SnapshotStatus?`, `snapshotAt DateTime?`, `templateVersion String?`) all exist and are nullable.
- **Plan 04 (tRPC quotes router + state machine):** Can build `quotes.create / list / get / update / transition` directly on `prisma.quote`. The state machine helper can call `assertValidProspectTransition` (now `@prisma/client`-typed) for the auto-sync to ProspectStatus.QUOTE_SENT/CONVERTED.
- **Plan 05 (YAML import script):** Can `prisma.quote.create({ data: { ..., lines: { create: [...] } } })` against the new tables; multi-tenant isolation works through `prospect.projectId`.
- **Phase 61:** `Quote.replacesId` self-FK already exists, so versioning ships without a second migration.
- **Tech debt logged for later cleanup:** dev DB drift items (`IntentExtraction` missing migration file, `ProjectDocumentChunk_embedding_hnsw_idx` phantom), `lib/enrichment/sitemap.test.ts` Buffer typing error, several `scripts/tmp-*.ts` stale debug scripts.

## Self-Check: PASSED

Files verified on disk:

- ✅ `prisma/schema.prisma`
- ✅ `prisma/migrations/20260413_quote_foundation/migration.sql`
- ✅ `lib/constants/prospect-statuses.ts`
- ✅ `lib/state-machines/prospect.ts`
- ✅ `.planning/phases/60-quote-schema-foundation/60-02-SUMMARY.md`

Commits verified in git history:

- ✅ `460613f` — Task 1 schema edit
- ✅ `890d200` — Task 2 migration + type tightening

---

_Phase: 60-quote-schema-foundation_
_Plan: 02_
_Completed: 2026-04-13_

---
phase: 06-use-cases-foundation
plan: 01
subsystem: database
tags: [prisma, postgresql, trpc, use-cases, proof-matching]

# Dependency graph
requires: []
provides:
  - UseCase PostgreSQL table with title, summary, category, outcomes, tags, caseStudyRefs, isActive, isShipped, sourceRef, externalUrl columns
  - ProofMatch.useCaseId nullable FK with SetNull delete behavior and index
  - tRPC useCasesRouter with list, getById, create, update, delete, importFromObsidian procedures
  - Obsidian JSON import with sourceRef deduplication
affects:
  - 06-02 (admin UI for use cases depends on this router)
  - 06-03 (proof matching wiring depends on ProofMatch.useCaseId FK)
  - 08-deep-evidence-pipeline (uses UseCase catalog for matching)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - tRPC adminProcedure CRUD router pattern (list/getById/create/update/delete)
    - Soft delete via isActive: false (consistent with existing Campaign pattern)
    - sourceRef idempotency for Obsidian import (prevents duplicate records)
    - externalUrl empty-string-to-null normalization at persistence layer

key-files:
  created:
    - prisma/migrations/20260220074743_use_cases/migration.sql
    - server/routers/use-cases.ts
  modified:
    - prisma/schema.prisma
    - server/routers/_app.ts
    - lib/workflow-engine.ts

key-decisions:
  - 'Soft delete via isActive=false for UseCase.delete — consistent with Campaign pattern, preserves ProofMatch history'
  - 'importFromObsidian uses sourceRef (Obsidian proofId) for idempotency — re-running import never creates duplicates'
  - 'Empty externalUrl string converted to null at persistence layer — Zod URL validation rejects empty strings so we handle it explicitly'

patterns-established:
  - 'tRPC CRUD router: list (optional filters + limit), getById, create, update (id + optional fields), delete (soft)'
  - 'Prisma migrate resolve --applied: use when DB has tables but migration history is out of sync in dev'

# Metrics
duration: 4min
completed: 2026-02-20
---

# Phase 6 Plan 01: UseCase Model and tRPC Router Summary

**UseCase Prisma model with PostgreSQL migration and tRPC CRUD + Obsidian import router registered as api.useCases.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-20T07:46:40Z
- **Completed:** 2026-02-20T07:50:16Z
- **Tasks:** 2
- **Files modified:** 4 + 1 migration created

## Accomplishments

- UseCase table created in PostgreSQL with all required fields including sourceRef for Obsidian import idempotency
- ProofMatch table extended with nullable useCaseId FK (SetNull on delete) and index
- tRPC useCasesRouter with 6 procedures (list, getById, create, update, delete, importFromObsidian) registered in app router
- inventoryToCandidates, offersToCandidates, readJsonSafe exported from workflow-engine.ts for reuse in import procedure
- All 27 existing tests pass with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add UseCase model and ProofMatch FK to Prisma schema** - `a4c7ce4` (feat)
2. **Task 2: Create tRPC use-cases router and register in \_app.ts** - `1f359e0` (feat)

**Plan metadata:** _(committed with this SUMMARY.md)_

## Files Created/Modified

- `prisma/schema.prisma` - Added UseCase model and ProofMatch.useCaseId FK
- `prisma/migrations/20260220074743_use_cases/migration.sql` - Migration SQL (creates UseCase table, alters ProofMatch)
- `server/routers/use-cases.ts` - tRPC router with 6 procedures including Obsidian import
- `server/routers/_app.ts` - Registered useCasesRouter (between signals and wizard alphabetically)
- `lib/workflow-engine.ts` - Exported readJsonSafe, inventoryToCandidates, offersToCandidates

## Decisions Made

- Soft delete via `isActive: false` for the delete procedure — consistent with Campaign router pattern, preserves ProofMatch history and audit trail
- importFromObsidian uses `sourceRef` (proofId from Obsidian) as idempotency key — re-running the import skips existing records instead of creating duplicates
- Empty string for `externalUrl` is converted to `null` at persistence — handles form inputs that send empty strings while Zod validates non-empty URLs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Ran `prisma generate` after migration to regenerate TypeScript types**

- **Found during:** Task 2 (tRPC router implementation)
- **Issue:** TypeScript errored with `Property 'useCase' does not exist on type 'PrismaClient'` — migration applied to DB but Prisma client types were stale
- **Fix:** Ran `npx prisma generate` to regenerate the Prisma client with the new UseCase model
- **Files modified:** node_modules (generated, not committed)
- **Verification:** `npx tsc --noEmit` passed with zero errors after regeneration
- **Committed in:** a4c7ce4 (part of Task 1 flow — needed before Task 2 could type-check)

**2. [Rule 3 - Blocking] Used `prisma migrate resolve --applied` to fix migration history drift**

- **Found during:** Task 1 (migration step)
- **Issue:** `prisma migrate dev` detected drift — DB had all tables but `_prisma_migrations` table showed two existing migrations as unapplied. This caused Prisma to want to reset the dev database.
- **Fix:** Ran `prisma migrate resolve --applied` for both existing migrations to mark them as applied without touching the DB, then ran `migrate dev` cleanly
- **Files modified:** No files — only internal Prisma migrations table in DB
- **Verification:** `prisma migrate status` shows "Database schema is up to date!" with 3 migrations all applied
- **Committed in:** N/A (state change in DB only)

---

**Total deviations:** 2 auto-fixed (both blocking, both Rule 3)
**Impact on plan:** Both auto-fixes were essential environment/tooling corrections with no scope change. Plan executed exactly as designed.

## Issues Encountered

- `npm run check` script does not exist in this project (plan references it). Used `npx tsc --noEmit` + `npm run lint` instead. ESLint produced 40 warnings all in pre-existing files not touched by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- UseCase table and useCasesRouter are fully operational — api.useCases.list/create/update/delete/importFromObsidian all type-check and are accessible
- Phase 06-02 (admin UI) can immediately import and call these procedures
- Phase 06-03 (proof matching) can use the ProofMatch.useCaseId FK to link matches to UseCase records

---

_Phase: 06-use-cases-foundation_
_Completed: 2026-02-20_

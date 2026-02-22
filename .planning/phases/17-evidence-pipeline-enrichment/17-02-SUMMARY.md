---
phase: 17-evidence-pipeline-enrichment
plan: '02'
subsystem: api
tags: [kvk, prisma, enrichment, typescript, vitest]

# Dependency graph
requires:
  - phase: 17-01
    provides: serp.ts and sitemap.ts enrichment modules (pattern for KvK to follow)
provides:
  - KvK Handelsregister enrichment module with two-step API lookup
  - REGISTRY enum value in EvidenceSourceType (schema + DB + Prisma client)
  - KVK_API_KEY and KVK_TEST_MODE env var validation
  - crawl4ai fallback draft behavior for minimal-content pages
affects:
  - 17-03: workflow integration that calls fetchKvkData in pipeline
  - 18-research-quality-gate: REGISTRY evidence type available for quality scoring

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'KvK two-step API pattern: Zoeken (name search) then Basisprofiel (full profile)'
    - 'Manual DB enum migration via docker exec psql when prisma migrate dev has drift'
    - 'process.env direct access (not env.mjs) in enrichment modules for testability'

key-files:
  created:
    - lib/enrichment/kvk.ts
    - prisma/migrations/20260222154800_add_registry_source_type/migration.sql
  modified:
    - prisma/schema.prisma
    - env.mjs
    - lib/web-evidence-adapter.ts
    - lib/enrichment/crawl4ai.ts

key-decisions:
  - 'DB drift prevented prisma migrate dev — applied enum via docker exec psql + created migration file manually'
  - 'KvK module uses process.env directly (not env.mjs) — matches serp.ts and crawl4ai.ts pattern for testability'
  - 'crawl4ai fallback stub (0.55 confidence) preferred over silent skip — enables EVID-08 LinkedIn placeholders'

patterns-established:
  - 'Enrichment module null-guard: check process.env.API_KEY at top of fetch function, return null immediately'
  - 'AbortSignal.timeout(8000) for all external API calls in enrichment modules'

# Metrics
duration: 4min
completed: 2026-02-22
---

# Phase 17 Plan 02: KvK Registry Enrichment + Crawl4ai Fix Summary

**KvK Handelsregister two-step API client (Zoeken + Basisprofiel) with REGISTRY enum in Prisma schema, and crawl4ai fallback stub for minimal-content pages replacing silent skip**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-22T15:47:07Z
- **Completed:** 2026-02-22T15:50:57Z
- **Tasks:** 3 completed
- **Files modified:** 6

## Accomplishments

- KvK enrichment module returns structured Dutch company data (SBI code, rechtsvorm, employee count, location) as REGISTRY evidence draft with 0.82 confidence
- REGISTRY enum added to EvidenceSourceType in schema and live DB (applied via ALTER TYPE on qualifai-db container)
- crawl4ai now creates fallback draft (0.55 confidence, metadata.fallback: true) for minimal-content pages instead of silently skipping — unblocks LinkedIn extraction stubs

## Task Commits

Each task was committed atomically:

1. **Task 1: Add REGISTRY enum + KVK env vars + Prisma migration** - `3413170` (feat)
2. **Task 2: Create KvK registry enrichment module** - `b761f0d` (feat, included in 17-01 commit due to lint-staged stash behavior)
3. **Task 3: Fix crawl4ai fallback draft for minimal-content pages** - `cee0bcf` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `lib/enrichment/kvk.ts` - KvK API client: fetchKvkData (two-step), kvkDataToEvidenceDraft, KvkEnrichmentData interface
- `prisma/migrations/20260222154800_add_registry_source_type/migration.sql` - ALTER TYPE ADD VALUE 'REGISTRY'
- `prisma/schema.prisma` - REGISTRY added to EvidenceSourceType enum
- `env.mjs` - KVK_API_KEY and KVK_TEST_MODE in server + runtimeEnv sections
- `lib/web-evidence-adapter.ts` - REGISTRY case (0.82) added to baseConfidence switch
- `lib/enrichment/crawl4ai.ts` - Fallback draft for minimal content (< 80 chars markdown)

## Decisions Made

- DB drift prevented `prisma migrate dev` — applied enum via `docker exec qualifai-db psql ALTER TYPE` and created migration file manually so schema history stays consistent
- KvK module uses `process.env` directly (not env.mjs) — matches serp.ts and crawl4ai.ts for testability without mocking the env module
- crawl4ai fallback stub preferred over silent skip — better for EVID-08 (LinkedIn) where we want a placeholder even when content extraction fails

## Deviations from Plan

None - plan executed exactly as written. The only implementation detail was the DB drift workaround (using docker exec psql instead of prisma migrate dev), which the plan explicitly anticipated in its NOTE.

## Issues Encountered

- `prisma migrate dev` and `--create-only` both failed due to accumulated DB drift from unapplied migrations. Resolved by applying the ALTER TYPE directly via docker exec psql (as anticipated in the plan NOTE) and creating the migration file manually.

## User Setup Required

**External services require manual configuration.**

KvK API requires a subscription or test mode:

| Variable        | Required      | Source                                                                                 |
| --------------- | ------------- | -------------------------------------------------------------------------------------- |
| `KVK_API_KEY`   | No (optional) | KvK Developer Portal (https://developers.kvk.nl) → Subscribe to API plan (€6.40/month) |
| `KVK_TEST_MODE` | No            | Set to `"true"` to use free KvK test environment with test key                         |

Test key (free, no subscription): `l7xx1f2691f2520d487b902f4e0b57a0b197`

Add to `.env.local`:

```
KVK_API_KEY=l7xx1f2691f2520d487b902f4e0b57a0b197
KVK_TEST_MODE=true
```

## Next Phase Readiness

- Plan 03 (workflow integration) can now call `fetchKvkData` and `kvkDataToEvidenceDraft` from `lib/enrichment/kvk.ts`
- REGISTRY enum is live in DB and Prisma client — Phase 18 quality gate can filter/score by source type including REGISTRY
- crawl4ai fix resolves EVID-08 LinkedIn placeholder requirement

---

_Phase: 17-evidence-pipeline-enrichment_
_Completed: 2026-02-22_

## Self-Check: PASSED

- lib/enrichment/kvk.ts — FOUND
- prisma/migrations/20260222154800_add_registry_source_type/migration.sql — FOUND
- .planning/phases/17-evidence-pipeline-enrichment/17-02-SUMMARY.md — FOUND
- Commit 3413170 (Task 1) — FOUND
- Commit cee0bcf (Task 3) — FOUND
- fetchKvkData export — FOUND
- kvkDataToEvidenceDraft export — FOUND
- KvkEnrichmentData export — FOUND
- REGISTRY in schema.prisma — FOUND
- crawl4ai fallback confidenceScore 0.55 — FOUND

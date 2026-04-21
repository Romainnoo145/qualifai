---
phase: 66-content-deduplication
plan: '01'
subsystem: database
tags: [prisma, sha256, deduplication, evidence-pipeline, vitest]

# Dependency graph
requires: []
provides:
  - contentHash column on EvidenceItem (Prisma schema + live DB)
  - SHA-256 hash computation via computeContentHash() exported helper
  - normalizeSnippet() normalization helper (lowercase, collapse whitespace)
  - Dedup guard in main evidence insert loop (findFirst before create)
  - Dedup guard in RAG evidence insert loop
  - Unit tests for normalizeSnippet and computeContentHash (6 tests)
affects: [evidence-pipeline, research-executor, scoring]

# Tech tracking
tech-stack:
  added: [node:crypto (createHash, built-in)]
  patterns:
    - SHA-256 content hash computed from normalized snippet before DB insert
    - findFirst dedup check on (prospectId, sourceType, contentHash) before evidenceItem.create
    - Partial unique index (WHERE content_hash IS NOT NULL) for backcompat with existing rows

key-files:
  created:
    - prisma/migrations/20260421000000_add_content_hash/migration.sql
    - lib/research-executor.test.ts
  modified:
    - prisma/schema.prisma
    - lib/research-executor.ts
    - lib/signals/detect.test.ts

key-decisions:
  - 'Dedup scoped within (prospectId, sourceType) — same snippet in WEBSITE and REVIEWS produces two items (cross-sourceType corroboration preserved)'
  - "Partial unique index (WHERE content_hash IS NOT NULL) so existing rows without hash don't conflict"
  - 'contentHash is String? (nullable) in Prisma for backcompat — new inserts always set it'

patterns-established:
  - 'computeContentHash: normalize (lowercase + collapse whitespace) then SHA-256 hex'
  - 'Dedup guard pattern: findFirst check then continue before create in insert loops'

requirements-completed: [FUNNEL-03]

# Metrics
duration: 4min
completed: 2026-04-21
---

# Phase 66 Plan 01: Content Deduplication Summary

**SHA-256 content hash deduplication on EvidenceItem — same snippet within (prospectId, sourceType) stored exactly once, cross-sourceType corroboration preserved.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-21T10:20:07Z
- **Completed:** 2026-04-21T10:24:17Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added `contentHash String?` column + `@@unique([prospectId, sourceType, contentHash])` constraint to `EvidenceItem` in Prisma schema
- Created and applied migration SQL with partial unique index to live Docker DB
- Added `normalizeSnippet()` and `computeContentHash()` exported helpers to `lib/research-executor.ts`
- Inserted dedup guard (findFirst before create) in both the main evidence insert loop and the RAG passage insert loop
- Created 6 passing unit tests covering normalization and hash determinism

## Task Commits

1. **Task 1: Add contentHash column to EvidenceItem schema + migration** - `463b111` (feat)
2. **Task 2: SHA-256 hash computation + dedup guard in evidence insert loops** - `26e1301` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `prisma/schema.prisma` - Added contentHash field and unique constraint to EvidenceItem
- `prisma/migrations/20260421000000_add_content_hash/migration.sql` - SQL migration with partial unique index
- `lib/research-executor.ts` - Added crypto import, helper functions, dedup guards in both insert loops
- `lib/research-executor.test.ts` - Unit tests for normalizeSnippet and computeContentHash (6 tests)
- `lib/signals/detect.test.ts` - Added contentHash: null to EvidenceItem mock factory

## Decisions Made

- Dedup scoped within `(prospectId, sourceType)` — same snippet appearing in WEBSITE and REVIEWS creates two items, preserving cross-sourceType corroboration for confidence scoring
- Partial unique index (`WHERE content_hash IS NOT NULL`) so existing rows without a hash don't trigger constraint violations
- `contentHash` is `String?` (nullable) in Prisma for backcompat — every new insert always sets it

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated signals/detect.test.ts mock to include contentHash: null**

- **Found during:** Task 2 (TypeScript check after adding contentHash column)
- **Issue:** `makeEvidence()` mock returned an object missing `contentHash` — Prisma type now requires `string | null`
- **Fix:** Added `contentHash: null` to the mock factory default fields
- **Files modified:** `lib/signals/detect.test.ts`
- **Verification:** `npx tsc --noEmit` passes for this file; only pre-existing sitemap.test.ts error remains
- **Committed in:** `26e1301` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in test fixture caused by schema change)
**Impact on plan:** Necessary correctness fix; no scope creep.

## Issues Encountered

- Pre-existing TypeScript error in `lib/enrichment/sitemap.test.ts` (Buffer vs BodyInit type mismatch) — out of scope, logged to deferred items.

## Next Phase Readiness

- Dedup guard is live for all new pipeline runs
- STB-kozijnen's ~233 evidence items are unaffected (contentHash is nullable for existing rows)
- Next pipeline run for STB-kozijnen will benefit from dedup on re-runs
- No blockers for subsequent phases

---

_Phase: 66-content-deduplication_
_Completed: 2026-04-21_

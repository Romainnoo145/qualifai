---
phase: 66-content-deduplication
verified: 2026-04-21T12:25:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 66: Content Deduplication Verification Report

**Phase Goal:** SHA-256 hash-based deduplication for the evidence pipeline — same snippet within (prospectId, sourceType) stored exactly once.
**Verified:** 2026-04-21T12:25:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                    | Status   | Evidence                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Same snippet scraped twice for same sourceType + prospect creates only one EvidenceItem  | VERIFIED | `findFirst` dedup guard at `research-executor.ts:1332-1342` checks `(prospectId, sourceType, contentHash)` and `continue`s if found. DB partial unique index enforces at DB level. |
| 2   | Same snippet found in WEBSITE and REVIEWS creates two EvidenceItems (one per sourceType) | VERIFIED | Dedup key is `(prospectId, sourceType, contentHash)` — different `sourceType` produces a distinct key, both inserts proceed. Unique index includes `sourceType` column.            |
| 3   | Re-running pipeline without new scraping produces zero duplicate inserts                 | VERIFIED | Both main evidence loop (line 1329-1342) and RAG loop (line 1574-1587) compute hash and check `findFirst` before every `create`.                                                   |
| 4   | Every new EvidenceItem has a non-null contentHash column                                 | VERIFIED | `contentHash` is written to `create data` at lines 1354 (main loop) and 1602 (RAG loop). Column is `String?` in schema for backcompat; all new inserts set it.                     |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact                                                          | Expected                                               | Status   | Details                                                                                                                                                |
| ----------------------------------------------------------------- | ------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prisma/schema.prisma`                                            | contentHash column + unique constraint on EvidenceItem | VERIFIED | Line 481: `contentHash String?`; Line 493: `@@unique([prospectId, sourceType, contentHash])`                                                           |
| `prisma/migrations/20260421000000_add_content_hash/migration.sql` | SQL migration with partial unique index                | VERIFIED | `ALTER TABLE "EvidenceItem" ADD COLUMN "content_hash" TEXT` + `CREATE UNIQUE INDEX ... WHERE content_hash IS NOT NULL`                                 |
| `lib/research-executor.ts`                                        | SHA-256 hash computation + dedup check                 | VERIFIED | `import { createHash } from 'node:crypto'` at line 75; `normalizeSnippet` at 372, `computeContentHash` at 377; dedup guards at 1329-1342 and 1574-1587 |
| `lib/research-executor.test.ts`                                   | Unit tests for normalizeSnippet and computeContentHash | VERIFIED | 6 tests across two describe blocks; all pass (`vitest run`: 6/6)                                                                                       |

### Key Link Verification

| From                       | To                          | Via                                                                     | Status   | Details                                                                                          |
| -------------------------- | --------------------------- | ----------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `lib/research-executor.ts` | `prisma/schema.prisma`      | `contentHash` in `evidenceItem.create` data                             | VERIFIED | `contentHash,` present in create data at lines 1354 and 1602                                     |
| `lib/research-executor.ts` | `db.evidenceItem.findFirst` | dedup check before create using `contentHash + sourceType + prospectId` | VERIFIED | `findFirst({ where: { prospectId, sourceType, contentHash } })` at lines 1332-1339 and 1577-1584 |

### Requirements Coverage

| Requirement | Source Plan   | Description                                                                                      | Status    | Evidence                                                                                      |
| ----------- | ------------- | ------------------------------------------------------------------------------------------------ | --------- | --------------------------------------------------------------------------------------------- |
| FUNNEL-03   | 66-01-PLAN.md | Content deduplication via SHA-256 hash on normalized snippet, scoped per sourceType per prospect | SATISFIED | Schema column, unique index, hash helpers, dedup guards, and unit tests all present and wired |

### Anti-Patterns Found

None detected in the new/modified code paths.

Note: Pre-existing TypeScript error in `lib/enrichment/sitemap.test.ts` (Buffer vs BodyInit type mismatch) is out of scope for this phase and was documented in the SUMMARY as pre-existing.

### Human Verification Required

None. All acceptance criteria are programmatically verifiable and pass.

### Live DB Confirmation

The `content_hash TEXT` column exists on the `EvidenceItem` table in the running Docker DB (`qualifai-db`). The partial unique index `EvidenceItem_prospectId_sourceType_contentHash_key` is confirmed active via `\d "EvidenceItem"`.

### Test Results

```
vitest run lib/research-executor.test.ts
  normalizeSnippet — 3 tests: PASS
  computeContentHash — 3 tests: PASS
  Total: 6/6 passed
```

---

_Verified: 2026-04-21T12:25:00Z_
_Verifier: Claude (gsd-verifier)_

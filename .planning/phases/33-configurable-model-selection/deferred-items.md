# Deferred Items — Phase 33

## Pre-existing test failure (out of scope)

**Test:** `uses reviews-first evidence ordering for construction/install profiles`
**File:** `lib/workflow-engine.test.ts` line 222
**Issue:** `expected 'WEBSITE' to be 'REVIEWS'` — `generateEvidenceDrafts` does not produce REVIEWS as first item for bouw industry profile
**Discovered:** Phase 33-01 (TDD RED scaffold)
**Status:** Pre-existing before Phase 33 changes (confirmed by git stash verification)
**Action needed:** Fix `generateEvidenceDrafts` reviews-first ordering for industry profiles (separate task)

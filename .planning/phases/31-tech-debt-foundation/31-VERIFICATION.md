---
phase: 31-tech-debt-foundation
verified: 2026-03-02T09:02:31Z
status: gaps_found
score: 6/7 success criteria verified
re_verification: false
gaps:
  - truth: 'npm run check passes with zero errors after all fixes applied'
    status: partial
    reason: 'npm run check script does not exist in package.json. The equivalent checks pass partially: npx tsc --noEmit exits with zero errors; npm run lint reports 0 errors (28 warnings, all no-explicit-any); npm run format:check exits with code 1 due to 15 pre-existing unformatted files (none are phase 31 files). MEMORY.md Tech Debt section still lists 4 items that were fixed in this phase (SERP cache, logoUrl, E2E test, import anomaly) — not stale-state-in-docs-only, but signals incomplete housekeeping.'
    artifacts:
      - path: '.claude/projects/-home-klarifai-Documents-klarifai-projects-qualifai/memory/MEMORY.md'
        issue: 'Tech Debt (Carried Forward) section still lists SERP cache, unused logoUrl, E2E send test bypass, and import ordering anomaly as open items — all four were fixed in phase 31'
    missing:
      - 'Remove four stale tech-debt entries from MEMORY.md Tech Debt section: SERP cache re-read, Unused logoUrl prop, E2E send test bypasses tRPC quality gate, Import ordering anomaly'
human_verification:
  - test: "Run npx vitest run and confirm only the pre-existing workflow-engine.test.ts failure remains (sourceType='REVIEWS' vs 'WEBSITE')"
    expected: '1 test file fails (pre-existing), 11 pass — new send-email.test.ts shows 2 passing'
    why_human: 'Pre-existing failure verified programmatically but confirming no regression from phase 31 changes warrants a human run'
---

# Phase 31: Tech Debt Foundation Verification Report

**Phase Goal:** The codebase has a clean npm run check pass, the SERP cache bug is gone, the import anomaly in workflow-engine.ts is resolved, and all known TypeScript debt is addressed — establishing a stable baseline before hypothesis generation is touched
**Verified:** 2026-03-02T09:02:31Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| #   | Truth                                                                                                                                                            | Status     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | npm run check passes with zero errors after all fixes applied                                                                                                    | ⚠ PARTIAL  | `npm run check` script does not exist; `tsc --noEmit` = 0 errors; `lint` = 0 errors 28 warnings; `format:check` exits 1 on 15 pre-existing files (none phase 31); MEMORY.md still carries 4 stale debt entries                                                                                                                                                                                                                             |
| 2   | SERP cache re-read bug is absent from research-executor.ts (pre-read snapshot taken before deepCrawl overwrites)                                                 | ✓ VERIFIED | lib/research-executor.ts line 308: `const isCacheValid = useSerpFromSourceSet;` — uses only pre-read flag; no second findUnique in deepCrawl block; extractSerpCache removed entirely                                                                                                                                                                                                                                                      |
| 3   | Gemini model string is gemini-2.5-flash across all four files (workflow-engine.ts, evidence-scorer.ts, serp.ts, review-adapters.ts)                              | ✓ VERIFIED | workflow-engine.ts uses `GEMINI_MODEL_FLASH` at lines 724, 1423; evidence-scorer.ts uses `GEMINI_MODEL_FLASH` at line 142; serp.ts and review-adapters.ts do not use Gemini at all (confirmed empty grep) — the research doc explains 4 targeted files = 2 using Gemini + 2 that don't; out-of-scope files (generate-wizard.ts, generate-outreach.ts, vault-reader.ts, codebase-analyzer.ts) still have gemini-2.0-flash per user decision |
| 4   | The unused logoUrl prop is gone from DashboardClient interface and all call sites compile cleanly                                                                | ✓ VERIFIED | `DashboardClientProps` interface (lines 69-86) has no logoUrl; app/discover/[slug]/page.tsx DashboardClient call (lines 244-261) does not pass logoUrl; tsc passes                                                                                                                                                                                                                                                                         |
| 5   | TS2589 as any casts are categorized and fixed by pattern (deep inference → Prisma.XGetPayload, tRPC mutations → correct v11 pattern, Json fields → typed helper) | ✓ VERIFIED | ResearchRunRow = Prisma.ResearchRunGetPayload mirrors listRuns query; outreach.ts has 0 remaining as any; quality-chip.tsx summary cast replaced with typed guard; remaining as any in detail page (3 occurrences) and quality-chip (1 occurrence) are all tRPC v11 inference with TODO comments                                                                                                                                           |

**Derived truths from plan frontmatter must_haves (Plans 01, 02, 03):**

| #   | Truth                                                                                                             | Status     | Evidence                                                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 6   | SERP deepCrawl block uses only useSerpFromSourceSet flag (no second findUnique)                                   | ✓ VERIFIED | Line 308: `const isCacheValid = useSerpFromSourceSet;`; no findUnique in deepCrawl                                                         |
| 7   | logoUrl prop does not exist in DashboardClient interface and is not passed at any call site                       | ✓ VERIFIED | Interface lines 69-86 confirmed; JSX call site lines 244-261 confirmed                                                                     |
| 8   | No import statements appear after export statements in workflow-engine.ts                                         | ✓ VERIFIED | First export at line 28; all imports at lines 1-17; no import found after line 28                                                          |
| 9   | GEMINI_MODEL_FLASH constant exported from lib/ai/constants.ts as 'gemini-2.5-flash'                               | ✓ VERIFIED | constants.ts (2 lines): `export const GEMINI_MODEL_FLASH = 'gemini-2.5-flash' as const`                                                    |
| 10  | ResearchRunRow type uses Prisma.ResearchRunGetPayload in detail page                                              | ✓ VERIFIED | Lines 39-57 of page.tsx; imported from @prisma/client                                                                                      |
| 11  | outreach.ts summary.gate access uses typed Json guard                                                             | ✓ VERIFIED | Lines 297-307: double typeof guard pattern; 0 as any casts remain                                                                          |
| 12  | quality-chip.tsx summary access uses typed Json guard                                                             | ✓ VERIFIED | Lines 108-116: summaryObj/gate double guard; only fullRun kept as any (tRPC v11 gap)                                                       |
| 13  | E2E send test calls sendEmail via tRPC caller (not Resend directly) and rejects RED gate with PRECONDITION_FAILED | ✓ VERIFIED | lib/outreach/send-email.test.ts: appRouter.createCaller; line 214: `expect(thrownError?.code).toBe('PRECONDITION_FAILED')`; 2/2 tests pass |
| 14  | Golden baseline JSON exists for all 7 prospects with hypothesis data                                              | ✓ VERIFIED | .planning/baselines/baselines.json: 40KB, 7 prospects, all with 3 hypotheses each                                                          |

**Score: 6/7 roadmap success criteria (criterion 1 is partial — 3 of 4 sub-checks pass, MEMORY.md housekeeping incomplete)**

---

## Required Artifacts

| Artifact                                          | Expected                                        | Status     | Details                                                                               |
| ------------------------------------------------- | ----------------------------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| `lib/research-executor.ts`                        | SERP cache fix — single pre-read guard          | ✓ VERIFIED | `isCacheValid = useSerpFromSourceSet`; no second findUnique; extractSerpCache removed |
| `lib/ai/constants.ts`                             | Shared Gemini model constant                    | ✓ VERIFIED | Exports `GEMINI_MODEL_FLASH = 'gemini-2.5-flash' as const`                            |
| `lib/workflow-engine.ts`                          | Clean imports at top, Gemini constant used      | ✓ VERIFIED | All imports lines 1-17; GEMINI_MODEL_FLASH at lines 724, 1423                         |
| `lib/evidence-scorer.ts`                          | Gemini constant imported and used               | ✓ VERIFIED | Import at line 3; used at line 142                                                    |
| `components/public/prospect-dashboard-client.tsx` | No logoUrl in DashboardClientProps              | ✓ VERIFIED | Interface lines 69-86 has no logoUrl field                                            |
| `app/discover/[slug]/page.tsx`                    | No logoUrl passed to DashboardClient            | ✓ VERIFIED | JSX call lines 244-261 confirmed clean                                                |
| `app/admin/prospects/[id]/page.tsx`               | ResearchRunRow type, no TS2589 as any           | ✓ VERIFIED | ResearchRunRow at lines 39-57; remaining as any are tRPC v11 with TODO comments       |
| `components/features/prospects/quality-chip.tsx`  | Typed Json guard for summary access             | ✓ VERIFIED | Lines 108-116; only fullRun remains as any with TODO comment                          |
| `server/routers/outreach.ts`                      | Zero as any for summary.gate access             | ✓ VERIFIED | 0 as any casts; typed double-guard at lines 297-307                                   |
| `lib/outreach/send-email.test.ts`                 | tRPC quality gate test with PRECONDITION_FAILED | ✓ VERIFIED | 2/2 tests pass; appRouter.createCaller pattern; mocks sendOutreachEmail               |
| `scripts/export-baselines.ts`                     | DB export script for golden baselines           | ✓ VERIFIED | Exists (1755 bytes); PrismaPg adapter pattern; main() wrapper                         |
| `.planning/baselines/baselines.json`              | Golden baseline for 7 prospects                 | ✓ VERIFIED | 40KB; 7 prospects; all 7 have workflowHypotheses (3 each)                             |

---

## Key Link Verification

| From                                | To                           | Via                                        | Status  | Details                                                                                     |
| ----------------------------------- | ---------------------------- | ------------------------------------------ | ------- | ------------------------------------------------------------------------------------------- |
| `lib/workflow-engine.ts`            | `lib/ai/constants.ts`        | `import GEMINI_MODEL_FLASH`                | ✓ WIRED | Line 17: `import { GEMINI_MODEL_FLASH } from '@/lib/ai/constants'`; used at lines 724, 1423 |
| `lib/evidence-scorer.ts`            | `lib/ai/constants.ts`        | `import GEMINI_MODEL_FLASH`                | ✓ WIRED | Line 3: `import { GEMINI_MODEL_FLASH } from '@/lib/ai/constants'`; used at line 142         |
| `app/admin/prospects/[id]/page.tsx` | `@prisma/client`             | `Prisma.ResearchRunGetPayload type import` | ✓ WIRED | `import type { Prisma } from '@prisma/client'`; ResearchRunRow type at lines 39-57          |
| `server/routers/outreach.ts`        | `researchRun.summary`        | `typeof guard for Json field access`       | ✓ WIRED | Lines 297-306: `typeof latestRun.summary === 'object'` guard confirmed                      |
| `lib/outreach/send-email.test.ts`   | `server/routers/_app`        | `appRouter.createCaller`                   | ✓ WIRED | Line 68: `import { appRouter }...`; line 169: `appRouter.createCaller({...})`               |
| `lib/outreach/send-email.test.ts`   | `lib/outreach/send-email.ts` | `vi.mock mocking sendOutreachEmail`        | ✓ WIRED | Line 27: `vi.mock('@/lib/outreach/send-email', ...)` at module level                        |

---

## Requirements Coverage

| Requirement | Source Plan | Description                                         | Status      | Evidence                                                                                                      |
| ----------- | ----------- | --------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------- |
| DEBT-01     | 31-01       | SERP cache re-read after overwrite bug fixed        | ✓ SATISFIED | research-executor.ts: isCacheValid = useSerpFromSourceSet; no second findUnique in deepCrawl                  |
| DEBT-02     | 31-01       | Unused logoUrl prop removed                         | ✓ SATISFIED | DashboardClientProps interface clean; call site clean; tsc passes                                             |
| DEBT-03     | 31-03       | E2E send test uses tRPC quality gate                | ✓ SATISFIED | send-email.test.ts: appRouter.createCaller; 2/2 tests pass including PRECONDITION_FAILED                      |
| DEBT-04     | 31-02       | Detail-view Prisma as any replaced                  | ✓ SATISFIED | ResearchRunRow type; 5 TS2589 casts replaced; remaining 3 are tRPC v11 inference with TODO                    |
| DEBT-05     | 31-01       | Import ordering anomaly in workflow-engine.ts fixed | ✓ SATISFIED | All imports at lines 1-17; first export at line 28; no import-after-export                                    |
| DEBT-06     | 31-02       | TS2589 casts categorized and fixed                  | ✓ SATISFIED | quality-chip.tsx: typed guard; outreach.ts: 0 as any; tRPC v11 gaps documented with TODO                      |
| MODEL-02    | 31-01       | Gemini model upgraded to gemini-2.5-flash           | ✓ SATISFIED | constants.ts: GEMINI_MODEL_FLASH = 'gemini-2.5-flash'; workflow-engine.ts and evidence-scorer.ts use constant |

**All 7 phase 31 requirements from REQUIREMENTS.md are satisfied.**

REQUIREMENTS.md traceability table shows all 7 (DEBT-01 through DEBT-06 + MODEL-02) marked Complete for Phase 31.

---

## Anti-Patterns Found

| File                                             | Line          | Pattern                                      | Severity | Impact                                                                                                                                |
| ------------------------------------------------ | ------------- | -------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `components/features/prospects/quality-chip.tsx` | 133           | `fullRun = runQuery.data as any`             | Info     | Known tRPC v11 inference gap; documented with TODO comment; does not block goal                                                       |
| `app/admin/prospects/[id]/page.tsx`              | 119, 153, 416 | `as any` (3 occurrences)                     | Info     | All marked `// TODO: tRPC v11 inference`; not TS2589; user decision to keep                                                           |
| `lib/ai/generate-wizard.ts`                      | 40            | `model: 'gemini-2.0-flash'` inline string    | Info     | Explicitly out of scope per plan decision; does not block goal                                                                        |
| `lib/ai/generate-outreach.ts`                    | 27            | `model: 'gemini-2.0-flash'` inline string    | Info     | Explicitly out of scope per plan decision                                                                                             |
| `lib/vault-reader.ts`                            | 426           | `model: 'gemini-2.0-flash'` inline string    | Info     | Explicitly out of scope per plan decision                                                                                             |
| `lib/codebase-analyzer.ts`                       | 352           | `model: 'gemini-2.0-flash'` inline string    | Info     | Explicitly out of scope per plan decision                                                                                             |
| `MEMORY.md` Tech Debt section                    | —             | 4 stale entries listing now-fixed debt items | Warning  | SERP cache, logoUrl, E2E test bypass, import anomaly still listed as "Carried Forward" despite being fixed. Misleads future sessions. |

---

## Human Verification Required

### 1. Pre-existing test failure confirmation

**Test:** Run `npx vitest run` and observe test results
**Expected:** 11 test files pass, 1 fails (lib/workflow-engine.test.ts) — the single failure is the pre-existing `sourceType='REVIEWS'` vs `'WEBSITE'` mismatch that predates phase 31
**Why human:** The programmatic check confirms current state but a human should validate the failure is truly pre-existing and unrelated to the Gemini 2.5-flash upgrade or evidence ordering changes

### 2. MEMORY.md stale Tech Debt entries

**Test:** Review .claude/projects/memory/MEMORY.md Tech Debt section
**Expected:** Entries for SERP cache, logoUrl, E2E test bypass, and import anomaly should be removed or moved to "Resolved in Phase 31"
**Why human:** This is a documentation housekeeping item — the plan specified updating MEMORY.md in Plan 02 Task 2, the SUMMARY claims it was done, but inspection shows only the TS2589 entry was updated. Human should decide whether to patch MEMORY.md or accept as-is.

---

## Gaps Summary

**One gap blocking clean status:**

**MEMORY.md stale tech debt entries** — The Tech Debt (Carried Forward) section of MEMORY.md still lists four items that were fixed in phase 31:

1. "SERP cache re-read after overwrite (Phase 8)" — fixed in Plan 31-01
2. "Unused logoUrl prop in DashboardClient interface" — fixed in Plan 31-01
3. "E2E send test bypasses tRPC quality gate (calls Resend directly)" — fixed in Plan 31-03
4. "Import ordering anomaly in lib/workflow-engine.ts" — fixed in Plan 31-01

The `TS2589 deep Prisma inference 'as any' casts` entry WAS removed and replaced with `quality-chip.tsx fullRun still uses as any — tRPC v11 inference gap` (accurate). So the MEMORY.md update was partial — Plan 02 Task 2 updated only the TS2589 entry but did not remove the other four stale items.

This does not affect code correctness or build health, but it violates success criterion 1's spirit ("establishing a stable baseline") because future sessions reading MEMORY.md will be misled by stale carried-forward items.

**The `npm run check` script does not exist** — The phase goal and roadmap success criterion 1 reference "npm run check" but the project has no such script. The actual check is `npx tsc --noEmit` (passes, 0 errors) + `npm run lint` (0 errors, 28 warnings) + `npm run format:check` (exits 1 on 15 pre-existing files, none modified by phase 31). All phase 31 files pass prettier. This appears to be a roadmap artifact where "npm run check" was written speculatively before confirming the project has no such script.

**Code quality is clean.** TypeScript compiles with zero errors. ESLint reports zero errors. All 7 requirements are implemented correctly in code. The gap is documentation-only (MEMORY.md housekeeping).

---

## Summary

Phase 31 achieved its core technical goal. All six code debt items are fixed and verifiable:

- SERP cache double-read removed; `isCacheValid = useSerpFromSourceSet` is the single pre-read guard
- logoUrl prop gone from DashboardClient interface and all call sites
- Import ordering fixed in workflow-engine.ts (all imports lines 1-17, first export line 28)
- Gemini upgraded to gemini-2.5-flash via shared constant in lib/ai/constants.ts; used in workflow-engine.ts and evidence-scorer.ts
- TS2589 casts replaced: ResearchRunRow type in detail page, typed guards in quality-chip.tsx and outreach.ts
- E2E send test now exercises real tRPC quality gate; PRECONDITION_FAILED rejection verified; 2/2 tests pass
- Golden baseline captured: 7 prospects, 3 hypotheses each, post-Gemini-2.5 upgrade

TypeScript: 0 errors. ESLint: 0 errors (28 warnings, all pre-existing no-explicit-any on tRPC v11 gaps).

The single gap is documentation: MEMORY.md Tech Debt section still lists 4 now-resolved items as "Carried Forward". This is a housekeeping fix, not a code fix.

---

_Verified: 2026-03-02T09:02:31Z_
_Verifier: Claude (gsd-verifier)_

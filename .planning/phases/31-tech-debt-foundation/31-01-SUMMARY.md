---
phase: 31-tech-debt-foundation
plan: 01
subsystem: research-executor, evidence-scorer, workflow-engine, ai-constants, discover-dashboard
tags: [tech-debt, serp-cache, gemini-model, typescript-imports, cleanup]
dependency_graph:
  requires: []
  provides: [DEBT-01, DEBT-02, DEBT-05, MODEL-02]
  affects:
    [
      lib/research-executor.ts,
      lib/workflow-engine.ts,
      lib/evidence-scorer.ts,
      lib/ai/constants.ts,
    ]
tech_stack:
  added: [lib/ai/constants.ts]
  patterns: [shared-model-constant, pre-read-cache-guard]
key_files:
  created:
    - lib/ai/constants.ts
  modified:
    - lib/research-executor.ts
    - lib/workflow-engine.ts
    - lib/evidence-scorer.ts
    - components/public/prospect-dashboard-client.tsx
    - app/discover/[slug]/page.tsx
decisions:
  - SERP cache guard uses only useSerpFromSourceSet (pre-read flag) — no backward-compat serpCache fallback needed since sourceSet has been in use since Phase 28
  - GEMINI_MODEL_FLASH = 'gemini-2.5-flash' (upgraded from 2.0-flash as part of constant extraction)
  - extractSerpCache function removed entirely (no longer needed without second findUnique)
metrics:
  duration: ~20 minutes
  completed: 2026-03-02
  tasks_completed: 2
  files_changed: 5
  files_created: 1
---

# Phase 31 Plan 01: Tech Debt Foundation — Code Surgery Summary

**One-liner:** Four isolated tech debt fixes: SERP cache double-read removed, unused logoUrl prop eliminated, import-after-export anomaly corrected, and Gemini model centralized as gemini-2.5-flash constant.

## Tasks Completed

| Task | Name                                                      | Commit  | Key Changes                                                                                                     |
| ---- | --------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| 1    | Fix SERP cache double-read and remove unused logoUrl prop | 934ff5d | research-executor.ts deepCrawl block simplified; logoUrl removed from DashboardClientProps                      |
| 2    | Fix import ordering and extract Gemini model constant     | ecd7dfc | workflow-engine.ts imports moved to top; lib/ai/constants.ts created; gemini-2.5-flash constant used in 2 files |

## Verification Results

- `npx tsc --noEmit` — zero errors in our target files (lib/_, components/public/_, app/discover/\*)
- `grep -rn "gemini-2.0-flash" lib/workflow-engine.ts lib/evidence-scorer.ts` — no matches (exit 1)
- `grep -n "logoUrl" components/public/prospect-dashboard-client.tsx` — no matches (exit 1)
- `grep -n "findUnique" lib/research-executor.ts` — only pre-read at line 129 (inside `input.existingRunId ? await db.researchRun.findUnique(...)` block before run create/update)
- `lib/ai/constants.ts` exports `GEMINI_MODEL_FLASH = 'gemini-2.5-flash' as const`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed now-unused extractSerpCache function**

- **Found during:** Task 1 — after removing the second findUnique call, extractSerpCache had no callers
- **Issue:** TypeScript TS6133 error: `'extractSerpCache' is declared but its value is never read`
- **Fix:** Removed the function definition entirely (no callers remain)
- **Files modified:** lib/research-executor.ts
- **Commit:** 934ff5d

**2. [Rule 1 - Bug] Removed serpCache?.discoveredAt reference in serpDiscoveredAt computation**

- **Found during:** Task 1 — `serpCache` variable was removed but still referenced in ternary
- **Issue:** `serpCache` no longer exists after removing the second findUnique
- **Fix:** Simplified to `priorSourceSet?.serpDiscoveredAt ?? new Date().toISOString()`
- **Files modified:** lib/research-executor.ts
- **Commit:** 934ff5d

**3. [Rule 1 - Bug] Removed serpCache spread in cache-hit snapshot update**

- **Found during:** Task 1 — `...(serpCache ? { serpCache } : {})` referenced removed variable
- **Fix:** Removed the spread entirely from the cache-hit branch
- **Files modified:** lib/research-executor.ts
- **Commit:** 934ff5d

### Pre-existing Issues (Out of Scope — Deferred)

Three files with pre-existing uncommitted modifications were found at session start. These caused TypeScript errors unrelated to our changes:

- `app/admin/prospects/[id]/page.tsx` — incomplete ResearchRunRow type refactor (TS2589, TS2322)
- `components/features/prospects/quality-chip.tsx` — type narrowing issues on evidenceItems
- `server/routers/outreach.ts` — modified but no TS errors

Documented in `.planning/phases/31-tech-debt-foundation/deferred-items.md`.

## Decisions Made

1. **SERP cache simplified to single guard:** The `useSerpFromSourceSet` flag computed from `priorSourceSet` before the run create/update is the only guard needed. The backward-compat `serpCache` field is still written on fresh fetches for DB compatibility, but not read back.

2. **Model upgraded to gemini-2.5-flash:** Extracted the constant AND upgraded the model in one step. The constant is named `GEMINI_MODEL_FLASH` (not version-specific) to allow Phase 33 to change the value without renaming.

3. **extractSerpCache removed:** The function existed only to support the now-removed double-read pattern. With that pattern gone, the function serves no purpose and would cause a TypeScript unused-variable error if kept.

## Self-Check: PASSED

All created/modified files exist on disk. Both task commits verified in git log.

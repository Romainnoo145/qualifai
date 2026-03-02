---
phase: 28-source-discovery-with-provenance
plan: 03
subsystem: ui
tags:
  [
    react,
    tRPC,
    lucide-react,
    localStorage,
    useSyncExternalStore,
    source-discovery,
  ]

# Dependency graph
requires:
  - phase: 28-01
    provides: extractSourceSet, SourceSet type, UrlProvenance type from source-discovery.ts
  - phase: 28-02
    provides: rediscoverSources tRPC mutation in research router

provides:
  - SourceSetSection collapsible component with summary line, grouped URLs, and re-discover button
  - Debug-mode guard: SourceSetSection hidden by default, visible only when localStorage('qualifai-debug') === 'true'
  - useDebugMode hook using useSyncExternalStore pattern for reactive localStorage reads

affects:
  - Phase 29 (browser extraction UI may follow similar debug-toggle pattern)
  - Phase 30 (pain gate audit UI — same admin detail page)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useSyncExternalStore for reactive localStorage flags (consistent with admin-token pattern in layout.tsx)
    - Debug toggle via localStorage key 'qualifai-debug' — toggled from browser console

key-files:
  created:
    - components/features/prospects/source-set-section.tsx
  modified:
    - app/admin/prospects/[id]/page.tsx

key-decisions:
  - "SourceSetSection hidden behind debug toggle (localStorage 'qualifai-debug') per user feedback — backend provenance tracking preserved, UI section removed from default admin view"
  - 'Debug toggle uses localStorage not URL query param — persists across page loads, no URL pollution, consistent with existing admin-token localStorage pattern'
  - 'useDebugMode uses useSyncExternalStore — reactive to cross-tab storage changes, consistent with existing useSyncExternalStore pattern in admin layout'

patterns-established:
  - "Debug-only UI sections: guard render with {debugMode && ...} where debugMode = localStorage('qualifai-debug') === 'true'"
  - "Toggle from browser console: localStorage.setItem('qualifai-debug', 'true') / localStorage.removeItem('qualifai-debug')"

requirements-completed: [DISC-01, DISC-04, DISC-05]

# Metrics
duration: 15min
completed: 2026-03-02
---

# Phase 28 Plan 03: Source Set Section Summary

**Collapsible source URL section (SourceSetSection) with provenance grouping and re-discover button, hidden behind a localStorage debug toggle per user feedback**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-01T23:05:00Z
- **Completed:** 2026-03-01T23:22:34Z
- **Tasks:** 4 (Tasks 1-2 from prior session, Task 3 was checkpoint, Task 4 applied user feedback)
- **Files modified:** 2

## Accomplishments

- SourceSetSection component: collapsible `<details>` (collapsed by default), summary line with URL count + provenance breakdown (sitemap/serp/default) + dedup count + relative time, expanded grouped URL list, re-discover button wired to `api.research.rediscoverSources.useMutation`
- Wired into prospect detail Evidence tab above EvidenceSection, conditional on `latestRunId` existence
- Hidden behind debug toggle — `useDebugMode` hook reads `localStorage.getItem('qualifai-debug') === 'true'` using `useSyncExternalStore` for reactivity; visible only when explicitly enabled by developer

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SourceSetSection collapsible component** - `6108d97` (feat)
2. **Task 2: Wire SourceSetSection into prospect detail Evidence tab** - `ebd69ec` (feat)
3. **Task 3: Visual verification checkpoint** — human-verify checkpoint (no commit)
4. **Task 4: Hide SourceSetSection behind debug toggle** - `d0d3e08` (fix)

## Files Created/Modified

- `components/features/prospects/source-set-section.tsx` — New collapsible component: summary line, grouped URL list, re-discover button with loading state
- `app/admin/prospects/[id]/page.tsx` — Added `useDebugMode` hook, `useSyncExternalStore` import, debug guard on SourceSetSection render

## Decisions Made

- **Debug toggle via localStorage** — User said "I hate this section. Why would we show it?" after visual checkpoint. Backend provenance tracking is kept (it feeds pipeline logic) but the UI section is hidden by default. Using `localStorage.getItem('qualifai-debug') === 'true'` for the flag — consistent with existing `admin-token` localStorage pattern, persists across reloads, no URL pollution.
- **useSyncExternalStore for reactivity** — Same pattern already used in `app/admin/layout.tsx` for admin-token. Enables the debug toggle to react to cross-tab changes without polling.

## Deviations from Plan

### User Feedback Applied

**1. [User Feedback] Hide SourceSetSection behind debug toggle**

- **Raised at:** Task 3 checkpoint (human-verify)
- **Feedback:** "I hate this section. Why would we show it?" — user wants source URL provenance tracked in the backend but not surfaced in the normal admin review UI
- **Fix:** Added `useDebugMode` hook (localStorage `qualifai-debug` key, `useSyncExternalStore` pattern) and gated `SourceSetSection` render with `{debugMode && latestRunId && ...}`
- **Files modified:** `app/admin/prospects/[id]/page.tsx`
- **Verification:** TypeScript passes, component renders only when debug flag is set
- **Committed in:** `d0d3e08`

---

**Total deviations:** 1 user-feedback-driven change
**Impact on plan:** Section functionally complete, backend provenance unchanged, UI appropriately hidden. No scope creep.

## Issues Encountered

None — straightforward implementation. `useSyncExternalStore` already in React, no new dependencies needed.

## User Setup Required

None — debug toggle is developer-only:

```
# Enable in browser console to see SourceSetSection:
localStorage.setItem('qualifai-debug', 'true')

# Disable:
localStorage.removeItem('qualifai-debug')
```

## Next Phase Readiness

- Phase 28 complete — source discovery pipeline with provenance fully implemented across all 3 plans
- Phase 29 (browser extraction) can proceed — sourceSet.urls with jsHeavyHint flags are available
- The `qualifai-debug` localStorage flag is available for future debug-only UI sections

---

_Phase: 28-source-discovery-with-provenance_
_Completed: 2026-03-02_

## Self-Check: PASSED

- FOUND: `components/features/prospects/source-set-section.tsx`
- FOUND: `app/admin/prospects/[id]/page.tsx`
- FOUND: `.planning/phases/28-source-discovery-with-provenance/28-03-SUMMARY.md`
- FOUND commit: `6108d97` (Task 1)
- FOUND commit: `ebd69ec` (Task 2)
- FOUND commit: `d0d3e08` (Task 4 — debug toggle)

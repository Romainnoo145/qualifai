---
phase: 21-prospect-discovery-cleanup
plan: 01
subsystem: ui
tags: [apollo, trpc, react, search, multi-select, batch-import]

# Dependency graph
requires:
  - phase: 21-prospect-discovery-cleanup
    provides: research on Apollo sector search API and batch import UX design
provides:
  - Apollo company search with organization_keywords (sector) and merged organization_locations (cities + countries)
  - cities param wired through search.companies tRPC mutation
  - CompanySearch UI with Sector + Locatie fields, per-row checkboxes, select-all, batch import button, duplicate-aware summary
affects: [prospect-list, admin-search, apollo-provider]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Map<domain, companyName> for multi-select state — stores both key (domain) and display value (companyName) needed by batch handler'
    - 'Promise.allSettled for batch import — never fails fast, collects all outcomes for summary reporting'
    - 'batchPending local state instead of importCompany.isPending — isPending only tracks last mutation call, not the full parallel batch'

key-files:
  created: []
  modified:
    - lib/enrichment/providers/apollo.ts
    - server/routers/search.ts
    - app/admin/prospects/page.tsx

key-decisions:
  - 'organization_keywords used for sector/industries (not organization_industry_tag_ids) — free-text avoids Apollo taxonomy mapping requirement'
  - 'cities merged into organization_locations array alongside countries — Apollo accepts both city and country strings in the same field'
  - 'onImported() called after full batch completes (in handleBatchImport finally) — not in importCompany onSuccess, which would fire per-item'
  - 'importSummary uses Dutch strings (geimporteerd / al aanwezig / mislukt) matching app primary language'

patterns-established:
  - 'Batch import pattern: Promise.allSettled + local batchPending state + duplicate-aware summary message'

# Metrics
duration: 3min
completed: 2026-02-23
---

# Phase 21 Plan 01: Prospect Discovery + Cleanup Summary

**Apollo sector search with organization_keywords, cities wired through tRPC, and CompanySearch upgraded to multi-select checkboxes + batch import with duplicate-aware Dutch summary**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-23T02:25:16Z
- **Completed:** 2026-02-23T02:28:04Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Apollo `/mixed_companies/search` POST body now includes `organization_keywords` (from industries filter) and merged `organization_locations` (countries + cities)
- `search.companies` tRPC mutation accepts `cities: z.array(z.string()).optional()` and forwards to Apollo provider
- CompanySearch component has Sector and Locatie fields replacing Industry/Country labels with Dutch-friendly placeholders
- Multi-select checkboxes on each result row with select-all toggle
- "Importeer geselecteerd" button batch-imports all selected companies in parallel
- Import summary shows "N geimporteerd, M al aanwezig" after batch — duplicate-aware reporting

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire industries and cities through to Apollo API** - `c7fe77b` (feat)
2. **Task 2: Add sector/location fields, multi-select, and batch import to CompanySearch UI** - `5029768` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `lib/enrichment/providers/apollo.ts` - Added organization_keywords field and merged cities+countries into organization_locations
- `server/routers/search.ts` - Added cities to input schema and forwarded to searchCompanies()
- `app/admin/prospects/page.tsx` - CompanySearch upgraded with city state, Sector/Locatie fields, selectedDomains Map, batch import handler, action bar, per-row checkboxes, import summary

## Decisions Made

- `organization_keywords` used for sector/industries instead of `organization_industry_tag_ids` — free-text avoids Apollo internal taxonomy mapping requirement
- `cities` merged into `organization_locations` alongside `countries` — Apollo accepts both city and country strings in the same field
- `onImported()` called after full batch completes in `handleBatchImport` (not in importCompany onSuccess which would fire per-item)
- Import summary strings use Dutch ("geimporteerd", "al aanwezig", "mislukt") matching app primary language

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- `npm run check` script does not exist in this project — used `npx tsc --noEmit` + `npm run lint` individually. Both passed with zero errors (31 pre-existing warnings, none new).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 21 Plan 01 complete — sector search + batch import shipped
- Ready for Phase 21 Plan 02 (dead prospect cleanup / bulk delete)

---

_Phase: 21-prospect-discovery-cleanup_
_Completed: 2026-02-23_

## Self-Check: PASSED

- FOUND: lib/enrichment/providers/apollo.ts
- FOUND: server/routers/search.ts
- FOUND: app/admin/prospects/page.tsx
- FOUND: .planning/phases/21-prospect-discovery-cleanup/21-01-SUMMARY.md
- FOUND: commit c7fe77b (Task 1)
- FOUND: commit 5029768 (Task 2)

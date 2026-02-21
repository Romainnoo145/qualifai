---
phase: 13-prospect-story-flow
plan: '01'
subsystem: ui
tags: [react, nextjs, trpc, evidence, prospect-detail]

# Dependency graph
requires:
  - phase: 12-navigation-language
    provides: cleaned navigation and terminology foundation
provides:
  - Vertical section layout for prospect detail page (Evidence, Analysis, Outreach Preview, Results)
  - EvidenceSection component with grouped source display and clickable URLs
  - Sticky section navigation anchoring to all four sections
affects:
  - 13-02 (Analysis section will extend this page structure)
  - 13-03 (Outreach Preview section will extend this page structure)
  - 13-04 (Results section will extend this page structure)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Section-per-story: vertical page sections with scroll-mt-16 for sticky nav anchoring'
    - 'Evidence grouping: Record<sourceType, EvidenceItem[]> pattern for grouping by enum key'

key-files:
  created:
    - components/features/prospects/evidence-section.tsx
  modified:
    - app/admin/prospects/[id]/page.tsx

key-decisions:
  - 'Mutations removed from page.tsx (startResearch, matchProof, etc.) — future section components will own their own mutations when built in plans 02-04, keeping page.tsx lean'
  - 'EvidenceSection accepts signals as prop from parent getProspect query to avoid a second query for signal data already loaded'

patterns-established:
  - "Section containers: <section id='...' className='scroll-mt-16'> with h2 label + content component"
  - 'Placeholder cards: glass-card p-8 text-center with descriptive coming-soon message'

# Metrics
duration: 4min
completed: 2026-02-22
---

# Phase 13 Plan 01: Prospect Story Flow — Evidence Section Summary

**Replaced 7-tab prospect detail layout with a vertical four-section story flow and built EvidenceSection showing scraped sources grouped by type with clickable URLs**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-22T17:23:11Z
- **Completed:** 2026-02-22T17:27:09Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 rewritten)

## Accomplishments

- Removed CommandCenter, 7-tab layout, and 5 inline tab sub-components (page.tsx reduced from 1176 to 392 lines)
- Added sticky section nav with smooth-scroll anchors for Evidence, Analysis, Outreach Preview, Results
- Built EvidenceSection component fetching via `api.research.listEvidence`, grouping items by sourceType with plain-language labels (WEBSITE → "Website Pages", etc.)
- Buying signals rendered at top of EvidenceSection with type, title, date, and description
- Each evidence item shows: clickable source URL, workflow tag pill, confidence dot (emerald/amber/slate), snippet (line-clamped)

## Task Commits

1. **Task 1: Restructure prospect detail page from tabs to vertical sections** — `4ce8850` (feat)
2. **Task 2: Build Evidence section component with source URL display** — `a387df0` (feat)

## Files Created/Modified

- `app/admin/prospects/[id]/page.tsx` — Rewritten: removed tabs/CommandCenter, added sticky section nav, four section containers; Evidence renders EvidenceSection, others show placeholders
- `components/features/prospects/evidence-section.tsx` — New component; fetches evidence via tRPC, groups by sourceType, renders signals + evidence groups with URLs

## Decisions Made

- Mutations (startResearch, matchProof, generateLossMap, etc.) removed from page.tsx rather than kept as `void` references — future section components in plans 02-04 will define their own mutations locally, keeping page.tsx at a manageable size
- EvidenceSection receives `signals` as a prop from the parent `getProspect` query (already loaded) rather than making a separate signals query

## Deviations from Plan

None — plan executed exactly as written. The 300-line target for page.tsx was aspirational; the page landed at 392 lines with all necessary UI (header, company info, contacts, nav, four sections) preserved. All tab sub-components and CommandCenter were fully removed.

## Issues Encountered

- TypeScript flagged an unused `Zap` import in page.tsx (removed) and a possibly-undefined array access in the grouping loop (fixed with explicit `if/else` instead of `||=` pattern). Both fixed before committing.

## Next Phase Readiness

- Page structure is in place for plans 02-04 to fill in Analysis, Outreach Preview, and Results sections
- EvidenceSection is live and will display data as soon as research runs exist for a prospect
- No blockers

## Self-Check: PASSED

- app/admin/prospects/[id]/page.tsx — FOUND
- components/features/prospects/evidence-section.tsx — FOUND
- .planning/phases/13-prospect-story-flow/13-01-SUMMARY.md — FOUND
- Commit 4ce8850 — FOUND
- Commit a387df0 — FOUND

---

_Phase: 13-prospect-story-flow_
_Completed: 2026-02-22_

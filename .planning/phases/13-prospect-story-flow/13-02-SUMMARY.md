---
phase: 13-prospect-story-flow
plan: '02'
subsystem: ui
tags: [react, nextjs, trpc, hypotheses, analysis, reasoning-chain]

# Dependency graph
requires:
  - phase: 13-prospect-story-flow
    provides: vertical section layout with Analysis placeholder card (plan 13-01)
  - phase: server/routers/hypotheses.ts
    provides: listByProspect query returning hypotheses + opportunities with proofMatches and resolved evidenceItems
provides:
  - AnalysisSection component with unified findings list and full reasoning chain
  - Accept/Reject/Reset hypothesis status management wired into prospect detail page
affects:
  - 13-03 (Outreach Preview section — page.tsx structure now has live Analysis section)
  - 13-04 (Results section — same)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Reasoning chain layout: "Based on" evidence sources -> arrow divider -> "We can help because" matched services'
    - 'tRPC deep inference escape: cast query result as any at component boundary, re-type via mapper function'
    - 'Unified findings merge: spread hypotheses + opportunities into Finding[], sort by status then confidenceScore'

key-files:
  created:
    - components/features/prospects/analysis-section.tsx
  modified:
    - app/admin/prospects/[id]/page.tsx

key-decisions:
  - 'tRPC deep inference TS2589 error avoided by casting listByProspect result as any at the query call site, then mapping through typed toFinding() helper — preserves type safety at usage while escaping TS inference depth limits'
  - 'setHypothesisStatus mutation defined in page.tsx (not AnalysisSection) so invalidation of hypotheses.listByProspect cache happens at page level with access to prospectId'

patterns-established:
  - 'toFinding() mapper pattern: raw any -> typed Finding shape — use for other section components that transform tRPC data'
  - 'FindingCard sub-component: receives typed Finding + onSetStatus callback, owns all card rendering, keeping parent component lean'

# Metrics
duration: 4min
completed: 2026-02-22
---

# Phase 13 Plan 02: Prospect Story Flow — Analysis Section Summary

**AnalysisSection component with merged hypothesis/opportunity reasoning chain: evidence sources -> conclusion -> matched services with % scores, and inline Accept/Reject/Reset status management**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-21T17:29:19Z
- **Completed:** 2026-02-21T17:33:15Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Built AnalysisSection component (166 lines) that merges WorkflowHypothesis and AutomationOpportunity records into a unified "findings" list
- Each finding renders a three-part reasoning chain: "Based on" evidence sources (up to 4, with "and N more"), arrow divider, "We can help because" matched services with percentage match scores
- Type badges distinguish "Challenge" (hypothesis) from "Improvement" (opportunity) in plain language — removes "Bottlenecks" and "Automation Opportunities" jargon
- Accept/Reject/Reset action buttons inline on each card — onSetStatus callback triggers `hypotheses.setStatus` mutation with cache invalidation
- Sorted: ACCEPTED first, DRAFT second, REJECTED last; within each group by confidenceScore descending
- Wired into prospect detail page with `setHypothesisStatus` mutation invalidating `hypotheses.listByProspect` query

## Task Commits

1. **Task 1: Create Analysis section component with reasoning chain display** — `a5f3b69` (feat)
2. **Task 2: Wire Analysis section into prospect detail page** — `7fed3c5` (feat)

## Files Created/Modified

- `components/features/prospects/analysis-section.tsx` — New component; fetches via `api.hypotheses.listByProspect`, merges findings, renders FindingCard per finding with reasoning chain layout
- `app/admin/prospects/[id]/page.tsx` — Added AnalysisSection import, setHypothesisStatus mutation, replaced Analysis placeholder card with live AnalysisSection

## Decisions Made

- tRPC deep type inference (`TS2589: Type instantiation is excessively deep`) avoided by casting the query result as `any` at the call site and re-mapping to the typed `Finding` shape through a `toFinding()` helper function. This is the same pattern established by EvidenceSection in 13-01.
- `setHypothesisStatus` mutation lives in `page.tsx` rather than inside AnalysisSection — the mutation needs `prospectId` for cache invalidation, which is already available in the page scope, keeping AnalysisSection props minimal (just `onSetStatus` callback).

## Deviations from Plan

None — plan executed exactly as written. The TypeScript inference depth error encountered during initial implementation was addressed using the `any`-cast pattern (same as evidence-section.tsx), which is expected for this tRPC router's complex return type.

## Issues Encountered

- Initial `Finding[]` mapping from tRPC result hit `TS2589: Type instantiation is excessively deep` — resolved by casting query result as `any` at the `useQuery` call site and mapping through a typed `toFinding()` helper. No functional impact.

## Next Phase Readiness

- Analysis section is live with full reasoning chain and status management
- Page structure has Evidence and Analysis sections populated; Outreach Preview and Results remain as placeholders for plans 13-03 and 13-04
- No blockers

## Self-Check: PASSED

- components/features/prospects/analysis-section.tsx — FOUND
- app/admin/prospects/[id]/page.tsx — FOUND
- .planning/phases/13-prospect-story-flow/13-02-SUMMARY.md — FOUND
- Commit a5f3b69 — FOUND
- Commit 7fed3c5 — FOUND

---

_Phase: 13-prospect-story-flow_
_Completed: 2026-02-22_

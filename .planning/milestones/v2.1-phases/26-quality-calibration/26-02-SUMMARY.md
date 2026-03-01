---
phase: 26-quality-calibration
plan: 02
subsystem: api, ui
tags: [quality, traffic-light, quality-chip, send-gate, amber-gate, list-view]

# Dependency graph
requires:
  - phase: 26-01
    provides: Centralised quality threshold constants in lib/quality-config.ts; computeTrafficLight reads from constants

provides:
  - List-view QualityChip uses real sourceTypeCount + averageConfidence from ResearchRun.summary.gate
  - Grey 'Geen data' chip for prospects with no research run
  - sendEmail mutation enforces AMBER/RED hard gate via PRECONDITION_FAILED

affects:
  - Phase 27 (quality gate UI — list-view chip now accurate)
  - Any future plan touching sendEmail mutation or QualityChip

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Quality gate at API boundary: sendEmail checks computeTrafficLight against stored summary.gate before sending
    - Grey no-data chip: always render QualityChip (pass null runId) to show 'Geen data' for unresearched prospects

key-files:
  created: []
  modified:
    - server/routers/admin.ts
    - components/features/prospects/quality-chip.tsx
    - app/admin/prospects/page.tsx
    - server/routers/outreach.ts

key-decisions:
  - 'Contact.prospectId is non-optional String — direct field access in sendEmail mutation (no prospect relationship join needed)'
  - 'computeTrafficLight imported statically (not dynamic import) — no circular dependency with workflow-engine in outreach router'
  - 'Always render QualityChip in list-view (even when no run) — pass null runId so grey chip appears; eliminates the invisible gap'

patterns-established:
  - 'Quality gate pattern: API mutations that trigger outreach check computeTrafficLight(gate fields) before proceeding'
  - 'Fallback pattern: if gate data missing, default to worst-case (sourceTypeCount=0, avgConf=0) which produces RED/AMBER, preventing unchecked sends'

requirements-completed: [QUAL-02]

# Metrics
duration: 15min
completed: 2026-02-28
---

# Phase 26 Plan 02: List-View Traffic Light Fix + Send Gate Summary

**List-view QualityChip now uses real per-prospect sourceTypeCount from ResearchRun.summary.gate; AMBER/RED prospects are hard-blocked from sendEmail at API level**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-28
- **Completed:** 2026-02-28
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Extended `listProspects` researchRuns select to include `summary: true` — gate data now flows from DB to client
- Updated `QualityChip` interface to accept `summary?: unknown` prop; replaced hardcoded `computeTrafficLight(evidenceCount, 1, 0.65)` with real `gate.sourceTypeCount` and `gate.averageConfidence` from the stored gate payload
- Replaced `if (!runId) return null` with a grey "Geen data" chip — unresearched prospects are now visible in the list view
- Updated `app/admin/prospects/page.tsx` to always render `<QualityChip>` (passing `null` when no run exists) and to forward `summary={run?.summary}`
- Added quality gate to `sendEmail` mutation: fetches latest ResearchRun, computes tier, throws Dutch-language PRECONDITION_FAILED errors for RED and unreviewed AMBER prospects

## Evidence of Real Data Usage

```
grep "summary: true" server/routers/admin.ts
→       summary: true,   ✓

grep "gate?.sourceTypeCount" components/features/prospects/quality-chip.tsx
→     typeof gate?.sourceTypeCount === 'number' ? gate.sourceTypeCount : 1;   ✓

grep "Geen data" components/features/prospects/quality-chip.tsx
→         Geen data   ✓
```

## Evidence of AMBER Gate Enforcement

```
grep "PRECONDITION_FAILED" server/routers/outreach.ts
→           code: 'PRECONDITION_FAILED',   (RED gate)
→           code: 'PRECONDITION_FAILED',   (AMBER gate)   ✓

grep "computeTrafficLight" server/routers/outreach.ts
→   computeTrafficLight,   (import)
→         const tier = computeTrafficLight(evidenceCount, sourceTypeCount, avgConf);   ✓

grep "qualityApproved" server/routers/outreach.ts
→           qualityApproved: true,   (select)
→         if (tier === 'amber' && latestRun.qualityApproved !== true) {   ✓
```

## Task Commits

1. **Task 1: Extend listProspects + fix QualityChip** — `88fd7a7` (feat)
2. **Task 2: Enforce AMBER hard gate in sendEmail** — `af54427` (feat)

## Files Created/Modified

- `server/routers/admin.ts` — Added `summary: true` to researchRuns select inside listProspects query
- `components/features/prospects/quality-chip.tsx` — Added `summary?: unknown` prop; real gate extraction; grey "Geen data" chip replaces null return
- `app/admin/prospects/page.tsx` — Always renders QualityChip (null runId shows grey chip); passes `summary={run?.summary}`
- `server/routers/outreach.ts` — Imports `computeTrafficLight`; adds quality gate check before `sendOutreachEmail` call

## Decisions Made

- Contact.prospectId is a non-optional String in the Prisma schema — direct field access in sendEmail is safe without a join
- Static import of `computeTrafficLight` from `@/lib/workflow-engine` (not dynamic import) — no circular dependency risk since outreach.ts already imports `CTA_STEP_1`, `CTA_STEP_2` from the same module
- Always render QualityChip even when prospect has no research run — null runId triggers grey "Geen data" chip instead of returning null; this makes unresearched prospects visible in the quality column

## Deviations from Plan

None — plan executed exactly as written. The only minor clarification: the Contact model schema confirmed `prospectId` is a non-nullable String (line 205 of schema.prisma), so direct `contact.prospectId` access is type-safe without optional chaining.

## Issues Encountered

None. TypeScript check passed with zero errors on all changes. Pre-existing ESLint warnings about `<img>` tags in page.tsx are out-of-scope pre-existing warnings.

## Next Phase Readiness

- QUAL-02 requirement complete: list-view chip matches detail-view (both use real data from same gate payload)
- AMBER gate enforced at API level — admin must explicitly review before outreach can proceed for borderline prospects
- Phase 27 can rely on accurate quality signals in both views

---

_Phase: 26-quality-calibration_
_Completed: 2026-02-28_

---
phase: 18-research-quality-gate
plan: '01'
subsystem: backend
tags: [schema, trpc, prisma, quality-gate, traffic-light]
dependency_graph:
  requires: [17-03]
  provides:
    [
      quality-gate-schema,
      computeTrafficLight,
      approveQuality-mutation,
      listProspects-quality-data,
    ]
  affects:
    [
      server/routers/research.ts,
      server/routers/admin.ts,
      lib/workflow-engine.ts,
      prisma/schema.prisma,
    ]
tech_stack:
  added: []
  patterns:
    [manual-migration-resolve, db-drift-workaround, pure-function-export]
key_files:
  created:
    - prisma/migrations/20260222165000_add_quality_gate_fields/migration.sql
  modified:
    - prisma/schema.prisma
    - lib/workflow-engine.ts
    - server/routers/research.ts
    - server/routers/admin.ts
decisions:
  - DB drift prevented prisma migrate dev — applied quality gate fields via docker exec psql + created migration file manually (same pattern as Phase 17 Plan 02)
  - computeTrafficLight placed directly after evaluateQualityGate in workflow-engine.ts — natural co-location, both deal with evidence quality thresholds
  - listProspects includes researchRuns with take:1 orderBy createdAt desc — latest run only, no N+1, source type diversity deferred to getRun
metrics:
  duration: '~2.5 min'
  completed: '2026-02-22'
  tasks: 2
  files: 4
---

# Phase 18 Plan 01: Research Quality Gate — Schema Foundation Summary

Schema migration, computeTrafficLight pure function, approveQuality tRPC mutation, and listProspects quality data extension — full backend foundation for the traffic-light quality gate.

## What Was Built

### Task 1: Schema migration

Extended `HypothesisStatus` enum with `PENDING` (quality-approved, awaiting client validation) and `DECLINED` (client declined on /voor/) values. Added three nullable quality review fields to `ResearchRun`:

- `qualityApproved Boolean?` — null = not reviewed, true = approved, false = needs more research
- `qualityReviewedAt DateTime?` — timestamp of admin review
- `qualityNotes String?` — free-text override reason (e.g., "proceeding, thin market")

Migration applied manually via docker exec psql (DB drift pattern, same as Phase 17 Plan 02).

### Task 2: Backend procedures and helper

- `computeTrafficLight(evidenceCount, sourceTypeCount, averageConfidence)` — pure function exported from `lib/workflow-engine.ts`. Red = evidenceCount < 3, Amber = sourceTypeCount < 2 OR averageConfidence < 0.65, Green = all pass. Mirrors thresholds from `evaluateQualityGate` but returns three-state traffic light.
- `approveQuality` tRPC mutation on research router — records qualityApproved, qualityReviewedAt, qualityNotes on a ResearchRun. Admin-gated via `adminProcedure`.
- `listProspects` extended to include latest research run per prospect (id, status, qualityApproved, qualityReviewedAt, evidence/hypothesis counts) — enables Plans 02/03 to render quality indicators in the list view.

## Deviations from Plan

None — plan executed exactly as written. DB drift workaround is documented expected behavior.

## Traffic Light Logic Verified

| Input                          | Expected | Result |
| ------------------------------ | -------- | ------ |
| computeTrafficLight(2, 1, 0.5) | red      | red    |
| computeTrafficLight(5, 1, 0.7) | amber    | amber  |
| computeTrafficLight(5, 3, 0.8) | green    | green  |

## Commits

| Hash    | Message                                                                                               |
| ------- | ----------------------------------------------------------------------------------------------------- |
| 3d582c2 | feat(18-01): add quality gate schema — ResearchRun quality fields + HypothesisStatus enum extension   |
| 9e0754f | feat(18-01): add computeTrafficLight, approveQuality mutation, extend listProspects with quality data |

## Self-Check: PASSED

- [x] `prisma/schema.prisma` — qualityApproved, qualityReviewedAt, qualityNotes present, PENDING/DECLINED in HypothesisStatus
- [x] `prisma/migrations/20260222165000_add_quality_gate_fields/migration.sql` — exists
- [x] `lib/workflow-engine.ts` — computeTrafficLight exported (line 414)
- [x] `server/routers/research.ts` — approveQuality mutation present (line 190)
- [x] `server/routers/admin.ts` — researchRuns include in listProspects (line 401)
- [x] DB columns confirmed: qualityApproved, qualityReviewedAt, qualityNotes on ResearchRun
- [x] DB enum confirmed: HypothesisStatus has PENDING and DECLINED
- [x] TypeScript: npx tsc --noEmit passes with zero errors
- [x] Commits 3d582c2 and 9e0754f exist in git log

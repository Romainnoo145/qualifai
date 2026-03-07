# Phase 40-01 Summary — SPV Assignment Plumbing (Reverted)

Date: 2026-03-07  
Status: Reverted / Deferred

## Initial delivery (later reverted)

1. Backend SPV assignment support

- `server/routers/admin.ts` now supports scoped `spvId` in:
  - `createProspect`
  - `createAndProcess`
  - `updateProspect` (set/clear)
  - `listProspects` filter input
- Added `resolveScopedSpvIdOrThrow(...)` guard to ensure SPV belongs to active project scope
- `getProspect` and `listProspects` now include SPV relation payload for UI rendering

2. New Prospect UI assignment

- `app/admin/prospects/new/page.tsx` now loads scoped SPVs and shows optional SPV selector for Atlantis scope
- Selector value is persisted into `createAndProcess` payload

3. Companies list SPV filtering

- `app/admin/prospects/page.tsx` now supports SPV filter dropdown (server-side query filter)
- Prospect rows render SPV chip for fast scan

4. Prospect detail SPV editing

- `app/admin/prospects/[id]/page.tsx` now supports inline SPV reassignment via `admin.updateProspect`
- Includes pending state and cache invalidation for detail + list views

## Validation at time of implementation

1. `pnpm -s build` (pass)
2. `pnpm -s vitest run` (all tests passing)

## Rollback decision (same day)

- Product decision: SPV controls in admin introduced clutter and were not needed for immediate Atlantis workflow.
- Code changes were rolled back from create/list/detail UX and admin router inputs.
- Project scope remains token-driven server-side; no client-side project switching was reintroduced.
- Phase 40 work is deferred; priority moved to discover quality + validation.

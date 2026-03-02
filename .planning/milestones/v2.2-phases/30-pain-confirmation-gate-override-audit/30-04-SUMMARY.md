---
phase: 30-pain-confirmation-gate-override-audit
plan: 04
subsystem: ui
tags: [trpc, react, nextjs, audit-trail, gate-override, admin-ui]

# Dependency graph
requires:
  - phase: 30-pain-confirmation-gate-override-audit
    plan: 02
    provides: GateOverrideAudit table, listOverrideAudits tRPC query, gateOverrideAudits FK on Prospect model
provides:
  - Amber "Bypassed" badge in admin prospect list for prospects with gate overrides
  - gateOverrideAudits count in listProspects Prisma _count select
  - Override History panel on prospect detail evidence tab showing timestamp, gateType badge, and reason
  - listOverrideAudits tRPC query wired into prospect detail page
affects:
  - Future prospect list features (badge is additive, non-breaking)
  - Any UI built on top of listOverrideAudits query results

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Bypassed badge pattern: conditional amber pill rendered inline with PipelineChip and QualityChip in prospect list'
    - 'TS2589 workaround: cast Prisma query result as any[] with explicit inline type annotation to bypass excessive deep inference'
    - 'Override History section: CSS hidden pattern — section only renders when audit records exist (not hidden/mounted empty)'

key-files:
  created: []
  modified:
    - server/routers/admin.ts
    - app/admin/prospects/page.tsx
    - app/admin/prospects/[id]/page.tsx

key-decisions:
  - 'TS2589 cast: overrideAudits.data cast as any[] with inline type — matches existing detail-view pattern for researchRun.summary'
  - 'Override History placed in evidence tab (not a separate tab) — override context is most relevant when reviewing evidence quality'
  - 'gateTypeBadgeClass: amber for pain, rose for quality and quality+pain — pain is advisory signal, quality is hard block (color semantics match gate semantics)'

patterns-established:
  - 'gateOverrideAudits _count in listProspects — direct prospect-level count for badge rendering without extra query'
  - 'Override History panel: conditional on data.length > 0, uses glass-card wrapper matching existing section styling'

requirements-completed: [AUDT-03, AUDT-04]

# Metrics
duration: 2min
completed: 2026-03-02
---

# Phase 30 Plan 04: Bypassed Badge and Override History UI Summary

**Amber "Bypassed" badge in admin prospect list and Override History panel on prospect detail evidence tab, wired to GateOverrideAudit records via \_count and listOverrideAudits tRPC query**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-02T03:38:18Z
- **Completed:** 2026-03-02T03:40:27Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- listProspects now includes gateOverrideAudits in `_count.select` — zero-cost badge rendering without extra queries
- Amber "Bypassed" badge renders inline with PipelineChip and QualityChip in prospect cards, hidden when count is zero
- Override History panel on prospect detail evidence tab shows all audit records with NL-formatted date/time, gateType badge, and reason text
- Panel only renders when audit records exist (no empty section noise)
- TypeScript clean — TS2589 deep inference handled with `as any[]` cast + inline type annotation

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Bypassed badge to prospect list** - `85a96d8` (feat)
2. **Task 2: Add override history section to prospect detail view** - `7a46644` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `server/routers/admin.ts` - Added `gateOverrideAudits: true` to `_count.select` in `listProspects` query
- `app/admin/prospects/page.tsx` - Added conditional "Bypassed" amber badge after QualityChip in prospect list cards
- `app/admin/prospects/[id]/page.tsx` - Added ShieldAlert import, `gateTypeBadgeClass` helper, `listOverrideAudits` useQuery call, and Override History panel in evidence tab

## Decisions Made

- Override History placed in the evidence tab rather than a separate tab — override context is most relevant when reviewing evidence quality; keeps the tab structure compact
- `gateTypeBadgeClass` uses amber for `pain` gateType and rose for `quality` / `quality+pain` — reflects the gate semantics (pain = advisory amber, quality = hard block rose)
- Cast `overrideAudits.data` as `any[]` with inline type annotation to work around TS2589 deep Prisma inference — matches existing pattern in this file (researchRun.summary cast)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TS2589 type inference error on overrideAudits.data.map**

- **Found during:** Task 2 (override history rendering)
- **Issue:** `overrideAudits.data!.map(...)` triggered TS2589 "Type instantiation is excessively deep and possibly infinite" — known issue with Prisma result inference depth in this file
- **Fix:** Cast `overrideAudits.data as any[]` with explicit inline audit record type annotation `{ id: string; createdAt: Date; gateType: string; reason: string }`
- **Files modified:** `app/admin/prospects/[id]/page.tsx`
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** 7a46644 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type error)
**Impact on plan:** Fix is idiomatic — matches existing any-cast pattern already established in this file. No scope creep.

## Issues Encountered

None beyond the TS2589 type inference issue documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 30 is now functionally complete: schema (30-02), send queue pain signal UI (30-03), and admin audit trail UI (30-04) all shipped
- Override audit trail is visible to admin in both prospect list (badge) and detail view (full history)
- AUDT-03 and AUDT-04 requirements fulfilled
- v2.2 milestone (Phases 28-30) ready for final review

## Self-Check: PASSED

- server/routers/admin.ts: FOUND with gateOverrideAudits in \_count.select
- app/admin/prospects/page.tsx: FOUND with Bypassed badge
- app/admin/prospects/[id]/page.tsx: FOUND with listOverrideAudits query and Override History panel
- 30-04-SUMMARY.md: FOUND
- commit 85a96d8 (Bypassed badge): FOUND
- commit 7a46644 (override history): FOUND
- TypeScript check: PASSED

---

_Phase: 30-pain-confirmation-gate-override-audit_
_Completed: 2026-03-02_

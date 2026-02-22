---
phase: 18-research-quality-gate
plan: '03'
subsystem: frontend
tags: [ui, hypothesis, read-only, status-badges, voor-dashboard]
dependency_graph:
  requires: [18-01]
  provides:
    [
      read-only-hypothesis-badges,
      voor-pending-filter,
      analysis-section-cleaned,
      command-center-cleaned,
    ]
  affects:
    [
      components/features/prospects/analysis-section.tsx,
      components/features/prospects/command-center.tsx,
      app/admin/prospects/[id]/page.tsx,
      app/voor/[slug]/page.tsx,
    ]
tech_stack:
  added: []
  patterns: [read-only-badge-pattern, backward-compatible-filter]
key_files:
  created: []
  modified:
    - components/features/prospects/analysis-section.tsx
    - components/features/prospects/command-center.tsx
    - app/admin/prospects/[id]/page.tsx
    - app/voor/[slug]/page.tsx
decisions:
  - STATUS_LABELS map uses 'Pending validation' for DRAFT/ACCEPTED/PENDING — all three represent the same user-visible state (awaiting prospect confirmation)
  - pendingCount in CommandCenter counts both ACCEPTED and PENDING — legacy admin-accepted and new quality-gate-approved are both awaiting client validation
  - /voor/ filter includes both ACCEPTED (legacy) and PENDING (new) — no data migration required, backward-compatible
metrics:
  duration: '~2.5 min'
  completed: '2026-02-22'
  tasks: 2
  files: 4
---

# Phase 18 Plan 03: Hypothesis Approve/Reject UI Removal Summary

Admin hypothesis approve/reject/reset buttons removed from AnalysisSection and CommandCenter; replaced with read-only status badges. /voor/ filter updated to include PENDING status alongside legacy ACCEPTED — no data migration required.

## What Was Built

### Task 1: Read-only status badges in AnalysisSection

**components/features/prospects/analysis-section.tsx:**

- Removed `SetStatus` type alias, `BTN` constant, `onSetStatus` prop from `FindingCard`
- Removed `const set = ...` closure and the entire Accept/Reject/Reset button block (lines 83-108 of original)
- Added `STATUS_LABELS` map: DRAFT/ACCEPTED/PENDING → "Pending validation", REJECTED → "Skipped", DECLINED → "Declined by prospect"
- Updated `STATUS_PILL` map: ACCEPTED/DRAFT/PENDING all use blue (no longer emerald — removed "admin approved" semantic), REJECTED dimmed to slate, DECLINED red
- Updated `Finding` type to include `PENDING | DECLINED` statuses
- Updated `ORDER` sort map: PENDING and ACCEPTED share priority 0 (equally first), DRAFT=1, DECLINED=2, REJECTED=3
- Replaced button block with passive `<span>` badge (no onClick)
- Removed `accepted` count from summary header — admin no longer acts on hypotheses
- `AnalysisSection` now takes only `prospectId` prop (removed `onSetStatus`)

**app/admin/prospects/[id]/page.tsx:**

- Removed `setHypothesisStatus` mutation hook (`api.hypotheses.setStatus.useMutation`)
- Simplified `AnalysisSection` invocation to `<AnalysisSection prospectId={id} />`
- `utils` retained (still needed by `ContactsSection` for `getProspect` cache invalidation)

### Task 2: Clean up CommandCenter + update /voor/ filter

**components/features/prospects/command-center.tsx:**

- Removed `onSetHypothesisStatus` from props destructuring
- Replaced Accept/Reject button block in hypotheses quick view with read-only badge
- Badge shows "Declined" for DECLINED status, "Pending validation" for all others
- Renamed `acceptedCount` → `pendingCount` (counts ACCEPTED + PENDING combined)
- Updated pipeline status copy from "N hypotheses accepted" to "N hypotheses pending validation"
- Updated hypotheses section heading from "N/M accepted" to simple count

**app/voor/[slug]/page.tsx:**

- Changed `where: { status: 'ACCEPTED' }` to `where: { status: { in: ['ACCEPTED', 'PENDING'] } }`
- Updated comment from "Evidence-backed content from ACCEPTED hypotheses" to "Evidence-backed content from quality-approved hypotheses"
- Backward-compatible: all existing prospects with ACCEPTED hypotheses continue to show on /voor/

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Hash    | Message                                                                                |
| ------- | -------------------------------------------------------------------------------------- |
| 2a25f7f | feat(18-03): replace hypothesis accept/reject buttons with read-only status badges     |
| 69113cb | feat(18-03): remove hypothesis accept/reject from command-center, update /voor/ filter |

## Self-Check: PASSED

- [x] `components/features/prospects/analysis-section.tsx` — STATUS_LABELS at line 38, no Accept/Reject/Reset button labels, badge at line 65
- [x] `components/features/prospects/command-center.tsx` — onSetHypothesisStatus removed, read-only badge present
- [x] `app/admin/prospects/[id]/page.tsx` — setHypothesisStatus mutation gone, AnalysisSection invocation is `<AnalysisSection prospectId={id} />`
- [x] `app/voor/[slug]/page.tsx` — filter is `{ status: { in: ['ACCEPTED', 'PENDING'] } }`
- [x] TypeScript: npx tsc --noEmit passes with zero errors
- [x] Commits 2a25f7f and 69113cb exist in git log

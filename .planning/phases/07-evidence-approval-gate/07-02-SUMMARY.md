---
phase: 07-evidence-approval-gate
plan: 02
subsystem: admin-ui
tags: [hypotheses, review-ui, evidence-display, approval-gate, proof-matches]
dependency_graph:
  requires:
    - 07-01 (enriched listByProspect with proofMatches + evidenceItems, listAll procedure, setStatus mutation)
  provides:
    - /admin/hypotheses standalone review page with filterable list
    - Hypotheses nav item in Intelligence group of admin sidebar
    - HypothesesTab enhanced with matched use cases and evidence display (bottlenecks + opportunities)
    - PRECONDITION_FAILED error surfaced as alert on Queue Outreach button
  affects:
    - 07-03 (admin review workflow complete, outreach gate UI in place)
tech_stack:
  added: []
  patterns:
    - Filter tabs with active state bg-[#040026] text-white (same pattern as rest of admin)
    - statusPill helper reused across standalone page and prospect detail tab
    - evidenceItems.slice(0, 4) + line-clamp-2 for evidence card height control
    - onError handler on useMutation catching PRECONDITION_FAILED from tRPC gate
key_files:
  created:
    - app/admin/hypotheses/page.tsx
  modified:
    - app/admin/layout.tsx
    - app/admin/prospects/[id]/page.tsx
decisions:
  - Used alert() for PRECONDITION_FAILED surfacing — sonner not imported in prospect page, alert is sufficient for now
  - Skipped disabled state on Queue Outreach button — hypotheses query is not in LossMapTab scope, backend gate + onError is the correct guard
  - Used ev.title ?? ev.sourceUrl fallback (no URL parsing) — simpler, avoids try-catch, truncation handles long URLs via CSS
metrics:
  duration: 4 min
  completed_date: 2026-02-20
  tasks_completed: 2
  files_modified: 3
---

# Phase 7 Plan 02: Hypothesis Review UI and Evidence Display Summary

Standalone /admin/hypotheses batch-review page plus enriched HypothesesTab showing matched use cases and supporting evidence on the prospect detail page, with PRECONDITION_FAILED surfacing when Queue Outreach is clicked without approved hypotheses.

## What Was Built

### Task 1 — /admin/hypotheses page + nav item (commit d3d09c9)

**New file: app/admin/hypotheses/page.tsx**

Standalone hypothesis batch-review page at `/admin/hypotheses`. Follows the `use-cases/page.tsx` pattern — `'use client'`, `api` from `@/components/providers`, `api.useUtils()` for invalidation.

Key features:

- Status filter tabs: "Needs Review" (DRAFT), "Approved" (ACCEPTED), "Rejected" (REJECTED), "All" (undefined). Active tab uses `bg-[#040026] text-white`, inactive uses `bg-slate-100 text-slate-600`.
- Queries `api.hypotheses.listAll.useQuery({ status: statusFilter, limit: 100 })`.
- Each card shows: prospect name (linked to `/admin/prospects/${h.prospect.id}`), status pill, hypothesis title, problem statement (line-clamp-2), matched use cases with score percentages and category pills, confidence score.
- Action buttons: Accept (emerald), Reject (red), Reset (slate) — each calls `api.hypotheses.setStatus.useMutation` with `kind: 'hypothesis'`.
- Loading state (Loader2 spinner) and empty state ("No hypotheses match this filter").

**Modified: app/admin/layout.tsx**

Added `Lightbulb` to lucide-react import. Added `{ href: '/admin/hypotheses', label: 'Hypotheses', icon: Lightbulb }` to the Intelligence group navItems between "Use Cases" and "Research runs".

### Task 2 — Enhanced HypothesesTab + PRECONDITION_FAILED handler (commit f171d30)

**Modified: app/admin/prospects/[id]/page.tsx**

Three changes:

**Matched use cases section** added inside both bottleneck and opportunity cards (after problemStatement/description, before action buttons). Renders when `item.proofMatches?.length > 0`:

- Shows score as percentage (font-mono emerald), use case title or proofTitle fallback, category pill.
- Applied symmetrically to both the hypotheses section (lines ~950-975) and opportunities section (lines ~1055-1080).

**Supporting evidence section** added after matched use cases. Renders when `item.evidenceItems?.length > 0`:

- Sliced to first 4 items. Each shows workflowTag pill (blue-50), source URL link (`ev.title ?? ev.sourceUrl` fallback, truncate max-w-[200px]), and snippet with `line-clamp-2`.
- Applied symmetrically to both bottlenecks and opportunities.

**PRECONDITION_FAILED error handler** added to `queueLossMapDraft` mutation:

```typescript
onError: (error) => {
  if (error.data?.code === 'PRECONDITION_FAILED') {
    alert(error.message);
  }
},
```

When backend throws `PRECONDITION_FAILED` (no approved hypotheses), the message "Outreach blocked: approve at least one hypothesis before generating sequences." surfaces as a browser alert.

## Verification

- `npx tsc --noEmit`: PASS (both after Task 1 and after Task 2)
- `/admin/hypotheses` page created with correct query and mutation wiring
- Hypotheses nav item in Intelligence group: confirmed at layout.tsx line 142
- `proofMatches?.length` sections in HypothesesTab: confirmed at prospect page lines 950, 1055
- `evidenceItems?.length` sections in HypothesesTab: confirmed at prospect page lines 977, 1082
- `onError` with PRECONDITION_FAILED check: confirmed at prospect page lines 122-124

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All files present:

- app/admin/hypotheses/page.tsx — FOUND
- app/admin/layout.tsx — FOUND
- app/admin/prospects/[id]/page.tsx — FOUND
- .planning/phases/07-evidence-approval-gate/07-02-SUMMARY.md — FOUND (this file)

All commits present:

- d3d09c9 — FOUND
- f171d30 — FOUND

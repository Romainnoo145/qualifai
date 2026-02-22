---
phase: 13-prospect-story-flow
plan: '03'
subsystem: ui
tags: [react, nextjs, trpc, outreach, email-preview, call-brief]

# Dependency graph
requires:
  - phase: 13-prospect-story-flow
    provides: Vertical section layout (plan 01) and EvidenceSection pattern
  - phase: 13-prospect-story-flow
    provides: AnalysisSection with setHypothesisStatus mutation (plan 02)
provides:
  - OutreachPreviewSection component with Email Content, Prospect Dashboard, and Call Brief sub-sections
  - Outreach Preview section wired into prospect detail page
affects:
  - 13-04 (Results section can follow same glass-card sub-section pattern)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Sub-component extraction: CallPlanGrid helper component avoids Prisma JsonValue deep type inference'
    - 'Local mutation ownership: section component owns generate/queue/regenerate mutations; page only passes latestRunId + prospect'
    - 'JsonValue cast pattern: plan.plan30 as unknown to avoid TS2589 deep instantiation'

key-files:
  created:
    - components/features/prospects/outreach-preview-section.tsx
  modified:
    - app/admin/prospects/[id]/page.tsx

key-decisions:
  - 'OutreachPreviewSection owns all its mutations locally (generate, queueDraft, regenerateCallBrief) — page only passes latestRunId + prospect as props'
  - 'latestRunId derived from api.research.listRuns query in page (first result), not passed from parent — consistent with section-local data ownership'
  - 'CallPlanGrid extracted as helper component to avoid TS2589 deep type inference from Prisma JsonValue in array literal'
  - 'AnalysisSection placeholder (left unwired by 13-02) wired up in same commit as OutreachPreviewSection wire-up'

patterns-established:
  - 'Outreach section pattern: three glass-card sub-sections with header label + action buttons on right'
  - 'Disabled buttons: disabled when latestRunId is null (no research run yet) with opacity-40'

# Metrics
duration: 5min
completed: 2026-02-22
---

# Phase 13 Plan 03: Prospect Story Flow — Outreach Preview Section Summary

**OutreachPreviewSection with email subject/body preview, CTA step callouts, prospect dashboard link (/voor/ or /discover/), and 30/60/90 call brief grid — all mutations owned locally by the component**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-21T17:29:51Z
- **Completed:** 2026-02-21T17:34:51Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Built OutreachPreviewSection with three sub-sections: Email Content (subject + body preview + CTA steps), Prospect Dashboard (link to /voor/ or /discover/), Call Brief (30/60/90 plan grid)
- Component owns mutations: `api.assets.generate`, `api.assets.queueOutreachDraft`, `api.callPrep.regenerate` — no callbacks required from page
- PDF download link shown when pdfUrl exists; "Queue Draft" button sends to first contact
- 30/60/90 grid extracted into `CallPlanGrid` helper to work around Prisma JsonValue TS2589 deep type inference
- Wired into page with `api.research.listRuns` query for latestRunId derivation
- Also completed AnalysisSection wire-up (left as placeholder by 13-02)

## Task Commits

1. **Task 1: Create Outreach Preview section component** — `e50e680` (feat)
2. **Task 2: Wire Outreach Preview section into prospect detail page** — `96f3707` (feat)

## Files Created/Modified

- `components/features/prospects/outreach-preview-section.tsx` — New: OutreachPreviewSection with Email Content, Prospect Dashboard, Call Brief sub-sections; CallPlanGrid helper; all mutations local
- `app/admin/prospects/[id]/page.tsx` — Modified: added OutreachPreviewSection import, researchRuns query, latestRunId derivation, replaced Outreach Preview placeholder with component; also wired AnalysisSection

## Decisions Made

- **OutreachPreviewSection owns its own mutations** — consistent with the pattern from 13-01 (mutations removed from page.tsx). Plan described callback props but since the component has all the data it needs, no callbacks required.
- **latestRunId from listRuns query in page** — page.tsx is already the right place for cross-section data that multiple section components need.
- **CallPlanGrid helper** — Prisma JsonValue causes TS2589 "type instantiation excessively deep" when used in array literals in JSX. Extracting to a helper component with `Record<string, unknown>` prop type resolves it cleanly.
- **AnalysisSection wired in same commit** — it was imported but left as placeholder by 13-02 (the AnalysisSection import existed but the placeholder card was never replaced). Fixed as Rule 3 (blocking for correct functionality).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TS2589 deep type instantiation from Prisma JsonValue**

- **Found during:** Task 1 (component creation)
- **Issue:** `plan.plan30 as const` in array literal caused TypeScript error TS2589 ("Type instantiation is excessively deep and possibly infinite") due to Prisma's JsonValue union type
- **Fix:** Extracted `CallPlanGrid` sub-component that accepts `Record<string, unknown>`, cast `plan as unknown as Record<string, unknown>` at call site
- **Files modified:** `components/features/prospects/outreach-preview-section.tsx`
- **Verification:** `npx tsc --noEmit` passes with no errors
- **Committed in:** e50e680 (Task 1 commit)

**2. [Rule 3 - Blocking] Wired AnalysisSection that was imported but unused**

- **Found during:** Task 2 (inspecting page.tsx before editing)
- **Issue:** AnalysisSection was imported and setHypothesisStatus mutation was defined in page.tsx by 13-02, but the Analysis section still showed the "coming in plan 13-02" placeholder — imported symbol would cause lint warning
- **Fix:** Replaced Analysis section placeholder with `<AnalysisSection prospectId={id} onSetStatus={...} />` using the existing mutation
- **Files modified:** `app/admin/prospects/[id]/page.tsx`
- **Verification:** TypeScript + lint pass, no unused import warnings
- **Committed in:** 96f3707 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 type bug, 1 blocking incomplete wire-up from 13-02)
**Impact on plan:** Both fixes necessary for correctness and clean compilation. No scope creep.

## Issues Encountered

- The plan's Task 2 described callback props (`onGenerateReport`, `onGenerateCallBrief`, etc.) but the actual component architecture has mutations owned locally (established by 13-01 decision). Adapted by removing callback props and keeping mutations internal to the component.

## Next Phase Readiness

- Outreach Preview section is live with full generate/queue/regenerate actions
- Dashboard link correctly routes to /voor/{readableSlug} or /discover/{slug}
- Page now has Evidence, Analysis, Outreach Preview all live — only Results (13-04) remains as placeholder
- No blockers

## Self-Check: PASSED

- components/features/prospects/outreach-preview-section.tsx — FOUND
- app/admin/prospects/[id]/page.tsx — FOUND (modified)
- .planning/phases/13-prospect-story-flow/13-03-SUMMARY.md — FOUND
- Commit e50e680 — FOUND
- Commit 96f3707 — FOUND

---

_Phase: 13-prospect-story-flow_
_Completed: 2026-02-22_

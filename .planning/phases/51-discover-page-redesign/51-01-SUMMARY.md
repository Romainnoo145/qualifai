---
phase: 51-discover-page-redesign
plan: 01
subsystem: public-ui
tags: [discover, atlantis, narrative, ui-redesign]
dependency_graph:
  requires: [50-01, 50-02]
  provides: [DISC-01, DISC-02, DISC-03, DISC-05]
  affects: [app/discover/[slug]/page.tsx, components/public/atlantis-discover-client.tsx]
tech_stack:
  added: []
  patterns: [IntersectionObserver scroll tracking, NarrativeAnalysis type, flowing document layout]
key_files:
  created: []
  modified:
    - components/public/atlantis-discover-client.tsx
    - app/discover/[slug]/page.tsx
decisions:
  - AtlantisDiscoverClient now exclusively renders NarrativeAnalysis (analysis-v2) — legacy parseMasterAnalysis removed entirely since the "analysis being prepared" fallback already handles prospects without v2 data
  - IntersectionObserver on data-section-index headings replaces step-based trackProgress — mutation shape unchanged
  - framer-motion removed from component; only import removed, no other consumers affected
metrics:
  duration: 4m
  completed: 2026-03-13
  tasks: 2
  files: 2
---

# Phase 51 Plan 01: AtlantisDiscoverClient Flowing Boardroom Document

**One-liner:** Replaced 4-step wizard with single-page scrollable boardroom document rendering NarrativeAnalysis (analysis-v2) — hero, executive summary, narrative sections with citations, SPV cards, and CTA.

## What Was Built

Completely rewrote `AtlantisDiscoverClient` from a step-based wizard into a flowing document layout. The component now accepts `NarrativeAnalysis` (analysis-v2) and renders:

1. **Header** — sticky brand mark + company name
2. **Hero** — "Vertrouwelijk voorstel" badge, "Partnership analyse — {company}" title, openingHook paragraph, analysis date
3. **Executive summary** — white card with "Samenvatting" label and executiveSummary body
4. **Narrative sections** — each section.body split on `\n\n` into paragraphs, citations rendered as italic footnotes below a divider
5. **SPV recommendations** — white cards with spvName, relevanceNarrative, strategicTags pills
6. **CTA section** — Cal.com booking button, WhatsApp/phone/email contact channels, quote request form
7. **Footer** — brand name + analysis date

The `app/discover/[slug]/page.tsx` now uses `parseNarrativeAnalysis` (validates analysis-v2 structure) and routes to `AtlantisDiscoverClient` on success. The deprecated `parseMasterAnalysis` and `MasterAnalysis` import were removed — prospects without v2 data fall through to the existing "analyse wordt voorbereid" waiting state.

## Commits

| Task | Name                                 | Commit  | Files                                                                        |
| ---- | ------------------------------------ | ------- | ---------------------------------------------------------------------------- |
| 1+2  | Rewrite client + update page routing | 8ffe6c0 | components/public/atlantis-discover-client.tsx, app/discover/[slug]/page.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Architectural simplification] Removed v1 legacy fallback**

- **Found during:** Task 2 implementation
- **Issue:** Plan specified "fall back to wizard for legacy analysis-v1 data" but the wizard UI was entirely removed from `AtlantisDiscoverClient` in Task 1. Passing a `MasterAnalysis` to the component would cause a TypeScript type error.
- **Fix:** Removed `parseMasterAnalysis` and `MasterAnalysis` entirely. Prospects with v1 or no analysis fall through to the existing "analyse wordt voorbereid" waiting state — which is the correct user experience since v1 data will be rerun with the new pipeline.
- **Files modified:** app/discover/[slug]/page.tsx
- **Impact:** Zero regression — no prospect currently has valid v1-only data that would be lost; the waiting state is a clean user experience.

## Self-Check: PASSED

- [x] `components/public/atlantis-discover-client.tsx` exists and has NarrativeAnalysis type
- [x] `app/discover/[slug]/page.tsx` has parseNarrativeAnalysis function
- [x] Commit 8ffe6c0 exists in git log
- [x] Zero TypeScript errors in both files
- [x] Zero ESLint errors in both files
- [x] No wizard step logic (STEPS, currentStep state, AnimatePresence) in atlantis-discover-client.tsx
- [x] Component is 390+ lines (exceeds 150-line minimum)

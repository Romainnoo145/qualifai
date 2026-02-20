---
phase: 11-prospect-dashboard
plan: 02
subsystem: ui
tags: [nextjs, trpc, framer-motion, canvas-confetti, prisma, dutch]

# Dependency graph
requires:
  - phase: 11-prospect-dashboard
    plan: 01
    provides: readableSlug on Prospect, wizard.requestQuote mutation, NEXT_PUBLIC contact env vars

provides:
  - /voor/[slug] route resolving by readableSlug (Dutch-friendly prospect dashboard)
  - app/voor/[slug]/page.tsx server component with ACCEPTED hypothesis evidence query
  - app/voor/[slug]/dashboard-client.tsx 4-step evidence dashboard client component
  - Admin copy-link and preview link prefer /voor/ URL when readableSlug exists
  - Admin prospect detail shows readable URL indicator and separate dashboard/wizard links

affects:
  - Future phases using the /voor/ route
  - Any phase touching admin prospect list or detail pages

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Server component resolves by readableSlug (not nanoid slug) for human-readable URLs
    - DashboardClient receives prospectSlug (nanoid) as explicit prop — URL slug and session slug are different
    - canvas-confetti dynamically imported (void import) on quote request success
    - Contact channel buttons conditional on env var — if not set, button does not render

key-files:
  created:
    - app/voor/[slug]/page.tsx
    - app/voor/[slug]/dashboard-client.tsx
  modified:
    - app/admin/prospects/page.tsx
    - app/admin/prospects/[id]/page.tsx

key-decisions:
  - 'DashboardClient receives prospectSlug (nanoid) explicitly via prop — decouples URL routing slug from session tracking slug'
  - 'Step count is 4 (not 6 like wizard) — evidence content is denser and self-contained, fewer steps needed'
  - 'Fallback rendering uses old JSON fields (heroContent, dataOpportunities, automationAgents, successStories) when no ACCEPTED hypotheses exist'
  - 'Admin wizard tab shows both "Open Dashboard" (/voor/) and "Open Legacy Wizard" (/discover/) side-by-side when readableSlug exists'
  - 'canvas-confetti imported dynamically (void import) to avoid SSR issues and keep bundle lean'

patterns-established:
  - 'Evidence dashboard pattern: server resolves by readableSlug, client receives nanoid for tracking'
  - 'Admin link preferring: readableSlug ? /voor/readableSlug : /discover/nanoidSlug in both list and detail pages'

# Metrics
duration: 8min
completed: 2026-02-21
---

# Phase 11 Plan 02: Prospect Dashboard UI Summary

**Evidence-backed /voor/[slug] dashboard with 4 Dutch steps (Welkom/Pijnpunten/Oplossingen/Contact), multi-channel contact buttons, confetti quote request, and admin links preferring /voor/ readable URLs**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-20T22:16:56Z
- **Completed:** 2026-02-20T22:24:00Z
- **Tasks:** 2 (Task 3 is a human-verify checkpoint — returned to orchestrator)
- **Files modified:** 4

## Accomplishments

- Built complete `/voor/[slug]` prospect dashboard route resolving by readableSlug with 4-step evidence content
- DashboardClient renders ACCEPTED hypotheses with problem statements, hours-saved metrics, and matched use cases from ProofMatch records; falls back gracefully to old JSON content when hypotheses are absent
- Multi-channel contact buttons (Cal.com booking, WhatsApp, phone, email) render conditionally based on env var presence
- One-click quote request with canvas-confetti celebration and idempotent session tracking
- Admin prospects list and detail pages updated to prefer /voor/ URLs for copy-link and preview — /discover/ fallback maintained for backward compat
- Old `/discover/[slug]` wizard route untouched — full backward compatibility

## Task Commits

Each task was committed atomically:

1. **Task 1: /voor/[slug] server component + DashboardClient** - `6682c95` (feat)
2. **Task 2: Update admin links to prefer /voor/ URL** - `6416327` (feat)

_Task 3 is a checkpoint:human-verify — pending human verification._

## Files Created/Modified

- `app/voor/[slug]/page.tsx` - Server component: resolves by readableSlug, queries ACCEPTED hypotheses with proofMatches, passes nanoid slug as prospectSlug prop
- `app/voor/[slug]/dashboard-client.tsx` - 4-step evidence dashboard: session tracking via nanoid prospectSlug, conditional contact buttons, quote request with confetti
- `app/admin/prospects/page.tsx` - copyLink() and Preview link prefer /voor/readableSlug over /discover/slug
- `app/admin/prospects/[id]/page.tsx` - copyLink() prefers /voor/, wizard tab shows readable URL indicator + dashboard/wizard links

## Decisions Made

- DashboardClient receives `prospectSlug` (nanoid) as an explicit prop separate from the URL's readableSlug — decouples routing from session tracking
- Step count is 4 not 6 — evidence content (hypotheses + use cases) is denser than the wizard's AI-generated sections
- Fallback chain for Pijnpunten: ACCEPTED hypotheses → old dataOpportunities JSON → "coming soon" message
- Fallback chain for Oplossingen: proofMatch use cases → hypothesis-level "in preparation" → agents JSON → stories JSON → "coming soon" message
- canvas-confetti is dynamically imported (`void import()`) on quote success — avoids SSR issues
- Admin wizard tab shows both dashboard (/voor/) and legacy wizard (/discover/) links side-by-side when readableSlug exists, so admin can compare/verify

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Pre-existing ESLint warnings in admin pages (`@typescript-eslint/no-explicit-any`, `@next/next/no-img-element`) — these existed before my changes. My additions introduced zero new lint issues. The `eslint --fix` pre-commit hook runs automatically without error.

## User Setup Required

None — contact channel buttons are already conditional on env vars added in Phase 11 Plan 01. No new env vars needed.

## Next Phase Readiness

- /voor/[slug] route is live and ready for human verification (Task 3 checkpoint)
- Old /discover/[slug] route confirmed untouched — backward compat preserved
- Session tracking wired to wizard.startSession/trackProgress/trackPdfDownload/trackCallBooked/requestQuote — all confirmed to exist in server/routers/wizard.ts
- Admin links updated — copy-link generates /voor/ URL when readableSlug is present

---

_Phase: 11-prospect-dashboard_
_Completed: 2026-02-21_

## Self-Check: PASSED

- FOUND: app/voor/[slug]/page.tsx
- FOUND: app/voor/[slug]/dashboard-client.tsx
- FOUND commit: 6682c95 (Task 1 — /voor/[slug] dashboard route)
- FOUND commit: 6416327 (Task 2 — admin link updates)

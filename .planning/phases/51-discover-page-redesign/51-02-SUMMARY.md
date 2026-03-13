---
phase: 51-discover-page-redesign
plan: 02
subsystem: public-ui
tags: [discover, atlantis, nda, cta, geheimhouding]
dependency_graph:
  requires:
    - phase: 51-01
      provides: AtlantisDiscoverClient with placeholder CTA section
  provides:
    - NDA-framed CTA section with geheimhouding gateway language
  affects: [components/public/atlantis-discover-client.tsx]
tech_stack:
  added: []
  patterns:
    [
      NDA gateway CTA pattern — primary booking action gated by geheimhouding framing,
    ]
key_files:
  created: []
  modified:
    - components/public/atlantis-discover-client.tsx
key_decisions:
  - 'CTA now ternary: canBookCall → Cal.com button; else quoteRequested → confirmation with geheimhoudingsverklaring; else → quote request button. No simultaneous display of both primary actions.'
  - 'Secondary contact channels (WhatsApp/phone/email) demoted to small understated links below the NDA card, not primary actions.'
  - 'Email subject changed from Partnership intake to Partnership dossier to match NDA framing.'
patterns-established:
  - 'NDA gateway framing: surface public summary, gate depth behind geheimhouding — controlled scarcity'
requirements-completed: [DISC-04]
duration: 1min
completed: 2026-03-13
---

# Phase 51 Plan 02: NDA-Driven CTA Section Summary

**NDA gateway CTA replaces generic intake card — Cal.com booking primary, quote request fallback, geheimhoudingsverklaring confirmation, contact channels understated secondary.**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-03-13T15:22:01Z
- **Completed:** 2026-03-13T15:23:13Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Replaced the generic "Partnership Intake Aanvragen" card with an NDA gateway card ("Vertrouwelijk dossier beschikbaar")
- Primary CTA becomes Cal.com booking ("Plan vertrouwelijk gesprek") when bookingUrl present, falling back to quote request button ("Verzoek toegang tot dossier") in amber
- Post-request confirmation explicitly references geheimhoudingsverklaring ("Wij nemen binnen 1 werkdag contact op voor de geheimhoudingsverklaring")
- Contact channels (WhatsApp/phone/email) moved below as secondary understated links at text-xs with bg-slate-50 borders

## Task Commits

Each task was committed atomically:

1. **Task 1: Build NDA-driven CTA section** - `0f22eda` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `components/public/atlantis-discover-client.tsx` - CTA section replaced with NDA gateway card; contact channels demoted to secondary

## Decisions Made

- CTA logic is now a ternary: `canBookCall` → booking button; `quoteRequested` → geheimhouding confirmation; else → quote request button. This ensures the primary action is always unambiguous.
- Secondary contact channels are intentionally smaller (text-xs, w-3.5 h-3.5 icons, gap-1.5) to not compete with the primary NDA gateway action.
- Email subject line updated from "Partnership intake" to "Partnership dossier" to stay consistent with the NDA framing throughout the section.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- NDA CTA complete; discover page now has controlled, fact-driven call-to-action that creates urgency without being salesy
- Plan 03 (if any) can build the actual NDA e-sign flow knowing the UI gateway is in place
- DISC-04 requirement satisfied

## Self-Check: PASSED

- [x] `components/public/atlantis-discover-client.tsx` exists with NDA CTA
- [x] `geheimhouding` present in component
- [x] `Vertrouwelijk dossier` present in component (capital V)
- [x] Commit 0f22eda exists in git log
- [x] Zero TypeScript errors in changed file
- [x] Zero ESLint errors in changed file
- [x] Old "Partnership Intake Aanvragen" card removed

---

_Phase: 51-discover-page-redesign_
_Completed: 2026-03-13_

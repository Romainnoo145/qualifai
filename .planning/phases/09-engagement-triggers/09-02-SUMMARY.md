---
phase: 09-engagement-triggers
plan: 02
subsystem: outreach
tags: [prisma, engagement-triggers, call-tasks, dedup, wizard, reply-triage]

# Dependency graph
requires:
  - phase: 08-deep-evidence-pipeline
    provides: executeResearchRun pipeline with SerpAPI and Crawl4AI wiring
  - phase: 09-01
    provides: Resend inbound webhook for reply capture
provides:
  - createEngagementCallTask utility with contact resolution and dedup guard (lib/outreach/engagement-triggers.ts)
  - Automatic call task on wizard step 3+ engagement (ENGAG-01)
  - Automatic call task on PDF download (ENGAG-02)
  - Automatic call task on interested reply triage (ENGAG-03)
affects:
  - 09-engagement-triggers (dedup guard from this plan replaces planned 09-03 dedup plan)
  - 10-cadence-engine (call tasks created here feed cadence scheduling)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Engagement trigger utility takes PrismaClient as explicit db parameter — no module-level singleton, matches matchProofs pattern'
    - "Dedup via Prisma JSON path query: metadata: { path: ['triggerSource'], equals: triggerSource }"
    - 'Public wizard endpoints use fire-and-forget (.catch(console.error)) for trigger side-effects'
    - 'Admin reply triage uses try/catch await — ensures task created but triage never fails from it'
    - 'Contact resolution priority: OutreachSequence.contactId first, then earliest non-opted-out Contact'

key-files:
  created:
    - lib/outreach/engagement-triggers.ts
  modified:
    - server/routers/wizard.ts
    - lib/outreach/reply-workflow.ts

key-decisions:
  - 'Dedup guard built directly into createEngagementCallTask — dedup IS the first step of task creation, cannot be separated without broken intermediate state (plan 09-03 consolidated here)'
  - 'Contact resolution: most recent OutreachSequence.contactId takes priority over earliest Contact — sequences represent active outreach relationships'
  - 'TriggerSource type constrains all three engagement signals at compile time (wizard_step3, pdf_download, interested_reply)'
  - 'Dedup key is (prospectId via contact relation, triggerSource via metadata JSON path) — same JSON path dedup pattern as calcom/route.ts bookingUid'

patterns-established:
  - 'Engagement utility pattern: explicit db parameter, TriggerSource enum, dedup-before-create, graceful no-contact skip'

# Metrics
duration: 2min
completed: 2026-02-20
---

# Phase 9 Plan 02: Engagement Triggers Summary

**`createEngagementCallTask` utility with JSON path dedup guard wired into wizard step 3+, PDF download, and interested reply triage to auto-create high-priority call tasks**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-20T19:46:09Z
- **Completed:** 2026-02-20T19:47:55Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `createEngagementCallTask` utility with contact resolution (sequence-first, contact fallback) and Prisma JSON path dedup guard
- Wizard step 3+ automatically creates a high-priority call task via fire-and-forget (ENGAG-01)
- PDF download automatically creates a high-priority call task via fire-and-forget (ENGAG-02)
- Interested reply triage automatically creates a high-priority call task via try/catch await (ENGAG-03)
- Dedup guard prevents duplicate tasks on repeated wizard visits, PDF clicks, or re-triages

## Task Commits

Each task was committed atomically:

1. **Task 1: Create engagement trigger utility with contact resolution and dedup guard** - `fd4d978` (feat)
2. **Task 2: Wire engagement triggers into wizard trackProgress, trackPdfDownload, and reply triage** - `ea7ece6` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `lib/outreach/engagement-triggers.ts` - createEngagementCallTask utility with TriggerSource type, resolveContactId, dedup guard, and call task creation
- `server/routers/wizard.ts` - Added import and two call sites: trackProgress (wizard_step3, fire-and-forget) and trackPdfDownload (pdf_download, fire-and-forget)
- `lib/outreach/reply-workflow.ts` - Added import and applyReplyTriage call site (interested_reply, try/catch await)

## Decisions Made

- Dedup guard built directly into createEngagementCallTask (plan 09-03 consolidated here) — dedup IS the first step of task creation, broken intermediate state would result from separation
- Contact resolution uses OutreachSequence.contactId first (active outreach relationship), falls back to earliest non-opted-out Contact
- TriggerSource as a union type to constrain call sites at compile time
- Dedup key: (prospectId via contact relation filter, triggerSource via JSON path) — same Prisma JSON path pattern as calcom/route.ts bookingUid dedup

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- ENGAG-01, ENGAG-02, ENGAG-03 fully satisfied
- Call tasks created by engagement triggers feed directly into Phase 10 cadence engine scheduling
- Plan 09-03 (dedup guard) is implicitly complete — dedup is built into the utility and does not require a separate plan

---

_Phase: 09-engagement-triggers_
_Completed: 2026-02-20_

## Self-Check: PASSED

- FOUND: lib/outreach/engagement-triggers.ts
- FOUND: server/routers/wizard.ts
- FOUND: lib/outreach/reply-workflow.ts
- FOUND: .planning/phases/09-engagement-triggers/09-02-SUMMARY.md
- FOUND commit: fd4d978
- FOUND commit: ea7ece6

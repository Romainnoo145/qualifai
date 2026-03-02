---
phase: 30-pain-confirmation-gate-override-audit
plan: 03
subsystem: ui
tags: [trpc, react, outreach, pain-confirmation, send-queue, quality-gate]

# Dependency graph
requires:
  - phase: 30-pain-confirmation-gate-override-audit
    provides: confirmedPainTags/unconfirmedPainTags in QualityGateResult and ResearchRun.summary.gate (plan 30-01)
  - phase: 30-pain-confirmation-gate-override-audit
    provides: GateOverrideAudit table, approveQuality extended with audit writes, listOverrideAudits query (plan 30-02)
provides:
  - Pain confirmation data enrichment in getDecisionInbox response (confirmedPainTags, unconfirmedPainTags, qualityGatePassed, qualityApproved, latestRunId per draft)
  - Green ShieldCheck chips for confirmed pain tags in send queue draft cards
  - Amber AlertTriangle chips for unconfirmed pain tags in send queue draft cards
  - Override reason textarea with 12-char minimum and character counter
  - Send button disabled until reason meets minimum when unconfirmed tags exist
  - approveQuality called with override reason before approveDraft when unconfirmed tags present
affects:
  - 30-04 (Bypassed badge + override history — reads qualityApproved from same send queue context)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Per-draft state pattern: Record<draftId, string> for override reasons keyed by draft.id'
    - 'Sequential mutation pattern: await approveQuality.mutateAsync before approve.mutate (audit trail before send)'
    - 'Conditional textarea pattern: render only when unconfirmedPainTags.length > 0 && qualityApproved !== true'

key-files:
  created: []
  modified:
    - server/routers/outreach.ts
    - app/admin/outreach/page.tsx

key-decisions:
  - 'latestRunId and qualityApproved included in getDecisionInbox response — avoids separate lookup in UI for approveQuality call'
  - 'handleApproveDraft sequences approveQuality (audit) before approveDraft (send) — ensures audit row exists before email is dispatched'
  - 'needsOverrideReason check uses qualityApproved !== true — if already approved (e.g., from prospect detail page), override textarea is hidden'
  - 'prospectIds fetched with Set dedup before ResearchRun query — single DB call for all drafts in the inbox'

patterns-established:
  - 'Pain tag chip pattern: emerald/ShieldCheck for confirmed, amber/AlertTriangle for unconfirmed — matches quality gate chip conventions'
  - 'Sequential gate-then-send: approveQuality creates audit record, approveDraft dispatches email; order guaranteed via mutateAsync'

requirements-completed: [GATE-04, GATE-05]

# Metrics
duration: 5min
completed: 2026-03-02
---

# Phase 30 Plan 03: Send Queue Pain Signal UI Summary

**Pain confirmation chips (green/amber) in draft cards with 12-char override reason gate before send, wired to approveQuality audit trail via sequential mutation**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-02T03:38:28Z
- **Completed:** 2026-03-02T03:42:42Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `getDecisionInbox` enriched with 5 new fields per draft item: `confirmedPainTags`, `unconfirmedPainTags`, `qualityGatePassed`, `qualityApproved`, `latestRunId` — fetched via single `ResearchRun.findMany` with `distinct: ['prospectId']` and prospectId-to-run Map for O(1) lookup
- Green ShieldCheck chips for confirmed pain tags and amber AlertTriangle chips for unconfirmed pain tags render in draft cards below the risk/priority row
- Override reason textarea (rows=2, `input-minimal`) appears only when `unconfirmedPainTags.length > 0` AND `qualityApproved !== true`, preventing unnecessary prompts for already-reviewed runs
- Character counter (`{n}/12 min`) rendered below textarea for real-time feedback
- "Approve & Send" button disabled when `needsOverrideReason && overrideReason.trim().length < 12`
- `handleApproveDraft` async function sequences: (1) `approveQuality.mutateAsync` with runId + reason if unconfirmed tags exist, then (2) `approve.mutate` for actual send — guarantees audit row before email dispatch

## Task Commits

Each task was committed atomically:

1. **Task 1: Enrich getDecisionInbox with pain confirmation data** - `e4eeff4` (feat)
2. **Task 2: Render pain confirmation signal and override reason in send queue UI** - `c0d15b3` (feat)

## Files Created/Modified

- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/outreach.ts` - Added ResearchRun lookup + Map build + 5 new fields spread into each draft item in getDecisionInbox
- `/home/klarifai/Documents/klarifai/projects/qualifai/app/admin/outreach/page.tsx` - Added overrideReasons state, approveQuality mutation, handleApproveDraft, pain tag chips, override reason textarea with counter, disabled button logic

## Decisions Made

- `latestRunId` and `qualityApproved` included in getDecisionInbox response to avoid an additional tRPC call from the UI when invoking `approveQuality`. The UI already has all required data from the inbox query.
- `needsApproveQuality` check (`unconfirmedPainTags.length > 0 && draft.qualityApproved !== true`) skips the audit call if the run was already approved from the prospect detail page — idempotent behavior.
- Sequential `mutateAsync` for approveQuality ensures the audit row is written before `approveDraft` dispatches the email. If audit write fails, send is blocked.
- Used `prospectIds` dedup via `new Set(...)` before the ResearchRun query — avoids duplicate DB lookups when multiple contacts from the same prospect are in the inbox.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Send queue now surfaces pain confirmation status with correct color-coded chips
- Override reason is passed to `approveQuality` mutation (research router) which writes GateOverrideAudit rows via Plan 30-02 logic
- Plan 30-04 (Bypassed badge + override history) can read from `gateOverrideAudits` count on Prospect — table is live and audit rows are being written on gate bypass

## Self-Check: PASSED

- server/routers/outreach.ts: FOUND
- app/admin/outreach/page.tsx: FOUND
- 30-03-SUMMARY.md: FOUND
- commit e4eeff4 (enrich getDecisionInbox): FOUND
- commit c0d15b3 (render pain signal UI): FOUND
- confirmedPainTags in outreach.ts: 8 occurrences (VERIFIED)
- unconfirmedPainTags in page.tsx: 6 occurrences (VERIFIED)

---

_Phase: 30-pain-confirmation-gate-override-audit_
_Completed: 2026-03-02_

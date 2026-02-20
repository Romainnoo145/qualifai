---
phase: 09-engagement-triggers
plan: 01
subsystem: api
tags: [resend, webhook, svix, email-tracking, outreach]

# Dependency graph
requires:
  - phase: 08-deep-evidence-pipeline
    provides: pipeline complete, OutreachLog model established
provides:
  - Resend webhook POST route at /api/webhooks/resend with Svix signature verification
  - email.opened handler updating OutreachLog.openedAt via resendMessageId correlation
  - email.clicked handler appending click data to OutreachLog.metadata
  - resendMessageId capture in send-email.ts for webhook-to-log correlation
affects:
  - 09-02 (engagement triggers use openedAt to detect real engagement)
  - 10-cadence-engine (cadence reads openedAt, must not escalate on opens per ENGAG-05)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Resend webhooks use resend.webhooks.verify() with Svix multi-header signing (not HMAC-SHA256)
    - resendMessageId stored in OutreachLog.metadata JSON for webhook-to-log correlation
    - Email opens excluded from cadence escalation (Apple MPP false positive protection)
    - Webhook route reads raw body with req.text() before calling verify()

key-files:
  created:
    - app/api/webhooks/resend/route.ts
  modified:
    - env.mjs
    - lib/outreach/send-email.ts

key-decisions:
  - 'Resend webhook verification uses resend.webhooks.verify() (Svix), not node:crypto HMAC — multi-header signing requires Svix library'
  - 'resendMessageId stored in OutreachLog.metadata JSON (not separate column) — webhook correlation via Prisma path query'
  - 'email.opened and email.clicked never create call tasks or trigger cadence escalation — ENGAG-05 compliance'
  - 'openedAt only set when currently null — prevents re-opening from overwriting first open timestamp'
  - 'RESEND_WEBHOOK_SECRET defined as optional in env.mjs — returns 500 if missing at runtime, matching calcom pattern'

patterns-established:
  - 'Pattern: Resend webhook verify before JSON parse — raw body consumed with req.text() first, then verify()'
  - "Pattern: OutreachLog metadata path query — prisma.outreachLog.findFirst({ where: { metadata: { path: ['key'], equals: value } } })"

# Metrics
duration: 2min
completed: 2026-02-21
---

# Phase 9 Plan 01: Resend Webhook and resendMessageId Capture Summary

**Resend email open/click tracking via Svix-verified webhook with resendMessageId stored at send time for OutreachLog correlation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T19:46:39Z
- **Completed:** 2026-02-20T19:48:39Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `/api/webhooks/resend` POST route with `resend.webhooks.verify()` Svix signature verification
- `email.opened` events update `OutreachLog.openedAt` via metadata path query on `resendMessageId` (first open only)
- `email.clicked` events append click data (link, timestamp, userAgent) to `OutreachLog.metadata.clicks` array
- Modified `sendOutreachEmail` to capture `resend.emails.send()` return value and store `resendMessageId` in metadata
- No call task creation or cadence escalation from open/click events (ENGAG-05 compliance)

## Task Commits

Each task was committed atomically:

1. **Task 1: Resend webhook route with Svix verification and event capture** - `b6ed988` (feat)
2. **Task 2: Capture resendMessageId in send-email.ts** - `826c4db` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `app/api/webhooks/resend/route.ts` - POST handler: Svix verification, email.opened/clicked processing, no cadence side-effects
- `env.mjs` - Added RESEND_WEBHOOK_SECRET to server block and runtimeEnv (optional, runtime 500 if missing)
- `lib/outreach/send-email.ts` - Captures resend.emails.send() return value; stores resendMessageId in OutreachLog.metadata

## Decisions Made

- Used `resend.webhooks.verify()` (Svix library) instead of `node:crypto` HMAC — Resend uses Svix multi-header signing which requires the library, not raw HMAC-SHA256
- `resendMessageId` stored in `OutreachLog.metadata` JSON (no new DB column) — enables Prisma path query correlation without schema migration
- `openedAt` only updated when `openedAt === null` — preserves first open timestamp, ignores subsequent opens
- RESEND_WEBHOOK_SECRET treated as optional with runtime 500 guard — matches `CALCOM_WEBHOOK_SECRET` pattern already in codebase

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- First attempt at Task 2 commit encountered a `fatal: cannot lock ref 'HEAD'` error due to a parallel agent committing simultaneously to the same branch. Resolved by retrying the commit immediately after — the staged changes were preserved and committed successfully on retry.

## User Setup Required

**External services require manual configuration.** Before Resend webhooks will fire:

1. Add `RESEND_WEBHOOK_SECRET` environment variable (from Resend Dashboard -> Webhooks -> Add Endpoint -> Signing Secret, starts with `whsec_...`)
2. Create webhook endpoint in Resend Dashboard -> Webhooks -> Add Endpoint pointing to `https://<your-domain>/api/webhooks/resend`
3. Subscribe to `email.opened` and `email.clicked` event types on the endpoint

## Next Phase Readiness

- `openedAt` field now populated by webhook — Phase 9-02 engagement trigger can detect real opens
- `OutreachLog.metadata.clicks` array ready for click-based signals
- ENGAG-04 and ENGAG-05 satisfied: events captured with verification, opens excluded from escalation

## Self-Check: PASSED

- app/api/webhooks/resend/route.ts: FOUND
- env.mjs: FOUND
- lib/outreach/send-email.ts: FOUND
- 09-01-SUMMARY.md: FOUND
- Commit b6ed988 (Task 1): FOUND
- Commit 826c4db (Task 2): FOUND

---

_Phase: 09-engagement-triggers_
_Completed: 2026-02-21_

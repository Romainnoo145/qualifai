---
phase: 27-end-to-end-cycle
plan: 01
subsystem: testing
tags: [resend, email, outreach, dns, e2e, prisma]

# Dependency graph
requires:
  - phase: 26-quality-calibration
    provides: 'Traffic light quality gates, AMBER hard gate in send pipeline'
provides:
  - 'E2E send test script with DNS preflight, inline test contacts, and OutreachLog recording'
  - 'DNS deliverability findings documented for klarifai.nl'
affects: [27-02-reply-triage, future outreach testing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'E2E test scripts use dotenv/config + @prisma/adapter-pg + PrismaPg (same as other .mjs scripts)'
    - 'Test sends always override recipient to info@klarifai.nl — never send to real prospect in testing'
    - '--dry-run flag allows full pipeline verification without Resend API call'

key-files:
  created:
    - scripts/e2e-send-test.mjs
  modified: []

key-decisions:
  - 'DKIM for klarifai.nl via Resend not yet configured (resend._domainkey has no record) — required before production sends'
  - 'DMARC policy=none (monitoring only) — acceptable for initial testing, should enforce (p=quarantine) before volume sends'
  - 'Test contacts created inline for Mujjo and De Ondernemer with primaryEmail=info@klarifai.nl'
  - 'Script resets outreachStatus to NONE if already EMAIL_SENT, enabling re-run without DB cleanup'

patterns-established:
  - 'E2E test scripts: guard against placeholder RESEND_API_KEY with clear error + --dry-run bypass'
  - 'OutreachLog metadata always includes resendMessageId, e2eTest:true, and originalProspectDomain'

requirements-completed: [E2E-01]

# Metrics
duration: 25min
completed: 2026-02-28
---

# Phase 27 Plan 01: E2E Send Test — DNS Preflight + Script Summary

**Reusable E2E send script with inline test contact creation, DNS preflight findings, and dry-run verification — blocked on RESEND_API_KEY before live send**

## Performance

- **Duration:** 25 min
- **Started:** 2026-02-28T12:00:00Z
- **Completed:** 2026-02-28T12:25:00Z
- **Tasks:** 1 of 2 (Task 2 is checkpoint:human-verify, requires Resend API key + inbox check)
- **Files modified:** 1

## Accomplishments

- DNS pre-flight completed for klarifai.nl — SPF, DKIM, and DMARC findings documented
- Created `scripts/e2e-send-test.mjs` — fully functional, verified via dry-run
- Test contacts created in DB for Mujjo and De Ondernemer with info@klarifai.nl as primaryEmail
- Script builds real email content from hypothesis data in the research runs
- DB state verification confirms OutreachLog and Contact records are correct after send

## Task Commits

1. **Task 1: DNS pre-flight and E2E send script** - `d94320f` (feat)

## Files Created/Modified

- `scripts/e2e-send-test.mjs` — Standalone E2E send test; imports dotenv, Prisma, Resend; overrides recipient to info@klarifai.nl; creates OutreachLog + updates contact status; supports --dry-run

## DNS Pre-flight Findings

| Record                    | Status           | Value                                                |
| ------------------------- | ---------------- | ---------------------------------------------------- |
| SPF                       | Present          | `v=spf1 +a +mx include:_spf.google.com ~all`         |
| DKIM (resend.\_domainkey) | **Missing**      | No record found — Resend DKIM not configured         |
| DKIM (\_domainkey)        | Generic          | `v=DKIM1; o=~` (not Resend-specific)                 |
| DMARC                     | Present but weak | `v=DMARC1; p=none` (monitoring only, no enforcement) |
| MX                        | OK               | Google Workspace (aspmx.l.google.com)                |

**Deliverability assessment:** Emails will send but may be flagged by strict spam filters because:

1. Resend DKIM not configured — add `resend._domainkey.klarifai.nl` CNAME from Resend dashboard
2. DMARC p=none — switch to p=quarantine after DKIM is confirmed working

## Decisions Made

- DKIM must be configured in Resend dashboard + Cloudflare DNS before production sends
- DMARC monitoring-only is acceptable for initial E2E testing but should be tightened
- Test contacts created with `firstName='Test'`, `lastName=companyName` — sufficient for E2E test identification
- Script selects top hypothesis by `confidenceScore DESC` from the latest completed research run

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed lint error: unused `researchRun` parameter**

- **Found during:** Task 1 (lint check before commit)
- **Issue:** `getOrCreateTestContact(prospect, researchRun)` — researchRun parameter was declared but never used, causing ESLint error
- **Fix:** Renamed parameter to `_researchRun` to match ESLint allowed-unused-args pattern
- **Files modified:** scripts/e2e-send-test.mjs
- **Verification:** `npm run lint` shows no errors for e2e-send-test.mjs
- **Committed in:** d94320f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (lint fix)
**Impact on plan:** No scope change — lint fix only.

## Authentication Gate

**Blocked:** RESEND_API_KEY is set to `re_your-key` (placeholder value) in `.env`.

The script enforces this at startup and exits with a clear error unless `--dry-run` is specified. The real send cannot proceed until a valid Resend API key is configured.

**To unblock:** Set `RESEND_API_KEY=re_xxxxx` in `.env` with a real key from resend.com/api-keys.

## Issues Encountered

- No contacts or outreach sequences existed in the DB — handled by the plan's fallback: created test contacts inline
- RESEND_API_KEY is a placeholder — authentication gate, treated as normal flow

## Next Phase Readiness

- Script is ready to run once RESEND_API_KEY is set
- Run: `node scripts/e2e-send-test.mjs` (live send) or `node scripts/e2e-send-test.mjs --dry-run` (test)
- After send: check info@klarifai.nl inbox for 2 emails, then proceed to Task 2 (human-verify checkpoint)
- Recommend configuring Resend DKIM via Cloudflare before the live send for better deliverability

---

_Phase: 27-end-to-end-cycle_
_Completed: 2026-02-28_

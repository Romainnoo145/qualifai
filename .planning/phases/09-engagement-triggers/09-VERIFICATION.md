---
phase: 09-engagement-triggers
verified: 2026-02-21T09:51:44Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 9: Engagement Triggers Verification Report

**Phase Goal:** Wizard engagement, PDF downloads, and positive email replies automatically create immediate follow-up tasks; email open/click events are captured but do not drive cadence escalation.
**Verified:** 2026-02-21T09:51:44Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                    | Status   | Evidence                                                                                                                                                                                                                                                                                                                        |
| --- | -------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | When a prospect reaches wizard step 3 or beyond, a call task is created immediately without admin action | VERIFIED | `wizard.ts` lines 111-123: inside `if (maxStep >= 3)` block, `createEngagementCallTask(ctx.db, session.prospectId, 'wizard_step3').catch(console.error)`                                                                                                                                                                        |
| 2   | When a prospect downloads the PDF, a call task is created immediately without admin action               | VERIFIED | `wizard.ts` lines 153-158: `trackPdfDownload` calls `createEngagementCallTask(ctx.db, session.prospectId, 'pdf_download').catch(console.error)`                                                                                                                                                                                 |
| 3   | When a reply is triaged as "interested," a call task is created immediately without admin action         | VERIFIED | `reply-workflow.ts` lines 186-203: inside `if (intent === 'interested')` block, `await createEngagementCallTask(db, reply.contact.prospectId, 'interested_reply')` in try/catch                                                                                                                                                 |
| 4   | Email open and click events are captured and stored via Resend webhook with HMAC signature verification  | VERIFIED | `app/api/webhooks/resend/route.ts`: reads raw body with `req.text()`, calls `resend.webhooks.verify()` with Svix headers; `email.opened` updates `OutreachLog.openedAt`; `email.clicked` appends to `metadata.clicks`                                                                                                           |
| 5   | Email opens alone never trigger cadence escalation                                                       | VERIFIED | Webhook route `email.opened` branch only calls `prisma.outreachLog.update` to set `openedAt`. No call to `createEngagementCallTask` anywhere in the `email.opened` branch. `createEngagementCallTask` has exactly 3 call sites (wizard trackProgress, trackPdfDownload, reply-workflow applyReplyTriage) — none in the webhook. |
| 6   | Resend webhook POST with invalid signature returns 400                                                   | VERIFIED | `route.ts` lines 34-39: try/catch around `resend.webhooks.verify()` returns `NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })`                                                                                                                                                                        |
| 7   | Every sent email stores resendMessageId in OutreachLog.metadata                                          | VERIFIED | `send-email.ts`: `messageMetadata.resendMessageId = null` initialised before send; set to `sendResult?.id ?? null` after successful send; metadata written into `outreachLog.create`                                                                                                                                            |
| 8   | Dedup: same engagement type for same prospect never creates duplicate call tasks                         | VERIFIED | `engagement-triggers.ts` lines 49-60: `db.outreachLog.findFirst` on `channel: 'call'`, `status: 'touch_open'`, `contact: { prospectId }`, `metadata: { path: ['triggerSource'], equals: triggerSource }` — returns early with `reason: 'already_exists'` if found                                                               |
| 9   | If a prospect has no contacts, the trigger skips gracefully without error                                | VERIFIED | `engagement-triggers.ts` lines 63-69: `resolveContactId` returns null → `console.warn` + return `{ created: false, taskId: null, reason: 'no_contact' }`                                                                                                                                                                        |
| 10  | RESEND_WEBHOOK_SECRET defined in env.mjs (server + runtimeEnv blocks)                                    | VERIFIED | `env.mjs` line 23: `RESEND_WEBHOOK_SECRET: z.string().min(8).optional()` in server block; line 64: `RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET` in runtimeEnv block                                                                                                                                               |

**Score:** 10/10 truths verified

---

## Required Artifacts

| Artifact                              | Expected                                                             | Status   | Details                                                                                                                                                                     |
| ------------------------------------- | -------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/api/webhooks/resend/route.ts`    | Resend webhook handler with Svix verification; exports POST          | VERIFIED | 107 lines; exports POST; uses `resend.webhooks.verify()` with Svix headers; email.opened/clicked handlers present; no cadence side-effects                                  |
| `env.mjs`                             | RESEND_WEBHOOK_SECRET env var in server + runtimeEnv                 | VERIFIED | Present in both blocks (lines 23 and 64); typed as `z.string().min(8).optional()`                                                                                           |
| `lib/outreach/send-email.ts`          | Captures resendMessageId from resend.emails.send() return            | VERIFIED | `resendMessageId` initialized null (line 91), set to `sendResult?.id ?? null` after successful send (line 117); included in metadata written to OutreachLog                 |
| `lib/outreach/engagement-triggers.ts` | createEngagementCallTask with contact resolution + dedup             | VERIFIED | 93 lines; exports `createEngagementCallTask` and `TriggerSource`; dedup via Prisma JSON path query; resolveContactId with sequence-first fallback; graceful no-contact skip |
| `server/routers/wizard.ts`            | trackProgress and trackPdfDownload call createEngagementCallTask     | VERIFIED | Imported line 5; called at lines 118 (wizard_step3) and 154 (pdf_download); both fire-and-forget with `.catch(console.error)`                                               |
| `lib/outreach/reply-workflow.ts`      | applyReplyTriage calls createEngagementCallTask on interested intent | VERIFIED | Imported line 3; called at line 193 inside `if (intent === 'interested')` block; try/catch await pattern used                                                               |

---

## Key Link Verification

| From                                  | To                       | Via                                                            | Status | Details                                                                                                                                                         |
| ------------------------------------- | ------------------------ | -------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/api/webhooks/resend/route.ts`    | `prisma.outreachLog`     | metadata JSON path query on resendMessageId                    | WIRED  | Lines 46-50 and 63-67: `metadata: { path: ['resendMessageId'], equals: emailId }` for both email.opened and email.clicked                                       |
| `lib/outreach/send-email.ts`          | `resend.emails.send()`   | captures return value id as resendMessageId                    | WIRED  | Line 102: `const { data: sendResult, error: sendError } = await resend.emails.send(...)` ; line 117: `messageMetadata.resendMessageId = sendResult?.id ?? null` |
| `lib/outreach/engagement-triggers.ts` | `prisma.outreachLog`     | dedup check with metadata JSON path query on triggerSource     | WIRED  | Line 54: `metadata: { path: ['triggerSource'], equals: triggerSource }` inside dedup findFirst                                                                  |
| `server/routers/wizard.ts`            | `engagement-triggers.ts` | import createEngagementCallTask; wizard_step3 and pdf_download | WIRED  | Import at line 5; `wizard_step3` at line 121; `pdf_download` at line 156                                                                                        |
| `lib/outreach/reply-workflow.ts`      | `engagement-triggers.ts` | import createEngagementCallTask; interested_reply              | WIRED  | Import at line 3; `interested_reply` at line 195                                                                                                                |

---

## Requirements Coverage

| Requirement                                                       | Status    | Notes                                                                                                                |
| ----------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------- |
| ENGAG-01: Wizard step 3+ creates immediate call task              | SATISFIED | `trackProgress` fires `createEngagementCallTask(..., 'wizard_step3')` inside `if (maxStep >= 3)`                     |
| ENGAG-02: PDF download creates immediate call task                | SATISFIED | `trackPdfDownload` fires `createEngagementCallTask(..., 'pdf_download')`                                             |
| ENGAG-03: Interested reply creates immediate call task            | SATISFIED | `applyReplyTriage` awaits `createEngagementCallTask(..., 'interested_reply')` in try/catch                           |
| ENGAG-04: Email open/click events captured with Svix verification | SATISFIED | `/api/webhooks/resend` verified via `resend.webhooks.verify()`; events stored to OutreachLog                         |
| ENGAG-05: Email opens never trigger cadence escalation            | SATISFIED | `email.opened` branch only updates `openedAt`; `createEngagementCallTask` has zero call sites in the webhook handler |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| None | —    | —       | —        | —      |

No TODO, FIXME, placeholder, stub, or empty implementation patterns found in any of the four modified/created files.

---

## Human Verification Required

### 1. Resend Webhook Svix Signature Acceptance

**Test:** Send a POST to `/api/webhooks/resend` with a valid Svix-signed payload constructed from the actual `RESEND_WEBHOOK_SECRET` value.
**Expected:** HTTP 200 with `{"received":true}`.
**Why human:** Svix signature is time-bound and requires a real secret; cannot be constructed in a static grep check.

### 2. Invalid Signature Rejection

**Test:** Send a POST to `/api/webhooks/resend` with a mismatched or missing `svix-signature` header.
**Expected:** HTTP 400 with `{"error":"Invalid webhook signature"}`.
**Why human:** Requires a live HTTP request to the running server.

### 3. Resend Dashboard Configuration

**Test:** Verify that the Resend dashboard webhook endpoint is registered pointing to the deployed URL, and `email.opened` and `email.clicked` event types are subscribed.
**Expected:** Real events fire and arrive at `/api/webhooks/resend`.
**Why human:** External dashboard configuration cannot be verified programmatically.

---

## Commits Verified

All four task commits referenced in summaries exist in git history:

- `b6ed988` — feat(09-01): add Resend webhook route with Svix verification and event capture
- `826c4db` — feat(09-01): capture resendMessageId in OutreachLog metadata at send time
- `fd4d978` — feat(09-02): create engagement trigger utility with contact resolution and dedup guard
- `ea7ece6` — feat(09-02): wire engagement triggers into wizard trackProgress, trackPdfDownload, and reply triage

---

## Summary

Phase 9 goal is fully achieved. All five observable truths from the phase goal hold:

- Wizard step 3+ and PDF downloads create immediate call tasks via fire-and-forget from public tRPC procedures — no admin action required and the public wizard flow is never blocked by task creation failures.
- Interested reply triage creates an immediate call task via a try/catch await from the admin triage path.
- Resend webhook captures email open and click events with proper Svix multi-header signature verification; `email.opened` updates `OutreachLog.openedAt` (first open only); `email.clicked` appends to `metadata.clicks`.
- `createEngagementCallTask` has exactly three call sites in the codebase (wizard trackProgress, wizard trackPdfDownload, reply-workflow applyReplyTriage). The `email.opened` handler contains no reference to it — ENGAG-05 is structurally enforced, not just commented.
- Dedup is built directly into `createEngagementCallTask` using a Prisma JSON path query on `metadata.triggerSource`, preventing duplicate call tasks from repeated wizard visits or re-triages.

---

_Verified: 2026-02-21_
_Verifier: Claude (gsd-verifier)_

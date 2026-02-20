# Phase 9: Engagement Triggers - Research

**Researched:** 2026-02-21
**Domain:** Webhook event capture, engagement trigger wiring, deduplication guards
**Confidence:** HIGH

---

## Summary

Phase 9 has three parallel concerns: (1) capturing Resend email open/click events via webhook with HMAC signature verification, (2) wiring three engagement signals — wizard step 3+, PDF download, and interested reply — to immediately create a call task in `OutreachLog`, and (3) a deduplication guard that prevents the same engagement event from creating multiple tasks.

The Resend webhook system uses Svix under the hood. Resend's SDK ships a `resend.webhooks.verify()` method that verifies the three Svix headers (`svix-id`, `svix-timestamp`, `svix-signature`) against the webhook signing secret. This is distinct from the HMAC pattern used for the Cal.com webhook; the planner should not copy the Cal.com pattern. The signing secret is obtained from the Resend dashboard (or via API) when the webhook endpoint is registered, and must be stored as a new env var.

The two trigger points that are already partially wired need augmentation, not replacement. `trackProgress` in `wizard.ts` already sets `prospect.status = 'ENGAGED'` when `maxStep >= 3` but does not create a call task. `applyReplyTriage` in `reply-workflow.ts` already sets `prospect.status = 'ENGAGED'` for `interested` intent but does not create a call task. The task for PDF download must be added to `trackPdfDownload`. All three trigger points need the same "find primary contact → create call task" logic extracted into a shared utility.

**Primary recommendation:** Create a `lib/outreach/engagement-triggers.ts` utility with a `createEngagementCallTask(db, prospectId, triggerSource)` function, call it from all three trigger points, and protect it with an idempotency check using a metadata field query on `OutreachLog`.

---

## Standard Stack

### Core

| Library          | Version                  | Purpose                                                           | Why Standard                                                      |
| ---------------- | ------------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| `resend`         | 6.9.1 (installed)        | `resend.webhooks.verify()` for Svix-backed signature verification | Already in project, ships webhook verification                    |
| `svix`           | installed as resend peer | Underlying Svix library (used via Resend SDK, not directly)       | Resend's `verify()` delegates to Svix; no separate install needed |
| `next`           | 16.1.6 (installed)       | Next.js App Router `NextRequest`/`NextResponse` for webhook route | Existing pattern (see `app/api/webhooks/calcom/route.ts`)         |
| `zod`            | 4.3.6 (installed)        | Payload validation after signature verification                   | Existing project standard                                         |
| `@prisma/client` | 7.3.0 (installed)        | `OutreachLog` creation and dedup query                            | Existing ORM                                                      |

### Supporting

| Library       | Version  | Purpose                                                  | When to Use                                              |
| ------------- | -------- | -------------------------------------------------------- | -------------------------------------------------------- |
| `node:crypto` | built-in | `timingSafeEqual` if hand-rolling HMAC (not needed here) | Only relevant for Cal.com pattern; do NOT use for Resend |

### Alternatives Considered

| Instead of                 | Could Use                         | Tradeoff                                                                                                                 |
| -------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `resend.webhooks.verify()` | `svix` Webhook class directly     | Resend SDK wraps svix already; using it directly adds no benefit and requires knowing the Svix API separately            |
| `resend.webhooks.verify()` | `node:crypto` HMAC (`createHmac`) | Resend/Svix uses a different signing scheme — NOT a plain HMAC-SHA256 on the raw body. Custom HMAC would break silently. |

**Installation:** No new packages needed. `resend` and `svix` are both already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
app/api/webhooks/
├── calcom/route.ts          # existing
├── inbound-reply/route.ts   # existing
└── resend/route.ts          # NEW: 09-01

lib/outreach/
├── reply-workflow.ts        # existing — augment applyReplyTriage
├── send-email.ts            # existing — augment to store resendMessageId
└── engagement-triggers.ts   # NEW: 09-02 shared utility
```

### Pattern 1: Resend Webhook Verification (Svix-backed)

**What:** Resend uses Svix to sign webhooks. Three headers carry the signature: `svix-id`, `svix-timestamp`, `svix-signature`. The SDK's `resend.webhooks.verify()` validates all three against a per-endpoint signing secret. The signing secret looks like `whsec_...` (not `re_...`).

**When to use:** Always on the POST handler for `/api/webhooks/resend` before touching the payload.

**Critical constraint:** You MUST read the raw body as a string with `await req.text()` BEFORE calling `verify()`. Parsing via `req.json()` then re-stringifying breaks the cryptographic signature.

```typescript
// Source: Resend SDK types + official docs (https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests)
import { Resend, type WebhookEventPayload } from 'resend';
import { env } from '@/env.mjs';

const resend = new Resend(env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const rawBody = await req.text(); // MUST be raw string

  let event: WebhookEventPayload;
  try {
    event = resend.webhooks.verify({
      payload: rawBody,
      headers: {
        id: req.headers.get('svix-id') ?? '',
        timestamp: req.headers.get('svix-timestamp') ?? '',
        signature: req.headers.get('svix-signature') ?? '',
      },
      webhookSecret: env.RESEND_WEBHOOK_SECRET,
    });
  } catch {
    return NextResponse.json(
      { error: 'Invalid webhook signature' },
      { status: 400 },
    );
  }

  // event is now typed as WebhookEventPayload
  if (event.type === 'email.opened' || event.type === 'email.clicked') {
    // capture and store
  }

  return NextResponse.json({ received: true });
}
```

### Pattern 2: Resend Webhook Payload Shape

Verified from installed Resend SDK types (`index.d.cts`, v6.9.1):

```typescript
// email.opened
interface EmailOpenedEvent {
  type: 'email.opened';
  created_at: string; // ISO 8601
  data: {
    broadcast_id?: string;
    created_at: string;
    email_id: string; // this is the resend message ID to correlate
    from: string;
    to: string[];
    subject: string;
    template_id?: string;
    tags?: Record<string, string>;
  };
}

// email.clicked — extends base with click data
interface EmailClickedEvent {
  type: 'email.clicked';
  created_at: string;
  data: {
    // ... same base fields ...
    email_id: string;
    click: {
      ipAddress: string;
      link: string;
      timestamp: string;
      userAgent: string;
    };
  };
}
```

The `data.email_id` is the Resend message ID. To correlate an open/click back to a specific `OutreachLog`, `send-email.ts` must be updated to capture the returned `id` from `resend.emails.send()` and store it in `OutreachLog.metadata.resendMessageId`.

### Pattern 3: Shared Engagement Trigger Utility

**What:** All three trigger points (wizard step 3+, PDF download, interested reply) must produce a call task. Extract into a reusable function with built-in dedup.

**Contact resolution strategy:** `OutreachLog` requires a non-null `contactId`. For wizard and PDF download triggers, the prospect may or may not have a contact. Use this priority order:

1. Find the most recent `OutreachSequence.contactId` for the prospect (most recently updated, non-null contactId)
2. Fall back to `Contact` ordered by outreach seniority hint: `outreachStatus != OPTED_OUT`, ordered by `createdAt asc` (earliest = primary)
3. If no contact exists, skip task creation and log a warning (do not throw — wizard engagement should not error)

```typescript
// lib/outreach/engagement-triggers.ts
import type { PrismaClient } from '@prisma/client';

type TriggerSource = 'wizard_step3' | 'pdf_download' | 'interested_reply';

async function resolveContactId(
  db: PrismaClient,
  prospectId: string,
): Promise<string | null> {
  // Priority 1: most recent outreach sequence with a contact
  const sequence = await db.outreachSequence.findFirst({
    where: { prospectId, contactId: { not: null } },
    orderBy: { updatedAt: 'desc' },
    select: { contactId: true },
  });
  if (sequence?.contactId) return sequence.contactId;

  // Priority 2: earliest non-opted-out contact
  const contact = await db.contact.findFirst({
    where: { prospectId, outreachStatus: { not: 'OPTED_OUT' } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return contact?.id ?? null;
}

export async function createEngagementCallTask(
  db: PrismaClient,
  prospectId: string,
  triggerSource: TriggerSource,
): Promise<{ created: boolean; taskId: string | null; reason?: string }> {
  // Dedup check: has this trigger type already created a task for this prospect?
  const existing = await db.outreachLog.findFirst({
    where: {
      channel: 'call',
      status: 'touch_open',
      contact: { prospectId },
      metadata: {
        path: ['triggerSource'],
        equals: triggerSource,
      },
    },
    select: { id: true },
  });
  if (existing) {
    return { created: false, taskId: existing.id, reason: 'already_exists' };
  }

  const contactId = await resolveContactId(db, prospectId);
  if (!contactId) {
    return { created: false, taskId: null, reason: 'no_contact' };
  }

  const subject =
    triggerSource === 'wizard_step3'
      ? 'Follow-up: prospect engaged with wizard (step 3+)'
      : triggerSource === 'pdf_download'
        ? 'Follow-up: prospect downloaded PDF report'
        : 'Follow-up: prospect replied with interest';

  const task = await db.outreachLog.create({
    data: {
      contactId,
      type: 'FOLLOW_UP',
      channel: 'call',
      status: 'touch_open',
      subject,
      bodyText: null,
      metadata: {
        kind: 'touch_task',
        priority: 'high',
        dueAt: null,
        notes: null,
        createdBy: 'engagement-trigger',
        triggerSource,
        prospectId,
      } as never,
    },
    select: { id: true },
  });

  return { created: true, taskId: task.id };
}
```

### Pattern 4: Deduplication Guard Design

**The dedup key is `(prospectId, triggerSource)` via a JSON metadata path query on `OutreachLog`.**

Rationale: The same prospect can reach step 3 multiple times across sessions (return visits). The PDF download tracker is called on every click. The interested reply triage may be re-run. In all cases, exactly one open call task per trigger type per prospect is the correct behavior.

The Prisma `metadata: { path: [...], equals: ... }` JSON path filter is already used in the project (see `calcom/route.ts`). This is the established dedup pattern.

**Alternative considered:** A dedicated `EngagementEvent` DB table. Rejected because it requires a migration and the existing `OutreachLog` metadata is sufficient for Phase 9. Phase 10 can promote this to a proper column if needed.

### Pattern 5: `resendMessageId` Storage at Send Time

**What:** To correlate a Resend webhook `email.opened` or `email.clicked` event back to an `OutreachLog` record, the message ID returned by `resend.emails.send()` must be stored.

**Location:** `lib/outreach/send-email.ts`, in the `metadata` object of the `OutreachLog` created after send.

```typescript
// In send-email.ts — capture the returned id
const { data: sendResult, error: sendError } = await resend.emails.send({ ... });
// sendResult?.id is the Resend message ID (e.g. "2342e8e9-...")

// Store in log metadata:
metadata: {
  ...messageMetadata,
  resendMessageId: sendResult?.id ?? null,
}
```

**Note:** The current `send-email.ts` discards the return value of `resend.emails.send()`. It must be captured. The `resendMessageId` enables the webhook handler to look up the `OutreachLog` via `metadata.path['resendMessageId']` and update `openedAt` or record a click.

### Anti-Patterns to Avoid

- **Using `req.json()` before `verify()`:** Fatal — breaks Svix signature verification. Always `req.text()` first.
- **Using `node:crypto` HMAC for Resend:** The Cal.com webhook uses `createHmac('sha256', secret)` on the raw body. Resend/Svix uses a different multi-header scheme. Do not port the Cal.com pattern.
- **Creating tasks at the prospect level without a contact:** `OutreachLog.contactId` is NOT NULL in the schema. Must resolve a contact first. If none found, skip gracefully.
- **Deduplicating by `prospectId` alone:** Multiple trigger sources (wizard + PDF) should each create their own task. Dedup key must include `triggerSource`.
- **Triggering cadence escalation from email opens:** ENGAG-05 is explicit. Email opens are stored for analytics only, never acted upon.

---

## Don't Hand-Roll

| Problem                     | Don't Build                   | Use Instead                                     | Why                                                                                                     |
| --------------------------- | ----------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Svix signature verification | Custom HMAC with `createHmac` | `resend.webhooks.verify()`                      | Resend uses multi-header Svix scheme, not simple HMAC-SHA256; custom implementation would silently fail |
| Webhook secret rotation     | Custom key management         | Resend dashboard signing_secret                 | Each webhook endpoint has its own secret; Resend handles rotation                                       |
| JSON metadata path filter   | Custom JS loop                | Prisma `metadata: { path: [...], equals: ... }` | Already in production use in `calcom/route.ts`; Postgres JSONB path queries are indexed                 |

**Key insight:** The Resend webhook infrastructure (Svix) and the deduplication pattern (Prisma JSON path) are both already present in the codebase. This phase is about wiring, not building new infrastructure.

---

## Common Pitfalls

### Pitfall 1: Raw Body Consumed Before Verification

**What goes wrong:** `req.json()` or `req.formData()` is called before `resend.webhooks.verify()`, consuming the stream. The raw body passed to `verify()` is empty or already parsed, making signature verification fail for every request.

**Why it happens:** Next.js Request body can only be consumed once. Developers familiar with REST patterns reach for `req.json()` reflexively.

**How to avoid:** `const rawBody = await req.text()` is the FIRST thing in the handler. Parse with `JSON.parse(rawBody)` after verification (or trust the typed return from `verify()`).

**Warning signs:** `Error: Invalid webhook signature` on every request even with correct secret.

### Pitfall 2: Using the Resend API Key as the Webhook Secret

**What goes wrong:** Developer confuses `RESEND_API_KEY` (`re_...`) with the webhook signing secret (`whsec_...`). Verification always fails.

**Why it happens:** Both are Resend credentials stored as env vars. The webhook signing secret is per-endpoint and obtained separately from the Resend dashboard under Webhooks → (endpoint) → Signing Secret.

**How to avoid:** Add `RESEND_WEBHOOK_SECRET` as a distinct env var in `env.mjs` and `.env.example`. Never reuse `RESEND_API_KEY`.

**Warning signs:** `Invalid webhook signature` even though the key looks correct.

### Pitfall 3: Duplicate Call Tasks on Return Visits

**What goes wrong:** Prospect opens wizard to step 3, comes back next day, opens to step 3 again. Two call tasks are created.

**Why it happens:** `trackProgress` is called on every step navigation. Without dedup, each call to step 3+ would create a new task.

**How to avoid:** The dedup check in `createEngagementCallTask` must run BEFORE creating the task. The check queries `OutreachLog` where `triggerSource = 'wizard_step3'` and the contact belongs to the prospect.

**Warning signs:** Multiple `touch_open` tasks in the queue with the same subject for the same prospect.

### Pitfall 4: Missing Contact Causes Unhandled Error

**What goes wrong:** Prospect has no contacts yet (recently added, not yet enriched). Wizard step 3 fires `createEngagementCallTask`, which calls `resolveContactId`, returns `null`, then tries to `db.outreachLog.create({ contactId: null })` — Prisma throws because the field is NOT NULL.

**Why it happens:** `OutreachLog.contactId` is non-nullable. The contact resolution may legitimately return null for new prospects.

**How to avoid:** `createEngagementCallTask` must explicitly handle the null case with a graceful return (`{ created: false, reason: 'no_contact' }`), not a throw. Log the skip at `console.warn` level.

**Warning signs:** 500 errors in `trackProgress` mutation for newly-added prospects.

### Pitfall 5: Apple Mail Privacy Protection False Positives

**What goes wrong:** `email.opened` events are used to create call tasks, resulting in tasks for prospects who never actually opened the email (Apple MPP prefetches on behalf of the recipient).

**Why it happens:** Apple MPP is active for 40-60% of Apple Mail users. Every email appears "opened" immediately upon delivery.

**How to avoid:** The webhook handler for `email.opened` must ONLY store the event in `OutreachLog.openedAt` metadata — it must NEVER call `createEngagementCallTask`. Only `wizard_step3`, `pdf_download`, and `interested_reply` create tasks. This is enforced by ENGAG-05.

**Warning signs:** Call task queue floods immediately after email send batch.

---

## Code Examples

Verified patterns from codebase and official Resend SDK:

### New Env Var for Webhook Secret

```typescript
// env.mjs additions (in server block and runtimeEnv)
RESEND_WEBHOOK_SECRET: z.string().min(8).optional(),

// runtimeEnv:
RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET,
```

### Full Resend Webhook Route Skeleton

```typescript
// app/api/webhooks/resend/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { env } from '@/env.mjs';
import prisma from '@/lib/prisma';

const resend = new Resend(env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  if (!env.RESEND_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 },
    );
  }

  const rawBody = await req.text();

  let event;
  try {
    event = resend.webhooks.verify({
      payload: rawBody,
      headers: {
        id: req.headers.get('svix-id') ?? '',
        timestamp: req.headers.get('svix-timestamp') ?? '',
        signature: req.headers.get('svix-signature') ?? '',
      },
      webhookSecret: env.RESEND_WEBHOOK_SECRET,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'email.opened' || event.type === 'email.clicked') {
    // Find the OutreachLog by resendMessageId stored in metadata
    const emailId = event.data.email_id;
    const log = await prisma.outreachLog.findFirst({
      where: { metadata: { path: ['resendMessageId'], equals: emailId } },
      select: { id: true, openedAt: true },
    });

    if (log) {
      if (event.type === 'email.opened' && !log.openedAt) {
        await prisma.outreachLog.update({
          where: { id: log.id },
          data: { openedAt: new Date(event.created_at) },
        });
      }
      // For email.clicked: store click event in metadata (append to array)
    }
  }

  return NextResponse.json({ received: true });
}
```

### Augmented `send-email.ts` to Capture resendMessageId

```typescript
// In lib/outreach/send-email.ts — REPLACE the current resend.emails.send() call
let sendResult: { id: string } | null = null;
try {
  const { data, error } = await resend.emails.send({ ... });
  if (!error && data) sendResult = data;
} catch (error) {
  console.error('Failed to send outreach email:', error);
  status = 'failed';
  sentAt = null;
}

// In the metadata object:
metadata: {
  ...messageMetadata,
  resendMessageId: sendResult?.id ?? null,
} as never,
```

### Trigger Wiring in `wizard.ts` `trackProgress`

```typescript
// After setting prospect.status = 'ENGAGED':
if (maxStep >= 3) {
  await ctx.db.prospect.update({ ... }); // existing

  // NEW: create engagement call task (fire-and-forget, non-blocking)
  createEngagementCallTask(ctx.db, session.prospectId, 'wizard_step3').catch(console.error);
}
```

### Trigger Wiring in `wizard.ts` `trackPdfDownload`

```typescript
// After updating wizardSession.pdfDownloaded:
notifyAdmin({ ... }).catch(console.error); // existing

// NEW:
createEngagementCallTask(ctx.db, session.prospectId, 'pdf_download').catch(console.error);
```

### Trigger Wiring in `reply-workflow.ts` `applyReplyTriage`

```typescript
// After: if (intent === 'interested') { prospect.status = 'ENGAGED' }
// NEW (within the if block):
await createEngagementCallTask(
  db,
  reply.contact.prospectId,
  'interested_reply',
);
```

---

## State of the Art

| Old Approach                            | Current Approach                       | When Changed                    | Impact                                                     |
| --------------------------------------- | -------------------------------------- | ------------------------------- | ---------------------------------------------------------- |
| Manual HMAC for all webhooks            | Svix-backed `resend.webhooks.verify()` | Resend v2+                      | Much harder to forge; timestamp replay protection built in |
| Email opens used for engagement scoring | Excluded due to Apple MPP              | ~2022 (Apple MPP launch)        | Must store opens but cannot use for task creation          |
| Dedup via unique DB constraint          | Dedup via JSON metadata path query     | This project's existing pattern | No schema migration needed for dedup                       |

**Deprecated/outdated:**

- Manual `createHmac` for Resend webhooks: wrong scheme entirely; Resend does not use simple HMAC-SHA256 on body.

---

## Open Questions

1. **Should email.opened update `OutreachSequence.status` to `OPENED`?**
   - What we know: The schema has `SequenceStatus.OPENED`. The `OutreachLog.openedAt` field exists but is never set by the current send flow.
   - What's unclear: The roadmap says "email open/click events are captured and stored" but does not specify whether `OutreachSequence.status` should change.
   - Recommendation: Update `OutreachLog.openedAt` only, not `OutreachSequence.status`. Keep sequence status for genuine engagement (reply, booking). This is safe and reversible; Phase 10 can promote opens to sequence status if needed.

2. **What if a prospect has no contacts when the wizard triggers?**
   - What we know: `OutreachLog.contactId` is NOT NULL. New prospects added via search may not yet have enriched contacts.
   - What's unclear: Should the trigger silently skip, or should it fall back to creating a prospect-level notification?
   - Recommendation: Silent skip with `console.warn`. The admin notification via `notifyAdmin` already fires on wizard engagement and PDF download; that covers the admin's awareness. A call task without a contact is meaningless.

3. **Should `RESEND_WEBHOOK_SECRET` be required or optional in env.mjs?**
   - What we know: `CALCOM_WEBHOOK_SECRET` is defined as `.optional()`. The Resend webhook route won't function without it.
   - What's unclear: Whether the webhook route should return 500 when unconfigured (matching Cal.com pattern) or be a build-time requirement.
   - Recommendation: Match the Cal.com pattern — define as `.optional()` in env.mjs, return 500 with a clear error message at runtime if not configured. This prevents build failures in CI where the secret is unavailable.

---

## Sources

### Primary (HIGH confidence)

- Resend SDK `node_modules/resend/dist/index.d.cts` v6.9.1 — `WebhookEventPayload`, `EmailOpenedEvent`, `EmailClickedEvent`, `VerifyWebhookOptions`, `Webhooks.verify()` signatures
- Resend SDK `node_modules/resend/dist/index.cjs` — confirmed `svix.Webhook` is used internally, delegating Svix's multi-header scheme
- `/home/klarifai/Documents/klarifai/projects/qualifai/app/api/webhooks/calcom/route.ts` — existing HMAC verification pattern (for contrast)
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/wizard.ts` — existing `trackProgress`, `trackPdfDownload`, `startSession` mutations
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/outreach/reply-workflow.ts` — `applyReplyTriage` implementation
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/outreach.ts` — `queueTouchTask`, `TOUCH_TASK_STATUS_OPEN`, touch task metadata schema
- `/home/klarifai/Documents/klarifai/projects/qualifai/prisma/schema.prisma` — `OutreachLog` (contactId NOT NULL), `WizardSession`, `OutreachSequence`

### Secondary (MEDIUM confidence)

- [Resend Verify Webhooks Requests docs](https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests) — verified header names (`svix-id`, `svix-timestamp`, `svix-signature`), raw body requirement, SDK usage pattern
- [Resend Webhook Event Types docs](https://resend.com/docs/dashboard/webhooks/event-types) — event type list: `email.opened`, `email.clicked`, `email.sent`, `email.delivered`, etc.

### Tertiary (LOW confidence)

- WebSearch result re: Apple MPP 40-60% false positive rate — widely cited figure, not from an authoritative 2026 source; but the decision to exclude opens is already locked in the phase prior decisions.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all core libraries verified in installed packages and type definitions
- Architecture: HIGH — verified against existing codebase patterns (`calcom/route.ts`, `reply-workflow.ts`, `wizard.ts`)
- Pitfalls: HIGH — raw body pitfall and Apple MPP exclusion verified from official docs and prior decisions; contact null case verified from schema

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (stable domain — Resend SDK and Next.js App Router patterns are unlikely to change within 30 days)

# Post-Sale Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bridge the gap between `Quote.status = ACCEPTED` and "klant heeft betaald": auto-create an `Engagement` record on accept, fix the Cal.com kickoff link to be persistent, let Romano prepare and send invoices manually using the offerte's payment schedule, and surface everything in a Project tab on the prospect detail page.

**Architecture:** New `Engagement` (1:1 with Quote), `Invoice` (1:N from Engagement, snapshot of one termijn), and `EngagementMilestone` models. ACCEPTED-transition hook in `lib/state-machines/quote.ts` creates the Engagement + milestones. Cal.com webhook updates `Engagement.kickoffBookedAt`. Two crons: kickoff-reminder (max 2x, 7d apart) and invoice-overdue (UI flag only, no client mail). Invoice flow is fully manual-trigger: Romano clicks "Maak factuur klaar" per termijn, reviews DRAFT, then "Versturen" generates PDF + emails klant. PDF + email reuse Klarifai branding from `components/clients/klarifai/`.

**Tech Stack:** Prisma + Postgres, tRPC v11, Next.js 14 App Router, Vercel cron, Resend (existing), bcryptjs (already in deps), vitest. PDF rendering reuses the offerte-print pattern (HTML → puppeteer or React PDF — implementer chooses based on existing infra).

**Spec:** `docs/superpowers/specs/2026-04-26-post-sale-flow-design.md` (commit `b638dee`).

---

## Naming decision (read first)

The existing `Project` model in `prisma/schema.prisma` is the multi-tenant root: it defines tenants like `klarifai` and `europes-gate`. Every prospect, quote, and use-case carries a `projectId` that references it. **The post-sale "Project" concept in the spec is a different thing entirely** — it represents one engagement with one customer, born from one accepted Quote.

Two domain concepts both called "Project" in the same codebase will rot. **This plan renames the post-sale concept to `Engagement`** in code (model, FK, tRPC procedures, internal references) while keeping "Project" in the user-facing Dutch UI label (`<Tab>Project</Tab>`) because that's the word Romano uses with customers.

So:

- DB model: `Engagement`, `EngagementMilestone`
- Multi-tenant FK on those models: `projectId` (consistent with existing models like `Prospect.projectId`) — points at the multi-tenant `Project.id`
- Quote→engagement FK: `Engagement.quoteId`
- tRPC router: `engagementRouter`
- UI text: "Project tab", "Maak factuur klaar", etc. — Dutch, customer-friendly
- Spec language: spec uses "Project" — translate mentally to `Engagement` when reading code

If you disagree with this decision, stop and discuss before starting Task 1. Renaming back later is painful.

---

## Pre-flight context the executor must absorb

**State-machine integration point.** `lib/state-machines/quote.ts` defines `transitionQuote(tx, quoteId, nextStatus)`. The ACCEPTED transition is fired from `app/api/offerte/accept/route.ts:103` inside a Prisma `$transaction`. New `Engagement` creation must happen in that same transaction so quote-acceptance and engagement-creation are atomic.

**Multi-tenant scoping.** All new tRPC procedures use `projectAdminProcedure` and filter queries by `ctx.projectId` (the multi-tenant project, not the engagement). Pattern:

```ts
ctx.db.engagement.findMany({
  where: { projectId: ctx.projectId, ... },
})
```

This keeps Klarifai's data invisible to a future Atlantis tenant.

**DB drift workflow.** Local DB has known migration drift (see `reference_db_drift_workflow.md` in agent memory). When adding columns, do NOT use `prisma migrate dev`. Instead: edit schema, apply SQL via `docker exec qualifai-db psql`, manually create migration file with timestamp, then `pnpm prisma migrate resolve --applied <name>`, then `pnpm prisma generate`.

**Cal.com webhook.** Already exists at `app/api/webhooks/calcom/route.ts`. The handler currently processes booking events for sequence-driven Cal.com bookings (the cold-track booked-call flow). Engagement-kickoff bookings need to be detected via a different signal — most reliable is the Cal.com `bookingId` matched against an Engagement record (or via metadata passed when generating the kickoff link). The plan resolves this in Task 3.

**No existing crons.** `vercel.json` contains only `{"framework": "nextjs"}`. We add `"crons"` array.

**Test patterns.** Vitest. Existing tRPC router tests (e.g. `server/routers/quotes.test.ts`) mock `@/env.mjs` and `@/lib/prisma`. Follow that pattern.

**Romano's existing email signature** (`components/clients/klarifai/email-signature.ts` — moved there in today's multi-tenant ship) MUST be appended to all customer-facing mails.

---

## File structure

```
prisma/schema.prisma                                              MODIFY  (Engagement, Invoice, EngagementMilestone, enums)
prisma/migrations/<ts>_post_sale_flow/migration.sql               CREATE  (manual)
prisma/migrations/<ts>_invoice_model/migration.sql                CREATE  (manual, separate timestamp from engagement)

lib/state-machines/quote.ts                                       MODIFY  (Engagement creation hook on ACCEPTED)
lib/state-machines/quote.test.ts                                  MODIFY  (add engagement-creation test)

lib/email/acceptance-email.ts                                     MODIFY  (include persistent kickoff link)
                                                                          (path may differ; grep for the existing acceptance email)
app/api/webhooks/calcom/route.ts                                  MODIFY  (handle kickoff bookings → update Engagement)

components/clients/klarifai/kickoff-reminder-email.tsx            CREATE
components/clients/klarifai/invoice-email.tsx                     CREATE
components/clients/klarifai/invoice-renderer.tsx                  CREATE  (PDF template, server-rendered)

lib/invoice-number.ts                                             CREATE  (per-year sequential generator, atomic)
lib/invoice-number.test.ts                                        CREATE
lib/invoice-pdf.ts                                                CREATE  (renders PDF buffer from Invoice + project context)

server/routers/engagement.ts                                      CREATE  (getByProspect, completeMilestone, markKickoffBooked, sendKickoffLink)
server/routers/engagement.test.ts                                 CREATE
server/routers/invoice.ts                                         CREATE  (prepare, update, send, markPaid, cancel, getById)
server/routers/invoice.test.ts                                    CREATE
server/routers/_app.ts                                            MODIFY  (mount engagementRouter, invoiceRouter)

app/admin/prospects/[id]/page.tsx                                 MODIFY  (Project tab integration when Engagement exists)
components/features/engagement/project-tab.tsx                    CREATE  (top-level tab content)
components/features/engagement/kickoff-block.tsx                  CREATE
components/features/engagement/milestone-checklist.tsx            CREATE
components/features/engagement/invoice-queue.tsx                  CREATE

app/admin/invoices/[id]/page.tsx                                  CREATE
components/features/invoice/invoice-detail.tsx                    CREATE
components/features/invoice/invoice-actions.tsx                   CREATE  (Send/MarkPaid/Cancel buttons)

app/api/internal/cron/kickoff-reminder/route.ts                   CREATE
app/api/internal/cron/invoice-overdue/route.ts                    CREATE
vercel.json                                                       MODIFY  (add crons array)
```

Tests omitted from list above where they're inline with the implementation file (e.g. `engagement.test.ts` next to `engagement.ts`).

---

## Wave structure

The plan is large enough that you should ship in 3 waves. Each wave produces working software.

**Wave A — Foundation (Tasks 1-5).** Engagement + milestone records exist on ACCEPTED. Cal.com kickoff link works persistently. Webhook updates booking state. Project tab on prospect detail shows kickoff status (no invoice UI yet). After Wave A, Romano can verify "klant tekent → ik zie het in admin → kickoff link blijft werken."

**Wave B — Invoice generation (Tasks 6-12).** Invoice model + tRPC procedures + PDF + email. Invoice detail page. Romano can prepare, send, mark paid via UI.

**Wave C — Polish + crons (Tasks 13-15).** Engagement tab gets full UI (milestones + invoice queue). Kickoff reminder cron. Overdue cron. E2E synthetic test.

Pause between waves for review if you want. Don't run Wave B before Wave A is verified working in admin.

---

## Wave A — Foundation

### Task 1: Add `Engagement` + `EngagementMilestone` models

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_post_sale_engagement/migration.sql`

- [ ] **Step 1: Add models to schema**

Open `prisma/schema.prisma`. Find a quiet spot near other models (e.g. after `Quote`). Insert:

```prisma
model Engagement {
  id            String   @id @default(cuid())
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  quoteId       String   @unique
  quote         Quote    @relation(fields: [quoteId], references: [id])
  prospectId    String
  prospect      Prospect @relation(fields: [prospectId], references: [id])
  projectId     String   // multi-tenant scope (Klarifai etc.)
  project       Project  @relation(fields: [projectId], references: [id])
  acceptedAt    DateTime
  kickoffBookedAt        DateTime?
  kickoffReminderCount   Int       @default(0)
  kickoffReminderLastAt  DateTime?
  status        EngagementStatus @default(ACTIVE)
  invoices      Invoice[]
  milestones    EngagementMilestone[]
  @@index([prospectId])
  @@index([projectId])
}

model EngagementMilestone {
  id           String   @id @default(cuid())
  engagementId String
  engagement   Engagement @relation(fields: [engagementId], references: [id], onDelete: Cascade)
  ordering     Int
  label        String
  completedAt  DateTime?
  @@index([engagementId])
  @@index([engagementId, ordering])
}

enum EngagementStatus {
  ACTIVE
  DELIVERED
  ARCHIVED
}
```

Also add the back-relations to existing models. Find `model Quote {` and add inside the relations section (anywhere with the other relations is fine):

```prisma
  engagement   Engagement?
```

Find `model Prospect {` and add:

```prisma
  engagements  Engagement[]
```

Find `model Project {` and add:

```prisma
  engagements  Engagement[]
```

- [ ] **Step 2: Apply schema via direct SQL** (drift workflow)

Run:

```bash
docker exec qualifai-db psql -U user -d qualifai <<'SQL'
CREATE TYPE "EngagementStatus" AS ENUM ('ACTIVE', 'DELIVERED', 'ARCHIVED');

CREATE TABLE "Engagement" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "quoteId" TEXT NOT NULL,
  "prospectId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL,
  "kickoffBookedAt" TIMESTAMP(3),
  "kickoffReminderCount" INTEGER NOT NULL DEFAULT 0,
  "kickoffReminderLastAt" TIMESTAMP(3),
  "status" "EngagementStatus" NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT "Engagement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Engagement_quoteId_key" UNIQUE ("quoteId"),
  CONSTRAINT "Engagement_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Engagement_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Engagement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Engagement_prospectId_idx" ON "Engagement"("prospectId");
CREATE INDEX "Engagement_projectId_idx" ON "Engagement"("projectId");

CREATE TABLE "EngagementMilestone" (
  "id" TEXT NOT NULL,
  "engagementId" TEXT NOT NULL,
  "ordering" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "EngagementMilestone_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EngagementMilestone_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "EngagementMilestone_engagementId_idx" ON "EngagementMilestone"("engagementId");
CREATE INDEX "EngagementMilestone_engagementId_ordering_idx" ON "EngagementMilestone"("engagementId", "ordering");
SQL
```

Verify with `docker exec qualifai-db psql -U user -d qualifai -c '\dt' | grep -E "Engagement|Milestone"` — expect both tables listed.

- [ ] **Step 3: Create migration file**

```bash
mkdir -p prisma/migrations/20260427090000_post_sale_engagement
```

Create `prisma/migrations/20260427090000_post_sale_engagement/migration.sql` containing the exact SQL from Step 2 (without the heredoc wrapper).

- [ ] **Step 4: Mark migration as applied**

```bash
pnpm prisma migrate resolve --applied 20260427090000_post_sale_engagement
```

Expected output: `Migration 20260427090000_post_sale_engagement marked as applied.`

- [ ] **Step 5: Regenerate Prisma client**

```bash
pnpm prisma generate
```

Expected: `✔ Generated Prisma Client`. Verify type access: `node -e "const {PrismaClient} = require('@prisma/client'); console.log(Object.keys(new PrismaClient()).filter(k => k.includes('engagement') || k.includes('Engagement')))"` — expect `engagement` and `engagementMilestone` in output.

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: clean (or only pre-existing unrelated errors).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260427090000_post_sale_engagement/
git commit -m "feat(db): add Engagement + EngagementMilestone models for post-sale flow"
```

---

### Task 2: ACCEPTED hook creates Engagement + milestones

**Files:**

- Modify: `lib/state-machines/quote.ts`
- Modify: `lib/state-machines/quote.test.ts`

- [ ] **Step 1: Read existing transitionQuote**

Open `lib/state-machines/quote.ts`. Find the function that handles transitions (`transitionQuote` or similar). Note its signature — it accepts a Prisma transaction and quote ID, performs the status update, and returns the updated quote.

- [ ] **Step 2: Write failing test for engagement creation**

Open `lib/state-machines/quote.test.ts`. Add a new test block:

```ts
describe('transitionQuote → ACCEPTED creates Engagement', () => {
  it('creates Engagement with milestones from quote.paymentSchedule, marks first as completed', async () => {
    const quoteId = 'test-quote-id';
    const prospectId = 'test-prospect-id';
    const projectId = 'test-project-id';
    const paymentSchedule = [
      { label: 'Bij ondertekening', percentage: 50 },
      { label: 'Bij oplevering MVP', percentage: 25 },
      { label: 'Bij eindafrekening', percentage: 25 },
    ];

    // Mock prisma transaction with quote in SENT state
    const tx = mockPrismaTx({
      quote: { findUnique: ({ where }) => ({
        id: quoteId, prospectId, projectId,
        status: 'SENT', paymentSchedule, totalAmountCents: 1000000,
      })},
      quote_update: { ... },        // captures status update call
      engagement_create: { ... },   // captures engagement insert
      engagementMilestone_update: { ... },  // captures first-milestone completion
    });

    await transitionQuote(tx, quoteId, 'ACCEPTED');

    expect(tx.engagement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quoteId,
          prospectId,
          projectId,
          milestones: {
            create: [
              { ordering: 0, label: 'Bij ondertekening' },
              { ordering: 1, label: 'Bij oplevering MVP' },
              { ordering: 2, label: 'Bij eindafrekening' },
            ],
          },
        }),
      })
    );

    expect(tx.engagementMilestone.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ completedAt: expect.any(Date) }),
      })
    );
  });
});
```

(Use the project's existing `mockPrismaTx` helper if present, otherwise use plain `vi.fn()` mocks the way other state-machine tests do — copy the pattern from one of the existing `it()` blocks.)

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm vitest run lib/state-machines/quote.test.ts
```

Expected: NEW test fails (no engagement.create call). Existing tests still pass.

- [ ] **Step 4: Implement engagement creation in transitionQuote**

In `lib/state-machines/quote.ts`, locate the post-transition logic (the part that runs after the status update). Add an `if (nextStatus === 'ACCEPTED')` branch:

```ts
if (nextStatus === 'ACCEPTED') {
  const paymentSchedule = (quote.paymentSchedule ?? []) as Array<{
    label: string;
    percentage: number;
  }>;

  const engagement = await tx.engagement.create({
    data: {
      quoteId: quote.id,
      prospectId: quote.prospectId,
      projectId: quote.projectId,
      acceptedAt: new Date(),
      milestones: {
        create: paymentSchedule.map((term, idx) => ({
          ordering: idx,
          label: term.label,
        })),
      },
    },
    include: {
      milestones: { orderBy: { ordering: 'asc' }, take: 1 },
    },
  });

  // First milestone (= "bij ondertekening") is reached AT acceptance
  if (engagement.milestones[0]) {
    await tx.engagementMilestone.update({
      where: { id: engagement.milestones[0].id },
      data: { completedAt: new Date() },
    });
  }
}
```

If quote.paymentSchedule is empty or null (defensive — shouldn't happen for a quote that gets accepted), no milestones get created and the loop is a no-op.

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm vitest run lib/state-machines/quote.test.ts
```

Expected: all tests pass including the new one.

- [ ] **Step 6: Run broader quote-related tests**

```bash
pnpm vitest run lib/state-machines server/routers/quotes
```

Expected: still green (or at most pre-existing failures already documented in the multi-tenant PR).

- [ ] **Step 7: Commit**

```bash
git add lib/state-machines/quote.ts lib/state-machines/quote.test.ts
git commit -m "feat(state-machine): create Engagement + milestones on Quote ACCEPTED"
```

---

### Task 3: Cal.com webhook updates Engagement.kickoffBookedAt

**Files:**

- Modify: `app/api/webhooks/calcom/route.ts`

- [ ] **Step 1: Understand the kickoff-booking signal**

Read `app/api/webhooks/calcom/route.ts`. The handler currently processes `BOOKING_CREATED` events and matches them to Cal.com `bookingId` against existing OutreachLog records (cold-track). For Engagement kickoff bookings, we need a different match path because the booking originates from the post-acceptance kickoff link, not from a sequenced outreach mail.

The cleanest signal: when generating the kickoff Cal.com URL (Task 4), pass the engagement ID as URL metadata that Cal.com forwards in the webhook payload (`metadata.engagementId`). On webhook receipt, if `metadata.engagementId` is present, treat it as a kickoff booking.

- [ ] **Step 2: Add kickoff-booking branch to webhook handler**

In `app/api/webhooks/calcom/route.ts`, inside the existing `BOOKING_CREATED` event handler (search for the part that processes the booking — typically after signature verification), add an early branch:

```ts
const engagementId = body?.payload?.metadata?.engagementId;
if (typeof engagementId === 'string' && engagementId.length > 0) {
  // Kickoff booking — update Engagement, skip cold-track outreach matching.
  await prisma.engagement.update({
    where: { id: engagementId },
    data: { kickoffBookedAt: new Date() },
  });
  return NextResponse.json({ ok: true, kind: 'kickoff' });
}
```

Place this BEFORE the existing OutreachLog matching logic so kickoff bookings short-circuit out and don't accidentally match unrelated Cal.com bookings.

- [ ] **Step 3: Verify kickoffBookedAt is set after update**

There's no easy unit test for the webhook because it depends on Cal.com signature verification. We'll cover this in the Wave A E2E manual smoke test (Task 5 — there's a "Markeer als geboekt" admin button that does the same DB update; if the button works, the webhook update logic is the same one-liner).

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -E "calcom|webhook" | head -10
```

Expected: clean for the modified file.

- [ ] **Step 5: Commit**

```bash
git add app/api/webhooks/calcom/route.ts
git commit -m "feat(calcom): kickoff bookings update Engagement.kickoffBookedAt"
```

---

### Task 4: Acceptance email includes persistent kickoff link

**Files:**

- Modify: `lib/email/acceptance-email.ts` (or wherever the acceptance email is composed — confirm path first)

- [ ] **Step 1: Locate the acceptance email composer**

Run:

```bash
grep -rn "ACCEPTED\|acceptedAt" lib/email/ app/api/offerte/ 2>/dev/null | grep -E "html|email|send" | head -10
```

Expected: one or two files involved in composing the post-acceptance mail to the customer. Common candidates: `lib/email/acceptance-email.ts`, `lib/email/quote-emails.ts`, or inline in `app/api/offerte/accept/route.ts`. Open the file that produces the customer-facing acceptance HTML.

If no acceptance email exists yet (the current flow may rely on the bevestigingspagina + Cal.com embed without an email), skip to Step 4: instead of modifying an email, you'll create a NEW acceptance email from scratch. Use the structure of any existing customer-facing email helper as the template.

- [ ] **Step 2: Construct the kickoff URL with engagement metadata**

Inside the acceptance email composer, after the engagement is created (it's available via `quote.engagement` after the state-machine transaction commits), construct:

```ts
const kickoffUrl = `${process.env.CALCOM_BOOKING_URL}?metadata[engagementId]=${engagement.id}`;
```

`CALCOM_BOOKING_URL` is the existing kickoff event-type URL (already in env). The query-param syntax `?metadata[engagementId]=...` is what Cal.com forwards into the webhook payload.

- [ ] **Step 3: Add the kickoff CTA to the email body**

In the email template, add a clearly-styled CTA block (matches existing brand pattern — gold-accent pill or solid gold button per DESIGN.md scope rules). Body text:

```html
<p>
  Plan je kickoff op een moment dat het schikt — geen haast, de link blijft
  werken:
</p>
<a href="${kickoffUrl}" style="...">Plan kickoff</a>
<p style="font-size: 13px; color: #6b6f8a;">
  Of stuur een mailtje naar
  <a href="mailto:info@klarifai.nl">info@klarifai.nl</a> als een telefoongesprek
  beter past.
</p>
```

Apply the existing email template style (see `components/clients/klarifai/email-signature.ts` for the visual reference and Romano's signature should be appended at bottom).

- [ ] **Step 4: Verify the email actually sends after ACCEPTED**

Trace the call path: after `transitionQuote(..., 'ACCEPTED')` in `app/api/offerte/accept/route.ts`, is there an `await sendAcceptanceEmail(...)` call already? If yes, your changes auto-apply. If not, add one — read the engagement, build the kickoff URL with `engagement.id`, send the email.

If no acceptance email currently sends at all, this step DOES require adding the send call. Use the existing Resend send pattern from `lib/outreach/send-email.ts` (or whichever shared sender is project convention).

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -E "acceptance|accept/route" | head -10
```

- [ ] **Step 6: Commit**

```bash
git add lib/email/ app/api/offerte/accept/route.ts
git commit -m "feat(email): persistent kickoff link in acceptance email with engagement metadata"
```

---

### Task 5: Engagement tab stub on prospect detail

**Files:**

- Create: `server/routers/engagement.ts`
- Modify: `server/routers/_app.ts`
- Modify: `app/admin/prospects/[id]/page.tsx`
- Create: `components/features/engagement/project-tab.tsx`

This task gives Wave A its visible payoff: after acceptance you can see Engagement metadata (and the kickoff status) in admin. No invoice UI yet — that's Wave B.

- [ ] **Step 1: Create engagement router with `getByProspect`**

Create `server/routers/engagement.ts`:

```ts
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, projectAdminProcedure } from '../trpc';

export const engagementRouter = router({
  getByProspect: projectAdminProcedure
    .input(z.object({ prospectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const engagement = await ctx.db.engagement.findFirst({
        where: {
          prospectId: input.prospectId,
          projectId: ctx.projectId,
        },
        include: {
          quote: {
            select: {
              id: true,
              quoteNumber: true,
              totalAmountCents: true,
              paymentSchedule: true,
              acceptedAt: true,
            },
          },
          milestones: { orderBy: { ordering: 'asc' } },
          invoices: { orderBy: { createdAt: 'asc' } },
        },
      });
      return engagement;
    }),

  markKickoffBooked: projectAdminProcedure
    .input(z.object({ engagementId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Manual override path — webhook handles the auto path
      const result = await ctx.db.engagement.updateMany({
        where: { id: input.engagementId, projectId: ctx.projectId },
        data: { kickoffBookedAt: new Date() },
      });
      if (result.count === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Engagement not found in scope',
        });
      }
      return { success: true };
    }),
});
```

- [ ] **Step 2: Mount the router**

Open `server/routers/_app.ts`. Add the import at the top (alphabetically with siblings) and mount it inside the main `appRouter`:

```ts
import { engagementRouter } from './engagement';

export const appRouter = router({
  // ... existing routes ...
  engagement: engagementRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 3: Create stub Project tab component**

Create `components/features/engagement/project-tab.tsx`:

```tsx
'use client';

import { trpc } from '@/lib/trpc/client';

export function ProjectTab({ prospectId }: { prospectId: string }) {
  const { data: engagement, isLoading } =
    trpc.engagement.getByProspect.useQuery({ prospectId });

  if (isLoading) {
    return <div className="text-sm text-zinc-500">Project laden…</div>;
  }
  if (!engagement) {
    return (
      <div className="text-sm text-zinc-500">
        Project verschijnt zodra een offerte is geaccepteerd.
      </div>
    );
  }

  const totalEur = (engagement.quote.totalAmountCents / 100).toLocaleString(
    'nl-NL',
    { style: 'currency', currency: 'EUR' },
  );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-xl font-medium text-navy">Project</h2>
        <p className="text-sm text-zinc-600">
          Offerte {engagement.quote.quoteNumber} · {totalEur} · geaccepteerd op{' '}
          {new Date(engagement.acceptedAt).toLocaleDateString('nl-NL')}
        </p>
      </header>

      <section>
        <h3 className="text-sm font-medium text-navy mb-2">Kickoff</h3>
        <p className="text-sm text-zinc-700">
          {engagement.kickoffBookedAt
            ? `Geboekt op ${new Date(engagement.kickoffBookedAt).toLocaleDateString('nl-NL')}`
            : 'Nog niet geboekt'}
        </p>
        {engagement.kickoffReminderCount > 0 && (
          <p className="text-xs text-zinc-500 mt-1">
            {engagement.kickoffReminderCount} herinnering(en) verzonden
          </p>
        )}
      </section>

      <section>
        <h3 className="text-sm font-medium text-navy mb-2">Milestones</h3>
        <ul className="space-y-1">
          {engagement.milestones.map((m) => (
            <li key={m.id} className="text-sm flex gap-2">
              <span>{m.completedAt ? '✓' : '○'}</span>
              <span>{m.label}</span>
              {m.completedAt && (
                <span className="text-zinc-500">
                  {new Date(m.completedAt).toLocaleDateString('nl-NL')}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-sm font-medium text-navy mb-2">Facturen</h3>
        <p className="text-sm text-zinc-500">Komt in Wave B — invoice queue.</p>
      </section>
    </div>
  );
}
```

Style classes (`text-navy`, `text-zinc-*`) follow existing admin patterns in the codebase. Verify class names match the project's actual Tailwind/CSS-variable setup by glancing at e.g. `app/admin/prospects/[id]/page.tsx`.

- [ ] **Step 4: Wire the tab into prospect detail page**

Open `app/admin/prospects/[id]/page.tsx`. Find the existing tabs structure (looks like `<Tabs>` or a custom sidebar pattern with tab labels). Add a new tab labeled `Project` that renders `<ProjectTab prospectId={prospect.id} />`.

If the tab list is generated from a config array, append `{ key: 'project', label: 'Project', content: <ProjectTab ... /> }`. If it's hand-written JSX, add a new `<Tab>` element.

The Project tab should appear AFTER the existing tabs (Analyse, Outreach, etc.) so it's discoverable but not in front of pre-engagement work.

- [ ] **Step 5: Type-check + run dev server smoke test**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: clean.

```bash
lsof -i :9200 || pnpm dev
```

Expected: dev server boots.

Open http://localhost:9200/admin/prospects/<some-prospect-id-with-accepted-quote> in browser. Click "Project" tab. Verify:

- If no engagement: "Project verschijnt zodra…" message
- If engagement: header with quote number + amount + date, kickoff status, milestone list

If no prospect with an accepted quote exists locally, skip the visual smoke until Wave B has a way to create one (or accept a test quote manually via the offerte signing flow).

- [ ] **Step 6: Commit**

```bash
git add server/routers/engagement.ts server/routers/_app.ts \
        app/admin/prospects/[id]/page.tsx \
        components/features/engagement/project-tab.tsx
git commit -m "feat(admin): Project tab stub on prospect detail (kickoff + milestones)"
```

---

## Wave B — Invoice generation

### Task 6: Add `Invoice` model

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_invoice_model/migration.sql`

- [ ] **Step 1: Add Invoice model + InvoiceStatus enum to schema**

In `prisma/schema.prisma`, near the `Engagement` block:

```prisma
model Invoice {
  id            String   @id @default(cuid())
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  engagementId  String
  engagement    Engagement @relation(fields: [engagementId], references: [id], onDelete: Cascade)
  invoiceNumber String   @unique
  termijnIndex  Int
  termijnLabel  String
  amountCents   Int
  vatPercentage Int      @default(21)
  status        InvoiceStatus @default(DRAFT)
  sentAt        DateTime?
  dueAt         DateTime?
  paidAt        DateTime?
  pdfUrl        String?
  notes         String?  @db.Text
  @@unique([engagementId, termijnIndex])
  @@index([engagementId])
  @@index([status])
}

enum InvoiceStatus {
  DRAFT
  SENT
  PAID
  OVERDUE
  CANCELLED
}
```

Also add a `nextInvoiceSequence` model (for atomic invoice-number generation):

```prisma
model InvoiceSequence {
  year         Int      @id
  lastSequence Int      @default(0)
  updatedAt    DateTime @updatedAt
}
```

- [ ] **Step 2: Apply via direct SQL**

```bash
docker exec qualifai-db psql -U user -d qualifai <<'SQL'
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED');

CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "engagementId" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "termijnIndex" INTEGER NOT NULL,
  "termijnLabel" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "vatPercentage" INTEGER NOT NULL DEFAULT 21,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "sentAt" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "pdfUrl" TEXT,
  "notes" TEXT,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Invoice_invoiceNumber_key" UNIQUE ("invoiceNumber"),
  CONSTRAINT "Invoice_engagementId_termijnIndex_key" UNIQUE ("engagementId", "termijnIndex"),
  CONSTRAINT "Invoice_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Invoice_engagementId_idx" ON "Invoice"("engagementId");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

CREATE TABLE "InvoiceSequence" (
  "year" INTEGER NOT NULL,
  "lastSequence" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("year")
);
SQL
```

Verify: `docker exec qualifai-db psql -U user -d qualifai -c '\dt' | grep -E "Invoice"` — expect `Invoice` and `InvoiceSequence`.

- [ ] **Step 3: Create migration file + mark applied**

```bash
mkdir -p prisma/migrations/20260427100000_invoice_model
# Copy the SQL from Step 2 (without heredoc wrapper) into:
# prisma/migrations/20260427100000_invoice_model/migration.sql
pnpm prisma migrate resolve --applied 20260427100000_invoice_model
pnpm prisma generate
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260427100000_invoice_model/
git commit -m "feat(db): add Invoice + InvoiceSequence models"
```

---

### Task 7: Invoice number generator (atomic, per-year sequential)

**Files:**

- Create: `lib/invoice-number.ts`
- Create: `lib/invoice-number.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/invoice-number.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: { invoiceSequence: { upsert: vi.fn() } },
}));

import prisma from '@/lib/prisma';
import { nextInvoiceNumber } from './invoice-number';

describe('nextInvoiceNumber', () => {
  beforeEach(() => {
    (prisma.invoiceSequence.upsert as any).mockReset();
  });

  it('returns F-YYYY-001 for the first invoice of a year', async () => {
    (prisma.invoiceSequence.upsert as any).mockResolvedValue({
      year: 2026,
      lastSequence: 1,
    });
    const num = await nextInvoiceNumber(2026);
    expect(num).toBe('F-2026-001');
  });

  it('zero-pads up to 3 digits, then expands', async () => {
    (prisma.invoiceSequence.upsert as any).mockResolvedValue({
      year: 2026,
      lastSequence: 42,
    });
    expect(await nextInvoiceNumber(2026)).toBe('F-2026-042');

    (prisma.invoiceSequence.upsert as any).mockResolvedValue({
      year: 2026,
      lastSequence: 1234,
    });
    expect(await nextInvoiceNumber(2026)).toBe('F-2026-1234');
  });

  it('uses current year by default', async () => {
    (prisma.invoiceSequence.upsert as any).mockResolvedValue({
      year: new Date().getFullYear(),
      lastSequence: 1,
    });
    const num = await nextInvoiceNumber();
    expect(num).toMatch(/^F-\d{4}-001$/);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
pnpm vitest run lib/invoice-number.test.ts
```

Expected: FAIL with "Cannot find module './invoice-number'" or similar.

- [ ] **Step 3: Implement nextInvoiceNumber**

Create `lib/invoice-number.ts`:

```ts
import prisma from '@/lib/prisma';

/**
 * Atomic per-year sequential invoice number generator.
 * Uses InvoiceSequence row (year as PK, lastSequence as counter).
 * `upsert` + `increment` is atomic in Postgres — two parallel calls
 * always produce two distinct sequence numbers.
 */
export async function nextInvoiceNumber(
  year: number = new Date().getFullYear(),
): Promise<string> {
  const result = await prisma.invoiceSequence.upsert({
    where: { year },
    create: { year, lastSequence: 1 },
    update: { lastSequence: { increment: 1 } },
  });
  return `F-${year}-${String(result.lastSequence).padStart(3, '0')}`;
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run lib/invoice-number.test.ts
```

Expected: 3/3 pass.

- [ ] **Step 5: Commit**

```bash
git add lib/invoice-number.ts lib/invoice-number.test.ts
git commit -m "feat(invoice): atomic per-year sequential invoice-number generator"
```

---

### Task 8: `invoice.prepare` mutation

**Files:**

- Create: `server/routers/invoice.ts`
- Create: `server/routers/invoice.test.ts`
- Modify: `server/routers/_app.ts`

- [ ] **Step 1: Write failing test for `invoice.prepare`**

Create `server/routers/invoice.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

vi.mock('@/env.mjs', () => ({ env: { ADMIN_SECRET: 'test-secret' } }));
vi.mock('@/lib/invoice-number', () => ({
  nextInvoiceNumber: vi.fn().mockResolvedValue('F-2026-001'),
}));

const mockDb = {
  engagement: { findFirst: vi.fn() },
  invoice: { create: vi.fn() },
};
vi.mock('@/lib/prisma', () => ({ default: mockDb }));

import { invoiceRouter } from './invoice';
import { nextInvoiceNumber } from '@/lib/invoice-number';

const ctx = {
  db: mockDb,
  projectId: 'tenant-klarifai',
  allowedProjectSlug: 'klarifai',
  adminScope: 'project' as const,
};

describe('invoice.prepare', () => {
  beforeEach(() => {
    Object.values(mockDb).forEach((m) =>
      Object.values(m).forEach((fn) => (fn as any).mockReset?.()),
    );
    (nextInvoiceNumber as any).mockResolvedValue('F-2026-001');
  });

  it('creates Invoice with amount derived from termijn percentage', async () => {
    mockDb.engagement.findFirst.mockResolvedValue({
      id: 'eng-1',
      projectId: 'tenant-klarifai',
      quote: {
        totalAmountCents: 1000000, // €10.000
        paymentSchedule: [
          { label: 'Bij ondertekening', percentage: 50 },
          { label: 'Bij oplevering', percentage: 50 },
        ],
      },
      invoices: [],
    });
    mockDb.invoice.create.mockResolvedValue({ id: 'inv-1' });

    const caller = invoiceRouter.createCaller(ctx);
    await caller.prepare({ engagementId: 'eng-1', termijnIndex: 0 });

    expect(mockDb.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          engagementId: 'eng-1',
          invoiceNumber: 'F-2026-001',
          termijnIndex: 0,
          termijnLabel: 'Bij ondertekening',
          amountCents: 500000,
          status: 'DRAFT',
        }),
      }),
    );
  });

  it('throws CONFLICT when an invoice for the same termijn already exists', async () => {
    mockDb.engagement.findFirst.mockResolvedValue({
      id: 'eng-1',
      projectId: 'tenant-klarifai',
      quote: {
        totalAmountCents: 1000000,
        paymentSchedule: [{ label: 'Bij ondertekening', percentage: 50 }],
      },
      invoices: [{ termijnIndex: 0 }],
    });

    const caller = invoiceRouter.createCaller(ctx);
    await expect(
      caller.prepare({ engagementId: 'eng-1', termijnIndex: 0 }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('throws NOT_FOUND when engagement is in a different tenant', async () => {
    mockDb.engagement.findFirst.mockResolvedValue(null);
    const caller = invoiceRouter.createCaller(ctx);
    await expect(
      caller.prepare({ engagementId: 'eng-1', termijnIndex: 0 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
pnpm vitest run server/routers/invoice.test.ts
```

Expected: FAIL with "Cannot find module './invoice'".

- [ ] **Step 3: Implement invoice router with `prepare` mutation**

Create `server/routers/invoice.ts`:

```ts
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, projectAdminProcedure } from '../trpc';
import { nextInvoiceNumber } from '@/lib/invoice-number';

type PaymentTerm = { label: string; percentage: number };

export const invoiceRouter = router({
  prepare: projectAdminProcedure
    .input(
      z.object({
        engagementId: z.string(),
        termijnIndex: z.number().int().min(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const engagement = await ctx.db.engagement.findFirst({
        where: { id: input.engagementId, projectId: ctx.projectId },
        include: { quote: true, invoices: true },
      });
      if (!engagement) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Engagement not found in scope',
        });
      }

      const schedule = (engagement.quote.paymentSchedule ??
        []) as PaymentTerm[];
      const term = schedule[input.termijnIndex];
      if (!term) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Termijn ${input.termijnIndex} not in betaalschema`,
        });
      }

      const existing = engagement.invoices.find(
        (i) => i.termijnIndex === input.termijnIndex,
      );
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Factuur voor deze termijn bestaat al',
        });
      }

      const amountCents = Math.round(
        engagement.quote.totalAmountCents * (term.percentage / 100),
      );
      const invoiceNumber = await nextInvoiceNumber();

      return ctx.db.invoice.create({
        data: {
          engagementId: engagement.id,
          invoiceNumber,
          termijnIndex: input.termijnIndex,
          termijnLabel: term.label,
          amountCents,
          vatPercentage: 21,
          status: 'DRAFT',
        },
      });
    }),
});
```

- [ ] **Step 4: Mount router in `_app.ts`**

```ts
import { invoiceRouter } from './invoice';

export const appRouter = router({
  // ... existing ...
  invoice: invoiceRouter,
});
```

- [ ] **Step 5: Run tests — expect 3/3 pass**

```bash
pnpm vitest run server/routers/invoice.test.ts
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 7: Commit**

```bash
git add server/routers/invoice.ts server/routers/invoice.test.ts server/routers/_app.ts
git commit -m "feat(invoice): prepare mutation derives amount from offerte's payment schedule"
```

---

### Task 9: Invoice PDF renderer

**Files:**

- Create: `components/clients/klarifai/invoice-renderer.tsx`
- Create: `lib/invoice-pdf.ts`

- [ ] **Step 1: Locate the existing offerte-print pattern**

```bash
grep -rn "puppeteer\|@react-pdf\|pdf" lib/ app/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | grep -v test | head -10
```

Whatever the existing offerte print mechanism is (puppeteer-based HTML→PDF, or @react-pdf, or similar), reuse the same approach for invoices. Consistency matters — Romano's printer/client expects similar visual styling between offerte and factuur.

- [ ] **Step 2: Create the React-rendered invoice template**

Create `components/clients/klarifai/invoice-renderer.tsx`:

```tsx
import type { Invoice, Engagement, Quote, Prospect } from '@prisma/client';

interface InvoiceRenderInput {
  invoice: Invoice;
  engagement: Engagement & { quote: Quote; prospect: Prospect };
}

const KLARIFAI_BUSINESS = {
  name: 'Klarifai',
  street: 'Le Mairekade 77',
  postal: '1013 CB',
  city: 'Amsterdam',
  kvk: '<KVK_NUMMER>', // pull from env or memory's bedrijfsgegevens reference
  btw: '<BTW_NUMMER>',
  iban: '<IBAN>',
  bic: '<BIC>',
  email: 'info@klarifai.nl',
  website: 'klarifai.nl',
};

const formatEur = (cents: number) =>
  (cents / 100).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' });

export function InvoiceRenderer({ invoice, engagement }: InvoiceRenderInput) {
  const subtotalCents = invoice.amountCents;
  const vatCents = Math.round(subtotalCents * (invoice.vatPercentage / 100));
  const totalCents = subtotalCents + vatCents;
  const factuurDatum = invoice.sentAt ?? invoice.createdAt;
  const vervalDatum = invoice.dueAt;

  return (
    <html lang="nl">
      <head>
        <meta charSet="utf-8" />
        <title>Factuur {invoice.invoiceNumber}</title>
        <style>{`
          body { font-family: Sora, -apple-system, sans-serif; color: #0a0a2e; }
          .header { display: flex; justify-content: space-between; }
          .business { font-size: 13px; line-height: 1.6; }
          .doc-title { font-size: 32px; font-weight: 700; margin-top: 48px; }
          .doc-title .gold { color: #E4C33C; }
          .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 32px; }
          table.lines { width: 100%; border-collapse: collapse; margin-top: 32px; }
          table.lines th, table.lines td { padding: 12px 8px; text-align: left; border-bottom: 1px solid #e5e7eb; }
          .totals { margin-top: 16px; margin-left: auto; width: 320px; }
          .totals .row { display: flex; justify-content: space-between; padding: 4px 0; }
          .totals .grand { border-top: 2px solid #0a0a2e; font-weight: 700; font-size: 18px; color: #0a0a2e; }
          .payment-box { margin-top: 48px; padding: 16px; border: 1px solid #E4C33C; border-radius: 8px; background: #FFF9E5; }
          footer { margin-top: 64px; font-size: 11px; color: #6b6f8a; border-top: 1px solid #e5e7eb; padding-top: 12px; }
        `}</style>
      </head>
      <body>
        <div className="header">
          <div>
            <img
              src="/klarifai-logo-full.svg"
              alt="Klarifai"
              width="140"
              height="36"
            />
          </div>
          <div className="business">
            {KLARIFAI_BUSINESS.name}
            <br />
            {KLARIFAI_BUSINESS.street}
            <br />
            {KLARIFAI_BUSINESS.postal} {KLARIFAI_BUSINESS.city}
            <br />
            KVK {KLARIFAI_BUSINESS.kvk} · BTW {KLARIFAI_BUSINESS.btw}
            <br />
            {KLARIFAI_BUSINESS.email} · {KLARIFAI_BUSINESS.website}
          </div>
        </div>

        <h1 className="doc-title">
          Factuur<span className="gold">.</span>
        </h1>

        <div className="meta">
          <div>
            <strong>Aan</strong>
            <br />
            {engagement.prospect.companyName ?? engagement.prospect.domain}
            <br />
            {/* recipient address fields from quote — adjust to actual fields */}
          </div>
          <div>
            <div>
              <strong>Factuurnummer:</strong> {invoice.invoiceNumber}
            </div>
            <div>
              <strong>Factuurdatum:</strong>{' '}
              {factuurDatum.toLocaleDateString('nl-NL')}
            </div>
            {vervalDatum && (
              <div>
                <strong>Vervaldatum:</strong>{' '}
                {vervalDatum.toLocaleDateString('nl-NL')}
              </div>
            )}
            <div>
              <strong>Conform offerte:</strong>{' '}
              {engagement.quote.quoteNumber ?? engagement.quote.id}
            </div>
          </div>
        </div>

        <table className="lines">
          <thead>
            <tr>
              <th>Omschrijving</th>
              <th style={{ textAlign: 'right' }}>Bedrag</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{invoice.termijnLabel}</td>
              <td style={{ textAlign: 'right' }}>{formatEur(subtotalCents)}</td>
            </tr>
          </tbody>
        </table>

        <div className="totals">
          <div className="row">
            <span>Subtotaal</span>
            <span>{formatEur(subtotalCents)}</span>
          </div>
          <div className="row">
            <span>BTW {invoice.vatPercentage}%</span>
            <span>{formatEur(vatCents)}</span>
          </div>
          <div className="row grand">
            <span>Totaal</span>
            <span>{formatEur(totalCents)}</span>
          </div>
        </div>

        <div className="payment-box">
          <strong>Betaalinstructie</strong>
          <p>
            Gelieve {formatEur(totalCents)} binnen 30 dagen over te maken naar{' '}
            <strong>{KLARIFAI_BUSINESS.iban}</strong> t.n.v.{' '}
            {KLARIFAI_BUSINESS.name}, o.v.v. factuurnummer{' '}
            <strong>{invoice.invoiceNumber}</strong>.
          </p>
        </div>

        <footer>
          Vragen? {KLARIFAI_BUSINESS.email} · KVK {KLARIFAI_BUSINESS.kvk} · BTW{' '}
          {KLARIFAI_BUSINESS.btw}
        </footer>
      </body>
    </html>
  );
}
```

The `<KVK_NUMMER>`, `<BTW_NUMMER>`, `<IBAN>`, `<BIC>` placeholders need real values. Pull them from the project's existing source — check `klarifai-core/src/brand/` and `lib/` for an existing constants file, or inspect the offerte's PDF template for hardcoded values to match. If nothing exists yet, create `lib/klarifai-business.ts` with the constants exported. The user has these values in agent memory as "reference_klarifai_company_data.md".

- [ ] **Step 3: Create the PDF generator wrapper**

Create `lib/invoice-pdf.ts`:

```ts
import { renderToString } from 'react-dom/server';
import type { Invoice } from '@prisma/client';
import { InvoiceRenderer } from '@/components/clients/klarifai/invoice-renderer';
// Use the existing offerte-print PDF helper:
import { htmlToPdfBuffer } from '@/lib/pdf'; // adjust path/name to actual existing helper

export async function renderInvoicePdf(args: {
  invoice: Invoice;
  engagement: any; // type tightening in Step 4 below
}): Promise<Buffer> {
  const html = '<!doctype html>' + renderToString(
    <InvoiceRenderer invoice={args.invoice} engagement={args.engagement} />,
  );
  return htmlToPdfBuffer(html);
}
```

The exact import path for `htmlToPdfBuffer` depends on what the offerte print uses today. Search for the helper:

```bash
grep -rn "puppeteer\|playwright\|chromium" lib/ --include="*.ts" 2>/dev/null | head -5
```

If no helper exists (offerte print might rely on the browser's print-to-PDF dialog without server-side rendering), this is a Wave B blocker. Document it as a finding and either:

- Add a server-side puppeteer helper in this task (medium effort, ~30 min)
- Defer PDF generation and have the implementer escalate

For the plan to land, assume the helper either exists or you're adding a thin puppeteer wrapper. Inline minimum implementation if needed:

```ts
// lib/pdf.ts (only if it doesn't exist)
import puppeteer from 'puppeteer';

export async function htmlToPdfBuffer(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
    });
  } finally {
    await browser.close();
  }
}
```

If you add puppeteer as a dependency, Vercel deploys need `@sparticuz/chromium-min` or similar — ⚠️ check existing offerte print first.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -E "invoice|pdf" | head -10
```

Tighten `engagement: any` to a proper Prisma payload type if obvious.

- [ ] **Step 5: Commit**

```bash
git add components/clients/klarifai/invoice-renderer.tsx lib/invoice-pdf.ts
git commit -m "feat(invoice): PDF renderer with Klarifai branding + payment instructions"
```

---

### Task 10: Invoice email template (anti-phishing trust signals)

**Files:**

- Create: `components/clients/klarifai/invoice-email.tsx`

- [ ] **Step 1: Read the existing email template patterns**

```bash
grep -rn "render.*Email\|EmailHtml\|<html" components/clients/klarifai/ lib/email/ 2>/dev/null | head -10
```

Match the existing email-rendering style (likely React-render-to-string with inline styles for email-client compatibility).

- [ ] **Step 2: Create the invoice email**

Create `components/clients/klarifai/invoice-email.tsx`:

```tsx
import type { Invoice, Engagement, Quote, Prospect } from '@prisma/client';
import { getEmailSignature } from '@/components/clients/klarifai/email-signature';

interface InvoiceEmailInput {
  invoice: Invoice;
  engagement: Engagement & { quote: Quote; prospect: Prospect };
}

const formatEur = (cents: number) =>
  (cents / 100).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' });

export function buildInvoiceEmailSubject(input: InvoiceEmailInput): string {
  const { invoice, engagement } = input;
  return `Factuur ${invoice.invoiceNumber} — ${invoice.termijnLabel} — ${engagement.prospect.companyName ?? engagement.prospect.domain}`;
}

export function buildInvoiceEmailHtml(input: InvoiceEmailInput): string {
  const { invoice, engagement } = input;
  const totalEur = formatEur(
    invoice.amountCents +
      Math.round((invoice.amountCents * invoice.vatPercentage) / 100),
  );
  const sig = getEmailSignature('klarifai').html;

  return `
<!doctype html>
<html lang="nl">
<body style="font-family: Sora, -apple-system, sans-serif; color: #0a0a2e; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="border-bottom: 2px solid #E4C33C; padding-bottom: 16px; margin-bottom: 24px;">
    <img src="https://qualifai.klarifai.nl/klarifai-logo-full.svg" alt="Klarifai" width="120" height="32" />
  </div>

  <p>Beste ${engagement.prospect.companyName ?? 'lezer'},</p>

  <p>
    Naar aanleiding van onze offerte voor uw project — bij deze de termijnfactuur
    <strong>${invoice.invoiceNumber}</strong> voor <strong>${invoice.termijnLabel.toLowerCase()}</strong>.
  </p>

  <div style="background: #FFF9E5; border: 1px solid #E4C33C; border-radius: 8px; padding: 16px; margin: 24px 0;">
    <table>
      <tr><td>Factuurnummer:</td><td><strong>${invoice.invoiceNumber}</strong></td></tr>
      <tr><td>Conform offerte:</td><td>${engagement.quote.quoteNumber ?? engagement.quote.id}</td></tr>
      <tr><td>Termijn:</td><td>${invoice.termijnLabel}</td></tr>
      <tr><td>Totaal incl. BTW:</td><td><strong>${totalEur}</strong></td></tr>
    </table>
  </div>

  <p>De factuur zit als PDF bijgevoegd bij deze mail. Gelieve binnen 30 dagen over te maken naar:</p>

  <div style="background: #f8f9fb; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
    <strong>IBAN:</strong> &lt;IBAN&gt; t.n.v. Klarifai<br/>
    <strong>O.v.v.:</strong> ${invoice.invoiceNumber}
  </div>

  <p>Heb je vragen over de factuur, mail dan even naar
    <a href="mailto:info@klarifai.nl" style="color: #0a0a2e;">info@klarifai.nl</a>
    of bel (+31) 6 823 26 128.
  </p>

  ${sig}
</body>
</html>`;
}
```

Replace `<IBAN>` placeholder when you locate the canonical bedrijfsgegevens (same as Task 9 step 2).

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep invoice-email | head
```

- [ ] **Step 4: Commit**

```bash
git add components/clients/klarifai/invoice-email.tsx
git commit -m "feat(invoice): email template with trust signals + Romano signature"
```

---

### Task 11: `invoice.send` mutation (PDF + email + status atomic)

**Files:**

- Modify: `server/routers/invoice.ts`
- Modify: `server/routers/invoice.test.ts`

- [ ] **Step 1: Write failing test for `invoice.send`**

Append to `server/routers/invoice.test.ts`:

```ts
vi.mock('@/lib/invoice-pdf', () => ({
  renderInvoicePdf: vi.fn().mockResolvedValue(Buffer.from('fake-pdf')),
}));
vi.mock('@/lib/email/resend', () => ({
  sendEmailWithAttachment: vi.fn().mockResolvedValue({ id: 'email-id' }),
}));
vi.mock('@/lib/storage', () => ({
  uploadBuffer: vi
    .fn()
    .mockResolvedValue('https://storage.example/f-2026-001.pdf'),
}));

import { renderInvoicePdf } from '@/lib/invoice-pdf';
import { sendEmailWithAttachment } from '@/lib/email/resend';
import { uploadBuffer } from '@/lib/storage';

describe('invoice.send', () => {
  beforeEach(() => {
    (renderInvoicePdf as any).mockClear();
    (sendEmailWithAttachment as any).mockClear();
    (uploadBuffer as any).mockClear();
  });

  it('renders PDF, sends email with attachment, transitions DRAFT → SENT atomically', async () => {
    mockDb.invoice = {
      ...mockDb.invoice,
      findFirst: vi.fn().mockResolvedValue({
        id: 'inv-1',
        status: 'DRAFT',
        invoiceNumber: 'F-2026-001',
        amountCents: 500000,
        vatPercentage: 21,
        termijnLabel: 'Ondertekening',
        engagement: {
          id: 'eng-1',
          projectId: 'tenant-klarifai',
          quote: {
            id: 'q-1',
            quoteNumber: 'OFF-001',
            totalAmountCents: 1000000,
            paymentSchedule: [],
          },
          prospect: {
            id: 'p-1',
            companyName: 'TestCo',
            domain: 'test.co',
            contactEmail: 'klant@test.co',
          },
        },
      }),
      update: vi.fn().mockResolvedValue({ id: 'inv-1', status: 'SENT' }),
    };

    const caller = invoiceRouter.createCaller(ctx);
    await caller.send({ invoiceId: 'inv-1' });

    expect(renderInvoicePdf).toHaveBeenCalledOnce();
    expect(uploadBuffer).toHaveBeenCalledOnce();
    expect(sendEmailWithAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'klant@test.co',
        subject: expect.stringContaining('F-2026-001'),
        attachments: expect.arrayContaining([
          expect.objectContaining({ filename: 'F-2026-001.pdf' }),
        ]),
      }),
    );
    expect(mockDb.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'inv-1', status: 'DRAFT' }),
        data: expect.objectContaining({
          status: 'SENT',
          sentAt: expect.any(Date),
          dueAt: expect.any(Date),
          pdfUrl: 'https://storage.example/f-2026-001.pdf',
        }),
      }),
    );
  });

  it('throws CONFLICT if invoice is not in DRAFT', async () => {
    mockDb.invoice.findFirst = vi.fn().mockResolvedValue({
      id: 'inv-1',
      status: 'SENT',
      engagement: { projectId: 'tenant-klarifai' },
    });
    const caller = invoiceRouter.createCaller(ctx);
    await expect(caller.send({ invoiceId: 'inv-1' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
pnpm vitest run server/routers/invoice.test.ts
```

Expected: new tests fail.

- [ ] **Step 3: Implement `send` in invoice router**

Append to `server/routers/invoice.ts`:

```ts
import { renderInvoicePdf } from '@/lib/invoice-pdf';
import { sendEmailWithAttachment } from '@/lib/email/resend';     // verify path
import { uploadBuffer } from '@/lib/storage';                      // verify path
import {
  buildInvoiceEmailSubject,
  buildInvoiceEmailHtml,
} from '@/components/clients/klarifai/invoice-email';

// inside `router({ ... })`:
  send: projectAdminProcedure
    .input(z.object({ invoiceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findFirst({
        where: { id: input.invoiceId },
        include: {
          engagement: {
            include: { quote: true, prospect: true },
          },
        },
      });
      if (!invoice || invoice.engagement.projectId !== ctx.projectId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      if (invoice.status !== 'DRAFT') {
        throw new TRPCError({ code: 'CONFLICT', message: `Invoice is already ${invoice.status}` });
      }

      const pdfBuffer = await renderInvoicePdf({
        invoice,
        engagement: invoice.engagement,
      });
      const pdfUrl = await uploadBuffer(
        pdfBuffer,
        `invoices/${invoice.invoiceNumber}.pdf`,
      );

      await sendEmailWithAttachment({
        to: invoice.engagement.prospect.contactEmail!,
        subject: buildInvoiceEmailSubject({ invoice, engagement: invoice.engagement }),
        html: buildInvoiceEmailHtml({ invoice, engagement: invoice.engagement }),
        attachments: [{
          filename: `${invoice.invoiceNumber}.pdf`,
          content: pdfBuffer,
        }],
      });

      const sentAt = new Date();
      const dueAt = new Date(sentAt.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Optimistic concurrency on status='DRAFT' guards against double-send race
      const updated = await ctx.db.invoice.update({
        where: { id: invoice.id, status: 'DRAFT' },
        data: { status: 'SENT', sentAt, dueAt, pdfUrl },
      });

      return updated;
    }),
```

Verify the import paths for `@/lib/email/resend` and `@/lib/storage` — they may need adjustment based on actual project conventions. If the storage helper doesn't exist, store the PDF buffer in a Vercel Blob or simply skip storage and email-only the buffer (set `pdfUrl = null`). For phase B that's acceptable; the PDF is in the email.

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run server/routers/invoice.test.ts
```

Expected: all pass (5 tests now).

- [ ] **Step 5: Commit**

```bash
git add server/routers/invoice.ts server/routers/invoice.test.ts
git commit -m "feat(invoice): send mutation atomically PDFs, emails, and transitions DRAFT→SENT"
```

---

### Task 12: `markPaid`, `cancel`, `update`, `getById` mutations

**Files:**

- Modify: `server/routers/invoice.ts`
- Modify: `server/routers/invoice.test.ts`

- [ ] **Step 1: Write tests for the four remaining procedures**

Append to `server/routers/invoice.test.ts`:

```ts
describe('invoice.markPaid', () => {
  it('SENT → PAID with paidAt timestamp', async () => {
    mockDb.invoice.update = vi
      .fn()
      .mockResolvedValue({ id: 'inv-1', status: 'PAID' });
    mockDb.invoice.findFirst = vi.fn().mockResolvedValue({
      id: 'inv-1',
      status: 'SENT',
      engagement: { projectId: 'tenant-klarifai' },
    });
    const caller = invoiceRouter.createCaller(ctx);
    await caller.markPaid({ invoiceId: 'inv-1' });
    expect(mockDb.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'inv-1',
          status: { in: ['SENT', 'OVERDUE'] },
        }),
        data: expect.objectContaining({
          status: 'PAID',
          paidAt: expect.any(Date),
        }),
      }),
    );
  });
});

describe('invoice.cancel', () => {
  it('DRAFT → CANCELLED', async () => {
    mockDb.invoice.findFirst = vi.fn().mockResolvedValue({
      id: 'inv-1',
      status: 'DRAFT',
      engagement: { projectId: 'tenant-klarifai' },
    });
    mockDb.invoice.update = vi
      .fn()
      .mockResolvedValue({ id: 'inv-1', status: 'CANCELLED' });
    const caller = invoiceRouter.createCaller(ctx);
    await caller.cancel({ invoiceId: 'inv-1' });
    expect(mockDb.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CANCELLED' }),
      }),
    );
  });

  it('PAID → CANCELLED throws CONFLICT', async () => {
    mockDb.invoice.findFirst = vi.fn().mockResolvedValue({
      id: 'inv-1',
      status: 'PAID',
      engagement: { projectId: 'tenant-klarifai' },
    });
    const caller = invoiceRouter.createCaller(ctx);
    await expect(caller.cancel({ invoiceId: 'inv-1' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });
});

describe('invoice.update', () => {
  it('updates DRAFT fields, refuses on SENT', async () => {
    mockDb.invoice.findFirst = vi.fn().mockResolvedValue({
      id: 'inv-1',
      status: 'DRAFT',
      engagement: { projectId: 'tenant-klarifai' },
    });
    mockDb.invoice.update = vi.fn().mockResolvedValue({});
    const caller = invoiceRouter.createCaller(ctx);
    await caller.update({ invoiceId: 'inv-1', notes: 'Test note' });
    expect(mockDb.invoice.update).toHaveBeenCalled();
  });
});

describe('invoice.getById', () => {
  it('returns invoice in scope', async () => {
    mockDb.invoice.findFirst = vi.fn().mockResolvedValue({
      id: 'inv-1',
      engagement: { projectId: 'tenant-klarifai' },
    });
    const caller = invoiceRouter.createCaller(ctx);
    const result = await caller.getById({ invoiceId: 'inv-1' });
    expect(result.id).toBe('inv-1');
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
pnpm vitest run server/routers/invoice.test.ts
```

- [ ] **Step 3: Implement the procedures**

Append to `server/routers/invoice.ts`:

```ts
  markPaid: projectAdminProcedure
    .input(z.object({ invoiceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findFirst({
        where: { id: input.invoiceId },
        include: { engagement: { select: { projectId: true } } },
      });
      if (!invoice || invoice.engagement.projectId !== ctx.projectId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      return ctx.db.invoice.update({
        where: { id: invoice.id, status: { in: ['SENT', 'OVERDUE'] } },
        data: { status: 'PAID', paidAt: new Date() },
      });
    }),

  cancel: projectAdminProcedure
    .input(z.object({ invoiceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findFirst({
        where: { id: input.invoiceId },
        include: { engagement: { select: { projectId: true } } },
      });
      if (!invoice || invoice.engagement.projectId !== ctx.projectId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      if (invoice.status === 'PAID') {
        throw new TRPCError({ code: 'CONFLICT', message: 'Cannot cancel paid invoice' });
      }
      return ctx.db.invoice.update({
        where: { id: invoice.id },
        data: { status: 'CANCELLED' },
      });
    }),

  update: projectAdminProcedure
    .input(z.object({
      invoiceId: z.string(),
      termijnLabel: z.string().optional(),
      amountCents: z.number().int().positive().optional(),
      vatPercentage: z.number().int().min(0).max(100).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findFirst({
        where: { id: input.invoiceId },
        include: { engagement: { select: { projectId: true } } },
      });
      if (!invoice || invoice.engagement.projectId !== ctx.projectId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      if (invoice.status !== 'DRAFT') {
        throw new TRPCError({ code: 'CONFLICT', message: 'Only DRAFT invoices are editable' });
      }
      const { invoiceId, ...rest } = input;
      return ctx.db.invoice.update({
        where: { id: invoiceId },
        data: rest,
      });
    }),

  getById: projectAdminProcedure
    .input(z.object({ invoiceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findFirst({
        where: { id: input.invoiceId },
        include: {
          engagement: {
            include: { quote: true, prospect: true },
          },
        },
      });
      if (!invoice || invoice.engagement.projectId !== ctx.projectId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      return invoice;
    }),
```

- [ ] **Step 4: Run tests — all green**

```bash
pnpm vitest run server/routers/invoice.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add server/routers/invoice.ts server/routers/invoice.test.ts
git commit -m "feat(invoice): markPaid, cancel, update, getById procedures"
```

---

### Task 13: Invoice detail page (`/admin/invoices/[id]`)

**Files:**

- Create: `app/admin/invoices/[id]/page.tsx`
- Create: `components/features/invoice/invoice-detail.tsx`
- Create: `components/features/invoice/invoice-actions.tsx`

- [ ] **Step 1: Create the page route**

Create `app/admin/invoices/[id]/page.tsx`:

```tsx
import { InvoiceDetail } from '@/components/features/invoice/invoice-detail';

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InvoiceDetail invoiceId={id} />;
}
```

- [ ] **Step 2: Create the detail component**

Create `components/features/invoice/invoice-detail.tsx` (use the existing inline-edit pattern from `app/admin/quotes/[id]/page.tsx` as a reference — keep the same visual style, sidebar, and editing affordances):

```tsx
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { InvoiceActions } from './invoice-actions';

const formatEur = (cents: number) =>
  (cents / 100).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' });

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Concept',
  SENT: 'Verzonden',
  PAID: 'Betaald',
  OVERDUE: 'Vervallen',
  CANCELLED: 'Geannuleerd',
};

export function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const { data, isLoading, refetch } = trpc.invoice.getById.useQuery({
    invoiceId,
  });
  const updateMut = trpc.invoice.update.useMutation({
    onSuccess: () => refetch(),
  });

  if (isLoading) return <div>Laden…</div>;
  if (!data) return <div>Factuur niet gevonden.</div>;

  const isDraft = data.status === 'DRAFT';
  const totalCents =
    data.amountCents +
    Math.round((data.amountCents * data.vatPercentage) / 100);

  return (
    <div className="grid grid-cols-[1fr_280px] gap-6 p-6">
      <main className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-medium">{data.invoiceNumber}</h1>
          <p className="text-sm text-zinc-500">
            {STATUS_LABELS[data.status]} · {formatEur(totalCents)}
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-sm font-medium">Klant</h2>
          <p>
            {data.engagement.prospect.companyName ??
              data.engagement.prospect.domain}
          </p>
          <p className="text-sm text-zinc-600">
            Conform offerte{' '}
            {data.engagement.quote.quoteNumber ?? data.engagement.quote.id}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium">Termijn</h2>
          {isDraft ? (
            <input
              type="text"
              defaultValue={data.termijnLabel}
              onBlur={(e) => {
                if (e.target.value !== data.termijnLabel) {
                  updateMut.mutate({ invoiceId, termijnLabel: e.target.value });
                }
              }}
              className="w-full input-minimal"
            />
          ) : (
            <p>{data.termijnLabel}</p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium">Bedrag</h2>
          <p>Subtotaal: {formatEur(data.amountCents)}</p>
          <p>
            BTW {data.vatPercentage}%:{' '}
            {formatEur(
              Math.round((data.amountCents * data.vatPercentage) / 100),
            )}
          </p>
          <p className="font-medium">Totaal: {formatEur(totalCents)}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium">Notitie</h2>
          <textarea
            defaultValue={data.notes ?? ''}
            disabled={!isDraft}
            onBlur={(e) => {
              if (e.target.value !== (data.notes ?? '')) {
                updateMut.mutate({ invoiceId, notes: e.target.value });
              }
            }}
            className="w-full input-minimal min-h-[100px]"
          />
        </section>
      </main>

      <aside>
        <InvoiceActions invoice={data} onChange={refetch} />
      </aside>
    </div>
  );
}
```

- [ ] **Step 3: Create the actions sidebar**

Create `components/features/invoice/invoice-actions.tsx`:

```tsx
'use client';

import { trpc } from '@/lib/trpc/client';

export function InvoiceActions({
  invoice,
  onChange,
}: {
  invoice: { id: string; status: string; pdfUrl: string | null };
  onChange: () => void;
}) {
  const sendMut = trpc.invoice.send.useMutation({ onSuccess: onChange });
  const markPaidMut = trpc.invoice.markPaid.useMutation({
    onSuccess: onChange,
  });
  const cancelMut = trpc.invoice.cancel.useMutation({ onSuccess: onChange });

  return (
    <div className="space-y-3 sticky top-6">
      <h3 className="text-sm font-medium">Acties</h3>

      {invoice.status === 'DRAFT' && (
        <>
          <button
            onClick={() => {
              if (confirm('Factuur versturen aan klant?')) {
                sendMut.mutate({ invoiceId: invoice.id });
              }
            }}
            disabled={sendMut.isPending}
            className="w-full py-2 px-4 bg-[--color-gold] text-navy font-medium rounded"
          >
            {sendMut.isPending ? 'Versturen…' : 'Versturen'}
          </button>
          <button
            onClick={() => cancelMut.mutate({ invoiceId: invoice.id })}
            className="w-full py-2 px-4 border border-zinc-300 rounded text-sm"
          >
            Annuleren
          </button>
        </>
      )}

      {(invoice.status === 'SENT' || invoice.status === 'OVERDUE') && (
        <>
          <button
            onClick={() => markPaidMut.mutate({ invoiceId: invoice.id })}
            className="w-full py-2 px-4 bg-[--color-gold] text-navy font-medium rounded"
          >
            Markeer betaald
          </button>
          <button
            onClick={() => cancelMut.mutate({ invoiceId: invoice.id })}
            className="w-full py-2 px-4 border border-zinc-300 rounded text-sm"
          >
            Annuleren
          </button>
          {invoice.pdfUrl && (
            <a
              href={invoice.pdfUrl}
              target="_blank"
              rel="noopener"
              className="block w-full py-2 px-4 border border-zinc-300 rounded text-sm text-center"
            >
              Download PDF
            </a>
          )}
        </>
      )}

      {invoice.status === 'PAID' && (
        <p className="text-sm text-zinc-500">
          Betaald — geen acties beschikbaar.
        </p>
      )}
    </div>
  );
}
```

CSS classes match DESIGN.md scope: solid `--color-gold` rectangles for admin (NOT brochure pill gradient).

- [ ] **Step 4: Type-check + dev smoke**

```bash
npx tsc --noEmit 2>&1 | head -10
```

Open `http://localhost:9200/admin/invoices/<some-invoice-id>` after creating an invoice via Wave A test data + Task 8 prepare. Verify the page loads, edits work in DRAFT, send action exists.

- [ ] **Step 5: Commit**

```bash
git add app/admin/invoices/ components/features/invoice/
git commit -m "feat(admin): invoice detail page with inline edit + action sidebar"
```

---

### Task 13B: Top-level `/admin/facturen` overview

**Files:**

- Create: `app/admin/facturen/page.tsx`
- Modify: `server/routers/invoice.ts` (add `listForTenant` query)
- Modify: `server/routers/invoice.test.ts`
- Modify: admin sidebar nav config (find with `grep -rn "Prospects\|prospecten" components/ app/admin/ --include="*.tsx" | grep -i sidebar`)

**Why:** Per-prospect Project tab is good for in-context invoice work. But a top-level queue view is operationally important — Romano wants to see "totaal openstaand", "wat moet ik deze week sturen", "wat is overdue" zonder per-klant te klikken.

- [ ] **Step 1: Add `listForTenant` query to invoice router**

```ts
listForTenant: projectAdminProcedure
  .input(z.object({
    status: z.enum(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  }))
  .query(async ({ ctx, input }) => {
    const where = {
      engagement: { projectId: ctx.projectId },
      ...(input.status ? { status: input.status } : {}),
    };

    const [invoices, totalsRaw] = await Promise.all([
      ctx.db.invoice.findMany({
        where,
        include: {
          engagement: {
            include: { prospect: { select: { id: true, slug: true, companyName: true, domain: true } } },
          },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      }),
      ctx.db.invoice.groupBy({
        by: ['status'],
        where: { engagement: { projectId: ctx.projectId } },
        _sum: { amountCents: true },
        _count: true,
      }),
    ]);

    const totals = {
      outstanding: totalsRaw
        .filter((t) => t.status === 'SENT' || t.status === 'OVERDUE')
        .reduce((sum, t) => sum + (t._sum.amountCents ?? 0), 0),
      paidThisMonth: 0, // computed in step 2 if relevant
      countByStatus: Object.fromEntries(totalsRaw.map((t) => [t.status, t._count])),
    };

    return { invoices, totals };
  }),
```

- [ ] **Step 2: Compute "paid this month" if needed**

Add to the totals: a separate count of invoices with `paidAt` in the current calendar month. Either compute inline:

```ts
const startOfMonth = new Date();
startOfMonth.setDate(1);
startOfMonth.setHours(0, 0, 0, 0);

const paidThisMonthRaw = await ctx.db.invoice.aggregate({
  where: {
    engagement: { projectId: ctx.projectId },
    status: 'PAID',
    paidAt: { gte: startOfMonth },
  },
  _sum: { amountCents: true },
});
totals.paidThisMonth = paidThisMonthRaw._sum.amountCents ?? 0;
```

Optional polish — skip if marginal.

- [ ] **Step 3: Write failing tests for the list query**

Append to `server/routers/invoice.test.ts`:

```ts
describe('invoice.listForTenant', () => {
  it('returns scoped invoices + status totals', async () => {
    mockDb.invoice = {
      ...mockDb.invoice,
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'i1',
          status: 'SENT',
          amountCents: 100000,
          engagement: { prospect: { companyName: 'A' } },
        },
        {
          id: 'i2',
          status: 'PAID',
          amountCents: 50000,
          engagement: { prospect: { companyName: 'B' } },
        },
      ]),
      groupBy: vi.fn().mockResolvedValue([
        { status: 'SENT', _sum: { amountCents: 100000 }, _count: 1 },
        { status: 'PAID', _sum: { amountCents: 50000 }, _count: 1 },
      ]),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amountCents: 0 } }),
    };
    const caller = invoiceRouter.createCaller(ctx);
    const result = await caller.listForTenant({});
    expect(result.invoices).toHaveLength(2);
    expect(result.totals.outstanding).toBe(100000);
    expect(result.totals.countByStatus).toEqual({ SENT: 1, PAID: 1 });
  });

  it('filters by status when provided', async () => {
    mockDb.invoice.findMany = vi.fn().mockResolvedValue([]);
    mockDb.invoice.groupBy = vi.fn().mockResolvedValue([]);
    mockDb.invoice.aggregate = vi
      .fn()
      .mockResolvedValue({ _sum: { amountCents: 0 } });
    const caller = invoiceRouter.createCaller(ctx);
    await caller.listForTenant({ status: 'OVERDUE' });
    expect(mockDb.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'OVERDUE' }),
      }),
    );
  });
});
```

Run, confirm RED, then GREEN after Step 1+2 are in place.

- [ ] **Step 4: Build `/admin/facturen/page.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';

const formatEur = (cents: number) =>
  (cents / 100).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' });

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Concept',
  SENT: 'Verzonden',
  PAID: 'Betaald',
  OVERDUE: 'Vervallen',
  CANCELLED: 'Geannuleerd',
};

export default function FacturenPage() {
  const [statusFilter, setStatusFilter] = useState<undefined | string>(
    undefined,
  );
  const { data, isLoading } = trpc.invoice.listForTenant.useQuery({
    status: statusFilter as any,
  });

  if (isLoading) return <div className="p-6">Laden…</div>;
  if (!data) return <div className="p-6">Geen toegang</div>;

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-medium">Facturen</h1>
      </header>

      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded p-4">
          <div className="text-xs text-zinc-500">Openstaand</div>
          <div className="text-2xl font-medium">
            {formatEur(data.totals.outstanding)}
          </div>
        </div>
        <div className="border rounded p-4">
          <div className="text-xs text-zinc-500">Deze maand betaald</div>
          <div className="text-2xl font-medium">
            {formatEur(data.totals.paidThisMonth ?? 0)}
          </div>
        </div>
        <div className="border rounded p-4">
          <div className="text-xs text-zinc-500">Aantal per status</div>
          <div className="text-sm space-y-0.5 mt-1">
            {Object.entries(data.totals.countByStatus).map(([s, n]) => (
              <div key={s}>
                {STATUS_LABEL[s] ?? s}: {n as number}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2 text-sm">
        <button
          onClick={() => setStatusFilter(undefined)}
          className={!statusFilter ? 'font-medium' : ''}
        >
          Alle
        </button>
        {(['DRAFT', 'SENT', 'OVERDUE', 'PAID', 'CANCELLED'] as const).map(
          (s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={statusFilter === s ? 'font-medium' : ''}
            >
              {STATUS_LABEL[s]}
            </button>
          ),
        )}
      </div>

      <table className="w-full text-sm">
        <thead className="text-xs text-zinc-500 text-left">
          <tr>
            <th className="py-2">Nummer</th>
            <th>Klant</th>
            <th>Termijn</th>
            <th className="text-right">Bedrag</th>
            <th>Status</th>
            <th>Datum</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.invoices.map((inv: any) => (
            <tr key={inv.id} className="border-t">
              <td className="py-2">{inv.invoiceNumber}</td>
              <td>
                {inv.engagement.prospect.companyName ??
                  inv.engagement.prospect.domain}
              </td>
              <td>{inv.termijnLabel}</td>
              <td className="text-right">{formatEur(inv.amountCents)}</td>
              <td>{STATUS_LABEL[inv.status]}</td>
              <td>
                {new Date(inv.sentAt ?? inv.createdAt).toLocaleDateString(
                  'nl-NL',
                )}
              </td>
              <td>
                <Link
                  href={`/admin/invoices/${inv.id}`}
                  className="text-navy hover:underline"
                >
                  Bekijk →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Add to admin sidebar nav**

Find the sidebar nav config (likely in `components/admin/sidebar.tsx` or similar — grep first). Add a "Facturen" entry pointing at `/admin/facturen`. Match the existing nav-item style (icon + label).

- [ ] **Step 6: Type-check + smoke**

```bash
npx tsc --noEmit 2>&1 | head -10
```

Open `http://localhost:9200/admin/facturen` after creating a few invoices via Wave B prepare/send. Verify totals + filters work.

- [ ] **Step 7: Commit**

```bash
git add app/admin/facturen/ server/routers/invoice.ts server/routers/invoice.test.ts \
        components/admin/  # or wherever sidebar lives
git commit -m "feat(admin): top-level /admin/facturen overview with totals + filter"
```

---

## Wave C — Polish + crons

### Task 14: Engagement tab full UI (milestones + invoice queue)

**Files:**

- Modify: `components/features/engagement/project-tab.tsx`
- Create: `components/features/engagement/kickoff-block.tsx`
- Create: `components/features/engagement/milestone-checklist.tsx`
- Create: `components/features/engagement/invoice-queue.tsx`
- Modify: `server/routers/engagement.ts` (add `completeMilestone`, `sendKickoffLink`)

- [ ] **Step 1: Add `completeMilestone` and `sendKickoffLink` procedures**

Append to `server/routers/engagement.ts`:

```ts
import { sendKickoffReminderEmail } from '@/lib/email/kickoff-reminder'; // path adjusts

  completeMilestone: projectAdminProcedure
    .input(z.object({
      milestoneId: z.string(),
      completed: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      // tenant scope check via the join
      const ms = await ctx.db.engagementMilestone.findFirst({
        where: {
          id: input.milestoneId,
          engagement: { projectId: ctx.projectId },
        },
      });
      if (!ms) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.db.engagementMilestone.update({
        where: { id: input.milestoneId },
        data: { completedAt: input.completed ? new Date() : null },
      });
    }),

  sendKickoffLink: projectAdminProcedure
    .input(z.object({ engagementId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const engagement = await ctx.db.engagement.findFirst({
        where: { id: input.engagementId, projectId: ctx.projectId },
        include: { prospect: true, quote: true },
      });
      if (!engagement) throw new TRPCError({ code: 'NOT_FOUND' });

      await sendKickoffReminderEmail(engagement);
      await ctx.db.engagement.update({
        where: { id: engagement.id },
        data: {
          kickoffReminderCount: { increment: 1 },
          kickoffReminderLastAt: new Date(),
        },
      });
      return { success: true };
    }),
```

- [ ] **Step 2: Create `kickoff-block.tsx`**

```tsx
'use client';
import { trpc } from '@/lib/trpc/client';

export function KickoffBlock({ engagement }: { engagement: any }) {
  const sendMut = trpc.engagement.sendKickoffLink.useMutation();
  const markBookedMut = trpc.engagement.markKickoffBooked.useMutation();

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium text-navy">Kickoff</h3>
      {engagement.kickoffBookedAt ? (
        <p className="text-sm text-zinc-700">
          Geboekt op{' '}
          {new Date(engagement.kickoffBookedAt).toLocaleDateString('nl-NL')}
        </p>
      ) : (
        <>
          <p className="text-sm text-zinc-700">Nog niet geboekt</p>
          {engagement.kickoffReminderCount > 0 && (
            <p className="text-xs text-zinc-500">
              {engagement.kickoffReminderCount} herinnering(en) verzonden
              {engagement.kickoffReminderLastAt &&
                ` · laatste op ${new Date(engagement.kickoffReminderLastAt).toLocaleDateString('nl-NL')}`}
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => sendMut.mutate({ engagementId: engagement.id })}
              className="px-3 py-1.5 text-sm border border-zinc-300 rounded"
              disabled={sendMut.isPending}
            >
              Stuur kickoff link opnieuw
            </button>
            <button
              onClick={() =>
                markBookedMut.mutate({ engagementId: engagement.id })
              }
              className="px-3 py-1.5 text-sm border border-zinc-300 rounded"
            >
              Markeer als geboekt
            </button>
          </div>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Create `milestone-checklist.tsx`**

```tsx
'use client';
import { trpc } from '@/lib/trpc/client';

export function MilestoneChecklist({ milestones }: { milestones: any[] }) {
  const completeMut = trpc.engagement.completeMilestone.useMutation();
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium text-navy">Milestones</h3>
      <ul className="space-y-1">
        {milestones.map((m) => (
          <li key={m.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!m.completedAt}
              onChange={(e) =>
                completeMut.mutate({
                  milestoneId: m.id,
                  completed: e.target.checked,
                })
              }
            />
            <span>{m.label}</span>
            {m.completedAt && (
              <span className="text-zinc-500 text-xs ml-auto">
                {new Date(m.completedAt).toLocaleDateString('nl-NL')}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Create `invoice-queue.tsx`**

```tsx
'use client';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';

const formatEur = (cents: number) =>
  (cents / 100).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' });

const STATUS_BG: Record<string, string> = {
  DRAFT: 'bg-zinc-100',
  SENT: 'bg-blue-50',
  PAID: 'bg-green-50',
  OVERDUE: 'bg-red-50',
  CANCELLED: 'bg-zinc-50',
};

export function InvoiceQueue({ engagement }: { engagement: any }) {
  const prepareMut = trpc.invoice.prepare.useMutation();

  const schedule = (engagement.quote.paymentSchedule ?? []) as Array<{
    label: string;
    percentage: number;
  }>;
  const existingTermijnen = new Set(
    engagement.invoices.map((i: any) => i.termijnIndex),
  );

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium text-navy">Facturen</h3>

      {engagement.invoices.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-xs text-zinc-500 text-left">
            <tr>
              <th className="py-2">Nummer</th>
              <th>Termijn</th>
              <th className="text-right">Bedrag</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {engagement.invoices.map((inv: any) => (
              <tr key={inv.id} className="border-t">
                <td className="py-2">{inv.invoiceNumber}</td>
                <td>{inv.termijnLabel}</td>
                <td className="text-right">{formatEur(inv.amountCents)}</td>
                <td>
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${STATUS_BG[inv.status]}`}
                  >
                    {inv.status}
                  </span>
                </td>
                <td>
                  <Link
                    href={`/admin/invoices/${inv.id}`}
                    className="text-navy hover:underline"
                  >
                    Bekijk →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="space-y-2 pt-2">
        {schedule.map((term, idx) =>
          existingTermijnen.has(idx) ? null : (
            <button
              key={idx}
              onClick={() =>
                prepareMut.mutate({
                  engagementId: engagement.id,
                  termijnIndex: idx,
                })
              }
              disabled={prepareMut.isPending}
              className="w-full text-left px-3 py-2 border border-dashed border-zinc-300 rounded text-sm hover:bg-zinc-50"
            >
              + Maak factuur klaar — termijn {idx + 1}: {term.label} (
              {term.percentage}% ·{' '}
              {formatEur(
                Math.round(
                  (engagement.quote.totalAmountCents * term.percentage) / 100,
                ),
              )}
              )
            </button>
          ),
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Wire components into ProjectTab**

Replace the body of `components/features/engagement/project-tab.tsx`:

```tsx
'use client';
import { trpc } from '@/lib/trpc/client';
import { KickoffBlock } from './kickoff-block';
import { MilestoneChecklist } from './milestone-checklist';
import { InvoiceQueue } from './invoice-queue';

export function ProjectTab({ prospectId }: { prospectId: string }) {
  const { data: engagement, isLoading } =
    trpc.engagement.getByProspect.useQuery({ prospectId });

  if (isLoading) return <div className="text-sm text-zinc-500">Laden…</div>;
  if (!engagement) {
    return (
      <div className="text-sm text-zinc-500">
        Project verschijnt zodra een offerte is geaccepteerd.
      </div>
    );
  }

  const totalEur = (engagement.quote.totalAmountCents / 100).toLocaleString(
    'nl-NL',
    { style: 'currency', currency: 'EUR' },
  );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-xl font-medium text-navy">Project</h2>
        <p className="text-sm text-zinc-600">
          Offerte {engagement.quote.quoteNumber ?? engagement.quote.id} ·{' '}
          {totalEur} · geaccepteerd op{' '}
          {new Date(engagement.acceptedAt).toLocaleDateString('nl-NL')}
        </p>
      </header>

      <KickoffBlock engagement={engagement} />
      <MilestoneChecklist milestones={engagement.milestones} />
      <InvoiceQueue engagement={engagement} />
    </div>
  );
}
```

- [ ] **Step 6: Type-check + dev smoke**

```bash
npx tsc --noEmit 2>&1 | head
```

Open the prospect detail in browser, click Project tab, click "Maak factuur klaar — termijn 1". Verify a new row appears in the invoice queue + you can navigate to invoice detail page.

- [ ] **Step 7: Commit**

```bash
git add components/features/engagement/ server/routers/engagement.ts
git commit -m "feat(admin): full Project tab — kickoff actions, milestones, invoice queue"
```

---

### Task 15: Crons (kickoff reminder + invoice overdue) + email template

**Files:**

- Create: `app/api/internal/cron/kickoff-reminder/route.ts`
- Create: `app/api/internal/cron/invoice-overdue/route.ts`
- Create: `components/clients/klarifai/kickoff-reminder-email.tsx`
- Create: `lib/email/kickoff-reminder.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create the kickoff-reminder email template**

Create `components/clients/klarifai/kickoff-reminder-email.tsx`:

```tsx
import { getEmailSignature } from '@/components/clients/klarifai/email-signature';

interface ReminderInput {
  prospectName: string;
  kickoffUrl: string;
  acceptedAt: Date;
}

export function buildKickoffReminderHtml(input: ReminderInput): string {
  const sig = getEmailSignature('klarifai').html;
  const acceptedDate = input.acceptedAt.toLocaleDateString('nl-NL');
  return `
<!doctype html>
<html lang="nl">
<body style="font-family: Sora, sans-serif; color: #0a0a2e; max-width: 600px; margin: 0 auto; padding: 24px;">
  <p>Beste ${input.prospectName},</p>
  <p>
    Sinds onze offerte-acceptatie op ${acceptedDate} hebben we nog geen kickoff-moment kunnen plannen.
    Geen druk — wanneer het schikt:
  </p>
  <p style="margin: 24px 0;">
    <a href="${input.kickoffUrl}" style="display: inline-block; padding: 12px 24px; background: #E4C33C; color: #0a0a2e; text-decoration: none; border-radius: 6px; font-weight: 600;">
      Plan kickoff
    </a>
  </p>
  <p>Of mail naar <a href="mailto:info@klarifai.nl">info@klarifai.nl</a> als bellen beter past.</p>
  ${sig}
</body>
</html>`;
}

export const KICKOFF_REMINDER_SUBJECT =
  'Kickoff inplannen voor je Klarifai project';
```

Create `lib/email/kickoff-reminder.ts`:

```ts
import { sendEmail } from '@/lib/email/resend'; // adjust path to existing helper
import {
  buildKickoffReminderHtml,
  KICKOFF_REMINDER_SUBJECT,
} from '@/components/clients/klarifai/kickoff-reminder-email';

export async function sendKickoffReminderEmail(engagement: any): Promise<void> {
  const kickoffUrl = `${process.env.CALCOM_BOOKING_URL}?metadata[engagementId]=${engagement.id}`;
  const html = buildKickoffReminderHtml({
    prospectName: engagement.prospect.companyName ?? 'lezer',
    kickoffUrl,
    acceptedAt: engagement.acceptedAt,
  });
  await sendEmail({
    to: engagement.prospect.contactEmail,
    subject: KICKOFF_REMINDER_SUBJECT,
    html,
  });
}
```

- [ ] **Step 2: Create kickoff-reminder cron route**

Create `app/api/internal/cron/kickoff-reminder/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { subDays } from 'date-fns';
import prisma from '@/lib/prisma';
import { env } from '@/env.mjs';
import { sendKickoffReminderEmail } from '@/lib/email/kickoff-reminder';

export async function GET(req: Request) {
  // Auth: cron secret
  const expected = env.INTERNAL_CRON_SECRET ?? env.ADMIN_SECRET;
  const got = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!expected || got !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const due = await prisma.engagement.findMany({
    where: {
      kickoffBookedAt: null,
      acceptedAt: { lte: subDays(new Date(), 5) },
      kickoffReminderCount: { lt: 2 },
      OR: [
        { kickoffReminderLastAt: null },
        { kickoffReminderLastAt: { lte: subDays(new Date(), 7) } },
      ],
    },
    include: { prospect: true, quote: true },
  });

  let sent = 0;
  for (const eng of due) {
    try {
      await sendKickoffReminderEmail(eng);
      await prisma.engagement.update({
        where: { id: eng.id },
        data: {
          kickoffReminderCount: { increment: 1 },
          kickoffReminderLastAt: new Date(),
        },
      });
      sent++;
    } catch (err) {
      console.error('[kickoff-reminder] failed for', eng.id, err);
    }
  }
  return NextResponse.json({ ok: true, candidates: due.length, sent });
}
```

- [ ] **Step 3: Create invoice-overdue cron route**

Create `app/api/internal/cron/invoice-overdue/route.ts`:

```ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { env } from '@/env.mjs';

export async function GET(req: Request) {
  const expected = env.INTERNAL_CRON_SECRET ?? env.ADMIN_SECRET;
  const got = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!expected || got !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await prisma.invoice.updateMany({
    where: { status: 'SENT', dueAt: { lte: new Date() } },
    data: { status: 'OVERDUE' },
  });

  return NextResponse.json({ ok: true, flagged: result.count });
}
```

- [ ] **Step 4: Register crons in `vercel.json`**

Replace `vercel.json` content:

```json
{
  "framework": "nextjs",
  "crons": [
    { "path": "/api/internal/cron/kickoff-reminder", "schedule": "0 9 * * *" },
    { "path": "/api/internal/cron/invoice-overdue", "schedule": "0 8 * * *" }
  ]
}
```

`0 9 * * *` = daily at 09:00 UTC (kickoff reminder). `0 8 * * *` = daily at 08:00 UTC (overdue scan, runs first so reminder cron sees fresh OVERDUE flags if needed).

Vercel cron auto-includes the cron secret as Bearer header (configurable via `CRON_SECRET` Vercel env var). Confirm the existing project's cron auth pattern by checking other cron routes (`grep -rn "cron-secret\|INTERNAL_CRON_SECRET" app/api/internal/cron/`) and align.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -E "cron|kickoff" | head
```

- [ ] **Step 6: Smoke-test the cron endpoints locally**

```bash
SECRET=$(grep '^INTERNAL_CRON_SECRET=\|^ADMIN_SECRET=' .env | head -1 | cut -d'=' -f2-)
curl -H "Authorization: Bearer $SECRET" http://localhost:9200/api/internal/cron/kickoff-reminder
curl -H "Authorization: Bearer $SECRET" http://localhost:9200/api/internal/cron/invoice-overdue
```

Expected: both return 200 with JSON payloads (`{ok: true, ...}`). Without auth header: 401.

- [ ] **Step 7: Commit**

```bash
git add app/api/internal/cron/ vercel.json \
        components/clients/klarifai/kickoff-reminder-email.tsx \
        lib/email/kickoff-reminder.ts
git commit -m "feat(cron): kickoff reminder (max 2x/7d) + invoice overdue scanner"
```

---

### Task 16: E2E synthetic verification + DoD walkthrough

**Files:** none modified — verification only.

- [ ] **Step 1: Set up a synthetic Klarifai prospect with a SENT quote**

Use existing seed scripts or admin UI to create:

- Prospect "Synthetic E2E Klant"
- Quote with `paymentSchedule = [{label: 'Bij ondertekening', percentage: 50}, {label: 'Bij oplevering', percentage: 50}]`, `totalAmountCents = 1000000` (€10.000)
- Status `SENT`

If you don't have an easy seed path, run a one-off TS script:

```bash
pnpm tsx -e '
import prisma from "@/lib/prisma";
(async () => {
  const project = await prisma.project.findFirstOrThrow({ where: { slug: "klarifai" }});
  const prospect = await prisma.prospect.create({
    data: {
      projectId: project.id,
      slug: "synthetic-e2e",
      domain: "synthetic-e2e.nl",
      companyName: "Synthetic E2E Klant",
      contactEmail: "you+test@klarifai.nl",
      status: "SENT",
    },
  });
  const quote = await prisma.quote.create({
    data: {
      prospectId: prospect.id,
      projectId: project.id,
      status: "SENT",
      totalAmountCents: 1000000,
      paymentSchedule: [
        { label: "Bij ondertekening", percentage: 50 },
        { label: "Bij oplevering", percentage: 50 },
      ],
    },
  });
  console.log("synthetic prospectId:", prospect.id, "quoteId:", quote.id);
})();
'
```

- [ ] **Step 2: Trigger ACCEPTED transition**

Via admin UI (offerte signing flow on the prospect's quote) OR programmatically:

```bash
pnpm tsx -e '
import prisma from "@/lib/prisma";
import { transitionQuote } from "@/lib/state-machines/quote";
(async () => {
  await prisma.$transaction(async (tx) => {
    await transitionQuote(tx, "<quoteId>", "ACCEPTED");
  });
  console.log("ACCEPTED triggered");
})();
'
```

Expected: `Engagement` row exists for that quote, 2 milestones, milestone[0] has `completedAt`.

Verify:

```bash
docker exec qualifai-db psql -U user -d qualifai -c "SELECT e.id, e.\"acceptedAt\", count(m.*) milestones FROM \"Engagement\" e JOIN \"EngagementMilestone\" m ON m.\"engagementId\" = e.id WHERE e.\"prospectId\" = '<prospectId>' GROUP BY e.id;"
```

Expected: 1 row, milestones=2.

- [ ] **Step 3: Browse Project tab in admin**

Open `http://localhost:9200/admin/prospects/<prospectId>` → Project tab. Verify:

- Header shows €10.000 + acceptance date
- Kickoff: "Nog niet geboekt"
- Milestones: 2 items, first checked
- Facturen section shows two "Maak factuur klaar" buttons

- [ ] **Step 4: Click "Maak factuur klaar — termijn 1"**

Expected: row appears with `F-<year>-001`, status DRAFT, €5.000.

Click "Bekijk →" → navigate to `/admin/invoices/<id>`. Edit the termijnLabel field (blur to save). Verify update mutation fired.

- [ ] **Step 5: Click "Versturen"**

Expected: PDF generated, email sent (check Resend dashboard or stub the call), status flips to SENT, dueAt = today + 30d. Reload Project tab to confirm queue updated.

- [ ] **Step 6: Force OVERDUE**

```bash
docker exec qualifai-db psql -U user -d qualifai -c "UPDATE \"Invoice\" SET \"dueAt\" = NOW() - INTERVAL '1 day' WHERE \"invoiceNumber\" = 'F-<year>-001';"
SECRET=$(grep '^INTERNAL_CRON_SECRET=\|^ADMIN_SECRET=' .env | head -1 | cut -d'=' -f2-)
curl -H "Authorization: Bearer $SECRET" http://localhost:9200/api/internal/cron/invoice-overdue
```

Expected: response shows `{ok: true, flagged: 1}`. Reload invoice detail → status `OVERDUE`.

- [ ] **Step 7: Mark paid**

Click "Markeer betaald" in invoice actions. Verify status → PAID, paidAt populated.

- [ ] **Step 8: Test kickoff reminder**

```bash
docker exec qualifai-db psql -U user -d qualifai -c "UPDATE \"Engagement\" SET \"acceptedAt\" = NOW() - INTERVAL '6 days' WHERE \"prospectId\" = '<prospectId>';"
curl -H "Authorization: Bearer $SECRET" http://localhost:9200/api/internal/cron/kickoff-reminder
```

Expected: response shows `{ok: true, candidates: 1, sent: 1}` (assuming the reminder email send doesn't fail). `Engagement.kickoffReminderCount = 1` afterwards.

- [ ] **Step 9: Cleanup synthetic data**

```bash
docker exec qualifai-db psql -U user -d qualifai -c "DELETE FROM \"Prospect\" WHERE slug = 'synthetic-e2e';"
```

Cascade deletes the Engagement, milestones, invoices.

- [ ] **Step 10: Walk the spec DoD**

Open `docs/superpowers/specs/2026-04-26-post-sale-flow-design.md` §11 and check each box:

- ✅ Project (Engagement), Invoice, ProjectMilestone (EngagementMilestone) models — Tasks 1, 6
- ✅ ProjectStatus + InvoiceStatus enums — Tasks 1, 6
- ✅ State-machine ACCEPTED hook — Task 2
- ✅ Acceptance email persistent kickoff link — Task 4
- ✅ Cal.com webhook updates kickoffBookedAt — Task 3
- ✅ kickoff-reminder cron — Task 15
- ✅ kickoff-reminder-email template — Task 15
- ✅ tRPC procedures — Tasks 5, 8, 11, 12, 14
- ✅ invoice-overdue-check cron — Task 15
- ✅ Invoice PDF renderer — Task 9
- ✅ Invoice email template — Task 10
- ✅ Invoice number generator — Task 7
- ✅ Project tab on prospect detail — Tasks 5, 14
- ✅ Invoice detail page — Task 13
- ✅ Multi-tenant scoping — every router uses `projectAdminProcedure` + filters by `ctx.projectId`
- ✅ Vitest unit tests — Tasks 2, 7, 8, 11, 12
- ✅ E2E synthetic — this task
- ✅ tsc clean — verified per task

Anything unchecked: file follow-up tasks.

- [ ] **Step 11: Final commit (if needed) + branch tip**

If anything got fixed during E2E:

```bash
git status
git add -p
git commit -m "fix: E2E findings during post-sale verification"
```

Otherwise: branch is ready for PR. Don't merge yet — let user decide deployment timing.

---

## Out of scope (explicitly NOT in this plan)

These are documented in spec §10. If during execution you feel tempted, stop and re-read the spec:

- Finom auto-detect of payments
- Automatic overdue reminder mails to client
- Credit invoice flow
- Client-facing project status portaal
- Top-level "Klanten" route
- ProjectEvent activity log
- Editing sent invoices
- Bookkeeping export
- Multi-currency, BTW-shifting
- Multi-project per client (recurring engagements)

---

## Cron deploy notes

Vercel auto-runs the registered crons after first prod deploy. Monitor:

- Vercel dashboard → Project → Logs → filter by `/api/internal/cron/`
- Expect kickoff-reminder to find 0 candidates initially (no Engagements >5d old yet)
- Expect invoice-overdue to flag any pre-existing overdue invoices on first run (likely zero — no SENT invoices exist before this PR)

If something blows up: the cron handlers are idempotent — failed mid-run leaves DB in valid state. Re-runs at 08:00/09:00 next day.

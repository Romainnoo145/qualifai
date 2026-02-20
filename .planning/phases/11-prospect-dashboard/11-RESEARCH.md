# Phase 11: Prospect Dashboard - Research

**Researched:** 2026-02-21
**Domain:** Next.js routing, React dashboard UI, tRPC public procedures, Prisma schema migrations
**Confidence:** HIGH — all findings are based on direct codebase inspection, no external libraries needed beyond what is installed

---

## Summary

Phase 11 transforms the existing wizard at `/discover/[slug]` into a prospect dashboard. The wizard already exists as a 6-step animated presentation (`app/discover/[slug]/page.tsx` + `wizard-client.tsx`). The core engineering work is: (1) add a `readableSlug` field to `Prospect` for Dutch readable URLs (`/voor/bedrijfsnaam`), (2) add a new Next.js route at `app/voor/[slug]/` that resolves by `readableSlug`, (3) replace the current AI-generated content steps with evidence-backed data from approved `WorkflowHypothesis` + `AutomationOpportunity` + `ProofMatch` records, (4) add multi-channel contact buttons (Cal.com already wired, WhatsApp/call/email need env vars), and (5) add a one-click quote request mutation with admin notification. All engagement tracking in `WizardSession` continues unchanged.

The existing codebase is well-structured for this. The tRPC `wizardRouter` already has all session-tracking mutations. `ProofMatch` already links hypotheses to `UseCase` records. The `notifyAdmin()` function in `lib/notifications.ts` is the correct pattern for the quote request admin notification. No new npm packages are needed.

**Primary recommendation:** Create `app/voor/[slug]/` as a new Next.js route that queries by `readableSlug`, leaving `/discover/[slug]` working as before (backward compatibility for already-sent links). Refactor the single WizardClient into a DashboardClient that pulls live evidence data instead of pre-generated JSON blobs.

---

## Standard Stack

### Core (already installed — zero additions needed)

| Library       | Version | Purpose                              | Why Standard      |
| ------------- | ------- | ------------------------------------ | ----------------- |
| Next.js       | 16.1.6  | App Router routing, SSR, RSC         | Project framework |
| React         | 19.2.3  | Client components                    | Project framework |
| Prisma        | 7.3.0   | Schema migration, DB queries         | Project ORM       |
| tRPC          | 11.9.0  | Type-safe API mutations/queries      | Project API layer |
| framer-motion | 12.29.2 | Animations (already used in wizard)  | Already installed |
| lucide-react  | 0.563.0 | Icons (already used)                 | Already installed |
| Resend        | 6.9.1   | Email notification for quote request | Already installed |
| Zod           | 4.3.6   | Input validation                     | Already installed |

### Supporting (already installed)

| Library         | Version | Purpose                                     | When to Use                               |
| --------------- | ------- | ------------------------------------------- | ----------------------------------------- |
| nanoid          | 5.1.6   | Slug generation                             | Creating readable slugs from company name |
| canvas-confetti | 1.9.4   | Quote request celebration micro-interaction | On quote submitted                        |

### Alternatives Considered

| Instead of                  | Could Use                            | Tradeoff                                                                                         |
| --------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| New `/voor/[slug]` route    | Redirect from `/voor` to `/discover` | Redirect loses the clean URL goal — new route is better                                          |
| Extend WizardClient         | Full rewrite                         | Extension preferred; existing step tracking, session logic reusable                              |
| Server component data fetch | tRPC query                           | SSR is faster for initial load (already used in `/discover/[slug]/page.tsx`) — keep same pattern |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended Project Structure

```
app/
├── voor/
│   └── [slug]/
│       ├── page.tsx           # Server component — resolves readableSlug, fetches evidence data
│       └── dashboard-client.tsx  # Client component — renders dashboard with contact buttons
├── discover/
│   └── [slug]/
│       ├── page.tsx           # KEEP unchanged — old nanoid slugs still work
│       └── wizard-client.tsx  # KEEP unchanged — backward compat for sent links

server/routers/
└── wizard.ts                  # Add: requestQuote mutation

prisma/
└── schema.prisma              # Add: readableSlug field on Prospect
```

### Pattern 1: Readable Slug Field on Prospect

**What:** Add `readableSlug String? @unique` to `Prospect`. Generated from `companyName` when admin triggers "Generate readable link". Falls back to nanoid slug for backward compat.

**Why nullable:** Existing prospects have no readable slug. Admin generates it on demand (or auto-generate on `createProspect`).

**Slug generation function:**

```typescript
// Source: codebase pattern, similar to nanoid usage in admin.ts
function toReadableSlug(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // strip non-alphanum
    .trim()
    .replace(/\s+/g, '-') // spaces to hyphens
    .replace(/-+/g, '-') // collapse multiple hyphens
    .slice(0, 60); // max length
}
```

**Schema addition:**

```prisma
// In Prospect model — add alongside existing slug field
readableSlug String? @unique @db.VarChar(80)

// Add index
@@index([readableSlug])
```

### Pattern 2: /voor/[slug] Route (Server Component)

**What:** New Next.js App Router page that looks up `Prospect` by `readableSlug`, fetches evidence data server-side, passes to client component.

**When to use:** This is the primary URL pattern for Phase 11. The existing `/discover/[slug]` continues working.

**Example (follows existing `app/discover/[slug]/page.tsx` pattern exactly):**

```typescript
// app/voor/[slug]/page.tsx
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { DashboardClient } from './dashboard-client';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ProspectDashboardPage({ params }: Props) {
  const { slug } = await params;

  const prospect = await prisma.prospect.findUnique({
    where: { readableSlug: slug },
    select: {
      id: true,
      slug: true,         // nanoid slug — needed for WizardSession.startSession
      readableSlug: true,
      companyName: true,
      domain: true,
      industry: true,
      logoUrl: true,
      status: true,
      workflowHypotheses: {
        where: { status: 'ACCEPTED' },
        orderBy: { confidenceScore: 'desc' },
        take: 6,
        include: {
          proofMatches: {
            orderBy: { score: 'desc' },
            take: 3,
            include: {
              useCase: {
                select: { id: true, title: true, summary: true, category: true, outcomes: true },
              },
            },
          },
        },
      },
      workflowLossMaps: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true },
      },
    },
  });

  if (
    !prospect ||
    !['READY', 'SENT', 'VIEWED', 'ENGAGED', 'CONVERTED'].includes(prospect.status)
  ) {
    notFound();
  }

  return (
    <DashboardClient
      prospectSlug={prospect.slug}   // pass nanoid slug for session tracking
      companyName={prospect.companyName ?? prospect.domain}
      logoUrl={prospect.logoUrl}
      industry={prospect.industry}
      hypotheses={prospect.workflowHypotheses}
      lossMapId={prospect.workflowLossMaps[0]?.id ?? null}
      bookingUrl={process.env.NEXT_PUBLIC_CALCOM_BOOKING_URL ?? null}
      whatsappNumber={process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? null}
      phoneNumber={process.env.NEXT_PUBLIC_PHONE_NUMBER ?? null}
      contactEmail={process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? null}
    />
  );
}
```

### Pattern 3: Evidence-Backed Dashboard Content

**What:** Instead of displaying AI-generated JSON blobs (`heroContent`, `dataOpportunities` etc.), the dashboard renders `WorkflowHypothesis` records with status `ACCEPTED`, showing their `title`, `problemStatement`, `hoursSavedWeekMid`, and matched `UseCase` records via `ProofMatch`.

**Data shape available from schema:**

```typescript
// WorkflowHypothesis fields usable in dashboard
hypothesis.title                    // "Handmatige facturatie kost 8u/week"
hypothesis.problemStatement         // long description
hypothesis.hoursSavedWeekLow        // 4
hypothesis.hoursSavedWeekMid        // 8
hypothesis.hoursSavedWeekHigh       // 12
hypothesis.handoffSpeedGainPct      // 0.35 (35%)
hypothesis.errorReductionPct        // 0.60
hypothesis.revenueLeakageRecoveredMid // 15000
hypothesis.proofMatches[].useCase.title    // "Invoice Automation"
hypothesis.proofMatches[].useCase.summary  // description
hypothesis.proofMatches[].useCase.outcomes // ["Reduced processing time 80%"]
hypothesis.proofMatches[].score            // 0.87 (relevance)
```

**Fallback strategy:** If no ACCEPTED hypotheses exist, fall back to rendering the old `heroContent`/`dataOpportunities` JSON. This prevents blank dashboards during transition.

### Pattern 4: Quote Request Mutation

**What:** New `wizard.requestQuote` tRPC mutation. Prospect clicks button, sends their interest to admin. Admin receives enriched notification with company context and matched use cases.

**Pattern follows existing `notifyAdmin()` in `lib/notifications.ts`:**

```typescript
// In server/routers/wizard.ts — add new procedure
requestQuote: publicProcedure
  .input(z.object({
    sessionId: z.string(),
    message: z.string().max(500).optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    const session = await ctx.db.wizardSession.findUnique({
      where: { id: input.sessionId },
      include: {
        prospect: {
          include: {
            workflowHypotheses: {
              where: { status: 'ACCEPTED' },
              take: 3,
              include: {
                proofMatches: {
                  orderBy: { score: 'desc' },
                  take: 2,
                  include: { useCase: { select: { title: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!session) return null;

    // Build rich notification email
    await notifyAdmin({
      prospectId: session.prospectId,
      type: 'quote_request',
      companyName: session.prospect.companyName ?? session.prospect.domain,
      slug: session.prospect.slug,
    });

    return { success: true };
  }),
```

Note: `notifyAdmin()` must be extended to support `type: 'quote_request'` — the `NotifyOptions` type currently only accepts `'first_view' | 'pdf_download' | 'call_booked'`.

### Pattern 5: Multi-Channel Contact Buttons

**What:** Four contact buttons in Step 5 (CTA step) of the dashboard:

1. Cal.com booking — already exists, uses `NEXT_PUBLIC_CALCOM_BOOKING_URL`
2. WhatsApp — `wa.me/{number}?text=Hallo+Klarifai...` — needs `NEXT_PUBLIC_WHATSAPP_NUMBER`
3. Phone call — `tel:{number}` — needs `NEXT_PUBLIC_PHONE_NUMBER`
4. Email — `mailto:{email}?subject=...` — needs `NEXT_PUBLIC_CONTACT_EMAIL`

**New env vars to add to `env.mjs`:**

```typescript
// client section
NEXT_PUBLIC_WHATSAPP_NUMBER: z.string().optional(),  // e.g. "31612345678" (no + no spaces)
NEXT_PUBLIC_PHONE_NUMBER: z.string().optional(),      // e.g. "+31612345678"
NEXT_PUBLIC_CONTACT_EMAIL: z.string().email().optional(),
```

**Implementation pattern:**

```typescript
// wa.me URL format — verified from WhatsApp business docs
const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
  `Hallo Klarifai, ik heb de analyse voor ${companyName} bekeken en wil graag een offerte ontvangen.`,
)}`;

// tel: and mailto: are standard HTML href patterns
const callUrl = `tel:${phoneNumber}`;
const emailUrl = `mailto:${contactEmail}?subject=${encodeURIComponent(
  `Offerte aanvraag - ${companyName}`,
)}`;
```

### Pattern 6: Admin Mutation to Set readableSlug

**What:** Admin needs a way to generate the readable slug for existing and new prospects. Two approaches:

Option A: Auto-generate `readableSlug` in `createProspect` using `toReadableSlug(domain)` as initial value (before company name is known). Update on enrichment when `companyName` is available.

Option B: Admin manually triggers slug generation via new `admin.generateReadableSlug` mutation.

**Recommendation:** Auto-generate from `companyName` during `enrichProspect` (or `generateContent`). Add admin UI button to regenerate/override. This avoids blank readable slugs for existing prospects — the admin can batch-generate.

**Uniqueness collision handling:**

```typescript
async function generateUniqueReadableSlug(
  db: PrismaClient,
  companyName: string,
): Promise<string> {
  const base = toReadableSlug(companyName);
  let candidate = base;
  let i = 2;
  while (await db.prospect.findUnique({ where: { readableSlug: candidate } })) {
    candidate = `${base}-${i}`;
    i++;
  }
  return candidate;
}
```

### Anti-Patterns to Avoid

- **Replacing `/discover/[slug]` entirely:** Breaking existing sent links would invalidate emails already delivered to prospects. Keep both routes.
- **Querying hypotheses in client component:** Evidence data is not public-user-sensitive but fetching it server-side (RSC) is faster and avoids a tRPC round-trip on every page load.
- **Hard-coding Klarifai contact details:** All phone, WhatsApp, email must go through env vars. Different deployments may use different contact info.
- **Showing DRAFT hypotheses:** Only `status: 'ACCEPTED'` hypotheses should appear in the prospect-facing dashboard. DRAFT and REJECTED must be hidden.

---

## Don't Hand-Roll

| Problem            | Don't Build          | Use Instead                           | Why                                                      |
| ------------------ | -------------------- | ------------------------------------- | -------------------------------------------------------- |
| Slug sanitization  | Custom regex         | Simple inline function (shown above)  | No edge cases beyond ASCII; no library needed            |
| WhatsApp URL       | WhatsApp SDK         | `wa.me` URL (plain string)            | wa.me is the official WhatsApp business deep-link format |
| Admin notification | Custom email builder | Extend existing `notifyAdmin()`       | Already handles Resend + NotificationLog — consistent    |
| Slug uniqueness    | External service     | DB-loop collision check (shown above) | Low volume, simple pattern sufficient                    |

**Key insight:** This phase is primarily UI/routing work. All the hard backend work (evidence pipeline, hypothesis approval, ProofMatch) is done. The main risk is getting the data wiring right, not building new infrastructure.

---

## Common Pitfalls

### Pitfall 1: Engagement Tracking Uses nanoid Slug, Not readableSlug

**What goes wrong:** `WizardSession.startSession` takes `slug` (the nanoid), not `readableSlug`. If the dashboard passes `readableSlug` to the session API, sessions will not be created.

**Why it happens:** The wizard router uses `prisma.prospect.findUnique({ where: { slug } })` — this is the nanoid field. The new page fetches by `readableSlug` but must pass `prospect.slug` (nanoid) down to the client component for session tracking.

**How to avoid:** The server component must select BOTH `slug` (nanoid) and `readableSlug` from Prisma. Pass `prospectSlug` (nanoid) as a separate prop to `DashboardClient`. The `wizardRouter` session mutations do not need to change.

**Warning signs:** Sessions not created, engagement tracking silent, no "first_view" notification firing.

### Pitfall 2: Slug Collision on Company Name

**What goes wrong:** Two prospects both named "Bakker BV" get slug `bakker-bv`. The `@unique` constraint will throw.

**Why it happens:** Company names are not globally unique.

**How to avoid:** Use `generateUniqueReadableSlug()` with suffix loop. Admin can also manually override.

**Warning signs:** Prisma `UniqueConstraintViolation` on enrichment/slug generation.

### Pitfall 3: Empty Dashboard When No Accepted Hypotheses

**What goes wrong:** Prospect opens dashboard, sees blank pain points section because no hypotheses are ACCEPTED yet.

**Why it happens:** Phase 7 gate means outreach won't fire without approved hypotheses — but a prospect might receive an old link before the gate was active, or admin may have sent the link before approving hypotheses.

**How to avoid:** Build a graceful fallback: if `workflowHypotheses.length === 0`, show a message like "Jouw analyse wordt nog verfijnd" OR fall back to the old AI-generated content from `heroContent`/`dataOpportunities` if present.

**Warning signs:** Empty step with no content, confused prospect.

### Pitfall 4: notifyAdmin Type Mismatch for quote_request

**What goes wrong:** `lib/notifications.ts` currently types the `type` field as a union `'first_view' | 'pdf_download' | 'call_booked'`. Adding `'quote_request'` without updating the type causes TypeScript errors.

**How to avoid:** Update `NotifyOptions.type` to include `'quote_request'`, add corresponding subject/body template strings.

### Pitfall 5: wa.me Number Format

**What goes wrong:** WhatsApp `wa.me` URLs require the number without `+`, without spaces, with country code. `+31 6 12 34 56 78` must become `31612345678`.

**How to avoid:** Validate and strip the env var: `NEXT_PUBLIC_WHATSAPP_NUMBER.replace(/[^0-9]/g, '')`. Document the expected format in env.mjs schema description.

### Pitfall 6: Missing readableSlug Migration for Existing Prospects

**What goes wrong:** Existing prospects have no `readableSlug`. The admin panel shows a "Share" button that constructs the old `/discover/slug` URL. After this phase, the button should offer the new `/voor/slug` URL — but only if `readableSlug` is set.

**How to avoid:** Admin list page should conditionally show `/voor/` URL when `readableSlug` is present, otherwise keep `/discover/` URL. Add a "Generate readable link" button per prospect in the admin detail page.

---

## Code Examples

Verified patterns from codebase inspection:

### Fetching evidence for a prospect (server-side, follows existing patterns)

```typescript
// Source: server/routers/hypotheses.ts — listByProspect query pattern
const prospect = await prisma.prospect.findUnique({
  where: { readableSlug: slug },
  select: {
    id: true,
    slug: true, // nanoid — for session tracking
    companyName: true,
    domain: true,
    industry: true,
    logoUrl: true,
    status: true,
    workflowHypotheses: {
      where: { status: 'ACCEPTED' },
      orderBy: { confidenceScore: 'desc' },
      take: 6,
      include: {
        proofMatches: {
          orderBy: { score: 'desc' },
          take: 3,
          include: {
            useCase: {
              select: {
                id: true,
                title: true,
                summary: true,
                category: true,
                outcomes: true,
                externalUrl: true,
              },
            },
          },
        },
      },
    },
    workflowLossMaps: {
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: { id: true },
    },
  },
});
```

### Extending notifyAdmin for quote_request

```typescript
// Source: lib/notifications.ts — extend existing interface and maps
interface NotifyOptions {
  prospectId: string;
  type: 'first_view' | 'pdf_download' | 'call_booked' | 'quote_request';
  companyName: string;
  slug: string;
  matchedUseCases?: string[];  // optional for richer quote emails
}

// Add to subjects map:
quote_request: `${companyName} vraagt een offerte aan`,

// Add to bodies map:
quote_request: `<h2>${companyName} heeft een offerte aanvraag ingediend</h2>
  <p>Ze hebben de analyse bekeken en willen graag een voorstel ontvangen.</p>
  ${matchedUseCases?.length ? `<p><strong>Gematchte use cases:</strong> ${matchedUseCases.join(', ')}</p>` : ''}
  <p><a href="${adminUrl}/admin/prospects/${prospectId}">Bekijk prospect details</a></p>`,
```

### WhatsApp URL construction

```typescript
// Source: WhatsApp Business API docs — wa.me format
// NEXT_PUBLIC_WHATSAPP_NUMBER should be "31612345678" (no + or spaces)
const whatsappText = encodeURIComponent(
  `Hallo Klarifai, ik heb de analyse voor ${companyName} bekeken en wil graag meer informatie.`,
);
const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappText}`;
```

### Prisma schema addition

```prisma
// Add to Prospect model in prisma/schema.prisma
readableSlug String? @unique @db.VarChar(80)

// Add to @@index list
@@index([readableSlug])
```

### Admin: generating readable slug on enrichment

```typescript
// Source: server/routers/admin.ts — enrichProspect pattern
// Add to buildEnrichmentData when companyName is available:
if (enriched.companyName && !currentProspect.readableSlug) {
  const readableSlug = await generateUniqueReadableSlug(
    ctx.db,
    enriched.companyName,
  );
  updateData.readableSlug = readableSlug;
}
```

---

## State of the Art

| Old Approach                             | Current Approach                                 | When Changed      | Impact                                                         |
| ---------------------------------------- | ------------------------------------------------ | ----------------- | -------------------------------------------------------------- |
| AI-generated JSON wizard content         | Evidence-backed hypotheses from Phase 8 pipeline | Phase 8 completed | Dashboard shows verified pain points, not hallucinated content |
| nanoid slugs only (`/discover/abc12345`) | Dutch readable slugs (`/voor/bedrijfsnaam`)      | Phase 11          | Prospect URLs are shareable, memorable, professional           |
| No quote flow                            | One-click quote request with admin notification  | Phase 11          | Closes the conversion loop without requiring Cal.com booking   |
| Cal.com only as CTA                      | Cal.com + WhatsApp + call + email                | Phase 11          | Multi-channel preference coverage                              |

**Deprecated/outdated:**

- The `heroContent`, `dataOpportunities`, `automationAgents`, `successStories`, `aiRoadmap` JSON fields on `Prospect`: These are legacy AI-generated content. Phase 11 supersedes them with evidence-backed data. They should be kept as fallback but not as primary content source.

---

## Open Questions

1. **Should /voor/ redirect or coexist with /discover/?**
   - What we know: `/discover/[slug]` emails have already been sent to real prospects. Breaking those links is bad.
   - What's unclear: Should `/voor/[slug]` and `/discover/[slug]` show different UIs, or the same dashboard?
   - Recommendation: Coexist. `/voor/[slug]` is the new primary dashboard UI. `/discover/[slug]` keeps the old wizard UI for backward compat. This is clean and safe. The planner can decide if updating `/discover/` to show the new UI too (with graceful fallback) is in scope.

2. **Auto-generate readableSlug on prospect creation, or admin-triggered?**
   - What we know: `createProspect` only has `domain` at creation time; `companyName` comes from enrichment. Generating from domain could produce ugly slugs like `bakker-bv-nl`.
   - What's unclear: Whether admin wants control over the readable URL or wants it automatic.
   - Recommendation: Auto-generate from `companyName` during `enrichProspect`. Show in admin detail. Add an "override" text field. This is the least friction path.

3. **Should the quote request log to a WizardSession event, or a new model?**
   - What we know: `WizardSession` tracks `pdfDownloaded`, `callBooked` booleans. A `quoteRequested` boolean would be consistent.
   - What's unclear: Does the planner want a separate `QuoteRequest` model with message text?
   - Recommendation: Add `quoteRequested Boolean @default(false)` and `quoteRequestedAt DateTime?` to `WizardSession`. This is consistent with existing tracking pattern. If message text is needed, store in `NotificationLog.metadata`.

4. **What happens if a prospect has accepted hypotheses but no ProofMatches?**
   - What we know: `matchProofs()` must be run after hypotheses are approved. If admin approved hypotheses but never ran match, `proofMatches` will be empty.
   - Recommendation: Dashboard should still show the hypothesis title/problemStatement even with no proof matches. Proof section collapses gracefully.

5. **Is canvas-confetti appropriate for quote request celebration?**
   - What we know: It is installed (`package.json`). The wizard already has motion animations.
   - Recommendation: Small confetti burst on quote submit is a nice touch and costs nothing (already installed). Optional — planner decides.

---

## Sources

### Primary (HIGH confidence)

- `/home/klarifai/Documents/klarifai/projects/qualifai/app/discover/[slug]/page.tsx` — current wizard routing pattern
- `/home/klarifai/Documents/klarifai/projects/qualifai/app/discover/[slug]/wizard-client.tsx` — full wizard client component
- `/home/klarifai/Documents/klarifai/projects/qualifai/prisma/schema.prisma` — complete data model
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/wizard.ts` — session tracking mutations
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/proof.ts` — ProofMatch query patterns
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/hypotheses.ts` — hypothesis + proofMatch include patterns
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/notifications.ts` — notifyAdmin pattern
- `/home/klarifai/Documents/klarifai/projects/qualifai/env.mjs` — declared env vars (NEXT_PUBLIC_CALCOM_BOOKING_URL exists, WhatsApp/phone/email not yet declared)
- `/home/klarifai/Documents/klarifai/projects/qualifai/package.json` — all installed dependencies

### Secondary (MEDIUM confidence)

- WhatsApp `wa.me` deep-link format: `https://wa.me/{number}?text={encoded}` — standard documented behavior, widely used

### Tertiary (LOW confidence)

- None — all claims are grounded in direct codebase inspection

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries already installed, confirmed in package.json
- Architecture: HIGH — routing pattern matches existing `/discover/[slug]` exactly; data model inspected directly
- Pitfalls: HIGH — all pitfalls derived from direct code reading (slug field, type union, session tracking fields)
- Data availability: HIGH — ProofMatch + WorkflowHypothesis + UseCase all confirmed in schema with correct relations

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (stable stack, no fast-moving dependencies)

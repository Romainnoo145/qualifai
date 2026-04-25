# Qualifai Warm-Track Launch (Maintix First Send)

**Date:** 2026-04-25
**Status:** Design — pending user review
**First prospect:** Maintix (warm — on-site visit completed, bespoke voorstel HTML exists at `clientprojects/maintix/design-showcase/index.html`)

## Context

Qualifai has shipped end-to-end functionality for the cold-acquisition track (research → analyse → standard 7-page brochure → outreach), but has never been used to deliver a real offerte. The first real send is a warm prospect (Maintix), where:

- The proposal narrative is already authored as a 1932-line bespoke HTML page (deployed at `maintix-design.vercel.app`)
- The standard auto-generated brochure template is **not** suitable — the bespoke pitch is much richer
- Maintix is a startup with little to scrape; the research pipeline does not apply
- What's missing to send a real offerte: production deployment, formal commercial layer (line items + signing), email-sending bridge from Quote to Resend, and a way to host the bespoke voorstel under Qualifai's domain so view-tracking + branding are unified

This spec captures the design decisions to deliver Maintix's offerte through Qualifai while introducing a **dual-track** architecture that keeps the existing cold-acquisition flow intact.

## Two-Track Model

| Aspect                            | Cold (auto-acquisition)                                      | Warm (on-site visit)                            |
| --------------------------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| Trigger                           | Research pipeline auto-generates                             | Manual prospect record after visit              |
| Voorstel content                  | Standard 7-page brochure (template + AI-generated narrative) | Bespoke per-prospect pitch (hand-authored HTML) |
| Voorstel route                    | `/voorstel/[slug]` renders standard brochure                 | `/voorstel/[slug]` serves bespoke static HTML   |
| Offerte (formal commercial layer) | Shared: `/offerte/[slug]` with line items + akkoord          | Shared: `/offerte/[slug]`                       |
| Email content                     | AI-generator + cadence (deferred to later phase)             | Hand-typed in EmailCompose modal                |
| View tracking                     | Identical (POST `/api/offerte/viewed`)                       | Identical                                       |
| Quote model usage                 | Identical                                                    | Identical                                       |

The same Prospect/Quote/OutreachLog plumbing serves both tracks. The only branching is at the voorstel-rendering layer based on `prospect.voorstelMode`.

## Route Restructure (current state → target state)

Currently `/offerte/[slug]` serves the **full** 7-page brochure (narrative + formal commercial merged into one component, `BrochureCover` in `components/features/offerte/brochure-cover.tsx`). To support the dual-track model we split this into two routes with distinct responsibilities:

| Route              | Today                | Target                                                                                                                                                                                                                     |
| ------------------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/voorstel/[slug]` | does not exist       | **The pitch.** Cold prospect → renders the narrative pages of the standard brochure (current pages 1, 2, 3, 5 of `BrochureCover`). Warm prospect → serves the bespoke static HTML from `public/bespoke/{bespokeKey}.html`. |
| `/offerte/[slug]`  | full 7-page brochure | **The formal commercial page only.** Renders pages 4 (Investering / line items), 6 (Signing / akkoord), 7 (Closing / CTA). Same component for both tracks.                                                                 |

The `BrochureCover` component is split internally into two render paths driven by a prop (e.g. `<BrochureCover mode="voorstel" />` vs `<BrochureCover mode="offerte" />`), or extracted into two smaller components — implementation detail decided in the plan phase. From the user-facing perspective: voorstel is what the prospect first sees, offerte is the next click.

## Phase Breakdown

The first warm send (Maintix) is the driver. Each phase is an executable chunk; each can be planned and shipped independently.

### Fase 0 — Production deployment

**Goal:** Qualifai live at `qualifai.klarifai.nl`.

- Vercel project for the Next.js app, connected to the qualifai repo
- Railway services for Postgres + Redis (matches local Docker setup: `qualifai-db`, `qualifai-redis`)
- DNS: A/CNAME for `qualifai.klarifai.nl` → Vercel
- Production env vars: `DATABASE_URL`, `REDIS_URL`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `OUTREACH_FROM_EMAIL=Romano Kanters <info@klarifai.nl>`, `OUTREACH_REPLY_TO_EMAIL=info@klarifai.nl`, `OUTREACH_UNSUBSCRIBE_EMAIL=info@klarifai.nl`, `GEMINI_API_KEY`, `LINKEDIN_COOKIES`, `SCRAPLING_API_URL`, plus any other env entries enumerated in `env.mjs`
- Run Prisma migrations against production DB
- Resend domain `klarifai.nl` already verified (DKIM/SPF) — confirm it's active for the production sender
- Webhook endpoint `/api/webhooks/resend` reachable for bounce/reply handling
- Smoke-test base routes: `/admin`, `/api/healthz` (or equivalent), no 500s

**Out of scope:** custom error pages, auth hardening beyond what already exists, observability tooling.

### Fase 1 — Route split + responsive parity on `/offerte/[slug]` (formal page only)

**Goal:** introduce the route split (extract formal pages into `/offerte/[slug]`, leave narrative pages reachable later via `/voorstel/[slug]`), and make the formal page fully responsive at 375px / 768px / 1024px / 1440px.

**Route work:**

- Extract pages 4, 6, 7 from `BrochureCover` into the `/offerte/[slug]` render path so this route shows only the formal sequence (Investering → Signing → Closing/CTA)
- The narrative pages (1, 2, 3, 5) remain in the codebase but are not yet served by any route — they'll be wired into `/voorstel/[slug]` in Fase 1.5 for cold-track prospects
- For warm-track prospects, `/offerte/[slug]` is reached from the bespoke HTML's CTA; the narrative pages are never reached because the bespoke HTML replaces them

**Responsive scope (formal pages only, mirror analyse 1:1):**

- **Page 4 — Investering** (line items table + summary card)
- **Page 6 — Signing** (akkoordverklaring + signature canvas)
- **Page 7 — Closing / CTA**
- **`components/shared/brochure-chrome.tsx`** — chrome + nav arrows reposition on mobile

**Pattern source:** mirror `components/features/analyse/analyse-brochure.tsx` 1:1.

- Typography → `clamp()` on hero/section headings (specific values per page, taken from analyse)
- Breakpoints → `1024px` (tablet) and `768px` (mobile), identical to analyse
- Padding scale → desktop `120px 72px 160px` / `≤1024px` `28px 40px` / `≤768px` `90px 24px 180px`
- Grid collapse on Page 4: header row `32px 1fr 64px 120px` becomes stacked card-form on `≤768px` (omschrijving boven, uren+bedrag onder)
- Chrome reposition: logo + arrows from `48px` → `24px` on `≤768px`
- Mobile main becomes scrollable (`position: relative; overflow-y: auto`) with scroll-mask gradients under fixed chrome (analyse:129-146)

**Out of scope:** narrative pages 1, 2, 3, 5 — those are cold-track territory, fixed in Fase 3.

**Verification:** browse at 375px / 768px / 1024px / 1440px after each page-fix, side-by-side with `/analyse/[slug]` reference.

### Fase 1.5 — Warm-track architecture + Maintix bespoke

**Goal:** the route `/voorstel/[slug]` serves a per-prospect bespoke HTML for warm prospects, while still rendering the standard brochure for cold prospects. Maintix is the first warm prospect.

**Schema changes (Prospect model):**

- `voorstelMode` enum: `STANDARD` | `BESPOKE` (default `STANDARD`)
- `bespokeKey` string (nullable) — when `voorstelMode === 'BESPOKE'`, identifies the static HTML file to serve (e.g., `'maintix'` → `public/bespoke/maintix.html`)

**Routing logic at `/voorstel/[slug]/page.tsx`:**

1. Look up prospect by slug
2. If `voorstelMode === 'BESPOKE'` and `bespokeKey` set: serve the static HTML at `public/bespoke/{bespokeKey}.html` with a server-rendered `<script>` tracking-pixel injected before `</body>` that POSTs to `/api/offerte/viewed` with the prospect slug + `'voorstel'` page key
3. If `voorstelMode === 'STANDARD'`: render the narrative pages of `BrochureCover` (pages 1, 2, 3, 5 — extracted in Fase 1's route split), with the existing tracking-pixel/view-recording behavior. **Note:** for the first warm send (Maintix), this branch is exercised only if a cold prospect lands here; cold-track responsive treatment of these pages is Fase 3.

**Storage for bespoke voorstellen:** static HTML files in `public/bespoke/[bespokeKey].html`, version-controlled. New warm prospect = copy HTML file + commit + push. Vercel auto-deploys.

**Maintix-specific work:**

- Copy `clientprojects/maintix/design-showcase/index.html` → `public/bespoke/maintix.html`
- Create `Prospect` record in production DB: `companyName: 'Maintix'`, `slug: 'maintix'`, `voorstelMode: 'BESPOKE'`, `bespokeKey: 'maintix'`, plus minimum required fields (no research data)
- Update the showcase HTML's "Klaar om te starten?" CTA at the bottom to link to `/offerte/maintix`
- Verify the showcase renders correctly on qualifai.klarifai.nl/voorstel/maintix
- Verify view-tracking pixel fires (check OutreachLog or equivalent on first manual visit)

**Admin UI:** small affordance to set `voorstelMode` + `bespokeKey` on a prospect record. Minimal — checkbox + text input on prospect detail page.

**Out of scope:** dynamic content composition between bespoke HTML and quote data (e.g., showing live line items inside the showcase). The showcase points to `/offerte/maintix` for that. If we later need this, we upgrade to React-component storage.

### Fase 2 — Quote → email bridge

**Goal:** clicking "Verstuur" on a quote in admin sends a real email via Resend that delivers the voorstel link to the prospect, and atomically transitions the quote to `SENT`.

**Backend:**

- Add `quotes.sendEmail` mutation to `server/routers/quotes.ts`:
  - Input: `{ quoteId, to, subject, bodyHtml, bodyText? }`
  - Validates quote belongs to `ctx.projectId`, status is `DRAFT`
  - Calls `sendOutreachEmail()` (existing in `lib/outreach/send-email.ts`) — extend if needed to accept a `quoteId` reference
  - Within a single Prisma transaction: write `OutreachLog` entry (with `quoteId`, `type: 'QUOTE_DELIVERY'`), transition Quote `DRAFT → SENT` (state machine in `lib/state-machines/quote.ts` already handles snapshot freeze)
  - On Resend failure: do not transition status, surface error to UI

**OutreachLog schema:** add nullable `quoteId` foreign key + new enum value `QUOTE_DELIVERY` on `OutreachType`.

**Frontend (existing EmailCompose modal in `components/features/quotes/email-compose.tsx`):**

- Wire the modal's send button to call `quotes.sendEmail`
- On success: close modal, refresh quote detail, show toast "Verstuurd naar {email}"
- Hand-typed body for first send (no AI pre-fill in this phase)
- Include the voorstel URL (`https://qualifai.klarifai.nl/voorstel/[slug]`) clearly in the email — admin types this manually for the first send; later phases may auto-insert

**Contact resolution (deferred):** for Maintix the admin types the recipient email directly into the modal. Mapping `Quote → primary Contact` is not in this phase; it becomes relevant when we automate cadence for warm/cold tracks.

**Out of scope this phase:**

- AI generation of email body (deferred — separate phase for cold track)
- Cadence/follow-up scheduling after quote send (deferred — current behavior is manual)
- Multi-recipient send

### Fase 3 — Cold-track responsive brochure (deferred)

**Goal:** apply analyse-mirror responsive treatment to the remaining narrative pages of the standard brochure (cover, uitdaging, aanpak, scope), plus the cover video fallback.

**Trigger:** the first cold-acquisition prospect is genuinely ready to send.

**Includes:**

- Cover video mobile fallback: CSS-rendered title card (navy bg, Klarifai mark top-left, "Voorstel.[gold period]" + "voor [Company]" in Sora display centered, no asset). Decision logged here so it doesn't get re-litigated.
- All narrative pages mirror analyse responsive patterns (same as Fase 1)

**Not started until needed.**

## Decisions (with rationale)

- **Dual-track over forced unification.** Bespoke voorstellen for warm prospects are richer than what the auto-template can produce. Forcing Maintix-quality content through the cold-track template would waste the polish already invested.
- **Static HTML storage (option C) over React component (A) or DB blob (B).** For warm voorstellen, copy-paste an authored HTML file is the lowest-friction author flow. We don't currently need dynamic composition between bespoke pages and quote data — `/offerte/[slug]` is the formal layer. If that need emerges, upgrade to component storage.
- **Hand-typed email for first warm send over AI-assist.** Sets the tone gold standard manually. AI-generation is meaningful for cold (high volume); warm sends are 1-of-1.
- **Fase 1 scoped to formal `/offerte/[slug]` only.** The narrative pages of the brochure are not on the critical path for the first send (Maintix bypasses them). Treating them now would be premature.
- **Mirror analyse 1:1 (option C from earlier discussion).** Refactoring to a shared `<BrochurePage>` wrapper is YAGNI until a third brochure surface appears.
- **Atomic email-send + status transition.** Prevents the divergent state where the quote is marked SENT but no email actually went out (or vice versa).

## Open items (acknowledged, not blocking the spec)

- Exact production DNS provider/setup steps for `qualifai.klarifai.nl` — operational, resolved during Fase 0 execution
- Whether `prospect.slug` for Maintix needs to be reserved/manually set vs auto-derived — settled during Fase 1.5 implementation
- Tracking-pixel implementation detail (script vs `<img>` beacon, idempotency on reload) — settled during Fase 1.5
- Resend webhook secret rotation policy — operational, not part of this spec

## Out of scope (explicit non-goals)

- AI-generated email drafts for warm track
- Auto-cadence after quote SENT
- Contact-record linkage from Quote (Quote stays prospectId-only for now)
- Admin UI for cadence config (per-prospect or per-stage tuning)
- Refactor of brochure into shared component layer
- Cold-track responsive (Fase 3, deferred)
- Multi-tenant changes (project_id filtering already enforced)

## Success criteria

The first real warm send (Maintix) is successful when:

1. `qualifai.klarifai.nl` resolves and serves the production app
2. `/voorstel/maintix` renders the bespoke showcase, fully styled, branded under qualifai.klarifai.nl
3. View on `/voorstel/maintix` is recorded in `OutreachLog` (or equivalent)
4. `/offerte/maintix` renders the formal page with line items + total + akkoord, fully responsive at 375px / 768px / 1024px / 1440px
5. From admin, the "Verstuur" flow sends a real email via Resend to Maintix's contact, the quote transitions to `SENT`, and the OutreachLog records the send with `quoteId` reference
6. Maintix's recipient receives an email with a working `qualifai.klarifai.nl/voorstel/maintix` link

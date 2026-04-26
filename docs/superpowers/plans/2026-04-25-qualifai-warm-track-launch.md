# Qualifai Warm-Track Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Qualifai to production at `qualifai.klarifai.nl` and deliver Maintix's warm-track offerte through it: a bespoke voorstel page + a formal `/offerte/[slug]` page + a real Resend email send wired to the Quote state machine.

**Architecture:** Dual-track at the route layer (`/voorstel/[slug]` for the pitch, `/offerte/[slug]` for the formal commercial page). `BrochureCover` is split internally via a `mode` prop into narrative vs formal render paths. Warm prospects (Maintix) get bespoke static HTML served via a Route Handler with a server-injected tracking pixel. The Quote→email bridge is a single tRPC mutation that writes an `OutreachLog`, calls Resend, and transitions Quote `DRAFT → SENT` atomically.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Prisma, tRPC v11, PostgreSQL (Railway), Redis (Railway), Resend, Vercel, Tailwind CSS, framer-motion.

**Spec:** `docs/superpowers/specs/2026-04-25-qualifai-warm-track-launch.md` (commit `a94c6f7`).

---

## File Structure

### Created

- `public/bespoke/maintix.html` — copy of Maintix design-showcase, CTA edited to `/offerte/maintix`
- `app/voorstel/[slug]/route.ts` — Route Handler that serves bespoke HTML for warm prospects, 404 for STANDARD (deferred)
- `prisma/migrations/<timestamp>_prospect_voorstel_mode/migration.sql` — adds `VoorstelMode` enum + `voorstelMode` + `bespokeKey` to Prospect
- `prisma/migrations/<timestamp>_outreach_log_quote_id/migration.sql` — adds `quoteId` FK on OutreachLog + `QUOTE_DELIVERY` enum value
- `docs/operations/qualifai-deploy.md` — production deployment runbook

### Modified

- `prisma/schema.prisma` — schema changes for both migrations above
- `components/features/offerte/brochure-cover.tsx` — adds `mode: 'voorstel' | 'offerte'` prop, conditional render, responsive CSS for pages 4/6/7
- `components/shared/brochure-chrome.tsx` — responsive chrome (logo + arrows reposition on `≤768px`)
- `app/offerte/[slug]/page.tsx` — passes `mode="offerte"` to `BrochureCover`
- `app/admin/prospects/[id]/page.tsx` — minimal UI (checkbox + text input) for `voorstelMode` + `bespokeKey`
- `server/routers/admin.ts` — extend prospect-update mutation to accept `voorstelMode` + `bespokeKey`
- `server/routers/quotes.ts` — adds `sendEmail` mutation
- `server/routers/quotes.test.ts` — tests for `sendEmail`
- `lib/outreach/send-email.ts` — extend to accept optional `quoteId` for OutreachLog metadata
- `app/admin/quotes/[slug]/page.tsx` — drop `as any` cast on `sendEmailMutation` once router exposes it

### Decisions locked here

- **BrochureCover split via prop, not separate components.** Single source for chrome and shared layout; `mode` switches which pages render. Less file churn, easier responsive work.
- **Warm-track served by Route Handler, STANDARD deferred to Fase 3.** `/voorstel/[slug]/route.ts` returns 404 for STANDARD prospects until Fase 3 wires the cold-track render path. Saves the renderToString complexity for now.
- **Pixel injection is a `<script>` block** (POST to `/api/offerte/viewed` with `prospectId`), inserted server-side just before `</body>` in the bespoke HTML string. The existing endpoint already handles SENT→VIEWED transition.
- **Maintix recipient = a Contact record.** Required because `OutreachLog.contactId` is non-nullable. Created manually as part of Fase 1.5 setup.

---

## Fase 0 — Production deployment

### Task 1: Create deployment runbook

**Files:**

- Create: `docs/operations/qualifai-deploy.md`

- [ ] **Step 1: Write the runbook**

```markdown
# Qualifai Production Deployment

## Target

- App: Vercel — `qualifai.klarifai.nl`
- DB: Railway PostgreSQL (matches local `qualifai-db` schema)
- Cache: Railway Redis (matches local `qualifai-redis`)
- Email: Resend (domain `klarifai.nl` already DKIM/SPF verified)

## One-time setup checklist

1. Vercel project linked to qualifai repo
2. Railway project with Postgres + Redis services
3. DNS: CNAME `qualifai.klarifai.nl` → `cname.vercel-dns.com` (via Klarifai DNS provider)
4. Vercel env vars (production scope) — see "Required Env Vars" below
5. Run Prisma migrations against production DATABASE_URL
6. Verify base routes return 200 (not 500)

## Required Env Vars (production)

- `DATABASE_URL` (Railway Postgres)
- `REDIS_URL` (Railway Redis)
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `OUTREACH_FROM_EMAIL=Romano Kanters <info@klarifai.nl>`
- `OUTREACH_REPLY_TO_EMAIL=info@klarifai.nl`
- `OUTREACH_UNSUBSCRIBE_EMAIL=info@klarifai.nl`
- `GEMINI_API_KEY`
- `LINKEDIN_COOKIES`
- `SCRAPLING_API_URL`
- Plus everything else listed in `env.mjs`

## Smoke tests (run after deploy)

- `curl https://qualifai.klarifai.nl/` → 200
- `curl https://qualifai.klarifai.nl/admin` → 200 (or auth redirect)
- Visit `/admin` in browser, confirm tRPC works
- Confirm `/api/webhooks/resend` reachable (POST returns 401 without secret — that's correct)
```

- [ ] **Step 2: Commit**

```bash
git add docs/operations/qualifai-deploy.md
git commit -m "docs(ops): qualifai production deploy runbook"
```

### Task 2: Set up Vercel project

This is interactive and can't be fully scripted. Follow the runbook from `docs/operations/qualifai-deploy.md`.

- [ ] **Step 1: Run `npx vercel` from repo root**

```bash
npx vercel
```

Answer prompts:

- Set up and deploy: **yes**
- Scope: **Klarifai**
- Link to existing: **no**
- Project name: `qualifai`
- Root directory: `./`
- Override settings: **no**

- [ ] **Step 2: Confirm preview deploy succeeded**

Vercel returns a preview URL like `qualifai-<hash>.vercel.app`. Visit it — it should serve the homepage even without DB env vars (will 500 on tRPC routes; that's expected pre-config).

- [ ] **Step 3: Add custom domain `qualifai.klarifai.nl` in Vercel dashboard**

Project → Settings → Domains → Add `qualifai.klarifai.nl`. Vercel shows the required DNS record (typically CNAME to `cname.vercel-dns.com`).

### Task 3: Set up Railway services

- [ ] **Step 1: Create Railway project, add PostgreSQL + Redis services**

Via Railway dashboard: New Project → add Postgres, then add Redis. Both auto-provision.

- [ ] **Step 2: Capture connection strings**

From Railway → each service → Connect tab:

- `DATABASE_URL` (Postgres external URL)
- `REDIS_URL` (Redis external URL)

Save these for Task 5.

### Task 4: Configure DNS

- [ ] **Step 1: Add CNAME record**

In Klarifai's DNS provider:

- Name: `qualifai`
- Type: `CNAME`
- Value: `cname.vercel-dns.com`
- TTL: default

- [ ] **Step 2: Wait for propagation, verify**

```bash
dig qualifai.klarifai.nl CNAME +short
```

Expected output: `cname.vercel-dns.com.` (or similar). Vercel dashboard will mark domain as "Valid Configuration".

### Task 5: Configure production env vars in Vercel

- [ ] **Step 1: Add env vars via Vercel dashboard or CLI**

Project → Settings → Environment Variables → Add for **Production** scope. Set each var listed in the runbook (Task 1). For secrets like `RESEND_API_KEY`, use existing keys from local `.env.local`.

- [ ] **Step 2: Trigger production redeploy**

```bash
npx vercel --prod
```

This picks up the new env vars and DNS.

### Task 6: Run Prisma migrations against production DB

- [ ] **Step 1: Run migrations**

From local terminal with `DATABASE_URL` pointing to Railway:

```bash
DATABASE_URL="<railway-postgres-url>" npx prisma migrate deploy
```

Expected: all existing migrations applied to production DB.

- [ ] **Step 2: Verify schema**

```bash
DATABASE_URL="<railway-postgres-url>" npx prisma db pull --print | head -50
```

Confirm Prospect, Quote, OutreachLog tables exist.

### Task 7: Smoke-test the production deployment

- [ ] **Step 1: Hit base routes**

```bash
curl -I https://qualifai.klarifai.nl/
curl -I https://qualifai.klarifai.nl/admin
```

Both should return 200 (or auth redirect for `/admin`). No 500s.

- [ ] **Step 2: Confirm Resend webhook endpoint reachable**

```bash
curl -X POST https://qualifai.klarifai.nl/api/webhooks/resend
```

Expected: `401` or `400` (signature/payload missing) — proves the route is wired, just rejecting unsigned requests.

- [ ] **Step 3: Visit /admin in browser, confirm tRPC works**

Open `https://qualifai.klarifai.nl/admin` in browser. The page should load, show your data (or empty state if none seeded), and have no console errors.

- [ ] **Step 4: Mark Fase 0 complete in `.planning/STATE.md`**

```bash
git add .planning/STATE.md
git commit -m "ops(deploy): qualifai live at qualifai.klarifai.nl"
```

---

## Fase 1 — Route split + responsive parity on `/offerte/[slug]`

### Task 8: Add `mode` prop to BrochureCover (signature only)

**Files:**

- Modify: `components/features/offerte/brochure-cover.tsx`

- [ ] **Step 1: Add `mode` to component props interface**

Locate the Props interface near the top of the file. Add:

```typescript
mode: 'voorstel' | 'offerte';
```

- [ ] **Step 2: Set default at component callsites that haven't been updated yet**

For the time being, add a runtime default if `mode` is undefined (defensive, removed once all callers updated):

```typescript
const renderMode: 'voorstel' | 'offerte' = mode ?? 'voorstel';
```

- [ ] **Step 3: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: errors at any callsite still passing no `mode` prop. Note them — fixed in Task 9.

- [ ] **Step 4: Commit (signature change, no behavior change)**

```bash
git add components/features/offerte/brochure-cover.tsx
git commit -m "refactor(offerte): add mode prop to BrochureCover (no behavior change)"
```

### Task 9: Update `/offerte/[slug]/page.tsx` to pass `mode="offerte"`

**Files:**

- Modify: `app/offerte/[slug]/page.tsx:51-58`

- [ ] **Step 1: Pass mode prop**

Edit the JSX:

```typescript
return (
  <BrochureCover
    mode="offerte"
    slug={slug}
    prospect={...}
    quote={...}
  />
);
```

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors related to BrochureCover props.

- [ ] **Step 3: Commit**

```bash
git add app/offerte/[slug]/page.tsx
git commit -m "feat(offerte): pass mode=offerte from /offerte/[slug]"
```

### Task 10: Conditionally render pages based on mode

**Files:**

- Modify: `components/features/offerte/brochure-cover.tsx`

- [ ] **Step 1: Identify the page array / render structure**

`BrochureCover` renders a sequence of pages (currently all 7). Find the list/sequence where pages are emitted.

- [ ] **Step 2: Wrap each page in a conditional**

For pages 1, 2, 3, 5 (cover, uitdaging, aanpak, scope) — render only when `mode === 'voorstel'`.
For pages 4, 6, 7 (investering, signing, closing) — render only when `mode === 'offerte'`.

Pseudocode pattern (apply to each page block):

```typescript
{mode === 'voorstel' && (
  <Page1Cover ... />
)}
{mode === 'offerte' && (
  <Page4Investering ... />
)}
```

If page navigation (next/back arrows, page indices) is index-based, also recompute the visible-page count and active-index logic so the chrome reflects only the rendered pages.

- [ ] **Step 3: Manual smoke test**

Start dev server and visit `http://localhost:9200/offerte/<existing-slug>`:

```bash
npm run dev
```

Confirm: only formal pages (4, 6, 7) render. Narrative pages (1, 2, 3, 5) absent. Page nav shows correct count.

- [ ] **Step 4: Commit**

```bash
git add components/features/offerte/brochure-cover.tsx
git commit -m "feat(offerte): conditional render of pages by mode"
```

### Task 11: Responsive Page 4 — Investering (typography + container padding)

**Files:**

- Modify: `components/features/offerte/brochure-cover.tsx` (page 4 block, around `:837`)

- [ ] **Step 1: Replace fixed page padding with responsive scale**

Current page wrapper has `padding: '120px 72px 160px'`. Change to a CSS-class-based approach. Add this CSS to the existing `<style jsx>` block (or extract to a shared CSS file if already done in analyse-brochure):

```css
.offerte-page-4 {
  padding: 120px 72px 160px;
}
@media (max-width: 1024px) {
  .offerte-page-4 {
    padding: 28px 40px !important;
  }
}
@media (max-width: 768px) {
  .offerte-page-4 {
    padding: 90px 24px 180px !important;
  }
}
```

Apply `className="offerte-page-4"` to page 4's wrapper div, remove the inline `padding` style.

- [ ] **Step 2: Replace fixed h1 size with `clamp()`**

Find the page 4 hero heading (currently `fontSize: '64px'` around line 240 area). Replace with:

```typescript
style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}
```

- [ ] **Step 3: Manual visual check at 768px and 1440px**

Resize browser, confirm padding + heading scale.

- [ ] **Step 4: Commit**

```bash
git add components/features/offerte/brochure-cover.tsx
git commit -m "feat(offerte): responsive padding + clamp h1 on Investering page"
```

### Task 12: Responsive Page 4 — line items table → mobile card stack

**Files:**

- Modify: `components/features/offerte/brochure-cover.tsx` (around `:854, 876` — header row + data rows with `gridTemplateColumns: '32px 1fr 64px 120px'`)

- [ ] **Step 1: Replace inline grid with responsive class**

Add CSS:

```css
.offerte-line-row {
  display: grid;
  grid-template-columns: 32px 1fr 64px 120px;
  gap: 16px;
  align-items: center;
}
.offerte-line-header {
  /* same grid */
  display: grid;
  grid-template-columns: 32px 1fr 64px 120px;
  gap: 16px;
}
@media (max-width: 768px) {
  .offerte-line-header {
    display: none !important;
  }
  .offerte-line-row {
    grid-template-columns: 1fr !important;
    gap: 8px !important;
    padding: 16px;
    border-bottom: 1px solid var(--color-border);
  }
  .offerte-line-row .col-omschrijving {
    font-weight: 600;
  }
  .offerte-line-row .col-uren-bedrag {
    display: flex;
    justify-content: space-between;
    color: var(--color-muted);
    font-size: 13px;
  }
}
```

- [ ] **Step 2: Apply class names + restructure mobile row**

Update the line row JSX so on mobile a single column stacks: `Fase` (number) + `Omschrijving` (bold) + a flex row showing `Uren` + `Bedrag`. Keep all 4 grid cells on desktop. Use the CSS classes above.

- [ ] **Step 3: Visual check at 375px**

Confirm: header row hidden on mobile, each line item stacks as a card with omschrijving on top, uren + bedrag row underneath.

- [ ] **Step 4: Commit**

```bash
git add components/features/offerte/brochure-cover.tsx
git commit -m "feat(offerte): line items collapse to card stack on mobile"
```

### Task 13: Responsive Page 4 — split summary card

**Files:**

- Modify: `components/features/offerte/brochure-cover.tsx` (around `:837` — split `gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)'`)

- [ ] **Step 1: Replace with responsive class**

```css
.offerte-investering-split {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 48px;
}
@media (max-width: 768px) {
  .offerte-investering-split {
    grid-template-columns: 1fr !important;
    gap: 24px !important;
  }
}
```

Apply class, remove inline grid.

- [ ] **Step 2: Visual check at 375px and 768px**

Confirm: summary card stacks under phases on mobile; side-by-side on tablet+.

- [ ] **Step 3: Commit**

```bash
git add components/features/offerte/brochure-cover.tsx
git commit -m "feat(offerte): split summary stacks on mobile"
```

### Task 14: Responsive Page 6 — Signing

**Files:**

- Modify: `components/features/offerte/brochure-cover.tsx` (around `:1578` — page 6 wrapper, signature canvas at `:1441-1542`)

- [ ] **Step 1: Reuse the page-padding class pattern from Task 11**

Apply `.offerte-page-6` (same scale: `120px 72px 160px` → `28px 40px` → `90px 24px 180px`).

- [ ] **Step 2: Make signature canvas width fluid**

Find the signature canvas container. Confirm it uses `getBoundingClientRect()` for sizing (per existing logic at `:1461-1462`). The padding change in Step 1 alone makes the canvas wider on mobile. Verify it still resizes correctly when window resizes (the resize listener should already exist).

- [ ] **Step 3: Visual check at 375px**

Confirm: signing area readable, canvas wide enough to draw a signature comfortably.

- [ ] **Step 4: Commit**

```bash
git add components/features/offerte/brochure-cover.tsx
git commit -m "feat(offerte): responsive Signing page"
```

### Task 15: Responsive Page 7 — Closing/CTA

**Files:**

- Modify: `components/features/offerte/brochure-cover.tsx` (around `:2067`)

- [ ] **Step 1: Apply page-padding class**

Same pattern: `.offerte-page-7` with the three-tier padding scale.

- [ ] **Step 2: Add `clamp()` to any large hero text on this page**

Find the closing-page headline. Replace fixed `fontSize: 'XXpx'` with `clamp(36px, 5vw, 64px)` (or matching the page 4 heading scale).

- [ ] **Step 3: Visual check at 375px**

- [ ] **Step 4: Commit**

```bash
git add components/features/offerte/brochure-cover.tsx
git commit -m "feat(offerte): responsive Closing/CTA page"
```

### Task 16: Responsive `brochure-chrome.tsx`

**Files:**

- Modify: `components/shared/brochure-chrome.tsx`

- [ ] **Step 1: Reposition logo on mobile**

Current logo placement is at fixed `48px` (around `:26-27, :208-209`). Add CSS or inline media query:

```css
.brochure-logo {
  position: fixed;
  top: 48px;
  left: 48px;
}
@media (max-width: 768px) {
  .brochure-logo {
    top: 24px !important;
    left: 24px !important;
  }
}
```

Apply `.brochure-logo` class, remove inline `top` / `left`.

- [ ] **Step 2: Reposition next/back arrows on mobile**

Current at `right/left: '48px', bottom: '48px'` (`:166-169, :208-211`). Add:

```css
.brochure-nav-arrow {
  position: fixed;
  bottom: 48px;
  width: 64px;
  height: 64px;
}
.brochure-nav-arrow.next {
  right: 48px;
}
.brochure-nav-arrow.back {
  left: 48px;
}
@media (max-width: 768px) {
  .brochure-nav-arrow {
    bottom: 24px !important;
    width: 48px !important;
    height: 48px !important;
  }
  .brochure-nav-arrow.next {
    right: 24px !important;
  }
  .brochure-nav-arrow.back {
    left: 24px !important;
  }
}
```

Apply classes, remove inline `right`/`left`/`bottom`.

- [ ] **Step 3: Visual check at 375px**

Arrows + logo no longer overlap content.

- [ ] **Step 4: Commit**

```bash
git add components/shared/brochure-chrome.tsx
git commit -m "feat(offerte): responsive chrome (logo + nav arrows)"
```

### Task 17: Mobile main = scrollable + scroll-mask gradients

**Files:**

- Modify: `components/features/offerte/brochure-cover.tsx`

- [ ] **Step 1: Mirror analyse pattern at `analyse-brochure.tsx:93-106`**

Find the offerte's main container (the element wrapping all pages). Add CSS:

```css
.offerte-main {
  position: fixed;
  inset: 0;
  overflow: hidden;
}
@media (max-width: 768px) {
  .offerte-main {
    position: relative !important;
    overflow-y: auto !important;
    height: auto !important;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
  }
}
```

- [ ] **Step 2: Add scroll-mask gradients (mirror analyse:129-146)**

```css
@media (max-width: 768px) {
  .offerte-main::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 80px;
    background: linear-gradient(
      to bottom,
      var(--color-bg) 0%,
      transparent 100%
    );
    z-index: 5;
    pointer-events: none;
  }
  .offerte-main::after {
    content: '';
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 120px;
    background: linear-gradient(to top, var(--color-bg) 0%, transparent 100%);
    z-index: 5;
    pointer-events: none;
  }
}
```

- [ ] **Step 3: Visual check at 375px — confirm scroll works, content fades under chrome**

- [ ] **Step 4: Commit**

```bash
git add components/features/offerte/brochure-cover.tsx
git commit -m "feat(offerte): mobile scrollable main + scroll-mask gradients"
```

### Task 18: Visual verification across breakpoints

- [ ] **Step 1: Open `/offerte/<existing-slug>` at 4 breakpoints**

Use browser devtools to test at: 375px, 768px, 1024px, 1440px.

- [ ] **Step 2: Side-by-side compare with `/analyse/<existing-slug>` at same breakpoints**

The /offerte formal pages (4, 6, 7) should match /analyse polish: no overflow, readable typography, comfortable padding, working chrome positioning.

- [ ] **Step 3: Note any remaining gaps**

If any: open a follow-up task. Otherwise, mark Fase 1 complete.

```bash
git commit --allow-empty -m "chore(offerte): visual parity verified at 375/768/1024/1440"
```

---

## Fase 1.5 — Warm-track architecture + Maintix bespoke

### Task 19: Schema migration — VoorstelMode + Prospect fields

**Files:**

- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add VoorstelMode enum**

Insert after the existing `OutreachType` enum (around `:69`):

```prisma
enum VoorstelMode {
  STANDARD
  BESPOKE
}
```

- [ ] **Step 2: Add fields to Prospect model**

In the `Prospect` model (starts at `:137`), after `internalNotes` (`:179`) add:

```prisma
  // Voorstel routing
  voorstelMode VoorstelMode @default(STANDARD)
  bespokeKey   String?      @db.VarChar(40)
```

- [ ] **Step 3: Generate migration**

```bash
npx prisma migrate dev --name prospect_voorstel_mode
```

Expected: new file `prisma/migrations/<timestamp>_prospect_voorstel_mode/migration.sql` with `CREATE TYPE "VoorstelMode"` + `ALTER TABLE "Prospect" ADD COLUMN`. Migration applies to local DB.

- [ ] **Step 4: Verify**

```bash
docker exec qualifai-db psql -U user -d qualifai -c "\d \"Prospect\"" | grep -E "voorstelMode|bespokeKey"
```

Expected: both columns present with correct types.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add VoorstelMode enum + bespokeKey to Prospect"
```

### Task 20: Create `/voorstel/[slug]/route.ts` Route Handler shell

**Files:**

- Create: `app/voorstel/[slug]/route.ts`

- [ ] **Step 1: Write the handler shell**

```typescript
import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import prisma from '@/lib/prisma';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const prospect = await prisma.prospect.findFirst({
    where: { readableSlug: slug },
    select: {
      id: true,
      voorstelMode: true,
      bespokeKey: true,
    },
  });

  if (!prospect) {
    return new NextResponse('Not found', { status: 404 });
  }

  if (prospect.voorstelMode === 'STANDARD') {
    // Cold-track render path is Fase 3.
    return new NextResponse('Voorstel not yet available', { status: 404 });
  }

  if (!prospect.bespokeKey) {
    return new NextResponse('Bespoke key missing', { status: 500 });
  }

  const filePath = path.join(
    process.cwd(),
    'public',
    'bespoke',
    `${prospect.bespokeKey}.html`,
  );

  let html: string;
  try {
    html = await readFile(filePath, 'utf-8');
  } catch {
    return new NextResponse('Bespoke file missing', { status: 500 });
  }

  const trackingScript = `<script>
fetch('/api/offerte/viewed', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ prospectId: ${JSON.stringify(prospect.id)} }),
}).catch(() => {});
</script>`;

  const withPixel = html.replace('</body>', `${trackingScript}\n</body>`);

  return new NextResponse(withPixel, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit (handler exists but no prospects use it yet)**

```bash
git add app/voorstel/[slug]/route.ts
git commit -m "feat(voorstel): Route Handler for warm-track bespoke voorstellen"
```

### Task 21: Copy Maintix showcase HTML into the Qualifai repo

**Files:**

- Create: `public/bespoke/maintix.html`

- [ ] **Step 1: Copy the file**

```bash
mkdir -p public/bespoke
cp /home/klarifai/Documents/klarifai/clientprojects/maintix/design-showcase/index.html public/bespoke/maintix.html
```

- [ ] **Step 2: Edit the closing CTA to point to /offerte/maintix**

Find the "Klaar om te starten?" CTA section. Locate the button/link and update its `href` to `/offerte/maintix`. If there are multiple CTAs (e.g. one in the hero, one at the bottom), update both.

```bash
grep -n "Klaar om te starten\|href=" public/bespoke/maintix.html | head -20
```

- [ ] **Step 3: Confirm no other outbound links lead away from qualifai.klarifai.nl**

Search for absolute URLs:

```bash
grep -E "https?://" public/bespoke/maintix.html | grep -v "fonts.googleapis\|api.fontshare\|fontshare\|cdn\."
```

Any links to `maintix-design.vercel.app` or external destinations: replace with relative paths or remove.

- [ ] **Step 4: Commit**

```bash
git add public/bespoke/maintix.html
git commit -m "feat(voorstel): Maintix bespoke voorstel HTML"
```

### Task 22: Local smoke test of `/voorstel/maintix`

- [ ] **Step 1: Create Maintix prospect record in local DB**

Via Prisma Studio or a one-shot script:

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.prospect.create({
  data: {
    slug: 'mxslug001',
    readableSlug: 'maintix',
    domain: 'maintix.io',
    companyName: 'Maintix',
    voorstelMode: 'BESPOKE',
    bespokeKey: 'maintix',
    projectId: 'project_klarifai',
  },
}).then((p) => { console.log('created', p.id); process.exit(0); });
"
```

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```

- [ ] **Step 3: Visit `http://localhost:9200/voorstel/maintix`**

Expected: full Maintix showcase renders. Open devtools Network tab — confirm `POST /api/offerte/viewed` fires once and returns `{ ok: true }`.

- [ ] **Step 4: Confirm view-tracking landed in DB**

```bash
docker exec qualifai-db psql -U user -d qualifai -c \
  "SELECT id, status, \"viewedAt\" FROM \"Quote\" WHERE \"prospectId\" IN (SELECT id FROM \"Prospect\" WHERE \"readableSlug\"='maintix');"
```

If no Quote exists yet, the viewed endpoint returns `no-active-quote` — that's expected at this stage; we'll create Maintix's Quote in Fase 2.

- [ ] **Step 5: No commit needed (smoke test only). Document result inline if anything broke.**

### Task 23: Admin UI — voorstelMode + bespokeKey on prospect detail

**Files:**

- Modify: `app/admin/prospects/[id]/page.tsx`
- Modify: `server/routers/admin.ts` (extend prospect-update mutation if needed)

- [ ] **Step 1: Locate the prospect-update mutation in `server/routers/admin.ts`**

Find the existing mutation (likely `admin.prospects.update` or similar). Identify the input zod schema.

- [ ] **Step 2: Add `voorstelMode` + `bespokeKey` to the input schema**

```typescript
voorstelMode: z.enum(['STANDARD', 'BESPOKE']).optional(),
bespokeKey: z.string().max(40).nullable().optional(),
```

Pass through to `prisma.prospect.update`.

- [ ] **Step 3: Add UI in the prospect detail admin page**

A small section near the prospect metadata. Two controls:

```tsx
<div className="space-y-2">
  <label className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
    Voorstel mode
  </label>
  <select
    value={voorstelMode}
    onChange={(e) => updateProspect({ id, voorstelMode: e.target.value })}
    className="input-minimal w-full text-[13px]"
  >
    <option value="STANDARD">Standaard (cold-track)</option>
    <option value="BESPOKE">Bespoke (warm-track)</option>
  </select>
  {voorstelMode === 'BESPOKE' && (
    <input
      type="text"
      placeholder="bespokeKey (e.g. maintix)"
      value={bespokeKey ?? ''}
      onChange={(e) => updateProspect({ id, bespokeKey: e.target.value })}
      className="input-minimal w-full text-[13px]"
    />
  )}
</div>
```

- [ ] **Step 4: Typecheck + manual smoke test**

```bash
npx tsc --noEmit
```

Visit `http://localhost:9200/admin/prospects/<maintix-id>`, toggle the mode, confirm change persists.

- [ ] **Step 5: Commit**

```bash
git add app/admin/prospects/[id]/page.tsx server/routers/admin.ts
git commit -m "feat(admin): edit voorstelMode + bespokeKey on prospect detail"
```

---

## Fase 2 — Quote → email bridge

### Task 24: Schema migration — OutreachLog.quoteId + QUOTE_DELIVERY enum

**Files:**

- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `QUOTE_DELIVERY` to `OutreachType` enum**

At line 63-69:

```prisma
enum OutreachType {
  INTRO_EMAIL
  WIZARD_LINK
  PDF_REPORT
  FOLLOW_UP
  SIGNAL_TRIGGERED
  QUOTE_DELIVERY
}
```

- [ ] **Step 2: Add `quoteId` to OutreachLog**

At line 290 in the `OutreachLog` model, after the `prospect` relation (around `:298`):

```prisma
  quoteId String?
  quote   Quote?  @relation(fields: [quoteId], references: [id], onDelete: SetNull)
```

And add an index at the bottom of the model:

```prisma
  @@index([quoteId])
```

- [ ] **Step 3: Add inverse relation on Quote**

Find `model Quote` (around `:775`). Add the relations array (or extend if already exists):

```prisma
  outreachLogs OutreachLog[]
```

- [ ] **Step 4: Generate migration**

```bash
npx prisma migrate dev --name outreach_log_quote_id
```

- [ ] **Step 5: Verify**

```bash
docker exec qualifai-db psql -U user -d qualifai -c "\d \"OutreachLog\"" | grep quoteId
```

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): OutreachLog.quoteId + QUOTE_DELIVERY enum"
```

### Task 25: Extend `sendOutreachEmail` to accept `quoteId` for OutreachLog metadata

**Files:**

- Modify: `lib/outreach/send-email.ts`

Reference: `SendOutreachOptions` interface at `lib/outreach/send-email.ts:18-26`. Function returns `{ success: boolean; logId: string }` and **throws** on quality-check failures rather than returning `{ ok: false }`.

- [ ] **Step 1: Add optional `quoteId` to `SendOutreachOptions`**

Edit the interface:

```typescript
interface SendOutreachOptions {
  contactId: string;
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  type: OutreachType;
  metadata?: Record<string, unknown>;
  quoteId?: string | null;
}
```

Inside `sendOutreachEmail`, locate the `prisma.outreachLog.create` call and pass `quoteId: options.quoteId ?? null` in the data block.

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/outreach/send-email.ts
git commit -m "feat(outreach): sendOutreachEmail accepts optional quoteId"
```

### Task 26: Failing test for `quotes.sendEmail` — happy path

**Files:**

- Modify: `server/routers/quotes.test.ts`

Reference: existing tests in this file use `appRouter.createCaller({ db: makeMockDb() as never, adminToken: 'test-secret' })` pattern (see `:287-308` for the transition-delegation test). Mock `sendOutreachEmail` already exists at the top of the file (returns `{ success: true }`); extend it to also return `logId` for the new tests.

- [ ] **Step 1: Update existing top-of-file mock to include `logId`**

Change the existing `vi.mock('@/lib/outreach/send-email', ...)` block to:

```typescript
vi.mock('@/lib/outreach/send-email', () => ({
  sendOutreachEmail: vi
    .fn()
    .mockResolvedValue({ success: true, logId: 'log_test' }),
}));
```

- [ ] **Step 2: Add a new describe block at the bottom of the test file**

```typescript
describe('quotes router — sendEmail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends email + transitions DRAFT to SENT atomically', async () => {
    const db = makeMockDb();
    db.quote.findFirst.mockResolvedValueOnce({
      id: 'q1',
      status: 'DRAFT',
      prospect: {
        id: 'p1',
        projectId: 'proj-a',
        contacts: [{ id: 'c1', primaryEmail: 'klant@maintix.io' }],
      },
    });

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });

    const result = await caller.quotes.sendEmail({
      id: 'q1',
      to: 'klant@maintix.io',
      subject: 'Voorstel Klarifai',
      body: 'Hierbij ons voorstel.\nhttps://qualifai.klarifai.nl/voorstel/maintix',
    });

    expect(result).toEqual({ ok: true });
    expect(sendOutreachEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: 'c1',
        to: 'klant@maintix.io',
        subject: 'Voorstel Klarifai',
        type: 'QUOTE_DELIVERY',
        quoteId: 'q1',
      }),
    );
    expect(transitionQuote).toHaveBeenCalledWith(db, 'q1', 'SENT');
  });
});
```

`sendOutreachEmail` and `transitionQuote` are already imported as mocks in the test file — confirm imports are present. If not, add `import { sendOutreachEmail } from '@/lib/outreach/send-email';` and `import { transitionQuote } from '@/lib/state-machines/quote';` near the existing imports (around `:64`).

- [ ] **Step 3: Run the test, verify it fails**

```bash
npx vitest run server/routers/quotes.test.ts -t 'sendEmail'
```

Expected: FAIL with "sendEmail is not a function" (mutation does not exist yet).

- [ ] **Step 4: Commit (failing test)**

```bash
git add server/routers/quotes.test.ts
git commit -m "test(quotes): failing test for sendEmail happy path"
```

### Task 27: Implement `quotes.sendEmail` mutation (happy path)

**Files:**

- Modify: `server/routers/quotes.ts`

Reference: `transitionQuote` signature is `(db, quoteId, newStatus)` — positional, see `lib/state-machines/quote.ts:109`. Existing router context uses `ctx.db` (not `ctx.prisma`).

- [ ] **Step 1: Confirm imports**

At top of `server/routers/quotes.ts`, ensure these are present:

```typescript
import { sendOutreachEmail } from '@/lib/outreach/send-email';
import { transitionQuote } from '@/lib/state-machines/quote';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
```

Most are likely already imported — only add what's missing.

- [ ] **Step 2: Add the mutation inside the router builder**

Place near the existing `transition` mutation:

```typescript
sendEmail: projectAdminProcedure
  .input(
    z.object({
      id: z.string(),
      to: z.string().email(),
      subject: z.string().min(1),
      body: z.string().min(1),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const quote = await ctx.db.quote.findFirst({
      where: { id: input.id, prospect: { projectId: ctx.projectId } },
      include: {
        prospect: {
          include: { contacts: { take: 1, orderBy: { createdAt: 'asc' } } },
        },
      },
    });
    if (!quote) throw new TRPCError({ code: 'NOT_FOUND' });
    if (quote.status !== 'DRAFT') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Quote is niet meer in concept',
      });
    }

    const contact = quote.prospect.contacts[0];
    if (!contact) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Prospect heeft geen contact',
      });
    }

    const sendResult = await sendOutreachEmail({
      contactId: contact.id,
      to: input.to,
      subject: input.subject,
      bodyText: input.body,
      bodyHtml: input.body.replace(/\n/g, '<br>'),
      type: 'QUOTE_DELIVERY',
      quoteId: quote.id,
    });

    if (!sendResult.success) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Email kon niet verzonden worden',
      });
    }

    await transitionQuote(ctx.db, quote.id, 'SENT');

    return { ok: true };
  }),
```

Note: `sendOutreachEmail` throws on quality-check failures (blocked addresses, empty body) — those propagate as a 500 to the client automatically. The explicit `success: false` check guards against future non-throwing failure shapes.

- [ ] **Step 3: Run the test, verify it passes**

```bash
npx vitest run server/routers/quotes.test.ts -t 'sendEmail'
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/routers/quotes.ts
git commit -m "feat(quotes): sendEmail mutation"
```

### Task 28: Failing test — Resend failure leaves quote in DRAFT

**Files:**

- Modify: `server/routers/quotes.test.ts`

- [ ] **Step 1: Add the test inside the `quotes router — sendEmail` describe block**

```typescript
it('does NOT transition status when sendOutreachEmail throws', async () => {
  vi.mocked(sendOutreachEmail).mockRejectedValueOnce(
    new Error('resend network error'),
  );

  const db = makeMockDb();
  db.quote.findFirst.mockResolvedValueOnce({
    id: 'q1',
    status: 'DRAFT',
    prospect: {
      id: 'p1',
      projectId: 'proj-a',
      contacts: [{ id: 'c1', primaryEmail: 'klant@maintix.io' }],
    },
  });

  const caller = appRouter.createCaller({
    db: db as never,
    adminToken: 'test-secret',
  });

  await expect(
    caller.quotes.sendEmail({
      id: 'q1',
      to: 'klant@maintix.io',
      subject: 'X',
      body: 'Y',
    }),
  ).rejects.toThrow(/resend network error/);

  expect(transitionQuote).not.toHaveBeenCalled();
});

it('does NOT transition status when sendOutreachEmail returns success=false', async () => {
  vi.mocked(sendOutreachEmail).mockResolvedValueOnce({
    success: false,
    logId: 'log_failed',
  });

  const db = makeMockDb();
  db.quote.findFirst.mockResolvedValueOnce({
    id: 'q1',
    status: 'DRAFT',
    prospect: {
      id: 'p1',
      projectId: 'proj-a',
      contacts: [{ id: 'c1', primaryEmail: 'klant@maintix.io' }],
    },
  });

  const caller = appRouter.createCaller({
    db: db as never,
    adminToken: 'test-secret',
  });

  await expect(
    caller.quotes.sendEmail({
      id: 'q1',
      to: 'klant@maintix.io',
      subject: 'X',
      body: 'Y',
    }),
  ).rejects.toThrow(/Email kon niet verzonden/);

  expect(transitionQuote).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run, verify pass (Task 27 implementation already handles both)**

```bash
npx vitest run server/routers/quotes.test.ts -t 'sendEmail'
```

Expected: all three tests PASS.

- [ ] **Step 3: Commit**

```bash
git add server/routers/quotes.test.ts
git commit -m "test(quotes): sendEmail rolls back on send failure"
```

### Task 29: Test — non-DRAFT quote rejects send

**Files:**

- Modify: `server/routers/quotes.test.ts`

- [ ] **Step 1: Add the test inside the same describe block**

```typescript
it('rejects sendEmail when quote is not DRAFT', async () => {
  const db = makeMockDb();
  db.quote.findFirst.mockResolvedValueOnce({
    id: 'q1',
    status: 'SENT',
    prospect: {
      id: 'p1',
      projectId: 'proj-a',
      contacts: [{ id: 'c1', primaryEmail: 'klant@maintix.io' }],
    },
  });

  const caller = appRouter.createCaller({
    db: db as never,
    adminToken: 'test-secret',
  });

  await expect(
    caller.quotes.sendEmail({
      id: 'q1',
      to: 'klant@maintix.io',
      subject: 'X',
      body: 'Y',
    }),
  ).rejects.toThrow(/niet meer in concept/);

  expect(sendOutreachEmail).not.toHaveBeenCalled();
  expect(transitionQuote).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run, verify pass**

```bash
npx vitest run server/routers/quotes.test.ts -t 'sendEmail'
```

- [ ] **Step 3: Commit**

```bash
git add server/routers/quotes.test.ts
git commit -m "test(quotes): sendEmail rejects non-DRAFT quote"
```

### Task 30: Drop the `as any` cast on the admin page

**Files:**

- Modify: `app/admin/quotes/[slug]/page.tsx:115-119` and `:428-432`

The file uses `utils` from `api.useUtils()` (already declared higher up in the component). Existing pattern: `utils.quotes?.get?.invalidate?.({ slug })` with optional chaining.

- [ ] **Step 1: Replace cast block at `:115-119` with normally-typed mutation**

Before:

```typescript
// TODO: tRPC v11 inference gap — quotes.sendEmail (if available)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sendEmailMutation = (api.quotes as any).sendEmail?.useMutation?.({
  onSuccess: () => setShowEmailCompose(false),
});
```

After:

```typescript
const sendEmailMutation = api.quotes.sendEmail.useMutation({
  onSuccess: () => {
    setShowEmailCompose(false);
    utils.quotes?.get?.invalidate?.({ slug });
    utils.quotes?.list?.invalidate?.();
  },
});
```

- [ ] **Step 2: Update modal callsite at `:428-432`**

Before:

```typescript
isSubmitting={sendEmailMutation?.isPending ?? false}
onSend={(data) =>
  sendEmailMutation?.mutate?.({ id: quote.id, ...data })
}
```

After:

```typescript
isSubmitting={sendEmailMutation.isPending}
onSend={(data) =>
  sendEmailMutation.mutate({ id: quote.id, ...data })
}
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors related to `quotes.sendEmail`.

- [ ] **Step 4: Commit**

```bash
git add app/admin/quotes/[slug]/page.tsx
git commit -m "refactor(admin): drop as-any cast on sendEmail (now properly typed)"
```

### Task 31: Manual end-to-end smoke test (local)

- [ ] **Step 1: Ensure Maintix has a Contact record**

The Contact model uses `primaryEmail` (not `email`). Replace the email below with your own inbox for the smoke test:

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.prospect.findFirst({ where: { readableSlug: 'maintix' } })
  .then(prospect => p.contact.create({
    data: {
      prospectId: prospect.id,
      primaryEmail: 'YOUR_INBOX@example.com',
      firstName: 'Romano',
      lastName: 'Kanters (smoke test)',
    },
  }))
  .then(c => { console.log('contact', c.id); process.exit(0); });
"
```

- [ ] **Step 2: Create a draft Quote for Maintix in admin**

Visit `http://localhost:9200/admin/quotes`, create new quote for Maintix prospect with one line item + total.

- [ ] **Step 3: Click "Email versturen", fill the modal, click "Verstuur definitief"**

The email should include the link `http://localhost:9200/voorstel/maintix` (or use prod URL when testing in prod).

- [ ] **Step 4: Confirm**

- Email landed in your inbox
- Quote status moved to SENT in admin
- An OutreachLog row exists with `quoteId` set + `type='QUOTE_DELIVERY'`
- Clicking the link in the email opens `/voorstel/maintix` and the view-pixel fires (Quote status → VIEWED if active proposal flagged)

```bash
docker exec qualifai-db psql -U user -d qualifai -c \
  "SELECT id, status FROM \"Quote\" WHERE \"prospectId\" IN (SELECT id FROM \"Prospect\" WHERE \"readableSlug\"='maintix');"
docker exec qualifai-db psql -U user -d qualifai -c \
  "SELECT type, \"quoteId\", \"sentAt\" FROM \"OutreachLog\" WHERE \"quoteId\" IS NOT NULL ORDER BY \"createdAt\" DESC LIMIT 5;"
```

- [ ] **Step 5: Mark Fase 2 complete**

```bash
git commit --allow-empty -m "chore(quotes): warm-track first-send loop verified locally"
```

### Task 32: Production first send (Maintix)

- [ ] **Step 1: Push everything to main, confirm Vercel deploys cleanly**

```bash
git push origin main
```

Wait for Vercel deploy. Visit https://qualifai.klarifai.nl/admin — confirm app is live and current.

- [ ] **Step 2: Run production migrations**

```bash
DATABASE_URL="<railway-prod>" npx prisma migrate deploy
```

- [ ] **Step 3: Seed Maintix in production**

Same script as Task 22 Step 1, but pointed at production DATABASE_URL. Plus the Contact from Task 31 Step 1.

This time use the real recipient email (Maintix contact) for the Contact record.

- [ ] **Step 4: Visit https://qualifai.klarifai.nl/voorstel/maintix from a private window**

Confirm the bespoke voorstel renders. Confirm devtools shows POST to /api/offerte/viewed succeeds.

- [ ] **Step 5: Create the Quote in admin (production), fill line items, write the email body manually, send**

This is THE first real warm send. Be deliberate.

- [ ] **Step 6: Confirm email delivered + tracking works**

When Maintix opens the link, /api/offerte/viewed fires and the Quote status flips to VIEWED. You can monitor via:

```bash
DATABASE_URL="<railway-prod>" npx prisma studio
```

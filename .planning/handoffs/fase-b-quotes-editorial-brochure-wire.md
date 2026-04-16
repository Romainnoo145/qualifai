# Fase B · Quotes UI Editorial + Brochure wired to real Quote data

**Status:** SCHEDULED · starts after Fase A ships
**Pillar:** HANDOFF pillar 3 from 2026-04-15 session
**Doelgroep:** intern (Romano) + indirect client (via brochure wiring)
**Aesthetic:** Editorial paper for admin UI (per §3.2). Brochure keeps dark navy §3.1.

---

## 1. Goal

Two threads that belong together because they both revolve around Quote data:

1. **Admin quotes management UI** — redesign `/admin/quotes/*` (list + detail/edit) to Editorial aesthetic.
2. **Brochure wired to real Quote data** — Page 4 Investering in `/offerte/[slug]` currently uses a hardcoded stub (`200u × €95 = €22.990` per HANDOFF §3). Replace with `prisma.quote.findFirst({ where: { prospectId, status: 'ACCEPTED_OR_DRAFT' } })` + `QuoteLine` rows.

These must ship together because the brochure-facing investment page needs the quote UI to exist for Romano to confidently mark quotes as the "active voorstel" per prospect.

---

## 2. What exists already

- `Quote` + `QuoteLine` tables in Prisma (shipped Phase 60 — v9.0 Quote Schema Foundation)
- `/admin/quotes/*` functional shell shipped Phase 61 (design is "nog een ramp" per Romano HANDOFF §2)
- 3 Marfa quotes in DB (OFF001/OFF002/OFF003, all DRAFT, totals €7.816 / €11.495 / €13.285)
- Brochure Page 4 reads a hardcoded `quote` constant in `components/features/offerte/brochure-cover.tsx` (search for `200u × €95` or `22990`)

---

## 3. Scope

### 3.1 Admin quotes list `/admin/quotes`

- Editorial table layout: Ink header row, Plex Mono numbers right-aligned with tabular-nums, paper row striping
- Columns: ref (OFF001 mono) · prospect · title · line items count · amount excl · amount incl · status · actions
- Filter pills: `Draft · Sent · Accepted · Expired`
- Per-row quick actions: View / Edit / Duplicate / Archive
- New-quote CTA gold pill top right: `+ Nieuwe offerte`

### 3.2 Admin quote detail `/admin/quotes/[id]`

- Hero: ref (Plex Mono), title, status pill
- Line items editor (inline): description · hours · rate · subtotal · actions
- Totals block right-aligned at bottom: subtotal · BTW 21% · totaal with gold underline
- Sidebar right:
  - Prospect link (click to go back to `/admin/prospects/[prospectId]`)
  - Payment schedule (25/50/25 default, editable)
  - "Mark as active voorstel" toggle — writes `Quote.isActiveProposal = true`, clears others for same prospect
  - Preview button → opens `/offerte/[prospect-slug]` in new tab
- Actions row bottom: Send to client · Duplicate · Archive · Delete (danger rust)

### 3.3 Brochure wire-up

- Edit `components/features/offerte/brochure-cover.tsx`
- Add a `Quote` param alongside `prospect` prop, typed from Prisma
- Replace hardcoded stub in Page 4 Investering function with mapping from `Quote.lineItems`
- Compute totals at render time (subtotal = sum of line items, BTW = subtotal × 0.21, total incl = subtotal × 1.21)
- Format as `€X.XXX,XX` with Dutch locale
- Update `app/offerte/[slug]/page.tsx` server component: find active quote via `prisma.quote.findFirst({ where: { prospect: { readableSlug: params.slug }, isActiveProposal: true } })`, include `lineItems`, pass to BrochureCover
- Fallback if no active quote: render "Voorstel in voorbereiding" placeholder on Page 4 (Romano has manual step to flip `isActiveProposal`)

### 3.4 Schema update

Add field to `Quote` model:

```prisma
model Quote {
  // ... existing fields
  isActiveProposal Boolean @default(false)
  @@index([prospectId, isActiveProposal])
}
```

Migration: `add-is-active-proposal-to-quote`. Backfill: first DRAFT quote per prospect gets `isActiveProposal = true`.

---

## 4. Dependencies

- **Blocked by Fase A** — Editorial tokens (paper, ink, Sora, Plex Mono) must live in `app/globals.css` before this phase rebuilds quotes UI. Writing this phase before Fase A tokens = repaint hell.
- **Not blocked by Fase D** — `/discover/[slug]` can be redesigned independently. This phase touches `/admin/quotes` + `/offerte/[slug]` Page 4, neither touches `/discover`.

---

## 5. Acceptance

- `/admin/quotes` renders in Editorial with 3 Marfa quotes visible
- Opening a quote loads inline editor with line items editable
- Toggling "Mark as active voorstel" updates the brochure's Page 4 to show the real line items within 30s of page refresh
- `/offerte/marfa` Page 4 shows 3 rows of real quote line items with correct totals, NOT the old `200u × €95` stub
- `npm run check` passes
- All 3 Marfa quotes render visually correct on Page 4 when switched via the active-proposal toggle

---

## 6. Out of scope (defer)

- E-signature integration (Phase 63)
- PDF export of quotes (follow-up)
- Invoice generation from accepted quote (Fase C)
- Multi-currency (NL only for now)

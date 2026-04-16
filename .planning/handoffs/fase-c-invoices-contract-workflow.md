# Fase C · Invoice routes + Contract workflow

**Status:** SCHEDULED · starts after Fase B ships
**Pillar:** Phase 63 from original v9.0 roadmap (Contract workflow · click-to-sign)
**Doelgroep:** client (signing surface) + intern (admin invoice UI)
**Aesthetic:** brochure dark for client sign/invoice surface, Editorial paper for admin

---

## 1. Goal

The natural next step after Quote data is live: turn accepted quotes into signed contracts and downstream invoices. Three threads:

1. **Click-to-sign** — brochure Page 6 Akkoord & Ondertekening (`components/features/offerte/brochure-cover.tsx` Signing section) currently captures name/function/date into `Quote.acceptedAt` / `Quote.acceptedBy`. Wire this to a real e-signature flow OR keep the lightweight server-side capture and ship a signed PDF artifact.
2. **Invoice generation** — accepted Quote auto-generates an Invoice (new Prisma model). Payment schedule (25/50/25 default from quote) becomes 3 invoice records with due dates.
3. **Admin invoices UI** `/admin/invoices/*` — Editorial list + detail page, same patterns as `/admin/quotes`.

---

## 2. What exists already (probably nothing)

- No `Invoice` model yet — spec needs schema design
- Brochure Page 6 captures signature data but doesn't produce artifacts downstream
- No invoice generation logic
- No `/admin/invoices` routes
- Payment schedule shown on brochure Page 4 but not structured as separate records

---

## 3. Scope (rough — needs refinement during plan phase)

### 3.1 Schema

```prisma
model Invoice {
  id              String @id @default(cuid())
  invoiceNumber   String @unique // 2026-INV001 pattern
  quoteId         String
  quote           Quote @relation(fields: [quoteId], references: [id])
  prospectId      String
  prospect        Prospect @relation(fields: [prospectId], references: [id])

  amountExcl      Decimal
  amountIncl      Decimal
  btw             Decimal
  status          InvoiceStatus // DRAFT, SENT, PAID, OVERDUE, CANCELLED

  installmentPct  Int // 25, 50, 25
  dueAt           DateTime
  sentAt          DateTime?
  paidAt          DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([prospectId])
  @@index([quoteId])
  @@index([status, dueAt])
}

model Quote {
  // ... existing
  acceptedAt      DateTime?
  acceptedBy      String?
  acceptedRole    String?
  signatureData   String? // base64 canvas image OR pointer to e-sig provider ref
  invoices        Invoice[]
}
```

### 3.2 Acceptance flow

- Brochure Page 6 form submit → server action `acceptQuote({ quoteId, name, role, signatureDataURL })` → updates `Quote.acceptedAt` / `Quote.acceptedBy` / `Quote.acceptedRole` / `Quote.signatureData` → generates 3 Invoice records based on payment schedule → redirects to brochure Page 7 Bevestigd with invoice download links
- Email to Romano on acceptance (Resend) with quote ref + amounts
- Snapshot PDF of the accepted brochure is generated (or deferred to Phase 62 PDF worker)

### 3.3 Admin invoices UI `/admin/invoices`

- Editorial list: invoice ref · prospect · quote ref · amount · status · due date
- Color-coded status: rust for OVERDUE, gold for SENT, paper-2 for PAID
- Detail page with line-item breakdown, send invoice action, mark as paid, download PDF

### 3.4 Brochure Page 6 updates

- Keep current lightweight capture UX (name · role · date · gold CTA)
- Add optional canvas signature pad (already exists from previous session)
- On submit, show an "Bezig met verwerken..." loading state, then transition to Page 7

---

## 4. Dependencies

- **Blocked by Fase B** — Quote data must be real (not stub) on the brochure. Accepting a stub quote produces garbage invoices.
- **Could overlap with Fase D** — /discover redesign and this are independent threads.

---

## 5. Acceptance (high level)

- Accepting a quote on the brochure produces 3 Invoice rows with correct amounts and due dates (25/50/25 of total incl BTW)
- Admin invoices list shows those 3 invoices under the signed quote
- Romano receives an email notification when a client signs
- `npm run check` passes

---

## 6. Open decisions for plan phase

- E-signature provider? (PandaDoc, SignWell, DocuSign, or roll our own with the existing canvas?)
- Due date calculation: relative to signature date or configurable per quote?
- Invoice numbering: global or per-year reset?
- PDF generation: at invoice create OR on-demand?

---

## 7. Out of scope (defer)

- Recurring invoices
- Multiple currencies
- VAT variants beyond standard NL 21%
- Partial payments / payment plan reschedule

# Offerte Lifecycle Redesign

**Goal:** Replace the bloated QuoteForm with a notes-driven AI-assisted offerte flow. The admin quote detail page becomes: meeting notes → AI-generated narrative → line items → preview → send → track.

**Context:** Qualifai is 80% outreach. Offertes happen AFTER outreach succeeds — prospect responds, Romano has a call/meeting, then needs to send a proposal. The brochure at `/offerte/[slug]` IS the deliverable. The AI research pipeline feeds outreach, but the offerte content comes from what Romano learned in the actual conversation, enriched by research data.

---

## 1. Data Flow

```
Meeting/Call
    ↓
Meeting Notes (textarea or upload)
    ↓
AI Generation (Gemini 2.5 Pro)
  ├── Input: notes + ProspectAnalysis + firmographics
  └── Output: introductie + uitdaging + aanpak + suggested line items
    ↓
Romano reviews/edits narrative + sets line items (description × hours × rate)
    ↓
Preview brochure → Send email with link → Track views/acceptance
```

## 2. Schema Changes

Add to `Quote` model in `prisma/schema.prisma`:

```prisma
  meetingNotes         String?   @db.Text
  narrativeGeneratedAt DateTime?
  viewedAt             DateTime?
```

- `meetingNotes` — raw input after a call. Tied to this specific quote/proposal attempt.
- `narrativeGeneratedAt` — timestamp of last AI generation. Null = not yet generated.
- `viewedAt` — when the client first opened the brochure link.

Existing fields reused as-is:

- `introductie`, `uitdaging`, `aanpak` — AI-generated, editable
- `onderwerp` — quote subject/title
- `QuoteLine` (omschrijving, uren, tarief, position) — line items

Fields kept in DB but hidden from new UI:

- `tagline`, `scope`, `buitenScope` — backward compat only

## 3. Quote Detail Page Layout

Single column, no sidebar, no tabs. Top to bottom:

### Header

- Back link to prospect
- Quote nummer + status badge
- "Actief voorstel" toggle

### Block 1 — Meeting Notes

- Textarea: "Wat heb je besproken?"
- Optional file upload (meeting notes, client brief)
- Gold gradient button: "Genereer voorstel"
- After generation: notes collapse to a summary line (expandable)
- Auto-saves notes on blur

### Block 2 — Narrative Preview

- AI-generated `introductie`, `uitdaging`, `aanpak` rendered as readable text
- Document-preview feel — clean typography, not form fields
- Each section has a small edit icon → opens inline editing
- Shows "Nog niet gegenereerd" placeholder before first generation

### Block 3 — Line Items

- Table: omschrijving / uren / tarief (€/u) / subtotaal
- Rate varies per line (€80–€120 range)
- Add row button
- Inline editable
- Totals block below: subtotaal / BTW 21% / totaal incl. BTW
- After AI generation, suggested lines appear pre-filled (editable)

### Block 4 — Actions

- "Preview brochure" — opens `/offerte/[slug]` in new tab
- "Verstuur per email" — opens inline email compose:
  - To: pre-filled from prospect contacts
  - Subject: pre-filled from `onderwerp`
  - Body: editable, includes brochure link prominently
  - Send via Resend (existing integration)
- Status timeline: created → sent → viewed → accepted (inline, compact)

## 4. AI Generation Endpoint

New tRPC mutation: `quotes.generateNarrative`

**Input:** `{ quoteId: string }`

**Process:**

1. Fetch quote (including `meetingNotes`)
2. Fetch prospect's latest `ProspectAnalysis` (version: analysis-v2)
3. Fetch prospect firmographics (industry, size, location, domain)
4. Call Gemini 2.5 Pro with structured prompt:
   - Context block 1: meeting notes (primary — what the client said)
   - Context block 2: research evidence + narrative analysis (supporting)
   - Context block 3: firmographics (framing — industry, size for tone)
5. Parse response → write `introductie`, `uitdaging`, `aanpak` to quote
6. Optionally: suggest line items based on scope discussed in notes
7. Set `narrativeGeneratedAt = now()`

**Output:** Updated quote with narrative + suggested lines

**Language:** Dutch, boardroom quality. Same voice as the master-analyzer narrative.

**Re-generation:** Allowed. Overwrites previous narrative. Meeting notes preserved.

## 5. Brochure Wire-up

The brochure pages need to read narrative from the active quote:

- **Page 2 (De Uitdaging)** — reads `quote.uitdaging` (currently hardcoded)
- **Page 3 (Aanpak)** — reads `quote.aanpak` (currently hardcoded)
- **Page 4 (Investering)** — already wired to quote line items (Fase B)
- **Page 5 (Scope)** — derived from line items or `aanpak`

Fallback: if no active quote or narrative not generated, show current hardcoded content.

## 6. Email Send

Rework `QuoteSendConfirm` into an inline email compose:

- Uses Resend (already configured: `info@klarifai.nl`)
- Subject: `onderwerp` from quote
- Body template: Dutch professional email with brochure link
- Extra context field for Romano to add personal notes
- On send: transitions quote DRAFT → SENT, records `snapshotAt`

## 7. View Tracking

When client opens `/offerte/[slug]`:

- Lightweight API call records `viewedAt` on the active quote
- Transitions quote SENT → VIEWED (if not already)
- No auth required — the slug is the access token

Future enhancement: per-page view tracking (which pages they spent time on).

## 8. Components to Remove

- `QuoteForm` (components/features/quotes/quote-form.tsx) — replaced entirely
- `QuotePreviewIframe` — replaced by "open in new tab"
- `QuoteStatusTimeline` — replaced by inline status in actions bar
- `QuoteLineList` + `QuoteLineRow` — replaced by new inline table

## 9. Components to Keep / Reuse

- `computeQuoteTotals` / `formatEuro` — totals math
- `transitionQuote` state machine — add VIEWED trigger from brochure
- `QuoteVersionConfirm` — creating revised versions still works same way
- `ProspectAnalysis` query — feeds AI generation
- Resend email integration — powers the send flow

## 10. Acceptance Criteria

- Quote detail page renders the notes → narrative → line items → actions flow
- AI generates Dutch narrative from meeting notes + research data
- Line items are inline editable with variable rates per line
- Preview opens live brochure with real narrative + line items
- Email send works via Resend with brochure link
- View tracking records when client opens the brochure
- Brochure pages 2-3 read narrative from active quote
- `npm run check` passes
- Design matches cool SaaS tokens (white canvas, gold gradient, Sora, soft corners)

## 11. Out of Scope

- PDF export
- E-signature on Page 6 (future)
- Per-page view analytics
- Multi-currency
- Invoice generation from accepted quote
- File upload parsing (meeting notes upload is stored as file, not parsed by AI — future)

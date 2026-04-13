# Requirements: Qualifai v9.0 — Klant Lifecycle Convergence

**Defined:** 2026-04-13
**Core Value:** Every outreach message is backed by real evidence of a prospect's workflow pain points, matched to a service Klarifai actually delivers. No spray-and-pray.

**Milestone goal:** Converge klarifai-core's quote/contract pipeline into Qualifai zodat de volledige klant-lifecycle (prospect → quote → contract → start project) in één systeem leeft, met een gepersonaliseerde URL als primair output-formaat.

**Locked decisions:** `klarifai-core/docs/strategy/decisions.md` Q5/Q8/Q9/Q12/Q13.

---

## v9.0 Requirements

### Quote Data Layer (Schema + tRPC)

The Prisma schema and tRPC API surface for Quote/QuoteLine. Foundation that everything else depends on.

- [ ] **DATA-01**: System has `Quote` Prisma model with narrative fields (`tagline`, `introductie`, `uitdaging`, `aanpak`), `onderwerp`, `nummer`, `datum`, `geldig_tot`, `scope`, `buiten_scope`, and `btw_percentage`
- [ ] **DATA-02**: System has `QuoteLine` Prisma model with `fase`, `omschrijving`, `oplevering`, `uren`, `tarief`, linked to parent `Quote`
- [ ] **DATA-03**: System has `QuoteStatus` enum with values `DRAFT | SENT | VIEWED | ACCEPTED | REJECTED | EXPIRED | ARCHIVED`
- [ ] **DATA-04**: `ProspectStatus` enum is extended with one new value `QUOTE_SENT` (positioned between `ENGAGED` and `CONVERTED`); existing values unchanged
- [ ] **DATA-05**: `Quote` model has snapshot fields per decisions.md Q12: `snapshotAt: DateTime?`, `templateVersion: String?`, `snapshotHtml: String? @db.Text`, `snapshotData: Json?`, `snapshotPdfUrl: String?`, `snapshotStatus: SnapshotStatus?`
- [ ] **DATA-06**: `Quote` is linked to `Prospect` via `prospectId` foreign key with cascade rules consistent with existing Prospect relations
- [ ] **DATA-07**: Prisma migration runs cleanly on shadow DB without breaking existing rows; all new columns nullable for backwards compatibility
- [ ] **DATA-08**: tRPC `quotes` router exists with `create`, `list`, `get`, `update`, `transition` operations using `projectAdminProcedure`
- [ ] **DATA-09**: `quotes.transition(id, newStatus)` is a transactional helper that handles Quote → Prospect status auto-sync per decisions.md Q13 mapping table
- [ ] **DATA-10**: All new tRPC endpoints filter by `ctx.projectId` (multi-tenant isolation maintained)

### Foundation Fixes (from codebase audit)

Fragile areas in the existing Qualifai codebase that Phase 60 must address before bolting Quote on top.

- [ ] **FOUND-01**: Typed status constants live in `lib/constants/prospect-statuses.ts` as `as const` arrays (`PUBLIC_STATUSES`, `WIZARD_VISIBLE_STATUSES`, etc.); all hardcoded status string literals in `wizard.ts` and `admin.ts` are replaced by references to these constants
- [ ] **FOUND-02**: `admin.updateProspect` mutation validates state transitions; invalid transitions (e.g. `CONVERTED → DRAFT`) return a typed error rather than silently writing
- [ ] **FOUND-03**: `Quote.snapshotData` has a Zod schema in `lib/schemas/quote-snapshot.ts`, validated on every write
- [ ] **FOUND-04**: Type-safe accessor helper exists for reading snapshot fields without unsafe property access

### YAML Migration (klarifai-core import)

One-shot script that brings existing klarifai-core data into Qualifai. Per decisions.md Q8.

- [ ] **IMPORT-01**: `scripts/import-klarifai-yaml.ts` imports klarifai-core `data/clients/*.yaml` as Qualifai `Prospect` records, matching on `slug` for idempotency
- [ ] **IMPORT-02**: Script imports klarifai-core `data/quotes/{year}/*.yaml` as `Quote` + `QuoteLine` records, matching on `nummer` for idempotency
- [ ] **IMPORT-03**: Script supports `--dry` (default) showing what would be created/updated, and `--apply` for real writes
- [ ] **IMPORT-04**: Script logs all 3 existing Marfa quotes (OFF001, OFF002, OFF003) imported successfully with totals matching klarifai-core (€7.816,60 / €11.495,00 / €13.285,80)

### Admin UI for Quotes

Romano can manage quotes from inside the existing Qualifai admin shell.

- [ ] **ADMIN-01**: Admin can view all quotes grouped by status at `/admin/quotes`
- [ ] **ADMIN-02**: Admin can create a new quote for a prospect at `/admin/prospects/[id]/quotes/new` via a form with narrative fields, line items, and scope sections
- [ ] **ADMIN-03**: Admin can add, reorder, edit, and remove line items in the create form (each line: fase, omschrijving, oplevering, uren, tarief)
- [ ] **ADMIN-04**: Admin can preview the quote as rendered HTML in an iframe before sending (mirror of `/discover/[slug]/voorstel` for that draft)
- [ ] **ADMIN-05**: Admin can transition quote from `DRAFT → SENT` via a button that triggers snapshot creation and queues PDF rendering
- [ ] **ADMIN-06**: Admin can see quote status timeline (Created, Sent at, Viewed at, Accepted at) on the quote detail page
- [ ] **ADMIN-07**: Admin can edit a `DRAFT` quote freely; `SENT` and later quotes are read-only (immutable snapshot)
- [ ] **ADMIN-08**: Admin can archive an existing quote and create a new version that references the archived one via `replacesId`

### Client-Facing Proposal Page

What the prospect sees when they open the personalized URL.

- [ ] **CLIENT-01**: Prospect can view proposal at `/discover/[slug]/voorstel` (URL is shareable, slug-based, no auth)
- [ ] **CLIENT-02**: Page renders the snapshot HTML (frozen at SENT) for quotes in `SENT | VIEWED | ACCEPTED | REJECTED` status; falls back to live render only for `DRAFT` admin previews
- [ ] **CLIENT-03**: Page visually matches the canonical Klarifai design language from `klarifai-core/docs/design/proposal-template.html` (cover + 4 inner pages: uitdaging, aanpak, investering, scope)
- [ ] **CLIENT-04**: First view triggers idempotent transition to `VIEWED` status with timestamp
- [ ] **CLIENT-05**: Prospect can click "Akkoord" to open a confirmation modal asking for explicit consent
- [ ] **CLIENT-06**: Confirming acceptance triggers `Quote.ACCEPTED` + `Prospect.CONVERTED` in a single transaction
- [ ] **CLIENT-07**: Admin receives Slack and/or email notification when a quote is accepted, with a deep link to the quote detail page
- [ ] **CLIENT-08**: Page is responsive (works on phone, tablet, desktop) without breaking the design

### PDF Worker (Separate Railway Service)

Per decisions.md Q5: PDF rendering lives outside Qualifai's Next.js process.

- [ ] **PDF-01**: Separate Railway worker service exists with Puppeteer + Chromium, callable via authenticated HTTP endpoint
- [ ] **PDF-02**: Worker accepts a snapshot HTML payload (or quote ID + token) and returns/uploads a rendered PDF
- [ ] **PDF-03**: Quote acceptance/sending in Qualifai triggers async PDF generation via the worker; UI does not block on PDF readiness
- [ ] **PDF-04**: Worker writes PDF to persistent storage (S3 or Railway volume) and updates `Quote.snapshotPdfUrl` + `Quote.snapshotStatus` to `READY` via callback
- [ ] **PDF-05**: Worker handles failures gracefully: retry with backoff, mark `Quote.snapshotStatus = FAILED` after exhausting retries, surface error in admin UI
- [ ] **PDF-06**: Generated PDF visually matches the live HTML snapshot rendered in the browser (same fonts, margins, page breaks)

### Contract Workflow

Click-to-sign contract that follows an accepted quote. Per decisions.md Q3 (default: MVP self-built, no SignWell).

- [ ] **CONT-01**: System has `Contract` Prisma model linked to `Quote` (one contract per accepted quote), with terms text, signing fields, status enum
- [ ] **CONT-02**: `ContractStatus` enum exists: `DRAFT | SENT | VIEWED | SIGNED | REJECTED | EXPIRED`
- [ ] **CONT-03**: Admin can generate a contract from an accepted quote at `/admin/quotes/[id]/contract/new`, prefilled with quote data
- [ ] **CONT-04**: Admin can edit contract terms in a structured form (parties, scope reference, payment terms, signing block)
- [ ] **CONT-05**: Admin can preview the contract and transition `DRAFT → SENT` (snapshot frozen at SENT, same pattern as Quote)
- [ ] **CONT-06**: Prospect can view the contract at `/discover/[slug]/contract` after the related quote is accepted
- [ ] **CONT-07**: Prospect can sign via click-to-sign: type their name, click confirm; server records signature, IP address, user-agent, and timestamp
- [ ] **CONT-08**: Signing triggers `Contract.SIGNED` and notifies admin via Slack/email
- [ ] **CONT-09**: Signed contract is downloadable as PDF (rendered via the same Railway worker as quotes)
- [ ] **CONT-10**: Admin sees signature audit trail (who, when, IP, user-agent) on the contract detail page

### Test Coverage (verplicht — multi-tenant + state machine)

Tests die direct uit verification criteria komen, niet als bonus.

- [ ] **TEST-01**: State transition tests for `Prospect.updateProspect` covering valid paths and rejected invalid moves
- [ ] **TEST-02**: State transition tests for `Quote.transition` covering full state machine including Quote → Prospect auto-sync
- [ ] **TEST-03**: Multi-project isolation test for new `quotes.*` endpoints — admin scoped to Project A cannot see/mutate quotes in Project B
- [ ] **TEST-04**: Integration test for YAML import script — imports the 3 Marfa fixtures and verifies record counts + totals
- [ ] **TEST-05**: Snapshot validation test — Zod parsing rejects malformed `snapshotData`, accepts valid

---

## v10.0 Requirements (deferred)

### Invoice generation pipeline

- **INV-01**: Invoice model linked to Contract
- **INV-02**: Admin can generate invoice from signed contract
- **INV-03**: Invoice has its own status workflow (DRAFT, SENT, PAID, OVERDUE)
- **INV-04**: Stripe webhook integration for automatic payment matching
- **INV-05**: Client-facing invoice page at `/discover/[slug]/factuur`
- **INV-06**: Multi-period invoice support (deelfacturen)

### klarifai-core CLI deprecation

- **DEPR-01**: All YAML data archived in git history as historical record
- **DEPR-02**: klarifai-core CLI commands return deprecation notice pointing to Qualifai
- **DEPR-03**: klarifai-core repo marked as docs/schema authority only in README
- **DEPR-04**: Strategy and design docs migrated from klarifai-core/docs to Qualifai or a docs-only repo

---

## Out of Scope

| Feature                                                           | Reason                                                                                                    |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Multi-brand support                                               | Single Klarifai brand assumed for v9.0; multi-brand adds complexity without proven need                   |
| SignWell/DocuSign integration                                     | MVP self-built click-to-sign sufficient; external e-sign services add cost + friction without v9.0 value  |
| Token-protected proposal URLs                                     | Default is token-free with IP logging per decisions.md Q7 default; auth adds friction without proven need |
| Print-friendly offline proposal                                   | Snapshot PDF covers the archive use case; live HTML is the primary client experience                      |
| Repo umbrella / monorepo                                          | Qualifai stays the runtime home; klarifai-core remains separate until deprecation                         |
| Atlantis or copifai integration with quotes                       | Out of v9.0 scope; quotes flow lives in standard Qualifai prospect path                                   |
| Quote line item discount calculations beyond simple negative-line | Existing klarifai-core pattern (negative `tarief` line) sufficient for v9.0                               |
| Bilingual quotes (NL + EN)                                        | Dutch only for v9.0; klant-base is NL/BE                                                                  |

---

## Traceability

Empty until roadmapper assigns requirements to phases.

| Requirement                 | Phase | Status |
| --------------------------- | ----- | ------ |
| _(populated by roadmapper)_ |       |        |

**Coverage:**

- v9.0 requirements: 47 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 47 ⚠️

---

_Requirements defined: 2026-04-13_
_Last updated: 2026-04-13 after milestone v9.0 start_

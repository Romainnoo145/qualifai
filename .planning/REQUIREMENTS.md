# Requirements: Qualifai v9.0 — Klant Lifecycle Convergence

**Defined:** 2026-04-13
**Core Value:** Every outreach message is backed by real evidence of a prospect's workflow pain points, matched to a service Klarifai actually delivers. No spray-and-pray.

**Milestone goal:** Converge klarifai-core's quote/contract pipeline into Qualifai zodat de volledige klant-lifecycle (prospect → quote → contract → start project) in één systeem leeft, met een gepersonaliseerde URL als primair output-formaat.

**Locked decisions:** `klarifai-core/docs/strategy/decisions.md` Q5/Q8/Q9/Q12/Q13.

---

## v9.0 Requirements

### Quote Data Layer (Schema + tRPC)

The Prisma schema and tRPC API surface for Quote/QuoteLine. Foundation that everything else depends on.

- [x] **DATA-01**: System has `Quote` Prisma model with narrative fields (`tagline`, `introductie`, `uitdaging`, `aanpak`), `onderwerp`, `nummer`, `datum`, `geldig_tot`, `scope`, `buiten_scope`, and `btw_percentage`
- [x] **DATA-02**: System has `QuoteLine` Prisma model with `fase`, `omschrijving`, `oplevering`, `uren`, `tarief`, linked to parent `Quote`
- [x] **DATA-03**: System has `QuoteStatus` enum with values `DRAFT | SENT | VIEWED | ACCEPTED | REJECTED | EXPIRED | ARCHIVED`
- [x] **DATA-04**: `ProspectStatus` enum is extended with one new value `QUOTE_SENT` (positioned between `ENGAGED` and `CONVERTED`); existing values unchanged
- [x] **DATA-05**: `Quote` model has snapshot fields per decisions.md Q12: `snapshotAt: DateTime?`, `templateVersion: String?`, `snapshotHtml: String? @db.Text`, `snapshotData: Json?`, `snapshotPdfUrl: String?`, `snapshotStatus: SnapshotStatus?`
- [x] **DATA-06**: `Quote` is linked to `Prospect` via `prospectId` foreign key with cascade rules consistent with existing Prospect relations
- [x] **DATA-07**: Prisma migration runs cleanly on shadow DB without breaking existing rows; all new columns nullable for backwards compatibility
- [x] **DATA-08**: tRPC `quotes` router exists with `create`, `list`, `get`, `update`, `transition` operations using `projectAdminProcedure`
- [x] **DATA-09**: `quotes.transition(id, newStatus)` is a transactional helper that handles Quote → Prospect status auto-sync per decisions.md Q13 mapping table
- [x] **DATA-10**: All new tRPC endpoints filter by `ctx.projectId` (multi-tenant isolation maintained)

### Foundation Fixes (from codebase audit)

Fragile areas in the existing Qualifai codebase that Phase 60 must address before bolting Quote on top.

- [x] **FOUND-01**: Typed status constants live in `lib/constants/prospect-statuses.ts` as `as const` arrays (`PUBLIC_STATUSES`, `WIZARD_VISIBLE_STATUSES`, etc.); all hardcoded status string literals in `wizard.ts` and `admin.ts` are replaced by references to these constants
- [x] **FOUND-02**: `admin.updateProspect` mutation validates state transitions; invalid transitions (e.g. `CONVERTED → DRAFT`) return a typed error rather than silently writing
- [x] **FOUND-03**: `Quote.snapshotData` has a Zod schema in `lib/schemas/quote-snapshot.ts`, validated on every write
- [x] **FOUND-04**: Type-safe accessor helper exists for reading snapshot fields without unsafe property access

### YAML Migration (klarifai-core import)

One-shot script that brings existing klarifai-core data into Qualifai. Per decisions.md Q8.

- [x] **IMPORT-01**: `scripts/import-klarifai-yaml.ts` imports klarifai-core `data/clients/*.yaml` as Qualifai `Prospect` records, matching on `slug` for idempotency
- [x] **IMPORT-02**: Script imports klarifai-core `data/quotes/{year}/*.yaml` as `Quote` + `QuoteLine` records, matching on `nummer` for idempotency
- [x] **IMPORT-03**: Script supports `--dry` (default) showing what would be created/updated, and `--apply` for real writes
- [x] **IMPORT-04**: Script logs all 3 existing Marfa quotes (OFF001, OFF002, OFF003) imported successfully with totals matching klarifai-core (€7.816,60 / €11.495,00 / €13.285,80)

### Admin UI for Quotes

Romano can manage quotes from inside the existing Qualifai admin shell.

- [x] **ADMIN-01**: Admin can view all quotes grouped by status at `/admin/quotes`
- [x] **ADMIN-02**: Admin can create a new quote for a prospect at `/admin/prospects/[id]/quotes/new` via a form with narrative fields, line items, and scope sections
- [x] **ADMIN-03**: Admin can add, reorder, edit, and remove line items in the create form (each line: fase, omschrijving, oplevering, uren, tarief)
- [x] **ADMIN-04**: Admin can preview the quote as rendered HTML in an iframe before sending (mirror of `/discover/[slug]/voorstel` for that draft)
- [x] **ADMIN-05**: Admin can transition quote from `DRAFT → SENT` via a button that triggers snapshot creation and queues PDF rendering
- [x] **ADMIN-06**: Admin can see quote status timeline (Created, Sent at, Viewed at, Accepted at) on the quote detail page
- [x] **ADMIN-07**: Admin can edit a `DRAFT` quote freely; `SENT` and later quotes are read-only (immutable snapshot)
- [x] **ADMIN-08**: Admin can archive an existing quote and create a new version that references the archived one via `replacesId`

### Web Voorstel Design Foundation

Design discovery and contract that produces the documented foundation for the modern web proposal experience. Per decisions.md Q14, the web is the primary format and breaks fully with klarifai-core's PDF-first design.

- [ ] **DSGN-01**: `DESIGN.md` exists in the Qualifai repo, produced via `/design-consultation`, defining the aesthetic direction, typography scale, color palette, motion principles, and design system foundations for the web proposal experience. Uses awesome-design-md curated references and modern SaaS proposal pages (Pitch, Tome, Linear, Stripe-style) as inspiration sources, NOT klarifai-core's existing proposal-template.html.
- [ ] **DSGN-02**: `/design-shotgun` produces 3-5 visual variants of the proposal page; one direction is committed with explicit rationale documented in DESIGN.md.
- [ ] **DSGN-03**: `UI-SPEC.md` exists (produced via `/gsd:ui-phase`) as the implementation contract — covers layout grid, typography scale, color tokens, component inventory, motion principles, accessibility requirements, and responsive breakpoints. This is what the implementation plan tasks against.

### Client-Facing Proposal Page

What the prospect sees when they open the personalized URL. **The web is the primary format**, not a static A4 document in a browser.

- [ ] **CLIENT-01**: Prospect can view proposal at `/discover/[slug]/voorstel` (URL is shareable, slug-based, no auth)
- [ ] **CLIENT-02**: Page renders the snapshot HTML (frozen at SENT) for quotes in `SENT | VIEWED | ACCEPTED | REJECTED` status; falls back to live render only for `DRAFT` admin previews
- [ ] **CLIENT-03**: Page is a **modern, web-native experience** built per the `UI-SPEC.md` produced in DSGN-03 — scroll-driven sections, smooth transitions, motion, hover/interaction states. Visually unmistakably _not_ a static A4 mockup, and visually unmistakably _not_ a port of klarifai-core's existing `proposal-template.html` (which is reference material only, not the design source).
- [ ] **CLIENT-04**: First view triggers idempotent transition to `VIEWED` status with timestamp
- [ ] **CLIENT-05**: Prospect can click "Akkoord" to open a confirmation modal asking for explicit consent
- [ ] **CLIENT-06**: Confirming acceptance triggers `Quote.ACCEPTED` + `Prospect.CONVERTED` in a single transaction
- [ ] **CLIENT-07**: Admin receives Slack and/or email notification when a quote is accepted, with a deep link to the quote detail page
- [ ] **CLIENT-08**: Page is responsive across phone, tablet, and desktop with content priorities adjusted per viewport — not just a shrunken desktop layout

### PDF Worker (Separate Railway Service)

Per decisions.md Q5: PDF rendering lives outside Qualifai's Next.js process. Per decisions.md Q14: PDF is the **secondary** print-friendly format, NOT a 1:1 visual copy of the web experience.

- [ ] **PDF-01**: Separate Railway worker service exists with Puppeteer + Chromium, callable via authenticated HTTP endpoint
- [ ] **PDF-02**: Worker accepts a quote ID + token (or snapshot data payload) and returns/uploads a rendered PDF
- [ ] **PDF-03**: Quote acceptance/sending in Qualifai triggers async PDF generation via the worker; UI does not block on PDF readiness
- [ ] **PDF-04**: Worker writes PDF to persistent storage (S3 or Railway volume) and updates `Quote.snapshotPdfUrl` + `Quote.snapshotStatus` to `READY` via callback
- [ ] **PDF-05**: Worker handles failures gracefully: retry with backoff, mark `Quote.snapshotStatus = FAILED` after exhausting retries, surface error in admin UI
- [ ] **PDF-06**: Generated PDF is a **print-friendly version** of the proposal — preserves all content (narrative, line items, scope, totals, brand identity) in a clean A4 layout, but flattens web-only interactions (animations, motion, hover states, interactive components) into static representations. It is NOT a screen capture of the live web page.
- [ ] **PDF-07**: Web HTML and PDF render from the **same `Quote.snapshotData` source of truth** — content is identical, presentation differs. The PDF uses a separate print-optimised template (e.g. `templates/pdf-proposal.html`), not the live web component tree.

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

- [x] **TEST-01**: State transition tests for `Prospect.updateProspect` covering valid paths and rejected invalid moves
- [x] **TEST-02**: State transition tests for `Quote.transition` covering full state machine including Quote → Prospect auto-sync
- [x] **TEST-03**: Multi-project isolation test for new `quotes.*` endpoints — admin scoped to Project A cannot see/mutate quotes in Project B
- [x] **TEST-04**: Integration test for YAML import script — imports the 3 Marfa fixtures and verifies record counts + totals
- [x] **TEST-05**: Snapshot validation test — Zod parsing rejects malformed `snapshotData`, accepts valid

### Manual Prospect Flow Polish (Phase 61.1 — INSERTED)

Field-discovered roughness in the manual prospect creation flow. Surfaced during Phase 61 smoke testing on Marfa.

**Master analyzer resilience:**

- [x] **POLISH-01**: `lib/analysis/master-analyzer.ts` retries on Gemini 5xx/429 errors with exponential backoff (3 attempts, 1s → 4s → 16s). Catches only retryable errors; all other errors bubble immediately.
- [x] **POLISH-02**: After retry exhaustion, master-analyzer falls back to `gemini-2.5-flash` for one final attempt before failing. Logged with model used and attempt count.
- [x] **POLISH-03**: Master analyzer failures are persisted on `ProspectAnalysis` (or a sibling field on Prospect) with `lastAnalysisError: string?` and `lastAnalysisAttemptedAt: DateTime?` so the UI can render a friendly status instead of nothing.

**Favicon fallback (replaces Apollo logo gap):**

- [x] **POLISH-04**: New helper `lib/enrichment/favicon.ts` exports `getFaviconUrl(domain: string): Promise<string | null>` that probes Google's free favicon service (`https://www.google.com/s2/favicons?domain=<d>&sz=128`), falls back to DuckDuckGo's `https://icons.duckduckgo.com/ip3/<d>.ico`, returns null if both fail. Uses a HEAD request with a short timeout.
- [x] **POLISH-05**: `admin.createProspect` mutation calls `getFaviconUrl(domain)` after the Prisma create and updates `Prospect.logoUrl` if successful. Non-blocking — prospect is returned even if favicon fetch fails or times out.
- [x] **POLISH-06**: Existing prospects without `logoUrl` get an on-the-fly favicon via the same Google service rendered in the prospect card UI — no DB write required for backfill.

**Pipeline retrigger UI + error surface:**

- [x] **POLISH-07**: `/admin/prospects/[id]` has an "Acties" panel with three buttons: **Verrijk opnieuw** (calls `enrichProspect`), **Run research** (calls `executeResearchRun` via a new tRPC mutation), **Run analyse** (calls master-analyzer via a new tRPC mutation). Each button shows loading state and post-run feedback.
- [x] **POLISH-08**: Pipeline mutation errors are surfaced in the UI as friendly messages, not stack traces. Specifically: Gemini 503 / 429 / quota errors render as "AI tijdelijk niet beschikbaar — probeer over een paar minuten opnieuw." with a retry button.
- [x] **POLISH-09**: A "Laatste run" status indicator on `/admin/prospects/[id]` shows the last research/analysis run timestamp, status (success/warning/error), and brief message — populated from `ResearchRun.finishedAt` + `ProspectAnalysis.lastAnalysisError`.

**Logo rendering in prospect cards:**

- [x] **POLISH-10**: Prospect cards in `/admin/prospects` list page render `prospect.logoUrl` if present, else fall back to inline Google favicon URL (`https://www.google.com/s2/favicons?domain=${prospect.domain}&sz=128`). Avatar circle with initial letter as final fallback for prospects without a domain.
- [x] **POLISH-11**: `/admin/prospects/[id]` detail page header includes the same logo/favicon avatar next to the prospect name.

**Tests:**

- [x] **POLISH-12**: Unit test for `master-analyzer` retry logic — mocks Gemini SDK, asserts 3 retry attempts on 503, asserts fallback to flash on exhaustion, asserts non-retryable errors bubble immediately.
- [x] **POLISH-13**: Unit test for `favicon.ts` — Google success path, Google fail → DuckDuckGo fallback, both fail → null, timeout path.
- [x] **POLISH-14**: Component test for the Acties panel error surface — mocked mutation rejects with Gemini 503 → assert friendly message rendered, no raw error string in the DOM.

---

### Manual Prospect Parity (Phase 61.2 — INSERTED)

Field-discovered parity gaps in the manual prospect experience. Surfaced during Phase 61.1 smoke testing on Marfa.

**Apollo graceful fallback:**

- [x] **PARITY-01**: `enrichCompanyWithFallbackQueries` in `lib/enrichment/providers/apollo.ts` throws `EnrichmentNoCoverageError` (a typed class mirroring `EnrichmentPlanLimitedError`) when all Apollo fetch attempts return HTTP 422 — no raw error throw.
- [x] **PARITY-02**: `runWithWaterfall` in `lib/enrichment/service.ts` catches `EnrichmentNoCoverageError` as a partial-success case and returns a minimal `EnrichedCompanyData` with just `domain` populated — does NOT throw "all providers failed".
- [x] **PARITY-03**: `admin.enrichProspect` tRPC mutation catches `EnrichmentNoCoverageError` and returns `{ success: true, fallbackUsed: true, noCoverage: true }` — the existing Acties panel amber branch fires automatically.
- [x] **PARITY-04**: `FRIENDLY_ERROR_APOLLO_NO_COVERAGE` constant added to `components/features/prospects/error-mapping.ts` with verbatim Dutch text: "Apollo heeft deze organisatie niet in zijn database — verrijking gedeeltelijk."
- [x] **PARITY-05**: Acties panel `enrichProspect` button renders amber state with the Dutch message for the no-coverage case (via existing `markSuccess(data)` with `data.fallbackUsed` — no component change required).

**og:image logo source upgrade:**

- [x] **PARITY-06**: New helper `lib/enrichment/og-logo.ts` exports `getHighResLogoUrl(domain): Promise<string | null>` — fetches homepage HTML with plain `fetch` + `AbortSignal.timeout(5000)`, extracts og:image / twitter:image / apple-touch-icon / icon-png in priority order, HEAD-probes each candidate to confirm 200 + non-zero content-length, resolves relative URLs. No new dependencies.
- [ ] **PARITY-07**: `admin.createProspect` fire-and-forget IIFE calls `getHighResLogoUrl` first; falls through to `getFaviconUrl` on null.
- [ ] **PARITY-08**: `admin.enrichProspect` no-coverage partial-success path also attempts `getHighResLogoUrl` then `getFaviconUrl` to maximise logo quality for out-of-Apollo prospects.

**Inline enrichment form:**

- [ ] **PARITY-09**: `/admin/prospects/new` gets an "Optionele verrijking" collapsible `<details>` section (default closed) with 6 optional fields: companyName (text), industry (text), description (textarea, max 500 chars), employeeRange (select: `1-10`, `11-50`, `51-200`, `201-500`, `501-1000`, `1001-5000`, `5001+`), city (text), country (text, default "Nederland").
- [ ] **PARITY-10**: `admin.createAndProcess` Zod input schema extended with 6 optional nullable enrichment fields; manual entries are sticky — if `input.companyName` is set, the Apollo enrichment data merge does NOT overwrite it.

**Render parity + badge:**

- [ ] **PARITY-11**: `/admin/prospects/[id]` detail page renders without crashes on NULL Apollo fields — null guard audit confirms all field accesses use optional chaining or conditional rendering.
- [ ] **PARITY-12**: New `ProspectEnrichmentBadge` component renders an amber pill "Verrijking onvolledig" in the detail header when `companyName` OR `industry` OR `description` is null. Tooltip shows "Verrijking ontbreekt: " + Dutch-labeled list of missing fields.
- [ ] **PARITY-13**: Evidence tab renders cleanly for manual prospects with no research runs (shows "Geen runs" empty state — no crash).
- [ ] **PARITY-14**: Analysis tab renders cleanly for manual prospects with no analysis rows (shows empty state — no crash).
- [ ] **PARITY-15**: Human-verify checkpoint: Romano opens Marfa detail — zero crashes, amber pill visible (or absent if fields populated), evidence/analysis tabs show clean empty states.

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

| Requirement | Phase | Status   |
| ----------- | ----- | -------- |
| DATA-01     | 60    | Complete |
| DATA-02     | 60    | Complete |
| DATA-03     | 60    | Complete |
| DATA-04     | 60    | Complete |
| DATA-05     | 60    | Complete |
| DATA-06     | 60    | Complete |
| DATA-07     | 60    | Complete |
| DATA-08     | 60    | Complete |
| DATA-09     | 60    | Complete |
| DATA-10     | 60    | Complete |
| FOUND-01    | 60    | Complete |
| FOUND-02    | 60    | Complete |
| FOUND-03    | 60    | Complete |
| FOUND-04    | 60    | Complete |
| IMPORT-01   | 60    | Complete |
| IMPORT-02   | 60    | Complete |
| IMPORT-03   | 60    | Complete |
| IMPORT-04   | 60    | Complete |
| TEST-01     | 60    | Complete |
| TEST-02     | 60    | Complete |
| TEST-03     | 60    | Complete |
| TEST-04     | 60    | Complete |
| TEST-05     | 60    | Complete |
| ADMIN-01    | 61    | Complete |
| ADMIN-02    | 61    | Complete |
| ADMIN-03    | 61    | Complete |
| ADMIN-04    | 61    | Complete |
| ADMIN-05    | 61    | Complete |
| ADMIN-06    | 61    | Complete |
| ADMIN-07    | 61    | Complete |
| ADMIN-08    | 61    | Complete |
| DSGN-01     | 62    | Pending  |
| DSGN-02     | 62    | Pending  |
| DSGN-03     | 62    | Pending  |
| CLIENT-01   | 62    | Pending  |
| CLIENT-02   | 62    | Pending  |
| CLIENT-03   | 62    | Pending  |
| CLIENT-04   | 62    | Pending  |
| CLIENT-05   | 62    | Pending  |
| CLIENT-06   | 62    | Pending  |
| CLIENT-07   | 62    | Pending  |
| CLIENT-08   | 62    | Pending  |
| PDF-01      | 62    | Pending  |
| PDF-02      | 62    | Pending  |
| PDF-03      | 62    | Pending  |
| PDF-04      | 62    | Pending  |
| PDF-05      | 62    | Pending  |
| PDF-06      | 62    | Pending  |
| PDF-07      | 62    | Pending  |
| CONT-01     | 63    | Pending  |
| CONT-02     | 63    | Pending  |
| CONT-03     | 63    | Pending  |
| CONT-04     | 63    | Pending  |
| CONT-05     | 63    | Pending  |
| CONT-06     | 63    | Pending  |
| CONT-07     | 63    | Pending  |
| CONT-08     | 63    | Pending  |
| CONT-09     | 63    | Pending  |
| CONT-10     | 63    | Pending  |
| POLISH-01   | 61.1  | Complete |
| POLISH-02   | 61.1  | Complete |
| POLISH-03   | 61.1  | Complete |
| POLISH-04   | 61.1  | Complete |
| POLISH-05   | 61.1  | Complete |
| POLISH-06   | 61.1  | Complete |
| POLISH-07   | 61.1  | Complete |
| POLISH-08   | 61.1  | Complete |
| POLISH-09   | 61.1  | Complete |
| POLISH-10   | 61.1  | Complete |
| POLISH-11   | 61.1  | Complete |
| POLISH-12   | 61.1  | Complete |
| POLISH-13   | 61.1  | Complete |
| POLISH-14   | 61.1  | Complete |

| PARITY-01 | 61.2 | Complete |
| PARITY-02 | 61.2 | Complete |
| PARITY-03 | 61.2 | Complete |
| PARITY-04 | 61.2 | Complete |
| PARITY-05 | 61.2 | Complete |
| PARITY-06 | 61.2 | Complete |
| PARITY-07 | 61.2 | Pending |
| PARITY-08 | 61.2 | Pending |
| PARITY-09 | 61.2 | Pending |
| PARITY-10 | 61.2 | Pending |
| PARITY-11 | 61.2 | Pending |
| PARITY-12 | 61.2 | Pending |
| PARITY-13 | 61.2 | Pending |
| PARITY-14 | 61.2 | Pending |
| PARITY-15 | 61.2 | Pending |

**Coverage:**

- v9.0 requirements: 88 total (DATA 10 + FOUND 4 + IMPORT 4 + DSGN 3 + ADMIN 8 + CLIENT 8 + PDF 7 + CONT 10 + TEST 5 + POLISH 14 + PARITY 15)
- Mapped to phases: 88
- Unmapped: 0

---

_Requirements defined: 2026-04-13_
_Last updated: 2026-04-14 — Phase 61.2 inserted with 15 PARITY requirements (Apollo fallback, og-logo, enrichment form, render audit)_

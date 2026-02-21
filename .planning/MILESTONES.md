# Milestones: Qualifai

## v1.0 — MVP Sales Engine (Completed)

**Shipped:** 2026-02-20
**Phases:** 1–5 (scaffolded as single MVP)

### What shipped:

- Company enrichment + contact discovery via Apollo
- Research pipeline (fetch + parse + evidence extraction)
- Evidence quality gate
- Workflow Loss Map + Call Prep generation (PDF)
- Outreach sequence drafting with CTA enforcement
- Reply webhook handling + auto-triage
- Cal.com booking integration
- Signal tracking
- Public wizard (personalized landing per prospect)
- Admin command center
- Multi-touch task queue (call/LinkedIn/WhatsApp)
- Apollo plan-limit guardrails
- Campaign management

### Key learnings:

- Apollo free tier blocks people-search — need bulk import alternative
- Research fetch-only misses JS-rendered content and Google Reviews
- Evidence gate too permissive — outreach goes out without strong proof
- Email-only outreach too narrow — multi-touch needed
- Proof matching via Obsidian works but not scalable — needs in-app management

---

## v1.1 — Evidence-Backed Multi-Touch Outreach (Completed)

**Started:** 2026-02-20
**Shipped:** 2026-02-21
**Phases:** 6–11

### What shipped:

- Use Cases catalog with CRUD, Obsidian import, and NL synonym tags (Phase 6)
- Claude-powered semantic proof matching against DB use cases (Phase 6)
- Evidence approval gate — hypotheses require manual accept before outreach (Phase 7)
- Deep evidence pipeline: SerpAPI discovery + Crawl4AI browser extraction (Phase 8)
- SerpAPI caching in ResearchRun.inputSnapshot JSON (Phase 8)
- Engagement triggers: wizard step 3, PDF download, interested reply → immediate call tasks (Phase 9)
- Resend webhook verification (Svix) for email open/click events (Phase 9)
- Cadence engine: engagement-driven multi-touch scheduling across 4 channels (Phase 10)
- Cron-based cadence step processing with database-indexed timestamps (Phase 10)
- Prospect dashboard at /voor/bedrijfsnaam with evidence-backed content (Phase 11)
- Multi-channel contact: Cal.com modal, WhatsApp, phone, email (Phase 11)
- One-click quote request with admin notification (Phase 11)
- Readable URL slugs auto-generated from company names (Phase 11)
- Search merged into prospects page with 3-way toggle (Quick task)
- Prospect detail restructured: company/contacts inline, 7 tabs (Quick task)

### Key learnings:

- Auto-accepting hypotheses bypasses the approval gate — removed, manual review required
- glass-card CSS class overrides Tailwind bg colors — avoid combining with dark backgrounds
- /voor/ and /discover/ routes serve different components — keep both for backward compat
- Cal.com embed React SDK needs both light and dark cssVarsPerTheme keys
- Crawl4AI REST API requires {type: ClassName, params: {...}} wrapping — not optional
- Email opens excluded from cadence (Apple MPP false positives) — enforced at type level

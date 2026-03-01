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

---

## v1.2 — Autopilot with Oversight (Completed)

**Started:** 2026-02-21
**Shipped:** 2026-02-22
**Phases:** 12–15 (Phase 16 absorbed into v2.0)

### What shipped:

- Navigation simplified: 10 → 6 sidebar items (Dashboard, Companies, Campaigns, Draft Queue, Use Cases, Signals) (Phase 12)
- Terminology cleanup: Loss Map → Workflow Report, Call Prep → Meeting Brief, etc. (Phase 12)
- Prospect detail: 7-tab → 4-section story flow (Evidence → Analysis → Outreach Preview → Results) (Phase 13)
- Prospect detail redesign: hero company layout, real tabs, manual contact creation, CSS hidden mounting (Phase 13)
- Campaign reporting: named cohorts, funnel metrics, per-prospect status, conversion rates (Phase 14)
- Action queue dashboard: unified hub with hypotheses, drafts, calls, replies grouped by urgency (Phase 15)
- UI consistency pass: glass-card border-radius fix, input-minimal font fix, rounded corners app-wide (Quick tasks)

### Key learnings:

- glass-card CSS class needs border-radius in the class itself, not per-instance — prevents inconsistency
- Tab sections should stay mounted (CSS hidden) to avoid refetch/loading flash on switch
- input-minimal needs font-family: inherit to match app typography
- Conditional rendering vs CSS visibility: use CSS hidden for tabs with tRPC queries
- Hypothesis approval is in the wrong place — admin can't judge hypotheses for unknown prospects; client should validate via /voor/ dashboard
- Too many disconnected screens — user wants a simple flow: enter prospect → review research quality → send → track
- Draft Queue redesign (Phase 16) was too incremental — needs fundamental rethink as part of v2.0

## v2.0 — Streamlined Flow (Completed)

**Started:** 2026-02-22
**Shipped:** 2026-02-23
**Phases:** 17–22 (6 phases, 14 plans)
**Files:** 76 changed, +10,208 / -1,048

### What shipped:

- Evidence pipeline enriched with 4 new sources: sitemap crawling, Google search mentions, KvK registry, LinkedIn company pages (Phase 17)
- Traffic-light research quality gate with soft "proceed anyway" override for thin-presence Dutch SMBs (Phase 18)
- Hypothesis approve/reject removed from admin — replaced with read-only status badges (Phase 18)
- Prospect-facing hypothesis validation on /voor/ dashboard — prospects confirm or decline pain points themselves (Phase 19)
- One-click send queue with inline preview and atomic idempotency guards preventing double-sends (Phase 20)
- 7-stage pipeline chip (Imported → Booked) on every prospect row for at-a-glance status (Phase 20)
- Action queue filters to actionable stages only with engagement-based urgency ranking (Phase 20)
- Apollo sector/location search with multi-select batch import for prospect discovery (Phase 21)
- Dead admin pages (/admin/hypotheses, /admin/research, /admin/briefs) removed (Phase 21)
- Critical integration gap fixed: DRAFT→PENDING hypothesis transition in approveQuality (Phase 22)

### Key learnings:

- Cross-phase integration testing catches gaps invisible during individual phase verification — milestone audit essential
- Admin reviews research quality, not hypothesis content — prospect is the subject matter expert on their own pain points
- Soft gate (amber = warn + proceed) works better than hard blocking for Dutch SMB market with thin web presence
- Idempotency guard must ship in same phase as one-click send UI — never separate
- tRPC v11 middleware uses async getRawInput() not sync rawInput — breaking change from v10
- List-view quality indicators can use approximate values (source diversity not in list query) — detail is definitive

---

## v2.1 — Production Bootstrap (Completed)

**Started:** 2026-02-23
**Shipped:** 2026-03-02
**Phases:** 23–27.1 (7 phases, 16 plans, including inserted 26.1 + 27.1)
**Files:** 137 changed, +19,271 / -3,052
**Commits:** 89
**Codebase:** 32,535 LOC TypeScript

### What shipped:

- Use case population from Klarifai knowledge assets — Obsidian vault reader + AI codebase analyzer populated 77 use cases from 6 project codebases (Phase 23)
- Real prospect seeding — 10+ companies imported via Apollo sector/location search for NL SMBs (Phase 24)
- Pipeline hardening with Scrapling stealth fetcher — replaced raw fetch() with StealthyFetcher microservice, user-visible API error handling, AI-generated hypotheses replacing hardcoded templates (Phase 25)
- Multi-source evidence pipeline expanded from 4 to 8+ sources: LinkedIn posts, Google Reviews via SerpAPI, Google News RSS, employee reviews, job postings — with AI scoring via Gemini Flash (relevance + depth) (Phase 26.1)
- Quality threshold calibration — traffic-light gate calibrated against real data, AMBER hard gate enforced on send queue, list-view chip using real summary data (Phase 26)
- Full E2E outreach cycle verified — 2 real emails sent + delivered via Resend, 2 Dutch replies triaged (interested → book_teardown, not_fit → close_lost) (Phase 27)
- Cal.com booking → call prep pipeline verified end-to-end with HMAC-signed webhook simulation, all 6 DB state checks passing (Phase 27.1)

### Key learnings:

- AI evidence scoring (Gemini Flash) is far more effective than hardcoded source weights — formula: sourceWeight*0.30 + relevance*0.45 + depth\*0.25
- Dutch SMBs have thin web presence — quality gates need careful calibration (0.55 min avg confidence, not 0.85)
- Scrapling StealthyFetcher outperforms raw fetch() for bot-detected sites — returns HTML on previously blocked domains
- Hypothesis generation must be industry-dynamic — hardcoded "marketing bureau" prompt fails for construction, consumer goods, etc.
- E2E test scripts (send, reply, booking) are essential regression harness — each follows same pattern: set up DB state → trigger → verify side effects
- DKIM/SPF/DMARC verification is prerequisite for production email at volume
- Milestone audit → gap closure workflow (Phase 27.1 inserted for E2E-03) proves the audit-then-fix cycle works

---

# Qualifai

## What This Is

Qualifai is the sales engine in the Klarifai ecosystem. It automates evidence-backed outbound prospecting — finding companies with provable workflow pain points from 8+ sources (sitemap, Google search, KvK registry, LinkedIn, employee reviews, job postings, customer reviews, industry news), matching those to Klarifai's services via AI-scored hypothesis generation, and running personalized multi-touch outreach grounded in real evidence. The admin operates through a streamlined oversight console: enter prospects, review research quality via traffic-light indicators, approve outreach with one click, and track pipeline stage — while prospects validate pain-point hypotheses themselves on their /discover/ dashboard. The full cycle has been proven end-to-end: real emails sent, replies triaged, bookings triggering call prep. Built for any company that could benefit from workflow automations, especially non-tech companies in NL/BE.

## Core Value

Every outreach message is backed by real evidence of a prospect's workflow pain points, matched to a service Klarifai actually delivers. No spray-and-pray.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ **Company enrichment** via Apollo (search, import, enrich) — v1.0
- ✓ **Contact discovery** via Apollo with plan-limit guardrails — v1.0
- ✓ **Research pipeline** (website crawl + evidence extraction + hypothesis generation) — v1.0
- ✓ **Evidence quality gate** (confidence scoring, source diversity) — v1.0
- ✓ **Workflow Loss Map generation** (markdown → HTML → PDF with metrics) — v1.0
- ✓ **Call Prep Plan generation** (30/60/90, stakeholder map, discovery questions) — v1.0
- ✓ **Outreach sequence drafting** with CTA enforcement (2-step: loss map + demo) — v1.0
- ✓ **Reply webhook handling** + auto-triage (Resend, Mailgun, Postmark, SendGrid) — v1.0
- ✓ **Cal.com integration** (booking → auto call prep) — v1.0
- ✓ **Signal tracking** (job changes, funding, tech adoption, etc.) — v1.0
- ✓ **Public wizard** (personalized landing page per prospect) — v1.0
- ✓ **Admin command center** (dashboard, prospect detail, pipeline view) — v1.0
- ✓ **Multi-touch task queue** (call + LinkedIn + WhatsApp manual tasks) — v1.0
- ✓ **Apollo plan-limit guardrails** (UX warnings when people-endpoints blocked) — v1.0
- ✓ **Use Cases management** (service catalog + case studies in admin) — v1.1
- ✓ **Smart proof matching** (pijnpunten ↔ use cases with Claude semantic scoring) — v1.1
- ✓ **Deep evidence pipeline** (SerpAPI discovery + Crawl4AI browser extraction) — v1.1
- ✓ **Evidence approval gate** (manual hypothesis review before outreach) — v1.1
- ✓ **Engagement triggers** (wizard/PDF/reply → immediate call tasks with dedup) — v1.1
- ✓ **Cadence engine** (engagement-driven multi-touch scheduling across 4 channels) — v1.1
- ✓ **Prospect dashboard** (/voor/bedrijfsnaam with evidence-backed content + multi-channel contact) — v1.1
- ✓ **One-click quote request** (admin notification with matched use cases) — v1.1
- ✓ **Action queue dashboard** (unified hub: hypotheses, drafts, calls, replies) — v1.2
- ✓ **Nav simplification** (10 → 6 sidebar items) — v1.2
- ✓ **Prospect detail story flow** (Evidence → Analysis → Outreach Preview → Results) — v1.2
- ✓ **Campaign cohort reporting** (funnel metrics, per-prospect status) — v1.2
- ✓ **Terminology cleanup** (plain language throughout) — v1.2
- ✓ **Evidence pipeline enrichment** (sitemap, Google search, KvK registry, LinkedIn) — v2.0
- ✓ **Research quality gate** (traffic-light indicator, soft override, quality review) — v2.0
- ✓ **Client hypothesis validation** (prospect confirm/decline on /voor/ dashboard) — v2.0
- ✓ **One-click send queue** (inline preview, atomic idempotency guards) — v2.0
- ✓ **Pipeline stage visibility** (7-stage chip on every prospect row) — v2.0
- ✓ **Prospect discovery** (Apollo sector/location search with batch import) — v2.0
- ✓ **Dead page cleanup** (/admin/hypotheses, /research, /briefs removed) — v2.0
- ✓ **Use case population** (Obsidian vault reader + AI codebase analyzer, 77 use cases) — v2.1
- ✓ **Prospect seeding** (10+ real companies via Apollo sector/location search) — v2.1
- ✓ **Pipeline hardening** (Scrapling stealth fetcher, user-visible error handling, AI hypothesis generation) — v2.1
- ✓ **Multi-source evidence pipeline** (8+ sources with AI scoring via Gemini Flash) — v2.1
- ✓ **Quality threshold calibration** (traffic-light gate calibrated from real data, AMBER hard gate) — v2.1
- ✓ **Full E2E outreach cycle** (send → reply triage → Cal.com booking → call prep generation) — v2.1
- ✓ **Automatic source discovery per prospect** (Google + sitemap + manual merge with provenance labels, dedup, caps) — v2.2
- ✓ **Browser-rendered evidence extraction** (two-tier stealth-first routing, Crawl4AI escalation, 5-URL budget cap) — v2.2
- ✓ **Pain confirmation gate** (cross-source pain tag confirmation, advisory-only, send queue signals) — v2.2
- ✓ **Override audit trail** (GateOverrideAudit model, mandatory reason, Bypassed badge, Override History panel) — v2.2

- ✓ **Unified AI email engine** (single generateIntroEmail pipeline replaces template-based WorkflowLossMap) — v8.0
- ✓ **Signal diff detection** (evidence changes between research runs → Signal records with dedup) — v8.0
- ✓ **Signal-to-draft automation** (research refresh cron → signal detection → AI draft creation) — v8.0
- ✓ **Unified draft queue** (all draft types in one queue with Dutch date grouping, prospect links, kind chips) — v8.0
- ✓ **AI cadence follow-ups** (evidence-enriched follow-up generation from ProspectAnalysis + signals) — v8.0
- ✓ **OutreachLog.prospectId denormalization** (all draft types carry prospect link for queue queries) — v8.0
- ✓ **Dead code cleanup** (template engine, generateMasterAnalysis v1, ~970 lines removed) — v8.0

### Active

## Current Milestone: v9.0 — Klant Lifecycle Convergence

**Goal:** Converge klarifai-core's quote/contract pipeline into Qualifai zodat de volledige klant-lifecycle (prospect → quote → contract → start project) in één systeem leeft, met een gepersonaliseerde URL als primair output-formaat in plaats van losse PDFs.

**Strategie-context:** Zie `klarifai-core/docs/strategy/qualifai-convergence.md` (strategy), `klarifai-core/docs/strategy/HANDOFF.md` (multi-session handoff), en `klarifai-core/docs/strategy/decisions.md` (locked decisions Q5/Q8/Q9/Q12/Q13).

**Target features (4 phases):**

- **Schema foundation** — `Quote`/`QuoteLine` Prisma models, `QuoteStatus` enum, extended `ProspectStatus` (+`QUOTE_SENT`), tRPC `quotes.*` router with state-machine transitions, foundation fixes (typed status constants, state transition validation on `updateProspect`, Zod-validated snapshots), YAML import script for klarifai-core migration.
- **Admin UI voor quotes** — `/admin/quotes` list view, `/admin/prospects/[id]/quotes/new` form (narrative fields + line items + scope), live preview iframe, status workflow Draft → Sent.
- **Client-facing voorstel** — `/discover/[slug]/voorstel` route serving the proposal as HTML (single source: snapshot at sent), accept flow with confirmation modal, separate Railway PDF worker for snapshot generation, Slack/email notification to admin on accept.
- **Contract workflow** — Contract drafting from accepted quote, click-to-sign with IP logging, contract PDF snapshot, status transition to project-active.

**Out of scope for v9.0** (deferred to v10.0+):

- Invoice generation pipeline
- klarifai-core CLI deprecation/sunset
- Multi-brand support (single Klarifai brand assumed)

**Dependencies:**

- `decisions.md` Q5: PDF rendering = separate Railway worker service (not in-process)
- `decisions.md` Q8: Existing klarifai-core YAMLs migrated via idempotent import script
- `decisions.md` Q9: Snapshot at `QUOTE_SENT` (not live render)
- `decisions.md` Q12: Snapshot versioning = `snapshotAt: DateTime` + `templateVersion: String` (no counter)
- `decisions.md` Q13: Quote and Prospect have separate status enums with auto-sync via state-machine helper

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- OAuth/SSO login — Email/password sufficient, admin-only tool
- Mobile app — Web-first, internal tool
- Real-time chat — Not core to outbound prospecting
- WhatsApp API integration — Manual tasks for now, API too complex/expensive
- LinkedIn API automation — ToS risk, manual tasks only
- Bulk email sending without evidence — Contradicts core value
- "Need more research" re-run button — Pipeline now has 8+ sources; re-run available via scripts
- Kanban board pipeline view — List with stage chips sufficient at current volumes (20-50 prospects)
- Auto-send without approval — Trust not yet calibrated, GDPR/anti-spam risk for NL/BE
- Research completeness as hard blocker — Makes system unusable for thin-presence Dutch SMBs
- Global research threshold — Different industries have different evidence availability

## Context

- **Ecosystem:** Klarifai (holding) → Copifai (marketing) + Qualifai (sales)
- **Target market:** Any company that could benefit from workflow automations, especially non-tech companies in NL/BE
- **Proposition:** Workflow Optimization Sprint
- **CTA pattern (enforced):** Step 1: "I made a 1-page Workflow Loss Map" → Step 2: "15-min teardown + live mini-demo"
- **Current enrichment:** Apollo for company/contact data + KvK registry for Dutch company details
- **Current research:** 8+ source pipeline (sitemap, Google search, KvK, LinkedIn, employee reviews, job postings, Google Reviews, industry news) + Scrapling stealth fetcher + SerpAPI discovery + AI scoring via Gemini Flash
- **Proof matching:** In-app Use Cases management (77 use cases from 6 codebases) with Claude semantic scoring
- **Email delivery:** Resend API with idempotency guards, DKIM/SPF/DMARC verified for klarifai.nl
- **Scheduling:** Cal.com with HMAC-signed webhook → automatic call prep generation
- **Current codebase:** ~34,658 LOC TypeScript
- **Shipped:** v1.0 (Feb 20) → v1.1 (Feb 21) → v1.2 (Feb 22) → v2.0 (Feb 23) → v2.1 (Mar 2) → v2.2 (Mar 2) → v3.0 (Mar 5) → v4.0 (Mar 7) → v5.0 (Mar 8) → v6.0 (Mar 8) → v7.0 (Mar 15) → v8.0 (Mar 16)
- **Prospects in DB:** 7+ real companies, all passing quality gate after AI scoring overhaul

## Constraints

- **Tech stack**: Next.js 16 + tRPC + Prisma + PostgreSQL (established, no changes)
- **AI provider**: Anthropic Claude (established)
- **Enrichment**: Apollo (current plan limits people-search)
- **Browser crawling**: Crawl4AI REST API (managed browser)
- **Search discovery**: SerpAPI (Google search, reviews, jobs)
- **Multi-tenant**: All models need organization_id (NOT NULL, indexed)
- **Port**: App runs on 9200

## Key Decisions

| Decision                                 | Rationale                                                                     | Outcome   |
| ---------------------------------------- | ----------------------------------------------------------------------------- | --------- |
| SerpAPI for Google discovery             | Google aggressive with bot detection, not worth self-maintaining              | ✓ Good    |
| Crawl4AI for content extraction          | Handles JS-rendered pages, cookie consent, managed browser                    | ✓ Good    |
| Manual evidence approval (not auto)      | Quality over speed, wrong outreach damages brand                              | ✓ Good    |
| Engagement-driven cadence (not fixed)    | Smarter resource allocation, respond to prospect behavior                     | ✓ Good    |
| WhatsApp/LinkedIn as manual tasks        | API integration too complex/expensive for now                                 | ✓ Good    |
| Admin reviews quality, not hypothesis    | Prospect is subject matter expert on their own pain points                    | ✓ Good    |
| Soft gate (amber = warn + proceed)       | Dutch SMBs have thin web presence, hard block unusable                        | ✓ Good    |
| Prospect validates hypotheses on /voor/  | Shifts validation from admin guesswork to prospect confirmation               | ✓ Good    |
| Idempotency via atomic updateMany        | Database-level claim prevents double-sends, no external locks                 | ✓ Good    |
| List view with stage chips (not kanban)  | Sufficient at current volumes (20-50 prospects)                               | — Pending |
| Pipeline stage as computed value         | No schema change, derived from existing data                                  | ✓ Good    |
| Scrapling stealth fetcher over raw fetch | Bypasses bot detection on previously blocked domains                          | ✓ Good    |
| AI evidence scoring (Gemini Flash)       | More accurate than hardcoded weights; formula: src*0.30+rel*0.45+depth\*0.25  | ✓ Good    |
| Industry-dynamic hypothesis generation   | Hardcoded "marketing bureau" prompt fails for diverse sectors                 | ✓ Good    |
| AMBER as hard gate on send queue         | Prevents low-quality outreach; qualityApproved required                       | ✓ Good    |
| 8+ evidence sources per prospect         | More cross-source validation, higher confidence scores                        | ✓ Good    |
| E2E test scripts as regression harness   | Send/reply/booking scripts catch regressions automatically                    | ✓ Good    |
| Advisory-only pain gate                  | Dutch SMBs structurally fail cross-source; gate provides visibility not block | ✓ Good    |
| Two-tier extraction (stealth + browser)  | Most pages don't need browser rendering; 5-URL budget bounds worst-case time  | ✓ Good    |
| GateOverrideAudit as relational model    | Enables \_count queries, FK joins, future filtering — not a JSON blob         | ✓ Good    |
| Debug-only UI toggle via localStorage    | Features not ready for general visibility can still be tested                 | ✓ Good    |

---

## Current State

**Latest shipped:** v8.0 Unified Outreach Pipeline (2026-03-16) — unified AI email engine, signal diff detection, automated signal-to-draft pipeline, date-grouped draft queue with prospect linking, AI cadence follow-ups with evidence enrichment, ~970 lines dead code removed.

**Previous milestones:** v7.0 Atlantis Discover Pipeline Rebuild (Mar 15) → v6.0 Outreach Simplification (Mar 8) → v5.0 Atlantis Intelligence (Mar 8)

**12 milestones, 59 phases shipped**

---

_Last updated: 2026-04-13 after v9.0 milestone start (Klant Lifecycle Convergence)_

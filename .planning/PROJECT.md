# Qualifai

## What This Is

Qualifai is the sales engine in the Klarifai ecosystem. It automates evidence-backed outbound prospecting for the Workflow Optimization Sprint proposition — finding companies with provable workflow pain points from multiple sources (sitemap crawling, Google search, KvK registry, LinkedIn), matching those to Klarifai's services via AI hypothesis generation, and running personalized multi-touch outreach grounded in real evidence. The admin operates through a streamlined oversight console: enter prospects, review research quality via traffic-light indicators, approve outreach with one click, and track pipeline stage — while prospects validate pain-point hypotheses themselves on their /voor/ dashboard. Built for marketing agencies in NL/BE.

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

### Active

(No active requirements — define with next milestone)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- OAuth/SSO login — Email/password sufficient, admin-only tool
- Mobile app — Web-first, internal tool
- Real-time chat — Not core to outbound prospecting
- WhatsApp API integration — Manual tasks for now, API too complex/expensive
- LinkedIn API automation — ToS risk, manual tasks only
- Bulk email sending without evidence — Contradicts core value
- "Need more research" re-run button — Pipeline too narrow, same results; fix evidence sources first
- Kanban board pipeline view — List with stage chips sufficient at current volumes (20-50 prospects)
- Auto-send without approval — Trust not yet calibrated, GDPR/anti-spam risk for NL/BE
- Research completeness as hard blocker — Makes system unusable for thin-presence Dutch SMBs
- Global research threshold — Different industries have different evidence availability

## Context

- **Ecosystem:** Klarifai (holding) → Copifai (marketing) + Qualifai (sales)
- **Target market:** Marketing agencies in NL/BE
- **Proposition:** Workflow Optimization Sprint
- **CTA pattern (enforced):** Step 1: "I made a 1-page Workflow Loss Map" → Step 2: "15-min teardown + live mini-demo"
- **Current enrichment:** Apollo for company/contact data + KvK registry for Dutch company details
- **Current research:** Multi-source pipeline (website crawl, sitemap, Google search, LinkedIn, KvK) + Crawl4AI browser extraction + SerpAPI discovery
- **Proof matching:** In-app Use Cases management with Claude semantic scoring
- **Email delivery:** Resend API with idempotency guards
- **Scheduling:** Cal.com
- **Current codebase:** ~15,000 LOC TypeScript, 76 files modified in v2.0 alone
- **Shipped:** v1.0 (Feb 20) → v1.1 (Feb 21) → v1.2 (Feb 22) → v2.0 (Feb 23)

## Constraints

- **Tech stack**: Next.js 16 + tRPC + Prisma + PostgreSQL (established, no changes)
- **AI provider**: Anthropic Claude (established)
- **Enrichment**: Apollo (current plan limits people-search)
- **Browser crawling**: Crawl4AI REST API (managed browser)
- **Search discovery**: SerpAPI (Google search, reviews, jobs)
- **Multi-tenant**: All models need organization_id (NOT NULL, indexed)
- **Port**: App runs on 9200

## Key Decisions

| Decision                                | Rationale                                                        | Outcome   |
| --------------------------------------- | ---------------------------------------------------------------- | --------- |
| SerpAPI for Google discovery            | Google aggressive with bot detection, not worth self-maintaining | ✓ Good    |
| Crawl4AI for content extraction         | Handles JS-rendered pages, cookie consent, managed browser       | ✓ Good    |
| Manual evidence approval (not auto)     | Quality over speed, wrong outreach damages brand                 | ✓ Good    |
| Engagement-driven cadence (not fixed)   | Smarter resource allocation, respond to prospect behavior        | ✓ Good    |
| WhatsApp/LinkedIn as manual tasks       | API integration too complex/expensive for now                    | ✓ Good    |
| Admin reviews quality, not hypothesis   | Prospect is subject matter expert on their own pain points       | ✓ Good    |
| Soft gate (amber = warn + proceed)      | Dutch SMBs have thin web presence, hard block unusable           | ✓ Good    |
| Prospect validates hypotheses on /voor/ | Shifts validation from admin guesswork to prospect confirmation  | ✓ Good    |
| Idempotency via atomic updateMany       | Database-level claim prevents double-sends, no external locks    | ✓ Good    |
| List view with stage chips (not kanban) | Sufficient at current volumes (20-50 prospects)                  | — Pending |
| Pipeline stage as computed value        | No schema change, derived from existing data                     | ✓ Good    |

---

_Last updated: 2026-02-23 after v2.0 milestone_

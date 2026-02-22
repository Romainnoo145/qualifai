# Qualifai

## What This Is

Qualifai is the sales engine in the Klarifai ecosystem. It automates evidence-backed outbound prospecting for the Workflow Optimization Sprint proposition — finding companies with provable workflow pain points, matching those to Klarifai's services, and running personalized multi-touch outreach grounded in real evidence. Built for marketing agencies in NL/BE.

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

### Active

- [ ] **Admin oversight console** — single-flow admin experience: enter prospects → review research quality → approve/send outreach → track status
- [ ] **Research quality gate** — admin reviews whether research is sufficient (not hypothesis content) and can request more research
- [ ] **Client-facing hypothesis validation** — hypotheses approved by the prospect on /voor/ dashboard, not by admin
- [ ] **One-click send queue** — per-channel send buttons (Gmail/LinkedIn/WhatsApp/Call) with content preview, one click per action
- [ ] **Prospect pipeline view** — see every prospect's stage at a glance: researching → reviewed → sending → engaged → booked

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- OAuth/SSO login — Email/password sufficient, admin-only tool
- Mobile app — Web-first, internal tool
- Real-time chat — Not core to outbound prospecting
- WhatsApp API integration — Manual tasks for now, API too complex/expensive
- LinkedIn API automation — ToS risk, manual tasks only
- Bulk email sending without evidence — Contradicts core value

## Context

- **Ecosystem:** Klarifai (holding) → Copifai (marketing) + Qualifai (sales)
- **Target market:** Marketing agencies in NL/BE
- **Proposition:** Workflow Optimization Sprint
- **CTA pattern (enforced):** Step 1: "I made a 1-page Workflow Loss Map" → Step 2: "15-min teardown + live mini-demo"
- **Current enrichment:** Apollo for company/contact data. People-search endpoints blocked on current plan (free tier).
- **Current research:** Server-side fetch + HTML parse. No browser rendering, no Google discovery.
- **Proof source:** Obsidian vault (inventory.json + client_offers.json). Moving to in-app Use Cases management.
- **Email delivery:** Resend API
- **Scheduling:** Cal.com

## Constraints

- **Tech stack**: Next.js 16 + tRPC + Prisma + PostgreSQL (established, no changes)
- **AI provider**: Anthropic Claude (established)
- **Enrichment**: Apollo (current plan limits people-search)
- **Browser crawling**: Playwright (already devDependency)
- **Search discovery**: SerpAPI (new dependency for Google search)
- **Multi-tenant**: All models need organization_id (NOT NULL, indexed)
- **Port**: App runs on 9200

## Current Milestone: v2.0 — Streamlined Flow

**Goal:** Transform the admin from a collection of disconnected pages into a single oversight console where the admin enters prospects, reviews research quality, approves outreach with one click per channel, and tracks status — while prospects validate hypotheses themselves on their dashboard.

**Target features:**

- Admin oversight console (single flow: enter → review → send → track)
- Research quality gate (admin checks research sufficiency, not hypothesis accuracy)
- Client-side hypothesis validation (prospect approves on /voor/ dashboard)
- One-click send queue (Gmail/LinkedIn/WhatsApp/Call per row)
- Prospect pipeline view (stage visibility at a glance)

## Key Decisions

| Decision                              | Rationale                                                        | Outcome   |
| ------------------------------------- | ---------------------------------------------------------------- | --------- |
| SerpAPI for Google discovery          | Google aggressive with bot detection, not worth self-maintaining | — Pending |
| Playwright for content extraction     | Already in project, handles JS-rendered pages                    | — Pending |
| Manual evidence approval (not auto)   | Quality over speed, wrong outreach damages brand                 | — Pending |
| Engagement-driven cadence (not fixed) | Smarter resource allocation, respond to prospect behavior        | — Pending |
| WhatsApp/LinkedIn as manual tasks     | API integration too complex/expensive for now                    | — Pending |

---

_Last updated: 2026-02-22 after milestone v2.0 kickoff_

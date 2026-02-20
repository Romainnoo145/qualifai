# Feature Landscape

**Domain:** Evidence-backed multi-touch B2B outbound sales engine
**Researched:** 2026-02-20
**Milestone:** v1.1 — Evidence-Backed Multi-Touch Outreach

---

## Scope Boundary

This file covers only what is NEW in v1.1. The following already exist and are not re-researched:

- Company/contact enrichment via Apollo
- Website fetch + HTML parse evidence extraction
- Evidence quality gate (confidence scoring)
- Workflow Loss Map + Call Prep PDF generation
- Outreach sequence drafting with CTA enforcement
- Reply webhook + auto-triage
- Cal.com booking integration
- Signal tracking (job changes, funding, etc.)
- Public wizard (personalized landing page)
- Multi-touch task queue (manual call/LinkedIn/WhatsApp)
- Campaign management

---

## What Exists Today (Honest Assessment)

Reading the codebase reveals the following gaps the new milestone must close:

**Evidence gathering (current state):**

- Fetches prospect website, /careers, /jobs, /docs, /help pages via plain HTTP
- Manually provided review URLs (Trustpilot, Google Maps, klantenvertellen) — fetches HTML and extracts sentences matching Dutch/English pain keywords
- No search-engine-driven discovery — can't find Google Reviews that aren't already known URLs
- No Playwright/JS rendering — JS-rendered pages (many review sites, Glassdoor) silently fail
- `REVIEWS` source type exists in schema but requires manual URL input to activate
- `JOB_BOARD` source type exists but only matches `indeed.` or `intermediair.` or `job` in URL

**Use Cases / proof matching (current state):**

- Proof catalog loaded from two flat JSON files on disk (`OBSIDIAN_INVENTORY_JSON_PATH`, `OBSIDIAN_CLIENT_OFFERS_JSON_PATH`)
- Keyword overlap scoring only (token intersection ratio, no semantic matching)
- No admin UI for managing use cases
- No way to add/edit/retire use cases without editing files on disk

**Cadence (current state):**

- Three fixed email steps drafted at sequence creation time (intro, follow-up proof, follow-up teardown)
- Manual touch tasks (call/LinkedIn/WhatsApp) queued by hand with `dueAt` timestamps
- No automatic escalation based on prospect engagement
- Reply triage exists (interested/later/not_fit/stop) but does NOT automatically trigger next-step actions — it sets flags only
- Wizard session tracks step depth, PDF download, call booking — but nothing reads these to adjust the outreach cadence

**Evidence approval (current state):**

- `EvidenceItem.isApproved` field exists in schema but is never written to
- No admin UI for evidence review before outreach proceeds

---

## Table Stakes

Features users (Romano) expect from this class of tool. Their absence means the product fails at its own stated goal.

| Feature                               | Why Expected                                                                                                                                    | Complexity | Depends On                                  |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------- |
| **Search-driven review discovery**    | Can't find unknown review URLs manually for every prospect; Google Reviews are where the richest pain language lives                            | Medium     | SerpAPI account + quota management          |
| **JS-rendered page extraction**       | Review platforms (Google Maps widget, Glassdoor, klantenvertellen) serve content via JavaScript — plain fetch returns nothing useful            | Medium     | Playwright already in devDependencies       |
| **Glassdoor job pain extraction**     | Job descriptions systematically reveal what's broken inside a company ("managing chaos," "building from scratch," "no process")                 | Medium     | Playwright (Glassdoor is JS-heavy)          |
| **Use Cases admin CRUD**              | Proof catalog must be editable in-product without SSH access to disk; adding a new case study shouldn't require a deployment                    | Medium     | New DB model (`UseCase`)                    |
| **Pain-point ↔ use-case matching UI** | User must be able to see which use case was matched to which hypothesis before sending — right now it's invisible                               | Low-Medium | UseCase model + existing ProofMatch         |
| **Manual evidence approval gate**     | `isApproved` field exists but is inert; evidence must be human-reviewed before outreach drafts are generated — this is the core quality promise | Low        | Schema already has field; needs router + UI |
| **Engagement-triggered next step**    | Wizard open, PDF download, email open → system should surface a "follow up now" task, not just sit there                                        | Medium     | Existing WizardSession + OutreachLog        |
| **Reply-intent auto-escalation**      | `interested` triage already detected but does nothing; must auto-queue a call task or flag the contact for immediate follow-up                  | Low        | Existing reply-workflow.ts                  |
| **4-channel task view**               | Call/LinkedIn/WhatsApp/email task queue exists but has no UI that shows sequence context alongside the task                                     | Low-Medium | Existing touch task queue                   |

**Confidence: HIGH** — Derived from reading the codebase directly and the stated PROJECT.md requirements. These are already identified gaps by the product owner.

---

## Differentiators

Features that make Qualifai meaningfully better than "just another sales tool." Not expected, but high-value once the table stakes are solid.

| Feature                                      | Value Proposition                                                                                                                                           | Complexity | Depends On                                           |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------- |
| **Evidence-grounded cadence copy**           | Each channel touch (email follow-up, call script line, LinkedIn note) references the specific evidence item that matched — not generic follow-up text       | High       | Approved evidence + UseCase match + generation layer |
| **Engagement score surfacing in task queue** | Task queue should rank contacts by engagement recency (wizard step depth, opens, PDF downloads) not just dueAt — "highest intent first"                     | Medium     | WizardSession + OutreachLog signals                  |
| **Deferred follow-up auto-scheduling**       | When reply-triage detects `later` with `deferDays`, auto-create a touch task with the calculated due date — currently inferred but not acted on             | Low        | Existing deferDays field in reply-workflow           |
| **Research refresh on engagement**           | When a prospect opens the wizard or downloads the PDF, trigger a lightweight research refresh to check for new signals — approach signal is itself a signal | High       | research-refresh.ts (exists) + webhook               |
| **Support forum pain discovery**             | G2, Capterra, product forums, subreddits where the prospect's tools are discussed — find what their stack is causing them pain around                       | High       | SerpAPI + Playwright + new adapter                   |
| **Multi-hypothesis use-case coverage map**   | Show admin a grid: which hypotheses are covered by at least one use case vs. which have no proof — prevents sending outreach with uncovered claims          | Medium     | UseCase model + ProofMatch                           |

**Confidence: HIGH** — Derived from codebase analysis. These are architectural gaps where the infrastructure exists but the decision logic is missing.

---

## Anti-Features

Features to explicitly NOT build in this milestone, with reasons.

| Anti-Feature                                     | Why Avoid                                                                                                                                             | What to Do Instead                                                                    |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Fully automated send without approval**        | Core brand promise is human-verified outreach; automated send contradicts PROJECT.md values                                                           | Keep human-in-the-loop approval; improve the approval UI to be faster                 |
| **LinkedIn API automation**                      | LinkedIn ToS explicitly prohibits scraping and automated messaging; risk of account ban                                                               | Keep as manual tasks only; improve the task UI                                        |
| **WhatsApp API (Cloud API / Business API)**      | Complex BSP setup, template approval, per-message cost, not worth the overhead for single-user tool                                                   | Manual tasks with phone number shown in task detail                                   |
| **AI-generated use cases**                       | Use cases must represent what was actually shipped — hallucinated proof destroys credibility in a sales context                                       | Admin-entered use cases only; optionally import from Obsidian JSON                    |
| **Fixed-schedule cadence**                       | Fixed day-1/day-4/day-7 timing is the old way; prospect behavior should drive timing                                                                  | Engagement-triggered tasks with sensible defaults only when no engagement data exists |
| **Semantic embedding search for proof matching** | Adds OpenAI/Cohere dependency for marginal gain over keyword overlap in a small catalog; current token intersection is good enough for <200 use cases | Improve keyword extraction quality; add tag-based filtering to UseCase model          |
| **Glassdoor company reviews API**                | Glassdoor API requires partner approval, high cost, and long onboarding                                                                               | Playwright extraction of public Glassdoor pages (no login required for overview)      |
| **Mass-import of use cases from external CRMs**  | Not needed at current scale; single-user tool with small catalog                                                                                      | Manual CRUD in admin                                                                  |

**Confidence: HIGH** — All anti-features are either explicitly in PROJECT.md "Out of Scope" or are architectural risks identified from codebase analysis.

---

## Feature Dependencies (New v1.1 Only)

```
SerpAPI integration
  → Review URL discovery (Google Reviews, Trustpilot search)
  → Job board discovery (Indeed NL, LinkedIn Jobs public)
  → [feeds] → Playwright extraction

Playwright extraction
  → JS-rendered review text (Google Maps widget, klantenvertellen, Glassdoor overview)
  → Job posting full text
  → [feeds] → review-adapters.ts (existing) and new job-board adapter

Review URL discovery + Playwright extraction
  → New evidence items (REVIEWS, JOB_BOARD source types, already in schema)
  → [feeds] → Evidence approval gate

Evidence approval gate (isApproved field already exists)
  → Admin evidence review UI (new)
  → [gates] → Outreach sequence generation

UseCase model (new, replaces Obsidian JSON)
  → UseCase admin CRUD (new pages)
  → [enables] → Smart proof matching (improves existing matchProofs())
  → [enables] → Pain-point ↔ use-case matching UI

Smart proof matching
  → [feeds] → ProofMatch records (schema already exists)
  → [feeds] → Outreach copy with evidence references

Reply-intent auto-escalation
  → Existing reply-workflow.ts applyReplyTriage()
  → [triggers] → queueTouchTask() for 'interested' intent
  → [triggers] → deferred task creation for 'later' intent with deferDays

Wizard engagement signals
  → Existing WizardSession (stepTimes, maxStepReached, pdfDownloaded, callBooked)
  → [triggers] → Touch task surfacing / ranking
  → [optionally] → research-refresh trigger
```

---

## MVP Recommendation

Build in this order to deliver value at each step without blocking on unfinished infrastructure:

**Must ship (blocks everything else):**

1. UseCase model + admin CRUD — without this, proof matching stays file-based and can't be curated per campaign
2. Evidence approval gate UI — `isApproved` field is there; add the review screen so the gate actually gates

**High value, low risk (build next):** 3. Reply-intent auto-escalation — `deferDays` and `interested` detection already works; wire them to `queueTouchTask()` — very low implementation cost, high daily impact 4. Engagement-driven task surfacing — read WizardSession signals into task queue priority ranking

**Core new infrastructure (build after foundations):** 5. SerpAPI integration + URL discovery — new external dependency; needs quota management and fallback 6. Playwright extraction adapter — Playwright is already in devDependencies; new adapter following existing `web-evidence-adapter.ts` pattern

**Differentiators (build last when time allows):** 7. Evidence-grounded cadence copy — highest complexity, requires all upstream pieces 8. Multi-hypothesis coverage map — valuable for quality assurance, low urgency

**Defer from this milestone:**

- Support forum / G2 / Capterra pain discovery — HIGH complexity, unpredictable DOM structure, can be a v1.2 feature
- Research refresh on engagement trigger — useful but requires careful async design to avoid duplicate runs

---

## Complexity Notes

| Area                      | Dominant Complexity                                                                                | Risk                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| SerpAPI discovery         | External API dependency, rate limits, cost per query, Google may change SERPs                      | MEDIUM — need quota guard from day one                                                       |
| Playwright extraction     | DOM structure varies per site; selectors break on redesigns; timeout/memory pressure in serverless | HIGH — needs timeout budget, fallback to plain fetch, avoid running in Next.js request cycle |
| UseCase admin CRUD        | Standard CRUD with form validation; follows existing pattern                                       | LOW                                                                                          |
| Evidence approval gate UI | Simple list view with approve/reject; follows existing admin patterns                              | LOW                                                                                          |
| Reply auto-escalation     | Wire existing output to existing input; ~20 lines of code                                          | VERY LOW                                                                                     |
| Engagement task ranking   | Read existing WizardSession fields, add sort key to task query                                     | LOW                                                                                          |
| Evidence-grounded copy    | New prompt engineering + schema changes for per-touch evidence refs                                | HIGH                                                                                         |

---

## Sources

- Codebase analysis: `/home/klarifai/Documents/klarifai/projects/qualifai/lib/workflow-engine.ts` — proof matching, evidence generation, sequence steps
- Codebase analysis: `/home/klarifai/Documents/klarifai/projects/qualifai/lib/outreach/reply-triage.ts` — intent detection with `deferDays` already inferred
- Codebase analysis: `/home/klarifai/Documents/klarifai/projects/qualifai/lib/outreach/reply-workflow.ts` — triage applied but not wired to task creation
- Codebase analysis: `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/outreach.ts` — touch task queue, 4-channel support already wired
- Codebase analysis: `/home/klarifai/Documents/klarifai/projects/qualifai/prisma/schema.prisma` — `EvidenceItem.isApproved`, `ProofMatch`, `WizardSession` confirmed in schema
- Product definition: `/home/klarifai/Documents/klarifai/projects/qualifai/.planning/PROJECT.md` — milestone scope and constraints
- Product definition: `/home/klarifai/Documents/klarifai/projects/qualifai/.planning/MILESTONES.md` — v1.0 learnings that define v1.1 scope
- Confidence: HIGH — all findings derived directly from source code and product owner documentation, not training data assumptions

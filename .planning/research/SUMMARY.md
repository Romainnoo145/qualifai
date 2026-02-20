# Project Research Summary

**Project:** Qualifai — v1.1 Evidence-Backed Multi-Touch Outreach
**Domain:** B2B outbound sales engine — browser scraping pipeline, use cases catalog, engagement-driven cadence
**Researched:** 2026-02-20
**Confidence:** HIGH

## Executive Summary

Qualifai v1.1 extends an already-working B2B outbound tool (Next.js 16, tRPC, Prisma 7, PostgreSQL, Anthropic Claude, Railway) by closing four structural gaps: the evidence pipeline lacks search-driven discovery and JavaScript rendering; the proof catalog is file-based and cannot be managed at runtime; engagement signals (wizard views, PDF downloads, email opens) are tracked but never act on the cadence; and the cadence itself is entirely manual with no automatic advancement. All four gaps are well-understood because the existing codebase already contains the schema fields, enum values, and env var patterns needed — the milestone is primarily wiring and new lib modules, not new infrastructure.

The recommended approach is strictly additive and dependency-ordered. Use Cases database model comes first because proof matching, cadence scoring, and the admin workflow all depend on it. SerpAPI + Playwright deep crawl comes second as an independent new evidence source. Engagement-to-cadence wiring comes third using the already-existing `WizardSession`, `OutreachLog`, and `WORKER_BASE_URL` patterns. The cadence engine itself comes last because it builds on all prior steps. Only one new npm production dependency is required (`google-search-results-nodejs`). Browser rendering should use a managed API (Browserless/ScrapingBee) for Phase 1 to avoid Railway container bloat; self-hosted Playwright worker is the Phase 2 path if costs or reliability demand it.

The dominant risk is Playwright running inside Next.js API routes on Railway — this will cause container OOM kills and stuck `ResearchRun` records. A secondary risk is SerpAPI cost accumulation without per-prospect caching and human-gated triggers. Both risks are fully preventable if the architecture decisions are made at phase-start rather than discovered mid-implementation. Email open events should never be used as the sole trigger for call escalation — Apple Mail Privacy Protection creates 40–60% false positives; only wizard engagement and PDF downloads are reliable signals.

---

## Key Findings

### Recommended Stack

The existing stack requires only one new production library. `google-search-results-nodejs` (official SerpAPI client) fills the Google discovery gap that plain `fetch` cannot — SerpAPI handles CAPTCHAs, rotating proxies, and structured JSON output. All other capabilities are covered by config, new routes, and new lib modules within the existing stack.

Browser rendering for production should be a managed API (Browserless or ScrapingBee) via a single `SCRAPING_API_KEY` env var, not an in-process Playwright launch. Resend already supports open/click webhooks via HMAC-signed payloads — no new library needed, just a new webhook route and `RESEND_WEBHOOK_SECRET`. Railway's native cron service replaces the need for BullMQ/Redis — the cron pattern is already established at `/api/internal/cron/research-refresh`.

**Core technologies:**

- `google-search-results-nodejs`: SerpAPI discovery — only new production dep; handles auth, pagination, typed JSON
- Managed browser API (Browserless/ScrapingBee): JS-rendered page extraction — avoids Railway container bloat; `SCRAPING_API_URL` + `SCRAPING_API_KEY` env vars
- Resend webhooks: Email open/click tracking — already in stack; adds `RESEND_WEBHOOK_SECRET` and one new route
- Railway native cron: Cadence scheduling — first-class Railway feature; follows existing `research-refresh` pattern; no Redis needed

**New environment variables required:** `SERP_API_KEY`, `SCRAPING_API_KEY`, `SCRAPING_API_URL`, `RESEND_WEBHOOK_SECRET`

See `.planning/research/STACK.md` for full rationale and alternatives considered.

### Expected Features

The feature landscape is driven entirely by codebase gap analysis — the product owner has already identified what is missing. This is not speculation; it is a direct read of schema fields that exist but are inert, and code paths that detect intent but do not act on it.

**Must have (table stakes):**

- Search-driven review URL discovery — can't find unknown Google Reviews manually; SerpAPI fills this
- JS-rendered page extraction — review platforms serve via JS; plain fetch returns empty body
- Glassdoor job posting pain extraction — job descriptions systematically reveal internal dysfunction
- Use Cases admin CRUD — proof catalog must be editable without SSH or deployment
- Manual evidence approval gate — `isApproved` field exists in schema but is never written to
- Engagement-triggered next-step surfacing — wizard/PDF signals tracked but not connected to task queue
- Reply-intent auto-escalation — `interested` triage detected but does not queue follow-up tasks

**Should have (differentiators):**

- Evidence-grounded cadence copy — each touch references the specific evidence item that matched
- Engagement score ranking in task queue — "highest intent first" based on wizard depth + PDF + opens
- Deferred follow-up auto-scheduling — `deferDays` already inferred in reply-workflow but not acted on
- Multi-hypothesis use-case coverage map — shows which hypotheses lack proof before outreach

**Defer to v1.2:**

- Support forum / G2 / Capterra pain discovery — unpredictable DOM, high complexity
- Research refresh triggered by engagement — useful but requires careful async design to avoid duplicate runs
- LinkedIn API / WhatsApp API integration — partner approval blocks, manual tasks sufficient

**Anti-features (explicitly excluded):**

- Fully automated send without approval — contradicts brand promise
- LinkedIn automation — ToS violation risk
- AI-generated use cases — hallucinated proof destroys credibility
- Fixed-schedule cadence — prospect behavior should drive timing, not day-1/4/7 defaults

See `.planning/research/FEATURES.md` for full feature dependency tree and complexity ratings.

### Architecture Approach

Four new systems integrate with the existing architecture without replacing any existing component. The integration points are surgical: `research-executor.ts` gets an optional `deepCrawl` flag; `matchProofs()` in `workflow-engine.ts` receives a `db` parameter instead of reading files; `wizard.ts` adds `handleEngagementEvent()` calls after PDF download and step-3 progress; `outreach.ts` adds `evaluateCadence()` after `completeTouchTask`. The existing `OutreachLog` table, `WizardSession` model, and `ProofMatch` schema absorb all new data — no new tables except `UseCase`.

**Major components:**

1. `lib/enrichment/deep-crawler.ts` — SerpAPI + Playwright orchestrator; outputs `EvidenceDraft[]` merged into existing deduplication pipeline
2. `server/routers/use-cases.ts` + `UseCase` Prisma model — replaces Obsidian JSON file catalog with DB-managed, admin-editable proof library
3. `lib/cadence/triggers.ts` — maps engagement events (wizard, PDF, email open) to touch task creation with deduplication guard
4. `lib/cadence/engine.ts` — evaluates `CadenceState` → `CadenceDecision`; configuration-driven rules in `lib/cadence/rules.ts`, not a DB model
5. `app/api/webhooks/email-events/route.ts` — Resend webhook receiver; HMAC-verified; calls `handleEngagementEvent()`

Critical schema additions: `UseCase` model, `ProofMatch.useCaseId` FK, `OutreachStep.scheduledAt` + `triggeredBy` + `nextStepReadyAt` columns, `EvidenceSourceType.SERP_RESULT` enum value.

See `.planning/research/ARCHITECTURE.md` for full data flow diagrams and component boundary table.

### Critical Pitfalls

1. **Playwright in Next.js API routes causes Railway OOM** — Chromium uses 300–500MB minimum; Railway containers default to 512MB–1GB; a single research run with 5 URLs at 10s each hits the 60s cron timeout. Prevention: use managed browser API for Phase 1; if self-hosted, use the existing `WORKER_BASE_URL`/`WORKER_SHARED_SECRET` pattern to run Playwright in a separate Railway service, never in a tRPC handler.

2. **SerpAPI costs compound without caching** — 3–5 queries per prospect × 25-prospect refresh sweep × 26 sweeps/year = thousands of API calls. Prevention: only trigger SerpAPI from human-initiated "deep research" actions, never from the auto-refresh sweep; add `maxQueriesPerRun: 3` hard cap; track usage in existing `CreditUsage` model.

3. **Cadence timestamps in JSON metadata make indexing impossible** — `metadata.dueAt` is unparseable by Prisma for `WHERE dueAt <= NOW()` queries. Prevention: migrate before building the cadence cron; add first-class DB columns `OutreachStep.scheduledAt`, `triggeredBy`, `nextStepReadyAt` so the cron query is `WHERE status = 'SENT' AND nextStepReadyAt <= NOW()`.

4. **Email open = false signal (40–60% false positive)** — Apple Mail Privacy Protection pre-fetches all images, triggering open events for every Apple Mail user regardless of actual open. Prevention: treat open as a weak signal only; cadence advancement to call/LinkedIn must require wizard engagement or PDF download, never open alone.

5. **Dutch-language prospects return zero proof matches** — existing `toTokens()` lowercases and splits on whitespace; `"facturering"` scores 0 against `"invoice"`. Prevention: add `tags: String[]` to `UseCase` model with manually-maintained NL synonyms, or use Claude API for semantic matching (already in stack, <$0.01/call).

See `.planning/research/PITFALLS.md` for 12 pitfalls with detection signals and phase-specific warnings.

---

## Implications for Roadmap

Research establishes a clear dependency order. Use Cases foundation must be first because three downstream systems depend on it. Deep crawl is the most independent feature and can be built in parallel or second. Engagement wiring and cadence engine must follow in that order. Schema migrations must precede their dependent features.

### Phase 1: Use Cases Foundation

**Rationale:** Every downstream system reads from the proof catalog. Proof matching, cadence scoring, and the pain-point-to-use-case UI all require `UseCase` records in the database. The Obsidian JSON migration must complete before any other phase reads from DB. This phase has the lowest risk — standard CRUD with a clear migration path.

**Delivers:** Admin-manageable use cases catalog, DB-backed proof matching, one-shot migration from Obsidian JSON, admin CRUD pages.

**Addresses:** Use Cases admin CRUD (table stakes), pain-point to use-case matching UI (table stakes), DB-backed `matchProofs()` (architectural prerequisite).

**Avoids:** Pitfall 5 (Dutch-language mismatch) — design `tags: String[]` with NL synonyms from the start; Pitfall 11 (Obsidian proofId orphans) — add `sourceVersion` to `ProofMatch` before migration.

**Research flag:** Standard patterns — CRUD + migration script, no external APIs. Skip `research-phase`.

### Phase 2: Evidence Approval Gate

**Rationale:** `EvidenceItem.isApproved` exists in schema but is never written to. This is the core quality promise of the product. It must be wired before new evidence sources (Phase 3) are added, otherwise SerpAPI/Playwright results bypass review. Low complexity — schema is ready, needs router procedures and admin UI only.

**Delivers:** Admin evidence review screen (batch approve/reject), auto-approval logic for `WEBSITE`/`CAREERS` source types, manual-approval requirement for `REVIEWS` and `SERP_RESULT`.

**Addresses:** Manual evidence approval gate (table stakes).

**Avoids:** Pitfall 6 (approval bottleneck) — design batch UX and auto-approve own-website sources from the start.

**Research flag:** Standard patterns — skip `research-phase`.

### Phase 3: SerpAPI + Playwright Deep Crawl

**Rationale:** Independent of cadence and use cases. Can feed new evidence into the already-working research pipeline immediately. Must come after Phase 2 so new evidence sources are subject to the approval gate.

**Delivers:** `lib/enrichment/deep-crawler.ts`, Google Reviews/job discovery via SerpAPI, JS-rendered page extraction via managed browser API, `SERP_RESULT` enum value, `deepCrawl` flag on `researchRouter.startRun`.

**Addresses:** Search-driven review discovery (table stakes), JS-rendered page extraction (table stakes), Glassdoor job pain extraction (table stakes).

**Avoids:** Pitfall 1 (Playwright in API route) — use managed browser API (Browserless/ScrapingBee) exclusively in Phase 3; Pitfall 2 (SerpAPI cost accumulation) — quota cap + manual-only trigger + `CreditUsage` counter built before first API call; Pitfall 7 (Dutch cookie consent walls) — implement Cookiebot handler and content validity check; Pitfall 9 (wrong SerpAPI locale) — hardcode `gl=nl&hl=nl` in client wrapper; Pitfall 10 (binary missing in production) — managed API avoids this entirely.

**Research flag:** Needs `research-phase` — external APIs with rate limits, NL-specific cookie consent handling, managed browser API evaluation (Browserless vs ScrapingBee pricing/reliability as of 2026).

### Phase 4: Engagement-Triggered Task Surfacing

**Rationale:** The engagement event plumbing (Resend webhooks, wizard trackProgress calls, `handleEngagementEvent`) must be built before the cadence engine (Phase 5) can consume it. This phase alone delivers immediate value: PDF downloads and wizard engagement auto-queue follow-up tasks without waiting for the full cadence state machine.

**Delivers:** `lib/cadence/triggers.ts`, Resend webhook route with HMAC verification, `resendMessageId` stored at send time, engagement signals creating touch tasks, deduplication guard preventing task spam.

**Addresses:** Engagement-triggered next-step surfacing (table stakes), reply-intent auto-escalation (table stakes), deferred follow-up auto-scheduling (differentiator).

**Avoids:** Pitfall 4 (email open false signals) — define engagement signal priority order before writing any trigger logic; PDF download and wizard step 3+ are the primary triggers, not email open; Pitfall 12 (missing webhook signature verification) — HMAC verification is the first thing built in this phase.

**Research flag:** Standard patterns for webhook verification. Skip `research-phase`.

### Phase 5: Cadence Engine

**Rationale:** Builds on all prior phases. Requires UseCase engagement scoring (Phase 1), evidence quality signals (Phase 2), touch task primitives from engagement wiring (Phase 4), and the `OutreachStep.sentAt` reliability fix. Configuration-driven rules keep business logic in code, not database rows — deployable, reviewable, testable.

**Delivers:** `lib/cadence/engine.ts` with `buildCadenceState()` + `evaluateCadence()`, configuration rules in `lib/cadence/rules.ts`, schema migrations for `OutreachStep.scheduledAt`/`triggeredBy`/`nextStepReadyAt`, `completeTouchTask` calling `evaluateCadence()`, cadence history view in admin outreach page.

**Addresses:** Engagement-driven cadence advancement (table stakes), `close_lost` automation, reply-triage → task-queue wiring.

**Avoids:** Pitfall 3 (timestamps in JSON metadata) — schema migration adds first-class columns before any cadence cron code is written; Pitfall 8 (OutreachStep/OutreachLog status drift) — `OutreachStep.sentAt` is the authoritative timestamp, `OutreachLog` records are never deleted.

**Research flag:** Cadence rule thresholds need validation with product owner before implementation. The technical pattern is clear; the business logic values ("+2 days on PDF download", "close_lost after 4 touches") need sign-off. Flag for brief stakeholder review before Phase 5 starts.

### Phase Ordering Rationale

- Phase 1 before everything: `UseCase` records must exist in DB before proof matching, cadence scoring, or any admin workflow reads them.
- Phase 2 before Phase 3: Evidence approval gate must be active before new (and less trusted) SerpAPI/Playwright sources are added. Otherwise SERP results bypass human review.
- Phase 3 independent: Deep crawl does not depend on cadence or engagement wiring; it feeds the existing evidence pipeline. Could be built in parallel with Phase 2 if bandwidth allows.
- Phase 4 before Phase 5: Engagement event infrastructure (`handleEngagementEvent`, Resend webhook) must exist before the cadence engine can consume those events.
- Phase 5 last: Consumes all prior output; cadence correctness requires reliable engagement data and solid schema foundations.

### Research Flags

Needs deeper research during planning:

- **Phase 3 (Deep Crawl):** Managed browser API selection (Browserless vs ScrapingBee — pricing, reliability, NL IP availability as of 2026). SerpAPI quota tier selection. Cookiebot + Cloudflare handling specifics.

Standard patterns — skip research-phase:

- **Phase 1 (Use Cases CRUD):** Standard Prisma CRUD + one-shot migration script. Well-documented.
- **Phase 2 (Evidence Approval Gate):** Schema field already exists; admin list + approve/reject UI follows existing patterns.
- **Phase 4 (Engagement Triggers):** Resend webhook signature verification is documented; deduplication guard is standard DB query.
- **Phase 5 (Cadence Engine):** Technical pattern is clear from architecture research; needs stakeholder validation of business rule values, not additional technical research.

---

## Confidence Assessment

| Area         | Confidence | Notes                                                                                                                                                           |
| ------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack        | HIGH       | Derived from direct codebase inspection; only one new npm dep; all other choices are config/architecture                                                        |
| Features     | HIGH       | Derived from reading source code gaps directly — not assumptions; product owner has already identified these gaps in PROJECT.md and MILESTONES.md               |
| Architecture | HIGH       | Integration points fully read in source; data flow confirmed in schema; insertion points are unambiguous                                                        |
| Pitfalls     | HIGH       | 4 of 12 pitfalls are derived from reading existing code patterns directly; 8 from established engineering knowledge (Railway constraints, MPP, SerpAPI pricing) |

**Overall confidence:** HIGH

### Gaps to Address

- **Managed browser API selection:** Browserless vs ScrapingBee pricing and NL-region reliability as of February 2026 not confirmed. Validate before Phase 3 planning with a quick trial account.
- **Cadence rule thresholds:** The specific values ("+1 day for PDF download", "4 touches before close_lost") are business logic, not technical findings. Get product owner sign-off before Phase 5 implementation.
- **SerpAPI pricing tier:** `npm info google-search-results-nodejs` to verify current version; SerpAPI pricing page to confirm queries-per-month on current plan before designing quota guards.
- **Railway cron availability:** Confirm Railway plan tier includes cron jobs (training knowledge cutoff August 2025 — Railway pricing may have changed).
- **Dutch synonym tags:** The `UseCase.tags` strategy requires manually tagging each use case with NL synonyms at migration time. This is a data task, not a code task — allocate time for it during Phase 1 execution.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)

- `lib/research-executor.ts` — evidence pipeline insertion points, 24-item cap, deduplication
- `lib/workflow-engine.ts` — `matchProofs()` signature, `toTokens()` tokenizer, JSON file loading
- `lib/web-evidence-adapter.ts` — adapter pattern for new evidence sources
- `server/routers/outreach.ts` — touch task queue primitives, `completeTouchTask` insertion point
- `server/routers/proof.ts` — `matchProofs()` call site
- `server/routers/research.ts` — `startRun` input shape, `deepCrawl` flag insertion point
- `server/routers/wizard.ts` — `trackPdfDownload`, `trackProgress` mutation bodies
- `server/routers/sequences.ts` — `OutreachStep` status management, `markSequenceStepAfterSend()`
- `prisma/schema.prisma` — full schema: `EvidenceItem.isApproved`, `ProofMatch`, `WizardSession`, `OutreachStep.sentAt`, `CreditUsage`
- `lib/outreach/reply-workflow.ts` — `deferDays` detection, intent triage, no task queue wiring confirmed
- `lib/outreach/send-email.ts` — `resendMessageId` storage gap confirmed
- `app/discover/[slug]/wizard-client.tsx` — engagement event calls confirmed
- `app/api/internal/research/callback/route.ts` — worker callback pattern confirmed
- `.planning/PROJECT.md` + `.planning/MILESTONES.md` — product owner scope and gap identification

### Secondary (MEDIUM confidence — established engineering patterns)

- Railway container memory constraints (512MB–1GB default) — well-documented Railway behaviour
- Playwright production deployment requirements (`playwright install chromium --with-deps`) — documented in Playwright docs
- Apple Mail Privacy Protection false open rate (40–60%) — widely documented post-iOS 15 (2021)
- Dutch GDPR/CMP compliance and Cookiebot prevalence — NL/BE regulatory knowledge
- SerpAPI pricing model ($0.005–$0.05/search) — training knowledge August 2025, verify current
- `google-search-results-nodejs` package — official SerpAPI client, verify current version with `npm info`
- Resend webhook HMAC signing via `svix-signature` header — training knowledge August 2025, verify at resend.com/docs

### Tertiary (LOW confidence — needs validation before implementation)

- Browserless/ScrapingBee pricing and NL-region IP availability as of February 2026
- Railway cron availability on current plan tier
- Exact SerpAPI query costs on current account plan

---

_Research completed: 2026-02-20_
_Ready for roadmap: yes_

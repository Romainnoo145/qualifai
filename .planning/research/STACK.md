# Technology Stack — Evidence Pipeline & Multi-Touch Cadence

**Project:** Qualifai — subsequent milestone additions
**Researched:** 2026-02-20
**Scope:** NEW capabilities only. Existing stack (Next.js 16, tRPC, Prisma 7, PostgreSQL, Anthropic Claude SDK, Apollo API, Resend, Cal.com, Zod, Tailwind 4, Playwright in devDependencies) is validated and NOT re-researched here.

---

## Capability Area 1: SerpAPI — Google Search Discovery

### Recommended Addition

| Library                        | Version  | Purpose                                   | Why                                                                                                                                                                                          |
| ------------------------------ | -------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `google-search-results-nodejs` | `^2.2.0` | SerpAPI HTTP client with TypeScript types | Official SerpAPI client. Handles auth, pagination, JSON parsing. Works with the `/search` endpoint for Google Reviews (Maps), Google Jobs, and general search. Zero additional dependencies. |

**Why SerpAPI over scraping directly:**
Google blocks raw scraping aggressively. SerpAPI is already the industry standard for structured Google data extraction — it returns clean JSON (no HTML parsing), handles CAPTCHAs and rotating proxies, and provides dedicated engines for Maps reviews (`engine: google_maps_reviews`) and Jobs (`engine: google_jobs`). The existing `review-adapters.ts` already handles Trustpilot/Klantenvertellen via raw fetch; SerpAPI fills the Google gap that raw fetch cannot.

**Why this client over writing a raw fetch wrapper:**
The package ships TypeScript types, handles the `api_key` auth header, and normalises pagination. Writing a raw wrapper saves nothing — SerpAPI's API surface is stable enough that the official package is the right boundary.

**Integration point:** New `lib/enrichment/serp.ts`. Called from `research-executor.ts` alongside the existing `ingestWebsiteEvidenceDrafts` and `ingestReviewEvidenceDrafts`. Results are normalised into `EvidenceDraft[]` using the same interface as the existing adapters. The `EvidenceSourceType` enum already has `REVIEWS` and `JOB_BOARD` values — no schema migration needed for basic integration.

**Confidence:** MEDIUM — official package, well-established in Node.js ecosystem as of August 2025 training cutoff. Verify current version with `npm info google-search-results-nodejs` before installing.

---

## Capability Area 2: Playwright for Production Content Extraction

### No New Library Required — Architecture Change Only

`@playwright/test@^1.58.0` is already a devDependency. The `playwright` package (without `@playwright/test`) ships the same browser automation API. However, for production content extraction in a Railway-deployed Next.js app, the approach matters more than the library.

**The core decision:**

| Approach                                                       | Trade-off                                                                                                                                                                                               | Recommendation                  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Playwright in Next.js process (same Railway service)           | Chromium binary is ~130MB. Railway builds will fail unless `playwright install chromium` runs at build time via a `nixpacks.toml` or custom Dockerfile. Adds ~800MB to container.                       | NOT recommended as default      |
| Playwright in a separate worker service                        | Clean separation. The existing codebase already has `WORKER_BASE_URL` + `WORKER_SHARED_SECRET` env vars and a `research/callback` internal API — this architecture is pre-wired for an external worker. | RECOMMENDED                     |
| Playwright via an HTTP scraping API (Browserless, ScrapingBee) | No binary management. Costs ~$30-100/mo at low volume. Eliminates Railway container bloat entirely.                                                                                                     | RECOMMENDED as Phase 1 fallback |

**Recommended stack for production Playwright extraction:**

Option A (self-hosted worker, fits existing architecture):

| What                                                                                          | How                                            |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Deploy a second Railway service (same repo, different start command: `tsx scripts/worker.ts`) | Uses `WORKER_BASE_URL` already in env          |
| Install: `npx playwright install chromium --with-deps` in worker Dockerfile/nixpacks          | Isolates the 800MB binary from the Next.js app |
| Next.js calls the worker via existing `WORKER_BASE_URL` + `WORKER_SHARED_SECRET` pattern      | Already used in `research-executor.ts`         |

Option B (managed browser API, lower ops overhead):

| Library            | Version | Purpose                                                 | Why                                                                                                                                        |
| ------------------ | ------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| No new npm package | N/A     | Use `fetch` against Browserless or ScrapingBee REST API | They accept a URL, return rendered HTML. Drop-in replacement in `ingestWebsiteEvidenceDrafts`. One env var (`BROWSER_API_KEY`), no binary. |

**Recommendation:** Start with Option B (managed API) for Phase 1. Add env var `SCRAPING_API_KEY` and `SCRAPING_API_URL`. Wrap in `lib/enrichment/browser-fetch.ts`. If costs or reliability become an issue, migrate to Option A worker.

**No npm install needed** for Option B. For Option A, no new npm package either — `playwright` is already available via `@playwright/test` in devDependencies; move to a production dependency only for the worker service.

**Confidence:** HIGH for the architectural recommendation (based on direct codebase inspection). MEDIUM for Browserless/ScrapingBee pricing estimates.

---

## Capability Area 3: Engagement Tracking (Wizard Views, Email Opens, PDF Downloads)

### What's Already Built

Codebase inspection confirms:

- `WizardSession` model exists with `pdfDownloaded`, `callBooked`, `stepTimes` fields
- `wizard-client.tsx` calls `api.wizard.startSession`, `trackProgress`, `trackPdfDownload`, `trackCallBooked`
- `OutreachLog` model has `openedAt` field
- `WizardSession` + `NotificationLog` exist for event storage

**Gap:** Email open tracking exists as a field but has no pixel or webhook wired to populate `openedAt`. Resend supports email open tracking via webhooks.

### Required Additions

| Library / Service  | Version | Purpose                        | Why                                                                                                                                                                                                     |
| ------------------ | ------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No new npm package | N/A     | Resend webhook for email opens | Resend already in stack. Enable open tracking in Resend dashboard, add webhook endpoint at `/api/webhooks/resend`. Parse `email.opened` events, write to `OutreachLog.openedAt`. Zero new dependencies. |

**Engagement event → cadence signal flow:**

```
WizardSession.pdfDownloaded = true  ─┐
OutreachLog.openedAt IS NOT NULL    ─┤─► trigger cadence rule evaluation
WizardSession.callBooked = true     ─┘
```

The evaluation logic lives in the cadence engine (see Capability Area 4). No new storage model needed. The `Prospect.status` enum already has `VIEWED` and `ENGAGED` values for prospect-level state.

**What to wire:**

1. Resend webhook at `/api/webhooks/resend/route.ts` — parse `email.opened`, update `OutreachLog.openedAt`, trigger cadence rule check
2. Resend webhook secret: add `RESEND_WEBHOOK_SECRET` to `env.mjs` (Resend sends HMAC-SHA256 signature)
3. PDF download: `/api/export/loss-map/[id]/route.ts` already exists — add a `db.wizardSession.update` call there to set `pdfDownloaded = true` and `pdfDownloadedAt`

**Confidence:** HIGH — Resend webhook support is documented, no new library needed, Prisma schema already has the fields.

---

## Capability Area 4: Multi-Touch Cadence Engine (Scheduled Tasks)

### Architecture Assessment

The existing codebase has:

- `OutreachSequence` + `OutreachStep` models with `plannedAt` timestamp field
- `SequenceStatus` enum (DRAFTED, QUEUED, SENT, OPENED, REPLIED, BOOKED, CLOSED_LOST)
- Signal/automation rule evaluation (`lib/automation/rules.ts`, `processor.ts`)
- Cron pattern already established: `/api/internal/cron/research-refresh` called with `x-cron-secret`

**Gap:** No scheduler fires the cron endpoint on a schedule. Steps have `plannedAt` but nothing polls them.

### Recommended Stack for Scheduling

**Approach: Extend existing Railway cron pattern — no new library.**

| Component                                        | What                                                                                   | Why                                                                                                                                                 |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Railway Cron Service                             | Configure in Railway dashboard: `POST /api/internal/cron/cadence` every 15 minutes     | Railway Pro supports cron jobs natively at no extra cost. Follows the exact pattern used for `research-refresh`. No new process, no new dependency. |
| New route: `/api/internal/cron/cadence/route.ts` | Queries `OutreachStep` where `plannedAt <= now` and `status = QUEUED`, dispatches them | Pure Prisma + existing `sendOutreachEmail`. Under 200 lines.                                                                                        |

**What NOT to add:**

- `bull` / `bullmq` / Redis queue — overkill for a single-user outbound tool processing tens of sequences, not thousands
- `pg-boss` — adds operational complexity; Railway cron + Prisma polling achieves the same at this scale
- `node-cron` / `node-schedule` — in-process schedulers don't survive Railway container restarts and can't be monitored

**Cadence rule engine for multi-channel steps:**

The `OutreachStep.metadata` JSON field already exists. Store channel type there: `{ channel: "email" | "call" | "linkedin" | "whatsapp" }`. The cadence cron processor dispatches based on channel:

```
email   → lib/outreach/send-email.ts (already exists)
call    → write to NotificationLog (admin notification, no API integration needed initially)
linkedin → write to NotificationLog (admin notification, manual action)
whatsapp → write to NotificationLog (admin notification, manual action)
```

This defers external API integrations (LinkedIn Sales Navigator, WhatsApp Business API) without blocking the cadence engine itself. The engine is channel-agnostic at the data layer.

**Engagement-triggered cadence changes:**

When a Resend webhook fires `email.opened`, the handler also calls a `evaluateCadenceAcceleration(prospectId)` function that:

1. Looks up the prospect's `QUEUED` OutreachStep records
2. If wizard view + PDF download both true: reschedule the next step from +7d to +2d
3. Updates `OutreachStep.plannedAt` and `Prospect.status` to `ENGAGED`

This logic is pure Prisma — no new library.

**Confidence:** HIGH for architectural approach. HIGH for Railway cron (it is a first-class Railway feature as of August 2025 training knowledge). LOW for LinkedIn/WhatsApp API integrations (deliberately deferred — those require external API approval workflows not suitable for this milestone).

---

## New Environment Variables Required

| Variable                | Purpose                                       | Service            |
| ----------------------- | --------------------------------------------- | ------------------ |
| `SERP_API_KEY`          | SerpAPI authentication                        | SerpAPI            |
| `SCRAPING_API_KEY`      | Managed browser API (Browserless/ScrapingBee) | Browser extraction |
| `SCRAPING_API_URL`      | Base URL for browser API                      | Browser extraction |
| `RESEND_WEBHOOK_SECRET` | HMAC verification for Resend webhooks         | Resend             |

All go into `env.mjs` as optional server-side vars (`.optional()`) to avoid breaking existing deploys.

---

## Installation

```bash
# Only one new production dependency
npm install google-search-results-nodejs
```

Everything else is architecture, configuration, and new route/lib files within the existing stack.

---

## Alternatives Considered

| Category                   | Recommended                              | Alternative                   | Why Not                                                                                 |
| -------------------------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------- |
| SerpAPI client             | `google-search-results-nodejs`           | Raw `fetch` wrapper           | Duplicates auth/pagination logic already in the package                                 |
| Browser content extraction | Managed API (Browserless/ScrapingBee)    | Playwright in Next.js process | Railway container bloat, complex nixpacks configuration                                 |
| Scheduling                 | Railway cron + Prisma polling            | BullMQ + Redis                | Redis is a new infrastructure dependency for a single-user tool; excessive              |
| Scheduling                 | Railway cron + Prisma polling            | `node-cron` in-process        | Not restart-safe on Railway; no visibility                                              |
| Email open tracking        | Resend webhook                           | Tracking pixel (self-hosted)  | Resend already in stack; webhook is more reliable than pixel (blocked by email clients) |
| Multi-channel cadence      | Notification-based (admin manual action) | LinkedIn Sales Navigator API  | LinkedIn API requires partner approval; blocks MVP                                      |

---

## Sources

- Codebase inspection: `/home/klarifai/Documents/klarifai/projects/qualifai` — HIGH confidence
- `@playwright/test` version `^1.58.0` confirmed in `package.json` devDependencies — HIGH confidence
- `OutreachStep.plannedAt`, `WizardSession` fields confirmed in `prisma/schema.prisma` — HIGH confidence
- Railway cron support: documented Railway feature as of August 2025 training cutoff — MEDIUM confidence (verify current Railway pricing tier for cron)
- `google-search-results-nodejs` package: training knowledge August 2025 — MEDIUM confidence (run `npm info google-search-results-nodejs` to verify current version)
- Resend webhook events and HMAC signing: training knowledge August 2025 — MEDIUM confidence (verify at resend.com/docs/webhooks)
- Browserless/ScrapingBee as managed browser APIs: training knowledge August 2025 — MEDIUM confidence (pricing/availability may have changed)

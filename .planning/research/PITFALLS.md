# Domain Pitfalls

**Domain:** B2B outbound sales engine — adding browser scraping, external search API, engagement-driven cadence, and use cases catalog to existing Next.js/Railway app
**Researched:** 2026-02-20
**Confidence:** HIGH (derived from existing codebase + established engineering patterns for these specific integrations)

---

## Critical Pitfalls

Mistakes that cause rewrites or major breakage.

---

### Pitfall 1: Playwright Launching Inside Next.js API Routes on Railway

**What goes wrong:** Playwright `chromium.launch()` inside a Next.js API route or tRPC handler hangs, OOMs the Railway container, or never completes. Railway containers default to limited memory (512MB–1GB). A single headless Chromium instance uses 300–500MB minimum. Two concurrent launches = container crash.

**Why it happens:** Next.js API routes are designed for fast I/O, not for spawning browser processes. Railway doesn't pre-install Chromium system deps (`libatk`, `libgbm`, `libasound2`, etc.). The `@playwright/test` devDependency in the current `package.json` installs test binaries, not production ones — `playwright install chromium` must be run explicitly in the Docker build or Railway start command.

**Specific risk for this codebase:** `lib/research-executor.ts` currently calls `ingestWebsiteEvidenceDrafts()` synchronously inside the research run loop. Adding Playwright there means the cron trigger at `/api/internal/cron/research-refresh` launches browser processes inside an HTTP request with a Railway-enforced 60-second timeout for cron endpoints. A 5-URL crawl at 10s per URL = 50 seconds minimum, guaranteed timeout for any real prospect.

**Consequences:**

- Silent hangs in production (Playwright awaits that never resolve, no error surfaced)
- Railway container OOM kills mid-research-run, leaving `ResearchRun` stuck in `CRAWLING` status forever
- The existing `isResearchStale()` guard won't detect stuck runs — they have active statuses and will never be re-queued

**Prevention:**

- Run Playwright in a separate Railway service or background worker, not inside Next.js API routes
- Use the existing `WORKER_BASE_URL` / `WORKER_SHARED_SECRET` env vars (already in `env.mjs`) — they were clearly designed for this exact separation
- Add a `BROWSER_CRAWL` `ResearchStatus` enum value and a stuck-run timeout recovery query (e.g., runs in `CRAWLING` for >5 minutes get reset to `FAILED`)
- If Railway worker separation is deferred, cap Playwright to 1 concurrent page with a 15s timeout and run it only from background cron, never from a user-facing tRPC call

**Detection:** Railway container memory graph spikes to ceiling. `ResearchRun` records stuck in `CRAWLING` for >10 minutes. Next.js logs show no error but the request never returned.

**Phase that must address this:** The Playwright integration phase — do NOT add `chromium.launch()` in API route handlers under any circumstances.

---

### Pitfall 2: SerpAPI Costs Escalating Without Per-Prospect Deduplication

**What goes wrong:** SerpAPI charges per search query ($0.005–$0.05 per search depending on plan). The current `research-refresh.ts` refresh sweep checks "stale" prospects every 14 days and re-runs research. If SerpAPI discovery runs 3–5 queries per prospect per refresh, and the campaign has 50 prospects, that's 150–250 queries per sweep, 26 sweeps/year = 3,900–6,500 queries/year minimum. At 50 prospects on a free-tier budget, costs compound fast.

**Why it happens:** The current `buildDefaultReviewSeedUrls()` generates URL seeds for every prospect on every refresh cycle. Adding SerpAPI queries to this loop without caching means every refresh (even when evidence is still valid) burns API credits.

**Specific risk for this codebase:** The refresh sweep runs with `limit: 25` but there is no SerpAPI result cache. If the SerpAPI integration is added to `ingestWebsiteEvidenceDrafts()` or `executeResearchRun()`, each call will make live API requests regardless of whether the evidence changed.

**Consequences:**

- Monthly bill spikes invisibly (SerpAPI has no built-in budget cap by default)
- Research runs become expensive enough to discourage running them
- No way to audit which prospects consumed credits without separate logging

**Prevention:**

- Cache SerpAPI results in a new `SerpApiCache` DB model or as a `metadata` JSON field on `EvidenceItem` with a `serpCachedAt` timestamp
- Add a separate `serpApiQueriesUsed` counter in `CreditUsage` (the model already exists)
- Set `maxQueriesPerRun: 3` hard cap — good enough for discovery (jobs, reviews, news)
- Add `SERP_API_KEY` to `env.mjs` with a `SERP_MAX_QUERIES_PER_PROSPECT` env var
- Do NOT run SerpAPI queries during the auto-refresh sweep — only run them when a human explicitly triggers "deep research" for a specific prospect

**Detection:** SerpAPI dashboard shows usage spike. Monthly cost exceeds budget without corresponding improvement in evidence quality.

**Phase that must address this:** The SerpAPI integration phase — design the quota system before writing a single API call.

---

### Pitfall 3: Cadence State Stored in JSON Metadata Instead of First-Class DB Fields

**What goes wrong:** The existing `OutreachSequence.status` and `OutreachStep.status` are `SequenceStatus` enums. But the engagement-driven cadence logic (email open detected → escalate to call → LinkedIn → WhatsApp) requires tracking event timestamps, trigger conditions, and next-step scheduling. If these are stored as `metadata: Json?` blobs — as the current `OutreachLog.metadata` does with `kind`, `dueAt`, `priority` etc. — the cadence engine cannot query them reliably with Prisma.

**Why it happens:** Metadata JSON is the path of least resistance when you don't know exactly what state you need upfront. The existing `queueTouchTask` stores `dueAt` as a JSON field inside `metadata`, then re-parses it with `parseIsoDate()` at query time. This pattern works for simple task tracking but breaks for time-based scheduling queries.

**Specific risk for this codebase:** To find "all sequences where the last email was opened 24h ago and no follow-up has been scheduled", you cannot write `WHERE metadata->>'openedAt' < NOW() - INTERVAL '24h'` reliably in Prisma without raw SQL. The existing `OutreachLog.openedAt` field exists as a proper `DateTime?` column — use that model as the pattern for cadence timestamps.

**Consequences:**

- Cron job that advances the cadence must load all sequences into memory and filter in JS — not scalable
- Adding an index to accelerate "find sequences ready to advance" requires schema migrations later
- Debugging cadence state requires JSON parsing in production logs

**Prevention:**

- Add first-class columns to `OutreachStep`: `scheduledAt DateTime?`, `triggeredBy String?` (enum: `TIME_DELAY`, `EMAIL_OPENED`, `PDF_DOWNLOADED`, `WIZARD_VIEWED`, `MANUAL`)
- Add `nextStepReadyAt DateTime?` on `OutreachSequence` — this is the column the cron query indexes
- The cron query becomes: `WHERE status = 'SENT' AND nextStepReadyAt <= NOW()` — fast and indexable
- Keep `metadata` for unstructured debug info only, never for query predicates

**Detection:** You find yourself writing `JSON_EXTRACT` or loading hundreds of sequences into memory to find ones ready to advance.

**Phase that must address this:** Schema migration phase — must precede any cadence automation code.

---

### Pitfall 4: Email Open Tracking Used as Primary Engagement Signal

**What goes wrong:** Email open events from Resend webhooks have a 40–60% false positive rate due to Apple Mail Privacy Protection (MPP), Gmail image pre-fetching, and corporate email security scanners that pre-load images. Building cadence advancement on "email opened = interested" means the cadence escalates based on bot activity, not human intent.

**Why it happens:** Open tracking works by embedding a 1x1 tracking pixel. When any email client, security gateway, or privacy proxy fetches images on behalf of the user (without the user opening the email), the open event fires. Apple's MPP (iOS 15+, 2021) routes all email image requests through Apple servers, making every email from Apple Mail appear "opened" regardless of actual open.

**Specific risk for this codebase:** The `OutreachLog.openedAt` field and `OutreachStatus.OPENED` enum are already in the schema. `OutreachSequence.status` has `OPENED`. If the cadence engine advances sequences when `openedAt` is set by a Resend webhook, it will schedule call follow-ups for contacts who never actually opened the email — leading to awkward cold calls ("I'm following up on the email I saw you opened") and no actual engagement signal.

**Consequences:**

- Cadence escalation based on false opens = spam behavior perceived by prospects
- Call follow-up for non-opened emails burns relationship capital
- Open rate metrics become meaningless for measuring campaign performance

**Prevention:**

- Treat email open as a weak signal only — never advance the cadence to call/LinkedIn based on open alone
- Use click events (link clicks in email body), wizard views (`WizardSession` already tracks this), PDF downloads (`pdfDownloaded` on `WizardSession`) as real engagement signals
- Design cadence triggers in priority order: PDF download > Wizard step 3+ reached > email reply > booking event > email link click > time delay. Email open should only advance cadence from step 3 to step 3b (a softer follow-up), never to call
- Add a `WIZARD_VIEWED` signal type to `SignalType` enum — the wizard already fires session events, wire them to the engagement engine

**Detection:** Call task queue fills up immediately after bulk outreach. Contacts receiving calls have no wizard sessions and no PDF downloads.

**Phase that must address this:** Cadence design phase — before building the trigger system, define which events are valid engagement signals.

---

## Moderate Pitfalls

---

### Pitfall 5: Use Cases Catalog Matching Uses Keyword Overlap Against Evidence Snippets

**What goes wrong:** The existing `matchProofs()` function in `workflow-engine.ts` uses token overlap between query string and `ProofCandidate.keywords`. This works as a fallback but scores poorly: a use case about "invoice automation" will not match an evidence snippet about "facturatie vertraging" (Dutch: invoice delay) because the tokenizer splits on whitespace and strips special chars, never mapping synonyms or cross-language terms.

**Why it happens:** The current system reads from Obsidian JSON files (`OBSIDIAN_INVENTORY_JSON_PATH`). The new Use Cases catalog will be in PostgreSQL with English/Dutch service descriptions matched against Dutch-language evidence snippets extracted from NL prospect websites. Token overlap without stemming or translation misses most relevant matches.

**Specific risk for this codebase:** The `toTokens()` function lowercases and filters to 3+ char alpha strings. Dutch compound words ("factuurverwerking") don't split into meaningful tokens this way. A use case titled "Automated Invoice Processing" tokenizes to `["automated", "invoice", "processing"]`. An evidence snippet containing "facturering" scores 0.

**Consequences:**

- Smart proof matching returns empty or wrong results for Dutch-language prospects
- Fallback "Custom build plan" fires for every prospect, defeating the purpose of the use cases catalog
- Sales emails cite irrelevant use cases, damaging credibility

**Prevention:**

- Add a `tags: String[]` field to the Use Case model — manually tag each use case with NL synonyms (e.g., `["factuur", "invoice", "billing", "facturering"]`)
- Use these tags as the matching vocabulary, not the title/description tokens
- Alternatively, use the Claude API for semantic matching: pass evidence snippets + use case descriptions and ask for relevance score — already have `ANTHROPIC_API_KEY` in the stack, cost per matching call is under $0.01
- Claude-based matching is the correct long-term approach; keyword matching is acceptable for MVP if tags are manually maintained

**Detection:** `matchProofs()` returns `isCustomPlan: true` for >50% of Dutch prospects with good evidence.

**Phase that must address this:** Use Cases catalog implementation phase.

---

### Pitfall 6: Manual Evidence Approval Becomes a Bottleneck That Blocks Outreach

**What goes wrong:** The intent is that a human approves evidence before outreach is generated. If the approval UX requires reviewing 12–24 evidence items per prospect (the current `slice(0, 24)` cap in `research-executor.ts`) before a sequence can be drafted, and campaigns run 50+ prospects, the approval queue grows faster than one person can clear it.

**Why it happens:** Evidence approval is designed to ensure quality — but the volume/granularity tradeoff is wrong if it requires per-item approval for evidence that is structurally always-valid (e.g., the company's own website homepage is always an acceptable evidence source).

**Specific risk for this codebase:** The `EvidenceItem.isApproved` field defaults to `false`. If the cadence engine requires `isApproved: true` on a minimum number of items before generating a `WorkflowLossMap`, every new research run stalls until manually reviewed. At 15 min/prospect for review + 50 prospects, that's 12+ hours of bottleneck before a single email goes out.

**Consequences:**

- Outreach pipeline stalls completely for days when workload increases
- Approval fatigue leads to rubber-stamping — defeating the purpose of the gate
- No emails go out during vacation or high-priority work periods

**Prevention:**

- Auto-approve evidence from `WEBSITE` and `CAREERS` sourceTypes (company's own content — always valid as a signal source)
- Only require manual approval for `REVIEWS` (user-submitted content can be misleading), `SERP_RESULT` (SerpAPI results need human curation), and any evidence with `confidenceScore < 0.65`
- Design the approval UI as a batch review (approve/reject all visible at once with one-click) not individual item-by-item
- Add a `skipApprovalGate` flag per campaign for trusted research sources

**Detection:** Decision inbox shows 0 low-risk drafts even when research runs completed successfully. Research runs have completed status but `isApproved` count < minimum threshold.

**Phase that must address this:** Evidence approval gate design phase — before building approval UI.

---

### Pitfall 7: Playwright Crawling Blocked by Dutch/BE Target Websites

**What goes wrong:** Dutch and Belgian B2B SMB websites (marketing agencies, construction companies, installers) commonly use cookie consent managers (Cookiebot, Didomi, UserCentrics) that block page rendering until consent is given. Playwright without consent handling fetches the consent overlay, not the page content. Additionally, sites using Cloudflare bot protection will 403 Playwright by default.

**Why it happens:** GDPR enforcement in NL/BE is among the strictest in Europe. Virtually every Dutch B2B site has a CMP (Consent Management Platform) by legal requirement. Playwright's default browser fingerprint is well-known to Cloudflare's bot detection heuristics.

**Specific risk for this codebase:** The existing `ingestWebsiteEvidenceDrafts()` already handles fetch failures by returning `fallbackDraft()` with `confidenceScore - 0.1`. Playwright adding a `browser.newPage()` → `page.goto()` pattern without CMP handling will hit the same wall — but worse, because it might block for the full 15s timeout before failing.

**Consequences:**

- Playwright fetches cookie banners instead of page content — evidence snippet is "Accept cookies" or "Wij gebruiken cookies"
- `extractWebsiteEvidenceFromHtml()` extracts the consent notice text as the primary snippet
- Evidence quality gate passes with garbage evidence that mentions only cookies

**Prevention:**

- Handle Cookiebot specifically: after `page.goto()`, check for `#CybotCookiebotDialog` and click the reject/accept button before scraping
- Use `page.waitForLoadState('domcontentloaded')` not `'networkidle'` — most Dutch sites load trackers that keep the network busy indefinitely
- Set `page.setExtraHTTPHeaders()` with a realistic desktop user-agent and accept-language `nl-NL,nl;q=0.9`
- Add a content validity check: if the extracted text contains "cookie" >3 times and the page text is <200 chars of non-cookie content, treat as a failed fetch

**Detection:** Evidence snippets contain "cookies", "cookie-instellingen", or "privacybeleid" as the primary text. Evidence titles extracted as "Cookie-instellingen | [Company Name]".

**Phase that must address this:** Playwright integration phase — must be implemented before any production crawls.

---

### Pitfall 8: OutreachSequence Status and OutreachStep Status Drift Out of Sync

**What goes wrong:** The existing `markSequenceStepAfterSend()` function updates the step to `SENT` and the sequence to `SENT`. But when the cadence engine advances to step 2, it needs to know the step 1 was actually sent (not just queued). If step 1's `OutreachLog` record is deleted on success (as `approveDraft` does with `ctx.db.outreachLog.delete()`), the step-to-log linkage via `OutreachStep.outreachLogId` becomes null, and step status reconstruction requires checking multiple tables.

**Why it happens:** The current design deletes the draft `OutreachLog` after sending and creates a new one for the sent email. The `OutreachStep.outreachLogId` FK can go null. For cadence advancement, you need to know "was step 1 sent, and when?" — which requires the log to persist or the timestamp to be on the step.

**Specific risk for this codebase:** `OutreachStep` already has `sentAt DateTime?`. But `markSequenceStepAfterSend()` only sets `status: 'SENT'` and `sentAt: new Date()`. If the cadence cron runs and tries to query `OutreachStep.outreachLog` for step 1, it will find null and may incorrectly treat it as unsent.

**Consequences:**

- Cadence engine sends step 2 before step 1 was actually delivered
- Duplicate outreach: step 1 draft approved manually AND cadence cron queues step 2
- Sequence status shows `SENT` but no email in the contact's inbox

**Prevention:**

- Never delete `OutreachLog` records — change `approveDraft` to set `status: 'sent'` instead of deleting
- Add a `isDeliveryRecord` boolean to `OutreachLog` to distinguish "draft to review" from "delivery record"
- Use `OutreachStep.sentAt` as the authoritative timestamp for cadence advancement, not `OutreachLog` presence
- The cadence cron query: `WHERE sentAt IS NOT NULL AND status = 'SENT'` — fully reliable

**Detection:** Contacts receive step 2 emails without receiving step 1. Sequence status shows `SENT` but step 1 `OutreachLog` is null.

**Phase that must address this:** Cadence state machine phase — must be resolved before building the advancement cron.

---

## Minor Pitfalls

---

### Pitfall 9: SerpAPI Returns SERP Results for Wrong Country/Language

**What goes wrong:** SerpAPI defaults to `gl=us` (US locale) and `hl=en` (English). Dutch prospects queried without `gl=nl&hl=nl` return English Wikipedia results, US company profiles, and international news instead of NL job listings, Dutch review sites (klantenvertellen.nl, feedbackcompany.com), or Dutch news.

**Prevention:** Always pass `gl=nl&hl=nl&lr=lang_nl` parameters for NL/BE prospects. For BE, use `gl=be`. Hardcode these as defaults in the SerpAPI client wrapper. Never use the SerpAPI default locale.

---

### Pitfall 10: Playwright Binary Not Installed in Railway Production Build

**What goes wrong:** `@playwright/test` is a devDependency. In production builds, `npm install --production` skips it. Even if installed, `playwright install chromium` must run separately to download the Chromium binary. Railway's Nixpacks build does not run this automatically.

**Prevention:** Move `playwright` to production dependencies (not `@playwright/test` — just `playwright`). Add `RUN npx playwright install chromium --with-deps` to the Dockerfile or Railway build command. Verify with a health check endpoint that returns Playwright version on startup.

---

### Pitfall 11: Use Cases Catalog Without Versioning Breaks Existing Proof Matches

**What goes wrong:** `ProofMatch` records store `proofId` as a string referencing the Obsidian JSON item_id. When Use Cases move to DB, the proofId format changes. Existing `ProofMatch` records reference IDs that no longer resolve.

**Prevention:** Add a `sourceVersion` field to `ProofMatch` (e.g., `'obsidian_v1'` vs `'usecase_db_v1'`). Run a migration script that marks existing Obsidian-sourced matches. Do not delete old matches — they are historical evidence of what was matched for already-sent outreach.

---

### Pitfall 12: Resend Webhook Signature Verification Missing for Engagement Events

**What goes wrong:** If the engagement webhook endpoint (`/api/webhooks/resend`) that receives open/click events doesn't verify the Resend webhook signature, it's open to spoofed requests that artificially trigger cadence advancement.

**Specific risk for this codebase:** The existing `/api/outreach/unsubscribe` handler uses a token-based approach. But engagement webhooks (open tracking) coming from Resend need HMAC signature verification with the `svix-signature` header. Missing this means anyone who knows the endpoint URL can fake an open event and trigger a call task for any contact.

**Prevention:** Use Resend's webhook signature verification. Store the webhook signing secret in env. Reject all webhook payloads without valid signatures before processing any engagement state changes.

---

## Phase-Specific Warnings

| Phase Topic            | Likely Pitfall                                 | Mitigation                                                                  |
| ---------------------- | ---------------------------------------------- | --------------------------------------------------------------------------- |
| Playwright integration | Browser in API route hangs Railway container   | Separate worker service, use existing WORKER_BASE_URL pattern               |
| Playwright integration | Cookie consent walls blocking NL/BE sites      | Implement Cookiebot handler, validate extracted text length                 |
| Playwright integration | Binary missing in production                   | Add to production deps + Railway build step                                 |
| SerpAPI integration    | Cost accumulation without cache                | DB cache + manual-only trigger + `CreditUsage` counter                      |
| SerpAPI integration    | Wrong country/language in results              | Hardcode `gl=nl&hl=nl` defaults                                             |
| Use Cases catalog      | Dutch-English mismatch in proof matching       | Tag-based matching with NL synonyms or Claude API semantic matching         |
| Use Cases catalog      | Obsidian proofId orphans                       | Add sourceVersion to ProofMatch before migration                            |
| Cadence state machine  | Timestamps in JSON metadata instead of columns | Schema migration first: add `scheduledAt`, `triggeredBy`, `nextStepReadyAt` |
| Cadence state machine  | Step/sequence status drift                     | Never delete OutreachLog, use OutreachStep.sentAt as source of truth        |
| Cadence state machine  | False email open signals driving call tasks    | Only advance to call on click/wizard/PDF events, not opens                  |
| Evidence approval      | Per-item approval bottleneck                   | Auto-approve own-website sources, batch approval UI                         |
| Engagement tracking    | No Resend webhook signature verification       | Add svix-signature verification before any engagement event processing      |

---

## Sources

- Codebase analysis: `lib/workflow-engine.ts`, `lib/research-executor.ts`, `lib/research-refresh.ts`, `lib/outreach/send-email.ts`, `server/routers/outreach.ts`, `server/routers/sequences.ts`, `prisma/schema.prisma`, `env.mjs`
- Domain knowledge: Railway container constraints (512MB–1GB default), Playwright production deployment requirements, SerpAPI pricing model, Apple Mail Privacy Protection (MPP) iOS 15+, Dutch GDPR/CMP compliance requirements, Cookiebot prevalence in NL/BE B2B sites
- Pattern analysis: Existing `WORKER_BASE_URL`/`WORKER_SHARED_SECRET` env vars indicate prior intent for worker separation; `CreditUsage` model indicates prior cost-tracking intent; `OutreachStep.sentAt` exists as correct pattern for temporal state

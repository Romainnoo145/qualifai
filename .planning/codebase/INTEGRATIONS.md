# External Integrations

**Analysis Date:** 2026-04-13

## APIs & External Services

**Email & Messaging:**

- Resend - Transactional email delivery
  - SDK: `resend` 6.9.1
  - Auth: `RESEND_API_KEY` (required)
  - Webhook: `RESEND_WEBHOOK_SECRET` (required for event tracking)
  - Webhook endpoint: `POST /api/webhooks/resend`
  - Events tracked: `email.opened`, `email.clicked`
  - Implementation: `lib/outreach/send-email.ts` - `sendOutreachEmail()`
  - Webhook handler: `app/api/webhooks/resend/route.ts` - Updates `OutreachLog.openedAt`, tracks click metadata

**Calendar & Booking:**

- Cal.com - Booking page embed
  - SDK: `@calcom/embed-react` 1.5.3
  - Auth: `CALCOM_API_KEY` (optional), `CALCOM_EVENT_TYPE_ID` (optional)
  - Webhook: `CALCOM_WEBHOOK_SECRET` (optional)
  - Webhook endpoint: `POST /api/webhooks/calcom`
  - Events tracked: Booking created/cancelled
  - Webhook handler: `app/api/webhooks/calcom/route.ts` - Creates `CallPrepPlan` draft on booking, tracks via `OutreachSequence.metadata.calcom`
  - Implementation: `app/discover/[slug]/wizard-client.tsx` - Embed via `getCalApi()`

**Contact & Company Enrichment:**

- Apollo.io - B2B data enrichment (contacts, companies, intent signals)
  - SDK: None (HTTP requests with custom retry logic)
  - Auth: `APOLLO_API_KEY` (optional)
  - Base URL: `https://api.apollo.io/api/v1`
  - Rate limiting: 120ms delay between requests (conservative, varies by plan)
  - Max retries: 3 with 1000ms exponential backoff
  - Implementation: `lib/enrichment/providers/apollo.ts`
  - Functions:
    - `enrichCompany(domain)` - Returns `EnrichedCompanyData`
    - `lookupPerson(params)` - Returns `EnrichedContactData`
    - `searchCompanies(filters)` - Returns paginated `SearchResult<EnrichedCompanyData>`
    - `searchContacts(filters)` - Returns paginated `SearchResult<EnrichedContactData>`
  - Data cached in Prospect/Contact models (Apollo fields: `lushaCompanyId`, `lushaPersonId`, `lushaRawData`, `intentTopics`, `fundingInfo`)
  - Credit tracking: `CreditUsage` model logs all Apollo API calls

**Business Registry:**

- KVK (Dutch Chamber of Commerce) - Company verification
  - SDK: HTTP requests
  - Auth: `KVK_API_KEY` (optional)
  - Test mode: `KVK_TEST_MODE` environment variable
  - Purpose: Verify Dutch companies, cross-validate Apollo data
  - Status: Integrated in prospect enrichment flow (referenced in UI)

**Web Search & Crawling:**

- SerpAPI - Google search results
  - SDK: `serpapi` 2.2.1
  - Auth: `SERP_API_KEY` (optional)
  - Implementation: `lib/enrichment/serp.ts` (tested in `lib/enrichment/serp.test.ts`)
  - Purpose: Job listings, news mentions, website URLs

**Web Crawling & Scraping:**

- Crawl4AI - Content extraction from URLs
  - SDK: HTTP requests
  - Base URL: `CRAWL4AI_BASE_URL` (optional)
  - Purpose: Extract content from prospect websites, help center, career pages
  - Status: Used in research workflow for evidence gathering

**Sitemaps:**

- Sitemapper - Parse sitemap.xml files
  - SDK: `sitemapper` 4.1.4
  - Purpose: Discover URLs on prospect domains
  - Implementation: Site catalog discovery (`ProspectSiteCatalogRun`)

## Data Storage

**Databases:**

- PostgreSQL (primary)
  - Connection: `DATABASE_URL` (required, full connection string)
  - Client: Prisma 7.3.0 with `@prisma/adapter-pg`
  - ORM: Prisma (type-safe queries, migrations via `prisma migrate`)
  - Schema: `prisma/schema.prisma`
  - Key tables:
    - `Prospect` - Company profiles with enrichment data
    - `Contact` - People linked to prospects
    - `ResearchRun` - Research workflow execution
    - `WorkflowHypothesis` - Automation opportunities
    - `EvidenceItem` - Research findings
    - `OutreachLog` - Email send history
    - `OutreachSequence` - Email campaign sequences
    - `WorkflowLossMap` - Generated PDF reports
    - `CallPrepPlan` - Sales call prep documents
    - See `prisma/schema.prisma` for full 50+ model schema

**File Storage:**

- S3-compatible storage (optional, falls back to local volume)
  - Config: `PDF_STORAGE_*` environment variables
  - Bucket: `PDF_STORAGE_BUCKET`
  - Region: `PDF_STORAGE_REGION`
  - Access: `PDF_STORAGE_ACCESS_KEY`, `PDF_STORAGE_SECRET_KEY`
  - Optional session token: `PDF_STORAGE_SESSION_TOKEN` (STS)
  - Endpoint: `PDF_STORAGE_ENDPOINT` (defaults to AWS S3 regional endpoint)
  - Public base URL: `PDF_STORAGE_PUBLIC_BASE_URL` (for signed URLs)
  - Implementation: `lib/pdf-storage.ts`
    - `persistWorkflowLossMapPdf()` - Uploads markdown-rendered PDFs
    - Signing: AWS SigV4 (HMAC-SHA256)
    - Key format: `workflow-loss-maps/{year}/{month}/{slug}-v{version}-{id}.pdf`
  - Fallback: Local volume at `PDF_STORAGE_VOLUME_PATH` (default: `/tmp/qualifai-pdfs`)
  - Final fallback: Inline (no URL, PDF stored in DB or memory)

**Caching:**

- In-memory caching for enrichment results
  - `ENRICHMENT_MEMORY_CACHE_TTL_SECONDS` (optional)
  - `ENRICHMENT_SEARCH_CACHE_TTL_SECONDS` (optional)
  - `ENRICHMENT_CACHE_MAX_ENTRIES` (optional)
  - Re-enrichment: `ENRICHMENT_REENRICH_AFTER_HOURS` (optional)

## Authentication & Identity

**Internal Authentication:**

- Custom admin token validation
  - Token header: `x-admin-token` (passed to tRPC context)
  - Secret: `ADMIN_SECRET` (required, min 8 chars)
  - Project scoping: `ATLANTIS_ADMIN_SECRET` (optional, for multi-tenant project access)
  - Implementation: `server/admin-auth.ts` - `resolveAdminProjectScope()`
  - tRPC middleware: `adminProcedure`, `projectAdminProcedure`, `prospectProcedure`

**Public Access:**

- Prospect wizard (prospect public pages)
  - Gated: Prospect must have status in `['READY', 'SENT', 'VIEWED', 'ENGAGED', 'CONVERTED']`
  - No authentication required
  - Rate limiting: Not currently enforced

## Monitoring & Observability

**Error Tracking:**

- Not detected (no Sentry, Axiom, or similar integration)

**Logs:**

- Console-based logging via `console.error()` and `console.log()`
- Research worker errors captured in `ResearchRun.error` field
- Webhook signature validation failures logged to console
- Integration failures fall back gracefully (e.g., S3 upload fallback to volume)

**Analytics:**

- Engagement tracking via `WizardSession` (page views, PDF downloads, calls booked, quotes requested)
- Email engagement via Resend webhooks (`OutreachLog.openedAt`, click tracking in `metadata.clicks`)
- Outreach sequence status tracking (`OutreachSequence.status`, `OutreachStep.status`)

## CI/CD & Deployment

**Hosting:**

- Vercel (Next.js platform, inferred from environment validation pattern)
- Environment: `NODE_ENV` = 'development' | 'test' | 'production'

**CI Pipeline:**

- Not detected (no GitHub Actions, CircleCI, or similar config files)

**Database Migrations:**

- Prisma migrations: `prisma/migrations/` directory
- Run via: `npm run db:migrate` (development) or `prisma migrate deploy` (production/CI)
- Adapter: PostgreSQL with Prisma adapter
- Validation: Zod schemas for incoming data

**Pre-commit Hooks:**

- Husky (configured in `package.json` via `prepare` script)
- Lint-staged: Auto-run ESLint + Prettier on staged files
  - TS/TSX: ESLint + Prettier
  - JSON/MD/YAML: Prettier only

## Environment Configuration

**Required env vars (production startup blocking):**

- `DATABASE_URL` - PostgreSQL connection string
- `ADMIN_SECRET` - Admin token secret (min 8 chars)
- `RESEND_API_KEY` - Email delivery
- `ADMIN_EMAIL` - Admin contact email

**Optional but important (feature gates):**

- `APOLLO_API_KEY` - Enable contact/company enrichment
- `ANTHROPIC_API_KEY` - Enable Claude-powered analysis
- `OPENAI_API_KEY` - Enable OpenAI embeddings
- `GOOGLE_AI_API_KEY` - Enable Gemini wizard content generation
- `CALCOM_API_KEY`, `CALCOM_EVENT_TYPE_ID` - Enable booking embeds
- `SERP_API_KEY` - Enable Google search in research workflow
- `KVK_API_KEY` - Enable Dutch business verification

**Secrets location:**

- Environment variables injected at runtime (Vercel for production, `.env` locally for dev)
- Never committed to git (`.gitignore` excludes `*.env*`)
- Validation: Zod schemas in `env.mjs` prevent startup if required vars missing

## Webhooks & Callbacks

**Incoming Webhooks:**

1. **Resend Email Events**
   - URL: `POST /api/webhooks/resend`
   - Secret header: `svix-signature` (Svix-signed webhook)
   - Verification: `resend.webhooks.verify()` with `RESEND_WEBHOOK_SECRET`
   - Events:
     - `email.opened` → Update `OutreachLog.openedAt`
     - `email.clicked` → Track clicks in `OutreachLog.metadata.clicks` array

2. **Cal.com Booking Events**
   - URL: `POST /api/webhooks/calcom`
   - Secret header: `X-Cal-Signature-256` (HMAC-SHA256)
   - Verification: Manual HMAC validation with `CALCOM_WEBHOOK_SECRET`
   - Events:
     - `BOOKING.CREATED` → Create `CallPrepPlan` draft, track in sequence metadata
     - `BOOKING.CANCELLED` → Archive sequence or mark as closed

3. **Research Worker Callback**
   - URL: `POST /api/internal/research/callback`
   - Secret header: `x-worker-signature` (HMAC-SHA256)
   - Verification: Manual HMAC validation with `WORKER_SHARED_SECRET`
   - Payload: `ResearchRunCallback` with status, evidence items, hypotheses, opportunities
   - Validation: Zod schemas enforce strict payload structure
   - Async processing: Creates `EvidenceItem`, `WorkflowHypothesis`, `AutomationOpportunity` records

4. **Inbound Reply Webhook** (Placeholder)
   - URL: `POST /api/webhooks/inbound-reply`
   - Purpose: Capture inbound email replies to outreach (not fully implemented)
   - Secret: `INBOUND_REPLY_WEBHOOK_SECRET`

**Outgoing Webhooks:**

- Cal.com booking integration uses outbound triggers (if configured)
- No other outgoing webhooks detected

## Internal Services

**Cron Jobs:**

1. **Research Refresh**
   - Endpoint: `POST /api/internal/cron/research-refresh`
   - Secret: `INTERNAL_CRON_SECRET`
   - Purpose: Re-run research on stale prospects
   - Interval: Configurable via `RESEARCH_REFRESH_STALE_DAYS`

2. **Cadence Engine Sweep**
   - Endpoint: `POST /api/internal/cron/cadence-sweep`
   - Secret: `INTERNAL_CRON_SECRET`
   - Purpose: Trigger next outreach steps at scheduled times
   - Query: Uses `OutreachStep.nextStepReadyAt` index for efficient filtering

**Internal Worker:**

- External research worker (not in codebase)
  - Base URL: `WORKER_BASE_URL`
  - Shared secret: `WORKER_SHARED_SECRET`
  - Callback: Calls `POST /api/internal/research/callback` with HMAC signature

## Partner Integration (Atlantis)

**RAG Document Ingestion:**

- Partner documents stored in Obsidian vault
- Paths: `OBSIDIAN_INVENTORY_JSON_PATH`, `OBSIDIAN_CLIENT_OFFERS_JSON_PATH`, `OBSIDIAN_VAULT_PATH`
- Alternative: `ATLANTIS_RAG_VOLUMES_PATH` for pre-built RAG volumes
- Ingestion: `npm run rag:ingest:atlantis` script
- Models: `RagIngestionRun`, `ProjectDocument`, `ProjectDocumentChunk`
- Vector search: Embedding model stored in `ProjectDocumentChunk.embeddingModel`
- Cost tracking: `RagIngestionRun.estimatedCostUsd` for embedding tokens

---

_Integration audit: 2026-04-13_

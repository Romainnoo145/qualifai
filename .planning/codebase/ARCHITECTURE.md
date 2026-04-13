# Architecture

**Analysis Date:** 2026-04-13

## Pattern Overview

**Overall:** Next.js 16 App Router with tRPC for RPC API layer + Prisma ORM

**Key Characteristics:**

- **Type-safe API:** tRPC client/server with full TypeScript inference
- **Server-driven:** Thick Prisma models, AI-powered business logic in lib files
- **Project-scoped:** Multi-tenant architecture with Project and SPV (Strategic Partner/Vertical) models
- **Evidence-based:** Research runs, hypotheses, and proof matching drive outreach generation
- **Admin-gated:** Token-based authentication for `/admin` and `/api/trpc` endpoints
- **Public-facing:** `/discover/[slug]` for client-accessible wizard experience

## Layers

**UI Layer (Next.js App Router):**

- Purpose: Server-rendered pages and client components for admin/public experiences
- Location: `app/` (pages, layouts, loading states)
- Contains: Page components (`*.tsx`), route handlers for webhooks/exports
- Depends on: tRPC API via `api` client, Prisma for SSR data loading
- Used by: End users (admin, public wizard visitors)

**Components Layer:**

- Purpose: Reusable UI components organized by context
- Location: `components/` (ui/, features/, public/)
- Contains: Button, card components, prospect-specific sections (evidence, contacts, etc.)
- Key structure:
  - `components/ui/`: Primitive controls (Button, Badge, Card)
  - `components/features/prospects/`: Admin prospect dashboard sections
  - `components/public/`: Public-facing wizard (prospect-dashboard-client.tsx, etc.)
- Depends on: Tailwind CSS, Lucide React icons, tRPC hooks

**API/Router Layer:**

- Purpose: tRPC procedures organized by domain, secured by admin token
- Location: `server/routers/` (one router per domain: campaigns, research, hypotheses, etc.)
- Contains: Procedure definitions (query/mutation), input validation with Zod, context-aware auth
- Patterns:
  - `adminProcedure`: Requires valid x-admin-token header
  - `projectAdminProcedure`: Extends admin procedure, loads active project context
  - `prospectProcedure`: Public procedure for prospect access via slug (public wizard routes)
  - Input validation via Zod schemas inline in each procedure
- Root router: `server/routers/_app.ts` composes all domain routers
- Entry point: `app/api/trpc/[trpc]/route.ts` (fetch adapter)
- Used by: All UI components via tRPC React client

**Business Logic / Service Layer:**

- Purpose: Research execution, AI analysis, outreach generation, evidence scoring
- Location: `lib/` organized by function:
  - `lib/research-executor.ts`: Main research pipeline orchestration (67KB)
  - `lib/workflow-engine.ts`: Hypothesis generation, proof matching (53KB)
  - `lib/enrichment/`: Company data discovery (sitemap, SERP, Katana)
  - `lib/outreach/`: Email generation, contact scoring, reply triage
  - `lib/ai/`: Prompt building and AI calls (Claude, Gemini)
  - `lib/rag/`: Retrieval-augmented generation for Atlantis partnership documents
  - `lib/analysis/`: Narrative analysis type contracts and processors
- Depends on: Prisma ORM, external SDKs (Anthropic, Google Generative AI), business rules
- Used by: Router mutations/queries, cron handlers, webhook processors

**Data Access Layer (Prisma ORM):**

- Purpose: PostgreSQL schema definition and type-safe queries
- Location: `prisma/schema.prisma` + migrations in `prisma/migrations/`
- Key models:
  - `Prospect`: Core entity (slug, companyName, domain, status, project scoping)
  - `ResearchRun`: Pipeline execution state (status, quality approval, error tracking)
  - `WorkflowHypothesis`: Identified opportunities (title, problem, metrics, status)
  - `EvidenceItem`: Source findings (URL, snippet, confidence, workflow tag)
  - `OutreachSequence`: Email cadence planning (template, status)
  - `Contact`: Prospect person records (email, job title, outreach status)
  - Multi-project support via `Project` (KLARIFAI, ATLANTIS) and `SPV` (Strategic Vertical)
- Depends on: PostgreSQL adapter, vector embeddings for RAG chunks
- Used by: All router procedures, lib service functions

## Data Flow

**Research Run Flow:**

1. Admin initiates `research.startRun()` tRPC mutation with prospectId
2. Procedure calls `executeResearchRun()` in `lib/research-executor.ts`
3. Research executor:
   - Discovers URLs via sitemap, SERP, Katana
   - Crawls and extracts content for each source
   - Passes extracted evidence to AI workflow engine
4. Workflow engine (`lib/workflow-engine.ts`):
   - Generates hypotheses and automation opportunities using Claude
   - Matches evidence to use cases (ProofMatch)
   - Stores all results in Prospect relations (WorkflowHypothesis, EvidenceItem, etc.)
5. Admin reviews via `/admin/prospects/[id]` page (fetches via `hypotheses.listByProspect`)
6. Admin approves hypotheses and gates → Status updates to PENDING/ACCEPTED

**Outreach Generation Flow:**

1. Admin initiates `outreach.generateIntroDraft()` tRPC mutation
2. Procedure in `server/routers/outreach.ts` calls `generateIntroDraft()` in `lib/outreach/generate-intro.ts`
3. Generate intro:
   - Loads approved hypotheses from ResearchRun
   - Builds OutreachContext with evidence, competitor data, metrics
   - Calls Claude via `lib/ai/generate-outreach.ts`
   - Creates OutreachSequence and OutreachStep records
4. Admin reviews draft in `/admin/outreach` section
5. Admin sends or queues via `outreach.sendSequenceStep()` → email via Resend

**Public Discover Flow:**

1. User visits `/discover/[slug]` with prospectId slug
2. `app/discover/[slug]/page.tsx` fetches prospect via Prisma (SSR)
3. Renders `DashboardClient` component with:
   - Company vitals (domain, industry, headcount)
   - Wizard progress (steps, conversions)
   - Evidence sections, hypotheses, CTA
4. User interactions (click CTA, download PDF, book call) tracked in WizardSession

**State Management:**

- **Server state:** Prisma + PostgreSQL (single source of truth)
- **Client state:** React Query via tRPC client (auto-cached, refetchable)
- **Session state:** WizardSession model (step times, conversions, analytics)
- **Auth state:** Admin token in localStorage, validated on each tRPC request

## Key Abstractions

**Prospect Slug System:**

- Purpose: URL-friendly unique identifier for prospects
- Implementation: `slug` field (12 chars, CUID-based), `readableSlug` field (80 chars, human-readable)
- Examples: `app/discover/[slug]/page.tsx`, `lib/prospect-url.ts` helpers
- Pattern: Used in public wizard URLs (/discover/[slug]) and internal references

**Research Run:**

- Purpose: Encapsulates a full research execution with status tracking
- Examples: `ResearchRun` model, `executeResearchRun()` function, cron refresh via `lib/research-refresh.ts`
- Pattern: Created per prospect per campaign, linked to Hypotheses and Evidence

**Hypothesis as Narrative:**

- Purpose: Identified business opportunity with metrics, confidence, narrative
- Examples: `WorkflowHypothesis` (status: DRAFT→ACCEPTED→PENDING→DECLINED), `AutomationOpportunity`
- Pattern: Generated by AI, manually approved or declined on /discover/ page

**Project Scope:**

- Purpose: Isolate data by business context (Klarifai, Atlantis, future clients)
- Examples: `Project` model with `projectType`, Prospect/Campaign/UseCase all foreign-key `projectId`
- Pattern: Admin procedures use `projectAdminProcedure` to inject active project context

**Procedure Pattern (tRPC):**

- Purpose: Route-level authorization and context injection
- Examples:
  - `adminProcedure`: Validates x-admin-token, allows project scope override
  - `projectAdminProcedure`: Extends admin, loads Project record into context
  - `prospectProcedure`: Public access, validates prospect slug is READY+ status
- Pattern: `.input(zod schema).query() / .mutation()`

## Entry Points

**Admin Dashboard Entry:**

- Location: `app/admin/layout.tsx`
- Triggers: User visits `/admin` after authentication
- Responsibilities: Main navigation, sidebar, admin token gate, layout scaffold

**Admin Dashboard Home:**

- Location: `app/admin/page.tsx`
- Triggers: Loaded when admin visits /admin
- Responsibilities: Summary feed (research completed, replies, outreach sent), quick stats, prospect queue

**Prospect Detail (Admin):**

- Location: `app/admin/prospects/[id]/page.tsx`
- Triggers: Admin clicks prospect from list/queue
- Responsibilities: Full prospect view with research status, hypotheses, evidence, contacts, outreach history

**Public Discover Page:**

- Location: `app/discover/[slug]/page.tsx`
- Triggers: Public visitor with prospect slug (sent via email/outreach)
- Responsibilities: Prospect wizard—step tracking, PDF download, call booking, metrics display

**tRPC API Handler:**

- Location: `app/api/trpc/[trpc]/route.ts`
- Triggers: Any tRPC call from client
- Responsibilities: Route to correct router/procedure, validate admin token, execute business logic

**Webhook Handlers:**

- Locations:
  - `app/api/webhooks/inbound-reply/route.ts`: Email reply ingestion
  - `app/api/webhooks/resend/route.ts`: Email bounce/open tracking
  - `app/api/webhooks/calcom/route.ts`: Calendar booking confirmation
  - `app/api/webhooks/lusha/route.ts`: Enrichment provider callbacks
- Responsibilities: Ingest external events, update Prospect/Contact/Signal models

**Cron Handlers:**

- Locations:
  - `app/api/internal/cron/cadence-sweep/route.ts`: Schedule next outreach steps
  - `app/api/internal/cron/research-refresh/route.ts`: Re-run research after date threshold
- Responsibilities: Background job orchestration without explicit user trigger

## Error Handling

**Strategy:** Fail-safe with audit trail

**Patterns:**

- **Quality Gate Blocks:** Research, Hypothesis, Pain confirmation gates raise `TRPCError('PRECONDITION_FAILED')` if prerequisites unmet (e.g., "Outreach blocked: approve at least one hypothesis")
- **Schema Validation:** Zod input schemas validate at procedure boundary; invalid input → `TRPCError('BAD_REQUEST')`
- **Not Found:** Missing prospect/campaign/run → `TRPCError('NOT_FOUND')`
- **Async Failures:** Research executor, AI calls catch and log errors, store in `ResearchRun.error` field, set status to FAILED; UI displays "Onderzoek update nodig"
- **Audit Trail:** GateOverrideAudit, OutreachLog, NotificationLog track state changes and exceptions

## Cross-Cutting Concerns

**Logging:**

- Approach: Console.log in lib functions, structured logs for cron/webhooks
- Pattern: Errors logged with context (prospectId, runId, timestamp)

**Validation:**

- Approach: Zod schemas at procedure boundaries, type-safe queries via Prisma select()
- Pattern: Input validation inline in router procedures; runtime type-checking in lib functions where needed

**Authentication:**

- Approach: Token-based (x-admin-token header), stored in localStorage on client
- Middleware: `normalizeAdminToken()` checks format, `resolveAdminProjectScope()` maps token to allowed projects
- Pattern: `adminProcedure` middleware validates on every tRPC request

**Authorization:**

- Approach: Procedure-level (adminProcedure, projectAdminProcedure, prospectProcedure)
- Pattern: Helpers like `assertProspectInProject()`, `assertCampaignInProject()` throw if cross-project access attempted

**Internationalization:**

- Approach: Dutch (nl) as primary; Campaign model has `language` field
- Pattern: Template strings use Dutch labels, UI strings hardcoded for now (Phase 12 planned localization)

---

_Architecture analysis: 2026-04-13_

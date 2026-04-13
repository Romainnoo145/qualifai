# Codebase Structure

**Analysis Date:** 2026-04-13

## Directory Layout

```
qualifai/
├── app/                           # Next.js App Router (pages and routes)
│   ├── admin/                     # Admin dashboard (token-gated)
│   │   ├── layout.tsx             # Main admin layout with nav sidebar
│   │   ├── page.tsx               # Admin home—feed, stats, queues
│   │   ├── prospects/             # Prospect management
│   │   │   ├── page.tsx           # Prospect list with filters
│   │   │   ├── new/page.tsx       # Create prospect form
│   │   │   └── [id]/page.tsx      # Prospect detail + edit
│   │   ├── campaigns/             # Campaign CRUD
│   │   ├── contacts/              # Contact management
│   │   ├── outreach/              # Email sequence drafts/sends
│   │   ├── research/              # Research run history
│   │   ├── hypotheses/            # Hypothesis review
│   │   ├── briefs/                # Loss map briefs
│   │   ├── use-cases/             # Use case management
│   │   ├── signals/               # Signal monitoring
│   │   └── settings/              # Project settings
│   ├── api/                       # Route handlers
│   │   ├── trpc/[trpc]/route.ts   # tRPC API gateway
│   │   ├── export/                # CSV/JSON exports
│   │   ├── webhooks/              # Inbound webhooks
│   │   │   ├── inbound-reply/     # Email reply ingestion
│   │   │   ├── resend/            # Email event tracking
│   │   │   ├── calcom/            # Calendar booking
│   │   │   └── lusha/             # Enrichment callbacks
│   │   └── internal/              # Internal cron/jobs
│   │       └── cron/
│   │           ├── cadence-sweep/ # Schedule outreach steps
│   │           └── research-refresh/ # Auto re-run research
│   ├── discover/                  # Public wizard experience
│   │   └── [slug]/                # Prospect-specific wizard (public)
│   │       ├── page.tsx           # Server-rendered wizard page
│   │       └── wizard-client.tsx  # Client-side interactions
│   ├── layout.tsx                 # Root layout with fonts, metadata
│   ├── page.tsx                   # Home (redirects to /admin)
│   ├── globals.css                # Tailwind + custom CSS variables
│   └── loading.tsx                # Global loading skeleton
│
├── server/                        # tRPC backend
│   ├── routers/                   # Domain-specific tRPC routers
│   │   ├── _app.ts                # Root router (composes all routers)
│   │   ├── admin.ts               # Admin settings/project management
│   │   ├── campaigns.ts           # Campaign CRUD and linking
│   │   ├── contacts.ts            # Contact management
│   │   ├── research.ts            # Research run orchestration
│   │   ├── hypotheses.ts          # Hypothesis review and approval
│   │   ├── outreach.ts            # Email sequence generation and sending
│   │   ├── sequences.ts           # Cadence step scheduling
│   │   ├── call-prep.ts           # Call prep plan generation
│   │   ├── assets.ts              # PDF/document generation
│   │   ├── proof.ts               # Proof matching and evidence linking
│   │   ├── signals.ts             # Signal detection and processing
│   │   ├── wizard.ts              # Public wizard session tracking
│   │   ├── search.ts              # Full-text prospect search
│   │   ├── use-cases.ts           # Use case management
│   │   └── projects.ts            # Multi-project admin
│   ├── context.ts                 # tRPC context factory (injects db, adminToken)
│   ├── trpc.ts                    # tRPC base setup (procedures: adminProcedure, etc.)
│   └── admin-auth.ts              # Admin token validation and scope resolution
│
├── components/                    # React UI components
│   ├── providers.tsx              # TRPCProvider, QueryClient setup
│   ├── ui/                        # Primitive components
│   │   ├── button.tsx
│   │   ├── glass-card.tsx
│   │   ├── status-badge.tsx
│   │   └── page-loader.tsx
│   ├── features/                  # Feature-specific sections
│   │   └── prospects/             # Admin prospect detail sections
│   │       ├── company-vitals.tsx
│   │       ├── evidence-section.tsx
│   │       ├── contacts-section.tsx
│   │       ├── analysis-section.tsx
│   │       ├── results-section.tsx
│   │       ├── quality-chip.tsx
│   │       ├── pipeline-chip.tsx
│   │       ├── source-set-section.tsx
│   │       ├── intent-signals-section.tsx
│   │       ├── outreach-preview-section.tsx
│   │       ├── command-center.tsx
│   │       └── CadenceTab.tsx
│   └── public/                    # Public-facing components
│       ├── prospect-dashboard-client.tsx  # Main public wizard
│       ├── atlantis-discover-client.tsx   # Atlantis-specific wizard
│       ├── partnership-discover-client.tsx
│       └── prospect-dashboard-atlantis-client.tsx
│
├── lib/                           # Business logic and services
│   ├── prisma.ts                  # Prisma client singleton
│   ├── admin-token.ts             # Token validation and normalization
│   ├── admin-token.test.ts
│   ├── prospect-url.ts            # Prospect slug building and lookup
│   ├── readable-slug.ts           # Human-readable slug generation
│   ├── quality-config.ts          # Quality gate configuration
│   │
│   ├── research-executor.ts       # Main research pipeline (67KB)
│   │   └── Orchestrates: sitemap discovery → crawling → AI analysis
│   ├── research-refresh.ts        # Auto-refresh research by age
│   ├── site-catalog.ts            # Website URL catalog/sitemap discovery
│   │
│   ├── enrichment/                # Company data discovery
│   │   ├── sitemap.ts             # Sitemap URL extraction
│   │   ├── katana.ts              # Third-party endpoint crawler
│   │   ├── source-discovery.ts    # JS-heavy detection, default URLs
│   │   └── url-selection.ts       # Top N URL selection and ranking
│   │
│   ├── workflow-engine.ts         # Hypothesis and proof generation (53KB)
│   │   ├── generateHypothesisDrafts()
│   │   ├── matchProofs()
│   │   └── Depends on: Evidence items, AI analysis
│   ├── evidence-scorer.ts         # Confidence scoring for evidence
│   ├── web-evidence-adapter.ts    # Web content extraction and cleaning
│   ├── web-evidence-adapter.test.ts
│   │
│   ├── outreach/                  # Email and contact outreach
│   │   ├── generate-intro.ts      # Intro email generation
│   │   ├── send-email.ts          # Email sending via Resend
│   │   ├── quality.ts             # Contact outreach scoring
│   │   ├── quality.test.ts
│   │   ├── inbound-adapters.ts    # Email reply ingestion
│   │   ├── reply-triage.ts        # Classify replies (interested, busy, etc)
│   │   ├── reply-workflow.ts      # Reply automation
│   │   ├── engagement-triggers.ts # Trigger definitions
│   │   ├── sender.ts              # Load project-specific sender config
│   │   └── unsubscribe.ts         # Handle unsubscribe links
│   │
│   ├── ai/                        # AI integration and prompting
│   │   ├── generate-outreach.ts   # Claude-based email generation
│   │   ├── outreach-prompts.ts    # Prompt builders for outreach context
│   │   └── ... (other AI-specific logic)
│   │
│   ├── rag/                       # Retrieval-augmented generation
│   │   ├── retriever.ts           # Vector search in RAG chunks
│   │   ├── opportunity-generator.ts # Dual-evidence opportunity synthesis
│   │   └── ... (RAG orchestration)
│   │
│   ├── analysis/                  # Prospect analysis and narrative
│   │   ├── types.ts               # NarrativeAnalysis, EvidenceItem types
│   │   └── ... (analysis processors)
│   │
│   ├── cadence/                   # Outreach cadence scheduling
│   ├── automation/                # Automation opportunity detection
│   ├── extraction/                # Intent/signals extraction
│   ├── signals/                   # Signal detection (job change, funding, etc)
│   ├── partnership/               # Partnership-specific logic
│   │
│   ├── pdf-render.ts              # Puppeteer HTML→PDF rendering
│   ├── pdf-render.test.ts
│   ├── pdf-storage.ts             # Upload PDFs to storage (S3, etc)
│   ├── notifications.ts           # Send notifications (email, SMS)
│   ├── pipeline-stage.ts          # Pipeline stage definitions
│   ├── project-ui-profile.ts      # Project branding/UI config
│   ├── atlantis-volume-reader.ts  # Atlantis partnership document reader
│   ├── vault-reader.ts            # Partnership document retrieval
│   ├── codebase-analyzer.ts       # Static analysis of prospect codebase
│   ├── review-adapters.ts         # Review/evidence format conversion
│   ├── deep-analysis.ts           # Deep prospect analysis
│   └── utils.ts                   # Shared utilities
│
├── prisma/                        # Database schema and migrations
│   ├── schema.prisma              # Full Prisma schema (956 lines)
│   │   ├── Models: Prospect, Contact, Signal, Campaign, ResearchRun, etc.
│   │   ├── Enums: ProspectStatus, HypothesisStatus, EvidenceSourceType, etc.
│   │   └── Relations: One-to-many (Prospect→Hypotheses, etc.)
│   ├── seed.ts                    # Database seeding script
│   └── migrations/                # Auto-generated migration files
│       ├── 20260206151704_init/
│       ├── 20260221120000_readable_slug_and_quote/
│       └── ... (incremental schema changes)
│
├── public/                        # Static assets
│   └── logos/                     # Brand and company logos
│
├── hooks/                         # React hooks (empty directory, custom hooks TBD)
│
├── e2e/                           # End-to-end tests (Playwright)
│   └── ... (test files)
│
├── __tests__/                     # Unit tests
│   └── unit/
│
├── scripts/                       # Utility scripts
│   ├── ingest-atlantis-rag.ts     # RAG ingestion script
│   └── audit-site-coverage.ts     # Coverage audit script
│
├── .planning/                     # GSD planning documents
│   ├── codebase/                  # Codebase analysis (ARCHITECTURE.md, etc.)
│   ├── phases/                    # Implementation phase specs
│   └── milestones/                # Release milestones
│
├── .claude/                       # Project-specific Claude instructions
├── .husky/                        # Git hooks (linting on commit)
├── .eslintrc.json                 # ESLint configuration
├── prettier.config.json           # Code formatting config
├── tsconfig.json                  # TypeScript configuration
├── next.config.ts                 # Next.js configuration
├── package.json                   # Dependencies and scripts
├── postcss.config.js              # Tailwind PostCSS config
└── tailwind.config.ts             # Tailwind CSS configuration
```

## Directory Purposes

**app/admin:**

- Purpose: Token-gated admin dashboard and CRUD pages
- Contains: Page components, layout, loading states
- Key files:
  - `layout.tsx`: Navigation sidebar, admin auth gate
  - `page.tsx`: Dashboard home with feed and stats
  - `prospects/[id]/page.tsx`: Prospect detail (research, hypotheses, outreach)
- Pattern: Each domain (prospects, campaigns, contacts) gets its own subdirectory with page.tsx

**app/discover:**

- Purpose: Public-facing prospect wizard (client-accessible)
- Contains: `[slug]/page.tsx` (SSR), `wizard-client.tsx` (interactive components)
- Pattern: Dynamic route parameter [slug] matches Prospect.slug or Prospect.readableSlug
- Authentication: Via prospectProcedure (no admin token needed, public URLs sent via email)

**server/routers:**

- Purpose: tRPC procedure definitions organized by domain
- Pattern: Each file exports a `{domain}Router` which is composed in `_app.ts`
- Naming: `{domain}.ts` corresponds to tRPC call like `api.{domain}.{procedure}()`
- Example: `campaigns.ts` exports `campaignsRouter` with `create()`, `list()`, etc.

**lib/:**

- Purpose: Shared business logic, external integrations, utility functions
- Organization:
  - Top-level files: Singletons (prisma.ts), helpers (admin-token.ts, prospect-url.ts)
  - Subdirectories: Functional domains (enrichment/, outreach/, ai/, rag/)
  - Tests: Co-located with implementation (\*.test.ts)
- Size constraint: Individual files kept under 300 lines (largest: research-executor.ts at 67KB crosses this—marked for potential split)

**prisma/:**

- Purpose: Database schema and migrations
- Key file: `schema.prisma` defines all 25+ models, enums, indexes
- Migration pattern: Auto-generated on `prisma db push` or `prisma migrate dev`
- Relation strategy: Foreign keys use onDelete (Cascade, SetNull, Restrict) for referential integrity

**components/:**

- Purpose: React components organized by scope
- Subdirectories:
  - `ui/`: Primitive, reusable controls (Button, Badge, Card)
  - `features/`: Feature-specific sections tied to pages (prospects detail, campaign detail)
  - `public/`: Public-facing components (wizards, dashboards)
- Pattern: Component files match what they render (e.g., evidence-section.tsx → EvidenceSection)

**hooks/:**

- Purpose: Custom React hooks
- Current state: Empty directory (hooks would live here if added)
- Pattern: `use{Something}.ts` for custom hooks

## Key File Locations

**Entry Points:**

| File                           | Purpose                                 |
| ------------------------------ | --------------------------------------- |
| `app/layout.tsx`               | Root layout: fonts, providers, metadata |
| `app/page.tsx`                 | Home redirect (→ /admin)                |
| `app/admin/layout.tsx`         | Admin layout: nav, auth gate            |
| `app/admin/page.tsx`           | Admin dashboard home                    |
| `app/discover/[slug]/page.tsx` | Public wizard page                      |
| `app/api/trpc/[trpc]/route.ts` | tRPC gateway                            |

**Configuration:**

| File                   | Purpose                                            |
| ---------------------- | -------------------------------------------------- |
| `package.json`         | Dependencies, scripts (dev, build, test, etc.)     |
| `tsconfig.json`        | TypeScript config (strict mode, path aliases @/\*) |
| `next.config.ts`       | Next.js config (minimal)                           |
| `tailwind.config.ts`   | Tailwind CSS config                                |
| `prisma/schema.prisma` | Database schema                                    |

**Core Logic:**

| File                             | Purpose                                           |
| -------------------------------- | ------------------------------------------------- |
| `server/trpc.ts`                 | tRPC setup: router factory, procedure definitions |
| `server/context.ts`              | tRPC context: injects db, adminToken              |
| `lib/prisma.ts`                  | Prisma client singleton with PostgreSQL adapter   |
| `lib/research-executor.ts`       | Main research pipeline orchestration              |
| `lib/workflow-engine.ts`         | Hypothesis and proof generation                   |
| `lib/outreach/generate-intro.ts` | Email generation                                  |

**Testing:**

| File               | Purpose                       |
| ------------------ | ----------------------------- |
| `e2e/`             | End-to-end tests (Playwright) |
| `__tests__/unit/`  | Unit tests                    |
| `lib/**/*.test.ts` | Co-located unit tests         |

## Naming Conventions

**Files:**

- **Pages:** `page.tsx` in each route directory (Next.js convention)
- **Components:** PascalCase, e.g., `CompanyVitals.tsx`, `EvidenceSection.tsx`
- **Routers:** `{domain}.ts` in `server/routers/` (camelCase domain name)
- **Libraries:** kebab-case or camelCase (research-executor.ts, workflow-engine.ts)
- **Tests:** `*.test.ts` for unit tests, `*.spec.ts` for integration tests
- **Types:** `*.types.ts` for shared type definitions (used in analysis/, outreach/)

**Directories:**

- **app/{feature}/:** kebab-case for route segments (e.g., `prospects`, `use-cases`, `call-prep`)
- **server/routers/:** camelCase file names matching domain (campaigns.ts, contacts.ts)
- **lib/{subdomain}/:** kebab-case for functional areas (enrichment, outreach, rag)
- **components/{scope}/:** PascalCase for component files, subdirectories in camelCase (features/prospects)

**Database:**

- **Models:** PascalCase (Prospect, ResearchRun, WorkflowHypothesis)
- **Fields:** camelCase (companyName, lastEnrichedAt, internalNotes)
- **Enums:** UPPER_SNAKE_CASE (DRAFT, READY, CONVERTED)
- **Relations:** camelCase (prospect, researchRun, workflowHypotheses)
- **Indexes:** Created on frequently queried fields (domain, status, projectId, createdAt)

**API:**

- **tRPC procedures:** camelCase (startRun, listByProspect, generateIntroDraft)
- **Input/output schemas:** Zod inline in procedure definition
- **Query strings:** kebab-case (e.g., /api/trpc/research.startRun)

## Where to Add New Code

**New tRPC Router:**

1. Create `server/routers/{domain}.ts`
2. Export `export const {domain}Router = router({ ... })`
3. Import and add to `server/routers/_app.ts` in appRouter composition
4. Access from client: `api.{domain}.{procedure}()`

**New tRPC Procedure (in existing router):**

1. In `server/routers/{domain}.ts`, add procedure to the router:
   ```typescript
   export const {domain}Router = router({
     existingProcedure: ...,
     newProcedure: adminProcedure
       .input(z.object({ /* ... */ }))
       .query/mutation(async ({ ctx, input }) => { /* ... */ })
   })
   ```
2. Use `adminProcedure`, `projectAdminProcedure`, or `prospectProcedure` as base
3. Client call: `api.{domain}.newProcedure({ input })`

**New Page/Route:**

1. Create directory: `app/{feature}/{route}/`
2. Add `page.tsx` for Server Component or Client Component (use 'use client' if interactive)
3. If admin-gated: Layout is protected by `app/admin/layout.tsx` auth check
4. If public: Implement custom auth in the page component (e.g., `prospectProcedure` via tRPC)

**New Component:**

1. Organize by scope:
   - Primitive UI: `components/ui/{name}.tsx`
   - Feature-specific: `components/features/{feature}/{name}.tsx`
   - Public-facing: `components/public/{name}.tsx`
2. Use TypeScript and export type alongside component
3. Import Tailwind classes, Lucide icons as needed

**New Service/Library Function:**

1. If domain-specific (outreach, research, etc.): Create/update `lib/{domain}/{function}.ts`
2. If cross-cutting utility: Add to `lib/utils.ts` or create `lib/{utility}.ts`
3. Ensure Prisma calls use proper `select()` to avoid N+1 queries
4. Write co-located tests: `lib/{function}.test.ts`
5. Export from appropriate top-level file for access across codebase

**New Prisma Model:**

1. Add model definition to `prisma/schema.prisma`
2. Include indexes on frequently queried fields (domain, status, foreign keys)
3. Run `prisma migrate dev` to create migration
4. Update related models' relations if needed
5. Add query helpers in lib layer (e.g., `lib/{domain}/find-*.ts`)

**New Admin Page:**

1. Create `app/admin/{feature}/page.tsx`
2. Use `api.{router}.{procedure}()` tRPC calls to fetch data
3. Leverage existing components from `components/features/{feature}/`
4. Navigation added to `app/admin/layout.tsx` sidebar NavItem array

**For Phase 1 (Quote/Voorstel Convergence):**

- **Models:** Add `Quote` and `QuoteLine` to `prisma/schema.prisma`, link to Prospect via foreignKey
- **Router:** Create `server/routers/quotes.ts` with create, list, generate, updateStatus procedures
- **Pages:** Create `app/admin/quotes/` with page.tsx, [id]/page.tsx
- **Components:** Create `components/features/prospects/quote-section.tsx` for quote info on prospect detail
- **Route pattern:** Mirror `/discover/[slug]` for `/voorstel/[slug]` public access (mirror from wizard.tsx)

## Special Directories

**prisma/migrations/:**

- Purpose: Track database schema evolution
- Generated: Auto-created by `prisma migrate dev` or `prisma db push`
- Committed: Yes, to version control for team consistency
- Structure: One directory per migration with up/down SQL

**public/:**

- Purpose: Static assets served directly
- Generated: No
- Committed: Yes
- Contents: Logos, icons (public/logos/)

**.planning/:**

- Purpose: GSD (Goal-Scoped Development) planning and analysis documents
- Generated: By GSD orchestrator tools (/gsd:map-codebase, /gsd:plan-phase)
- Committed: Yes, for future reference and continuity
- Subdirectories: codebase/, phases/, milestones/

**.next/:**

- Purpose: Next.js build artifacts and type definitions
- Generated: Yes (during `npm run build` and dev)
- Committed: No (.gitignore)

**node_modules/:**

- Purpose: Installed dependencies
- Generated: Yes (`npm install`)
- Committed: No (.gitignore)

---

_Structure analysis: 2026-04-13_

# Technology Stack

**Analysis Date:** 2026-04-13

## Languages

**Primary:**

- TypeScript 5 - Strict mode enabled, full codebase (frontend + backend)
- JavaScript (ESNext) - Build tooling and configuration files

**Secondary:**

- SQL - Prisma-managed via PostgreSQL

## Runtime

**Environment:**

- Node.js (ES2022 target)
- Next.js 16.1.6 - Full-stack framework (App Router)

**Package Manager:**

- npm (lockfile: package-lock.json present)

## Frameworks

**Core:**

- Next.js 16.1.6 - Full-stack React framework, deployed on Vercel
- React 19.2.3 - UI rendering
- React DOM 19.2.3 - DOM utilities

**API & Backend:**

- tRPC 11.9.0 - Type-safe RPC layer
  - `@trpc/server` 11.9.0 - Server runtime
  - `@trpc/client` 11.9.0 - Client connector
  - `@trpc/react-query` 11.9.0 - React hooks integration
- Prisma 7.3.0 - ORM for database access
  - `@prisma/adapter-pg` 7.3.0 - PostgreSQL adapter
  - `@prisma/client` 7.3.0 - Generated client

**Data Fetching & State:**

- TanStack React Query 5.59.15 - Server state management, caching, sync with tRPC
- Zod 4.3.6 - Schema validation at API boundaries

**UI & Styling:**

- Tailwind CSS 4 - Utility-first CSS framework with PostCSS
- Framer Motion 12.29.2 - Animation library
- Lucide React 0.563.0 - Icon library
- Class Variance Authority 0.7.1 - Type-safe CSS-in-JS component variants
- Tailwind Merge 3.4.0 - Merge Tailwind class lists safely
- Tailwind CSS Animate 1.0.7 - Tailwind animation utilities
- clsx 2.1.1 - Conditional classname utility

**AI & LLM:**

- @anthropic-ai/sdk 0.73.0 - Claude API client
- @google/generative-ai 0.24.1 - Google Gemini API client
- (Optional) OpenAI API via env var - For embeddings and analysis

**Email:**

- Resend 6.9.1 - Transactional email service
- @calcom/embed-react 1.5.3 - Calendar booking embed (Cal.com)

**Search & Enrichment:**

- Serpapi 2.2.1 - SerpAPI for web search
- (Via API) Apollo.io - Contact/company enrichment (env-based)

**Data & PDF:**

- Canvas-confetti 1.9.4 - Celebratory animations
- Nanoid 5.1.6 - URL-safe unique ID generation
- Sitemapper 4.1.4 - Sitemap parsing

## Key Dependencies

**Critical:**

- Prisma 7.3.0 - All database access, type-safe queries, migrations managed via Prisma CLI
- tRPC 11.9.0 - Backend API contract between Next.js API routes and React frontend
- @anthropic-ai/sdk 0.73.0 - Claude for hypothesis generation, analysis, and outreach copy
- @google/generative-ai 0.24.1 - Gemini for wizard content generation
- Resend 6.9.1 - Email delivery (mandatory for outreach engine)

**Infrastructure:**

- @t3-oss/env-nextjs 0.13.10 - Type-safe environment variable validation using Zod
- Zod 4.3.6 - All schema validation

## Configuration

**Environment:**

- `env.mjs` - T3 Env configuration with Zod schemas
- Validated at startup (server-side) and build time (client-side)
- Required vars: `DATABASE_URL`, `ADMIN_SECRET`, `RESEND_API_KEY`, `ADMIN_EMAIL`
- Optional: `APOLLO_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_AI_API_KEY`, `CALCOM_API_KEY`, `SERP_API_KEY`, `KVK_API_KEY`
- Optional: S3 storage config (`PDF_STORAGE_*`)
- Optional: Internal secrets (`INTERNAL_CRON_SECRET`, `WORKER_SHARED_SECRET`)

**Build:**

- `next.config.ts` - Next.js configuration (empty, using defaults)
- `tsconfig.json` - TypeScript strict mode + path aliases (`@/*`)
- `tailwind.config.ts` - Tailwind CSS (Tailwind 4)
- `postcss.config.mjs` - PostCSS with Tailwind plugin
- `vitest.config.ts` - Test runner configuration (unit tests)
- `playwright.config.ts` - E2E test configuration (baseURL: http://localhost:3000)

**Code Quality:**

- `eslint.config.mjs` - ESLint with Next.js preset
- `.prettierrc` - Prettier (singleQuote, 2-space, 80-char printWidth)

## Package Scripts

**Development & Build:**

- `npm run dev` - Start Next.js dev server on port 9200
- `npm run build` - Production build
- `npm run start` - Run production server on port 9200

**Database:**

- `npm run db:generate` - Regenerate Prisma client
- `npm run db:push` - Push schema changes (no migration file)
- `npm run db:migrate` - Create migration and apply
- `npm run db:seed` - Run `prisma/seed.ts`
- `npm run db:studio` - Open Prisma Studio on port 9101

**Testing:**

- `npm run test` - Run Vitest unit tests
- `npm run test:ui` - Vitest with UI
- `npm run test:coverage` - Coverage report
- `npm run test:e2e` - Run Playwright tests
- `npm run test:e2e:ui` - Playwright UI mode

**Code Quality:**

- `npm run lint` - Run ESLint
- `npm run lint:fix` - ESLint with auto-fix
- `npm run format` - Prettier write
- `npm run format:check` - Prettier check

**Scripts (Custom):**

- `npm run rag:ingest:atlantis` - Ingest RAG volumes for Atlantis partner docs
- `npm run audit:site-coverage` - Audit site catalog coverage
- `npm run prepare` - Husky setup (git hooks)

## Platform Requirements

**Development:**

- Node.js (ES2022 compatible, tested on current LTS)
- PostgreSQL database (connection string in `DATABASE_URL`)
- Recommended: Port 9200 available (Next.js dev server)

**Production:**

- Deployment target: Vercel (Next.js optimized)
- PostgreSQL database (managed or self-hosted)
- Environment variables injected at runtime (Vercel injects at runtime, skips build-time validation)

**External Service Accounts:**

- Resend (email) - API key required, webhook secret for event tracking
- OpenAI (optional, for embeddings) - API key
- Google Gemini (optional, wizard content) - API key
- Claude/Anthropic (optional, AI analysis) - API key
- Apollo.io (optional, enrichment) - API key
- Cal.com (optional, booking embed) - API key + event type ID
- SerpAPI (optional, web search) - API key
- S3-compatible storage (optional, PDF hosting) - Bucket, credentials, endpoint
- KVK API (optional, Dutch business registry lookup) - API key

---

_Stack analysis: 2026-04-13_

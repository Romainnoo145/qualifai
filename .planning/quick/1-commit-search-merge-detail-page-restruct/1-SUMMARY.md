---
phase: quick-commit-search-merge-detail-page-restruct
plan: 01
subsystem: api, ui
tags: [trpc, enrichment, outreach, search, react-components, prospect-dashboard]

requires: []
provides:
  - search.companies and search.contacts tRPC procedures
  - Enrichment layer with Apollo provider
  - Outreach pipeline: quality scoring, reply triage, inbound adapters
  - Reusable UI components: Button, StatusBadge, GlassCard, CommandCenter, CompanyVitals
  - Restructured prospect detail page with CommandCenter
  - Merged search UI into prospects list page
  - Admin section stubs: briefs, campaigns, contacts, outreach, research, settings, signals
  - API routes: export, internal cron, outreach unsubscribe, webhooks (calcom, inbound-reply)
affects: [prospect-dashboard, admin-ui, outreach-pipeline]

tech-stack:
  added: []
  patterns:
    - 'tRPC router per domain (search, contacts, signals, call-prep)'
    - 'Enrichment layer with swappable providers (Apollo)'
    - 'Reusable UI components under components/ui/ and components/features/'

key-files:
  created:
    - server/routers/search.ts
    - server/routers/contacts.ts
    - server/routers/signals.ts
    - server/routers/call-prep.ts
    - lib/enrichment/index.ts
    - lib/enrichment/service.ts
    - lib/enrichment/types.ts
    - lib/enrichment/provider-id.ts
    - lib/enrichment/providers/apollo.ts
    - lib/outreach/quality.ts
    - lib/outreach/reply-triage.ts
    - lib/outreach/inbound-adapters.ts
    - lib/outreach/unsubscribe.ts
    - lib/automation/processor.ts
    - lib/automation/rules.ts
    - lib/pdf-render.ts
    - lib/pdf-storage.ts
    - lib/research-refresh.ts
    - lib/review-adapters.ts
    - lib/web-evidence-adapter.ts
    - lib/ai/generate-outreach.ts
    - lib/ai/outreach-prompts.ts
    - lib/ai/outreach-schemas.ts
    - components/ui/button.tsx
    - components/ui/status-badge.tsx
    - components/ui/glass-card.tsx
    - components/features/prospects/command-center.tsx
    - components/features/prospects/company-vitals.tsx
    - app/api/export/companies/route.ts
    - app/api/export/contacts/route.ts
    - app/api/export/loss-map/[id]/route.ts
    - app/api/internal/cron/research-refresh/route.ts
    - app/api/internal/research/callback/route.ts
    - app/api/outreach/unsubscribe/route.ts
    - app/api/webhooks/calcom/route.ts
    - app/api/webhooks/inbound-reply/route.ts
    - prisma/migrations/20260207183000_workflow_sprint_engine/migration.sql
    - scripts/smoke-workflow.ts
  modified:
    - app/admin/prospects/page.tsx
    - app/admin/prospects/[id]/page.tsx
    - app/admin/prospects/new/page.tsx
    - app/admin/page.tsx
    - app/discover/[slug]/page.tsx
    - app/discover/[slug]/wizard-client.tsx
    - app/voor/[slug]/dashboard-client.tsx
    - app/globals.css
    - app/layout.tsx
    - server/routers/admin.ts
    - lib/workflow-engine.ts
    - lib/ai/generate-wizard.ts
    - env.mjs
    - package.json
    - prisma.config.ts
  deleted:
    - lib/lusha.ts

key-decisions:
  - 'Quick task — validate and commit accumulated working-tree changes, not new development'
  - 'No npm run check script exists; used npx tsc --noEmit + npm run lint separately'
  - 'lint output: 41 warnings only (no errors) — all pre-existing any types, acceptable to commit'

duration: 2min
completed: 2026-02-21
---

# Quick Task 1: Commit Search/Merge/Detail Page Restructure Summary

**tRPC search/contacts/signals routers, Apollo enrichment layer, outreach pipeline, and prospect detail page restructure committed as two atomic logical groups**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-21T10:58:37Z
- **Completed:** 2026-02-21T10:59:50Z
- **Tasks:** 2
- **Files committed:** 73 (48 backend + 25 frontend)

## Accomplishments

- Validated all accumulated working-tree changes: TypeScript passes clean, lint reports 41 warnings (zero errors)
- Committed backend group (48 files): search/contacts/signals/call-prep routers, enrichment layer, outreach pipeline, API routes, DB migration
- Committed frontend group (25 files): prospect detail restructure with CommandCenter, merged search UI, reusable UI components, admin stubs

## Task Commits

1. **Task 1: Validate — run npm run check** - no dedicated commit (validation only, no source changes)
2. **Task 2: Commit backend group** - `56d64f9` (feat)
3. **Task 2: Commit frontend group** - `42fd9ee` (feat)

## Files Created/Modified

**Backend (Commit 1 — `56d64f9`):**

- `server/routers/search.ts` - search.companies and search.contacts tRPC procedures
- `server/routers/contacts.ts` - Contact management tRPC procedures
- `server/routers/signals.ts` - Engagement signals tRPC procedures
- `server/routers/call-prep.ts` - Pre-call research tRPC procedures
- `lib/enrichment/` - Enrichment layer with Apollo provider (index, service, types, provider-id, providers/apollo)
- `lib/outreach/` - Outreach pipeline: quality scoring, reply triage, inbound adapters, unsubscribe
- `lib/automation/` - Automation processor and rules
- `lib/ai/generate-outreach.ts` + `outreach-prompts.ts` + `outreach-schemas.ts` - AI outreach generation
- `app/api/export/` - CSV export routes for companies, contacts, loss map
- `app/api/internal/` - Internal cron (research refresh) and research callback routes
- `app/api/outreach/unsubscribe/` - Unsubscribe handler
- `app/api/webhooks/` - Calcom and inbound-reply webhook routes
- `prisma/migrations/20260207183000_workflow_sprint_engine/` - Workflow sprint DB migration
- `scripts/smoke-workflow.ts` - Smoke test script
- `lib/pdf-render.ts`, `lib/pdf-storage.ts` - PDF generation and storage
- `lib/research-refresh.ts` - Research refresh logic
- `lib/review-adapters.ts`, `lib/web-evidence-adapter.ts` - Review and web evidence adapters
- Updated: `lib/workflow-engine.ts`, `lib/ai/generate-wizard.ts`, `env.mjs`, `package.json`, `prisma.config.ts`

**Frontend (Commit 2 — `42fd9ee`):**

- `components/ui/button.tsx` - Reusable Button with variants
- `components/ui/status-badge.tsx` - Prospect status badge component
- `components/ui/glass-card.tsx` - Glass morphism card component
- `components/features/prospects/command-center.tsx` - Pipeline status + action shortcuts for prospect detail
- `components/features/prospects/company-vitals.tsx` - Inline company metadata display
- `app/admin/prospects/page.tsx` - Merged CompanySearch and ContactSearch into prospects list
- `app/admin/prospects/[id]/page.tsx` - Restructured detail page with CommandCenter header
- `app/admin/briefs/`, `campaigns/`, `contacts/`, `outreach/`, `research/`, `settings/`, `signals/` - Admin section stubs
- `app/voor/[slug]/dashboard-client.tsx` - Prospect-facing dashboard client
- Deleted: `lib/lusha.ts` (replaced by enrichment layer)

## Decisions Made

- No `npm run check` script exists in this project — ran `npx tsc --noEmit` and `npm run lint` separately
- lint produced 41 warnings (no errors): pre-existing `any` types and `<img>` elements in unchanged and new files — acceptable to commit, not blocking

## Deviations from Plan

None — plan executed exactly as written. The project lacked a `check` script so type-check and lint were run individually, which matched the intent.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required for this commit task.

## Next Phase Readiness

- All accumulated working-tree changes are now committed in clean git history
- Phase 11 Plan 02 (prospect dashboard) can now be marked complete after the human-verify checkpoint resolves
- tRPC routers for search, contacts, signals are wired and available for frontend use

---

_Phase: quick-commit-search-merge-detail-page-restruct_
_Completed: 2026-02-21_

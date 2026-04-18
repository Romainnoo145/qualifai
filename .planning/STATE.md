---
gsd_state_version: 1.0
milestone: v9.0
milestone_name: Klant Lifecycle Convergence
status: '60 / 61 / 61.1 / 61.2 / 61.3 all shipped. resolveLogoUrl pipeline unified three scattered call sites, ProspectLogo component simplified to 2-stage trust-the-DB, backfill script ran and populated 2 empty rows (marcore + stb-kozijnen) + re-validated 8 existing. Romano flagged meta-concern about lack of design spec / component system / uniform backend endpoints — Phase 62 is being restructured to start with /design-consultation skill before any implementation. Next action: run /design-consultation for admin prospect detail + client /voorstel pages as anchor surfaces.'
stopped_at: Completed 61.4-04-PLAN.md
last_updated: '2026-04-18T17:25:43.087Z'
last_activity: 2026-04-14 — Plan 61.1-03 shipped (retrigger mutations, ProspectLogo, error-mapping, recordAnalysis\* wiring)
progress:
  total_phases: 8
  completed_phases: 4
  total_plans: 22
  completed_plans: 21
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-13)

**Core value:** Every outreach message is backed by real evidence of a prospect's workflow pain points, matched to a service Klarifai actually delivers. No spray-and-pray.
**Current focus:** v9.0 Klant Lifecycle Convergence — Phase 60 (Quote Schema Foundation, ready to plan)

## Current Position

Phase: 61.3 — Logo Pipeline Unification (COMPLETE, lean exec) — next Phase 62 design consultation
Plan: Single session, 4 atomic commits, no GSD plan-checker ceremony per Romano's request
Status: 60 / 61 / 61.1 / 61.2 / 61.3 all shipped. resolveLogoUrl pipeline unified three scattered call sites, ProspectLogo component simplified to 2-stage trust-the-DB, backfill script ran and populated 2 empty rows (marcore + stb-kozijnen) + re-validated 8 existing. Romano flagged meta-concern about lack of design spec / component system / uniform backend endpoints — Phase 62 is being restructured to start with /design-consultation skill before any implementation. Next action: run /design-consultation for admin prospect detail + client /voorstel pages as anchor surfaces.
Last activity: 2026-04-14 — Plan 61.1-03 shipped (retrigger mutations, ProspectLogo, error-mapping, recordAnalysis\* wiring)

**Progress bar:** [██████████] 100% (9/9 plans, 1/4 phases)

## Milestones Shipped

- v1.0 MVP — 2026-02-20 (Phases 1-5)
- v1.1 Evidence-Backed Multi-Touch Outreach — 2026-02-21 (Phases 6-11)
- v1.2 Autopilot with Oversight — 2026-02-22 (Phases 12-15)
- v2.0 Streamlined Flow — 2026-02-23 (Phases 17-22)
- v2.1 Production Bootstrap — 2026-03-02 (Phases 23-27.1)
- v2.2 Verified Pain Intelligence — 2026-03-02 (Phases 28-30)
- v3.0 Sharp Analysis — 2026-03-05 (Phases 31-35)
- v4.0 Atlantis Partnership Outreach — 2026-03-07 (Phases 36-39)
- v5.0 Atlantis Intelligence — 2026-03-08 (Phases 42-45)
- v6.0 Outreach Simplification — 2026-03-08 (Phases 46-47)
- v7.0 Atlantis Discover Pipeline Rebuild — 2026-03-15 (Phases 49-54)
- v8.0 Unified Outreach Pipeline — 2026-03-16 (Phases 55-59)

## Accumulated Context

### Roadmap Evolution

- Phase 61.1 inserted after Phase 61: Manual prospect flow polish (URGENT) — Romano discovered during Phase 61 smoke testing that (a) `createProspect` never triggers enrichment so manual prospects have no logo/Apollo data, (b) Marfa is too small for Apollo so even Apollo path wouldn't have given a logo (need favicon fallback), (c) master-analyzer hits Gemini 503 with no retry, (d) no UI to retrigger pipeline.
- Phase 61.2 inserted after Phase 61.1: Manual Prospect Parity (URGENT) — discovered during 61.1 smoke testing that the favicon fallback chain "works" but renders 16x16 lo-res icons as generic globes when upscaled, Apollo throws 422 on small NL SMBs without graceful fallback, and the manual prospect detail card is hollow (12+ Apollo-only fields blank). Also need an evidence/analysis page render audit. Scope: Apollo error catch + og:image scraping + inline manual enrichment form + render parity audit.

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

Strategy decisions for v9.0 live in `klarifai-core/docs/strategy/decisions.md`:

- **Q5**: PDF rendering via separate Railway worker service, not in-process
- **Q8**: Existing klarifai-core YAMLs migrated via idempotent import script (`scripts/import-klarifai-yaml.ts`, dry-run default, `--apply` flag)
- **Q9**: Snapshot at `QUOTE_SENT` (not live render) — what client sees is frozen from the moment of sending
- **Q12**: Snapshot versioning = `snapshotAt: DateTime` + `templateVersion: String`, no counter. Applied to Quote model; existing models (ResearchRun, WorkflowLossMap, ProspectAnalysis) are separate tech-debt cleanup.
- **Q13**: Quote and Prospect have separate status enums with auto-sync via state-machine helper. One new ProspectStatus value: `QUOTE_SENT` (between ENGAGED and CONVERTED). Quote.ACCEPTED → Prospect.CONVERTED (transactional). Quote.REJECTED → Prospect remains ENGAGED.

Codebase concerns informing Phase 60 scope (see `.planning/codebase/CONCERNS.md` and `.planning/tech-debt.md`):

- ProspectStatus has scattered hardcoded string checks — Phase 60 must extract typed constants into `lib/constants/prospect-statuses.ts`
- `updateProspect` mutation accepts any state transition without validation — Phase 60 adds state-machine guard with typed error on invalid moves
- `Quote.snapshotData` must have a Zod schema at `lib/schemas/quote-snapshot.ts`, validated on every write, with type-safe accessor helper

Out of Phase 60 scope (deferred to tech-debt backlog):

- tRPC v11 `as any` inference casts in existing components (Phase 61 touches those files)
- Cadence engine config hardcoded thresholds (unrelated to Quote)
- `ResearchRun.inputSnapshot` Zod schema (separate cleanup, not Phase 60 blocker)
- Inconsistent snapshot versioning on WorkflowLossMap/ProspectAnalysis (separate cleanup)
- [Phase 60]: Plan 02: Manually-authored migration to bypass pre-existing dev DB drift, verified clean on shadow DB pre-loaded from dev schema dump
- [Phase 60]: Plan 02: Quote.replacesId self-FK added in Phase 60 (Q9) to avoid second migration in Phase 61
- [Phase 60]: Pattern: typed as-const arrays in lib/constants/prospect-statuses.ts are the SSOT for ProspectStatus literals; assertValidProspectTransition pure helper reused by every status mutation entrypoint
- [Phase 60]: Plan 03: QuoteSnapshotSchema is single source of truth feeding both web template and PDF worker (Q14) — schema describes business content only, snapshotHtml/snapshotPdfUrl live on Quote row
- [Phase 60]: Plan 03: QuoteSnapshotLine.tarief uses z.number().int() with NO .nonnegative() — OFF003 Pakketkorting carries tarief: -800 (Pitfall 5)
- [Phase 60]: Plan 03: parseSnapshot returns null on failure (defensive read paths use getSnapshotField with fallback); Plan 04 quotes.update will use safeParse + throw TRPCError on the strict write path
- [Phase 60]: Plan 04: transitionQuote is the ONLY authorised path for mutating Quote.status — router `update` Zod input OMITS status/snapshot\*/replacesId; the runtime invariant is enforced by the state machine helper
- [Phase 60]: Plan 04: Multi-tenant isolation for Quote uses `prospect: { projectId: ctx.projectId }` relation filter instead of a duplicate projectId column on Quote — Prospect FK IS the tenancy boundary (research decision)
- [Phase 60]: Plan 04: Snapshot freeze on DRAFT→SENT is transactional — QuoteSnapshotSchema.parse runs BEFORE any Prisma write, inside the same $transaction as the status + Prospect cascade
- [Phase 60]: Plan 04: Pattern: state-machine + router pair per entity — state machine owns mutation, router is a thin scope-check + delegate (Quote is first entity to follow this pattern)
- [Phase 61-admin-ui-for-quotes]: Nummer versioning via -v2/-vN suffix (no version counter column; lineage via replacesId FK)
- [Phase 61-admin-ui-for-quotes]: transitionQuote split into dispatcher + runTransition so nested callers (createVersion) can pass an existing Prisma.TransactionClient (runtime detection of method)
- [Phase 61-admin-ui-for-quotes]: Plan 02: QuoteForm uses plain useState + props callback (no react-hook-form, no schema) — canonical admin form pattern mirroring app/admin/prospects/new/page.tsx
- [Phase 61-admin-ui-for-quotes]: Plan 02: Dynamic list form pattern established — pure state helpers (addLine/updateLine/removeLine/moveUp/moveDown) exported alongside the list component and unit-tested directly without React mount
- [Phase 61-admin-ui-for-quotes]: Plan 02: Read-only form mode is a single isReadOnly prop — disables every input + replaces submit button with Dutch muted message; Q9 immutability mirrored at UI layer
- [Phase 61-admin-ui-for-quotes]: Plan 02: /admin/quotes list uses stacked sections (Concept/Verstuurd/Gearchiveerd) with native HTML <details> for the archived collapsible — no new disclosure primitive added
- [Phase 61-admin-ui-for-quotes]: Plan 03: Detail page URL is flat at /admin/quotes/[id] (O4 hybrid — nested under prospect for create, flat for edit) so the reserved actions slot can be mounted without a prospect context
- [Phase 61-admin-ui-for-quotes]: Plan 03: Tab panels ALWAYS use CSS `hidden` (className={tab===X ? "" : "hidden"}) to keep panels mounted and avoid refetch flash on switch — never conditional unmount, never React.lazy in tabs
- [Phase 61-admin-ui-for-quotes]: Plan 03: Admin HTML preview route contract: sandboxed iframe + bearer token in querystring → server handler maps scope.allowedProjectSlug → project.id → prospect.projectId filter → renderQuotePreview → text/html with Pitfall 4 headers (no-store + noindex + no-referrer)
- [Phase 61-admin-ui-for-quotes]: Plan 03: Empty `data-testid="quote-actions-slot"` div on detail page is the 61-04 contract — 61-04 mounts QuoteSendConfirm + QuoteVersionConfirm into the slot without touching the detail page shell
- [Phase 61-admin-ui-for-quotes]: Plan 03: Next.js 15 route handler params accepted as sync OR Promise via `await Promise.resolve(context.params)` — single-line forward-compat with upcoming Promise<{id}> params shape
- [Phase 61-admin-ui-for-quotes]: Plan 03: Timeline viewedAt/acceptedAt hardcoded to null in 61-03 (props optional nullables) — Phase 62 adds real columns and swaps the null literals without touching the component API
- [Phase 61]: Plan 04: Verbatim Dutch copy locked via module-scope string constants so prettier JSX wrapping can't break grep acceptance — pattern for any future O6-style verbatim check
- [Phase 61]: Plan 04: Action components are self-visibility-gated (each returns null when its status precondition is not met); page shell mounts both unconditionally without branching on quote.status
- [Phase 61]: Plan 04: Mutation error/success simulation via captured onError/onSuccess callbacks + act() — required when triggering React state updates outside React event handlers for RTL getByText to see flushed DOM
- [Phase 61.1-manual-prospect-flow-polish]: getFaviconUrl: Google s2/favicons HEAD probe → DuckDuckGo ip3 fallback → null; buildInlineGoogleFaviconUrl exported as pure URL builder for ProspectLogo onError chain
- [Phase 61.1-manual-prospect-flow-polish]: callGeminiWithRetry returns GeminiCallResult envelope (not raw GenerateContentResult) so Plans 03 and 04 can thread fallbackUsed end-to-end
- [Phase 61.1-manual-prospect-flow-polish]: recordAnalysisFailure intentionally leaves lastAnalysisModelUsed untouched — previous successful model stays as history breadcrumb
- [Phase 61.1-manual-prospect-flow-polish]: runMasterAnalysis throws PRECONDITION_FAILED with Dutch copy — ProspectAnalysis.inputSnapshot is counts-only (not reconstructable); runResearchRun is the primary rerun path in Phase 61.1
- [Phase 61.1-manual-prospect-flow-polish]: ProspectLogo shape prop drives base rounding class (rounded-full vs rounded-2xl) — callers specify shape not Tailwind override
- [Phase 61.1-manual-prospect-flow-polish]: FRIENDLY_ERROR_GEMINI_FALLBACK exported from error-mapping.ts but NOT returned by mapMutationError — it is a positive success-with-warning signal for Plan 04 ProspectLastRunStatus
- [Phase 61.1-manual-prospect-flow-polish]: generateNarrativeAnalysis + generateKlarifaiNarrativeAnalysis return type tightened to include modelUsed narrow union (was missing from Plan 01 — Plan 03 Rule 1 fix)
- [Phase 61.2-manual-prospect-parity]: og-logo.ts uses plain fetch (not scrapling service) for homepage GET — simpler, no port dependency, sufficient for public homepages
- [Phase 61.2]: EnrichmentNoCoverageError placed in apollo.ts, re-exported from service.ts for single import point
- [Phase 61.2]: enrichProspect returns { success, fallbackUsed, noCoverage } shape — fires Acties panel amber branch via existing markSuccess(data.fallbackUsed) hook, no component change needed
- [Phase 61.2]: createAndProcess: sticky guard covers companyName/industry/city/country only — description and employeeRange are NOT sticky (Apollo values preferred for quality)
- [Phase 61.2]: og-logo IIFE in createAndProcess is a net-new addition (the mutation had no favicon IIFE before Plan 03) — createProspect still has its own favicon-only IIFE unchanged
- [Phase 61.2]: ProspectEnrichmentBadge: amber pill uses title= attribute for tooltip, returns null when all fields populated
- [Phase 61.2]: Detail page null guard audit confirmed existing guards sufficient — no fixes needed
- [Phase 61.4]: DataRow supports optional href prop to handle both clickable and non-clickable rows in single component
- [Phase 61.4]: StatCard uses text-data CSS class for tabular-nums (avoids Tailwind font-variant-numeric utilities)
- [Phase 61.4-admin-design-system-sweep]: admin-btn-primary: navy solid (--color-ink) fill + white text — NOT gold gradient. Gold gradient reserved for btn-pill-\* brochure surface classes only
- [Phase 61.4-admin-design-system-sweep]: StatusBadge uses admin-state-\* CSS classes as SSOT for all admin status rendering; QuoteStatusBadge is a re-export alias for backward compat
- [Phase 61.4-04]: outreachColors maps use admin-state-_ class names; --color-brand-success/danger for semantic colors (not --color-state-_)

### Pending Todos

None.

### Blockers/Concerns

None — all Phase 60 blockers (Q5/Q8/Q9/Q12/Q13) resolved in `klarifai-core/docs/strategy/decisions.md`.

Pre-Phase 62 decisions still to make (from decisions.md "Next decisions"):

- **Q6**: Design tokens harmoniseren — resolve before Phase 62 start
- **Q7**: Auth model voor `/voorstel` pagina — resolve before Phase 62 start

Pre-Phase 63 decisions:

- **Q3**: Contracts zelf bouwen vs SignWell — locked to MVP self-built per REQUIREMENTS.md Out of Scope (SignWell deferred)

## Session Continuity

Last session: 2026-04-18T17:25:43.084Z
Stopped at: Completed 61.4-04-PLAN.md
Resume command: `/gsd:execute-plan 62 01`

## Accumulated Context

### Roadmap Evolution

- Phase 61.4 inserted after Phase 61: Admin Design System Sweep — Apply cool SaaS design tokens across all 15 admin pages (URGENT)

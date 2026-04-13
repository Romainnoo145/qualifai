---
gsd_state_version: 1.0
milestone: v9.0
milestone_name: Klant Lifecycle Convergence
status: '61-03 shipped — prospect-scoped create page, /admin/quotes/[id] detail page with tabs + read-only branching, admin preview route + sandboxed iframe, and QuoteStatusTimeline (ADMIN-04/ADMIN-06 closed). Resumed session: Tasks 1-3 already committed; Task 4 recovered from timed-out executor and committed as-is. Next action: Plan 61-04 (send + version flow into reserved actions slot).'
stopped_at: Completed 61-03-PLAN.md
last_updated: '2026-04-13T21:13:00.000Z'
last_activity: 2026-04-13 — Plan 61-03 shipped (ADMIN-04 preview route + iframe, ADMIN-06 timeline, ADMIN-02/07 page-wiring)
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 9
  completed_plans: 8
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-13)

**Core value:** Every outreach message is backed by real evidence of a prospect's workflow pain points, matched to a service Klarifai actually delivers. No spray-and-pray.
**Current focus:** v9.0 Klant Lifecycle Convergence — Phase 60 (Quote Schema Foundation, ready to plan)

## Current Position

Phase: 61 — Admin UI for Quotes
Plan: 03 of 4 — Admin Quote UI Page Wiring + Preview + Timeline (complete)
Status: 61-03 shipped — prospect-scoped create page, /admin/quotes/[id] detail page with tabs + read-only branching, admin preview route + sandboxed iframe, QuoteStatusTimeline with 4 vitest cases. ADMIN-04 + ADMIN-06 closed. Task 4 recovered from prior executor timeout and committed as-is after verification. Next action: Plan 61-04 (send + version flow mounting into reserved actions slot).
Last activity: 2026-04-13 — Plan 61-03 shipped (ADMIN-04 preview route + iframe, ADMIN-06 timeline, ADMIN-02/07 page-wiring)

**Progress bar:** [████████░░] 89% (8/9 plans, 1/4 phases)

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

Last session: 2026-04-13T21:13:00.000Z
Stopped at: Completed 61-03-PLAN.md
Resume command: `/gsd:execute-plan 61 04`

# Codebase Concerns

**Analysis Date:** 2026-04-13

## Tech Debt

**TypeScript tRPC v11 Inference Gaps:**

- Issue: Deep query includes cause TypeScript inference to fail (TS2589 "type is too deep"). Temporary `as any` casts used in multiple components to work around limitations.
- Files:
  - `app/admin/prospects/[id]/page.tsx` (lines 126, 157, 416)
  - `components/features/prospects/outreach-preview-section.tsx` (lines 95-98)
  - `components/features/prospects/intent-signals-section.tsx` (lines 138-140)
  - `components/features/prospects/quality-chip.tsx` (line 130)
- Impact: Type safety reduced for complex nested queries; potential for runtime errors if query shapes change without type updates
- Fix approach: As query includes are stabilized, apply `Prisma.XGetPayload<{include:{...}}>` pattern seen in `admin.ts` (e.g., ResearchRunRow type) to replace `as any` casts with proper types. Or simplify includes to reduce nesting depth.

**Cadence Engine Thresholds Not Finalized:**

- Issue: Default cadence config thresholds (3-day base delay, 1-day engaged delay, 4 max touches) are functional but carry TODO comments indicating pending product owner sign-off.
- Files: `lib/cadence/engine.ts` (lines 12, 73)
- Impact: Thresholds may need adjustment without code changes if business strategy changes. Currently hardcoded, not configurable via environment or admin settings.
- Fix approach: Extract thresholds to environment config or admin-accessible settings before production rollout. Document exact business rationale for each threshold.

## Known Bugs

**Prospect Status State Machine Incomplete:**

- Issue: ProspectStatus enum spans 9 states (DRAFT → ENRICHED → GENERATING → READY → SENT → VIEWED → ENGAGED → CONVERTED → ARCHIVED), but not all transitions are enforced. For example, a prospect can jump from DRAFT directly to SENT without validation.
- Files: `prisma/schema.prisma` (lines 13-23), `server/routers/admin.ts` (updateProspect mutation at line 652+)
- Trigger: Manual status updates via `admin.updateProspect` without state validation
- Workaround: Status checks are performed in downstream routers (e.g., wizard.ts checks READY/SENT/VIEWED/ENGAGED/CONVERTED), but upstream data can be in inconsistent states
- Fix approach: Add state transition validation in `updateProspect` mutation or create a distinct function per transition. Document valid state paths clearly.

**Unfinished Snapshot-on-Sent Strategy:**

- Issue: ResearchRun has `inputSnapshot` field (phase 9) capturing state when research starts, and GateOverrideAudit has `gateSnapshot` (phase 30) capturing gate state at override time. Quote/QuoteLine will add snapshot-on-sent behavior, but existing patterns show versioning inconsistency (WorkflowLossMap.version is Int default 1, ProspectAnalysis.version is String "analysis-v1"). No unified versioning strategy exists.
- Files: `prisma/schema.prisma` (lines 372, 899-900, 943)
- Impact: When Quote is sent, snapshot will need to capture prospect data + research run state + hypothesis selections. Existing models use different versioning approaches—may cause confusion or inconsistency.
- Fix approach: Before implementing Quote snapshot-on-sent, establish single versioning strategy (Int or ISO string, incremented how, stored where). Document pattern in code comments and apply consistently across ResearchRun, GateOverrideAudit, ProspectAnalysis, and new Quote snapshot.

## Security Considerations

**Limited Multi-Tenancy (Single Project Focus):**

- Risk: Schema uses `projectId` (foreign key to Project model) for scoping, but all core operations assume a single active project per admin session. No organization_id field. Future quote system will extend Prospect—must ensure multi-project queries are filtered correctly.
- Files:
  - `server/trpc.ts` (projectAdminProcedure at lines 27-51 resolves single active project)
  - `server/routers/admin.ts` (all mutations/queries use `ctx.projectId`)
  - `prisma/schema.prisma` (Prospect.projectId, Campaign.projectId, etc.)
- Current mitigation: `projectAdminProcedure` enforces `projectId` in all admin queries. Public procedures use slug-based lookups (not project-scoped).
- Recommendations:
  - When adding Quote model, include `prospectId` FK only (projects are accessed via Prospect.projectId).
  - Add integration tests verifying cross-project data leaks cannot occur.
  - Consider adding organization_id at top level (Project) for future SaaS expansion.

**Public Wizard Endpoints Exposed Data (By Design):**

- Risk: `wizard.ts` publicProcedure endpoints allow any client to query prospect data (slug lookup) and create session records. Status checks prevent access to DRAFT/ENRICHED/GENERATING prospects, but endpoint is unauthenticated.
- Files: `server/routers/wizard.ts` (lines 9-40, 42-88, 134-150, 161+)
- Current mitigation:
  - getWizard returns null if prospect status not in [READY, SENT, VIEWED, ENGAGED, CONVERTED]
  - WizardSession tracks user-agent and IP (optional) for audit
  - Admin preview detection via `resolveAdminProjectScope(ctx.adminToken)` prevents admin tracking
- Recommendations:
  - If adding Quote request flow to wizard, ensure QuoteLine data (prices, discounts) only visible to authenticated/invited users, not anonymous wizard browsers
  - Add rate limiting to prevent slug enumeration attacks
  - Log all public API access for audit trail

**Admin Token Validation Single Point:**

- Risk: All admin authentication flows through `resolveAdminProjectScope(ctx.adminToken)`, which is called via header `x-admin-token`. No token refresh/rotation strategy visible.
- Files:
  - `server/admin-auth.ts` (resolveAdminProjectScope function)
  - `server/context.ts` (line 6)
  - `server/trpc.ts` (lines 10-25)
- Current mitigation: Token validation happens per request; no session persistence on client
- Recommendations:
  - Document admin token strategy (length, entropy, rotation schedule)
  - Ensure token never logged in error messages or console output
  - Add audit log entry on token change/revoke

## Performance Bottlenecks

**List Prospects Query Uses Multiple Aggregations:**

- Problem: `listProspects` query (admin.ts line 460+) makes 3 separate DB queries to aggregate research run counts (completed, active) and fetch deep research runs. For 50 prospects, this results in 3 additional queries post-fetch.
- Files: `server/routers/admin.ts` (lines 460-611)
- Cause: Prospect includes eager-loaded only top 1 researchRun. Deep statistics require additional groupBy + findMany queries.
- Improvement path:
  - Consider Prisma field selection with computed fields or application-layer aggregation
  - Or cache research run stats in a denormalized column on Prospect (updated async)
  - Or use raw SQL query with JOINs for research run statistics if performance is critical

**getProspect Include Query is Very Deep:**

- Problem: `admin.getProspect` (line 613+) includes 7 relations (project, sessions, notificationLogs, contacts, signals, \_count) with nested selects. On prospects with 1000+ session records, this becomes slow.
- Files: `server/routers/admin.ts` (lines 613-650)
- Cause: Sessions/notificationLogs taken with `take: 20/10` but full deep fetch still loads all related records before filtering
- Improvement path:
  - Add pagination support for sessions/notificationLogs (cursor-based, not just take)
  - Or split into separate queries (getProspect core data + getProspectSessions API)
  - Verify indexes on (prospectId, createdAt) exist and are used (they do: schema line 238, 883)

**Intent Extraction and ProspectAnalysis Creation Happens Synchronously:**

- Problem: Research pipeline completion triggers hypothesis generation → proof matching → analysis creation. All within single mutation. If analysis generation is slow (LLM call), prospect gets locked in HYPOTHESIS/BRIEFING state longer.
- Files: `server/routers/admin.ts` (lines 284+, createResearch mutation)
- Cause: No async task queue; generation happens in-process
- Improvement path:
  - Move analysis/hypothesis generation to background job (Bull queue, pg_boss, or similar)
  - Return prospect to READY state immediately after hypothesis draft
  - Queue async analysis as fire-and-forget

## Fragile Areas

**ProspectStatus Enum Extension (Affects Phase 1 Quote Implementation):**

- Files:
  - `prisma/schema.prisma` (ProspectStatus enum, lines 13-23)
  - Multiple router files checking status: `wizard.ts:32`, `admin.ts:662`, etc.
- Why fragile:
  - If new quote-related statuses are added (e.g., QUOTE_SENT, QUOTE_ACCEPTED), all hardcoded status checks must be updated
  - Current code has scattered string literals (e.g., `'READY', 'SENT', 'VIEWED', 'ENGAGED', 'CONVERTED'`) instead of using enum
- Safe modification:
  - Extract status check arrays into constants (`const PUBLIC_STATUSES = ['READY', 'SENT', ...] as const`)
  - Use `as const` and TypeScript typeof to ensure type safety
  - When adding new statuses for quotes, update constant definitions first, then handle quote-specific logic in separate conditional
  - Test coverage: Verify all status transitions work in admin.listProspects and wizard.getWizard

**Manual Prospect Status Updates vs. Workflow State:**

- Files: `server/routers/admin.ts` (updateProspect line 652, status field line 656-668)
- Why fragile:
  - No constraints on manual status changes; admin can set prospect to CONVERTED without any conversion actually happening
  - When Quote is added, QuoteLine status (e.g., ACCEPTED) must be consistent with parent Prospect status
- Safe modification:
  - Do NOT allow arbitrary status changes in updateProspect
  - Create typed mutation functions for each state transition: `acceptQuote()`, `rejectQuote()`, etc.
  - Enforce business rules at mutation layer (e.g., cannot move to CONVERTED unless at least one QuoteLine is ACCEPTED)

**Research Run inputSnapshot Field (JSON Untyped):**

- Files: `prisma/schema.prisma` (ResearchRun.inputSnapshot line 372), `server/routers/admin.ts` (line 500)
- Why fragile:
  - Snapshot is stored as untyped Json. Code assumes certain fields exist (e.g., `inputSnapshot.deepCrawl` accessed in listProspects line 567)
  - If snapshot structure changes, queries break silently or return wrong data
  - When Quote snapshot is created, same risk exists: QuoteSnapshot Json will be accessed without type guards
- Safe modification:
  - Create Zod schema for ResearchRunInputSnapshot, define all valid fields
  - Validate on save: `ResearchRunInputSnapshot.parse(snapshot)`
  - Create type-safe helper function for accessing nested fields (e.g., `getInputSnapshotField(snapshot, 'deepCrawl', false)`)
  - Apply same pattern to Quote snapshot before merging

**Cadence Engine Configuration Hardcoded:**

- Files: `lib/cadence/engine.ts` (DEFAULT_CADENCE_CONFIG line 76)
- Why fragile:
  - Cannot change engagement delays or touch limits without code change
  - If business decides to reduce maxTouches from 4 to 3, requires code change + redeploy
  - With quote intro sequence, may need separate cadence config for quote follow-ups
- Safe modification:
  - Extract config to database or environment immediately before using in Phase 1
  - Create Campaign.cadenceConfig Json field (optional, falls back to defaults)
  - Or create separate CadenceConfig table
  - Document that each time you change config, existing OutreachSequences remain unaffected (immutable after creation)

## Scaling Limits

**Prospect-Related Data Explosion:**

- Current capacity: Schema supports unlimited Prospect records, but with typical customer having 10-100+ prospects, and each prospect triggering multiple ResearchRuns, EvidenceItems, and Hypotheses, table sizes grow quickly.
- Limit: Once a customer has 100k+ prospects, listProspects query with full includes becomes slow. Pagination by cursor helps but doesn't eliminate deep aggregations.
- Scaling path:
  - Implement prospect "archive" workflow (ARCHIVED status exists but archival process unclear)
  - Add soft-delete pattern (isArchived bool + index) for permanent-but-recoverable removal
  - Consider sharding by projectId if customer base grows

**WizardSession Data Retention:**

- Current capacity: No retention policy visible. Sessions accumulate forever.
- Limit: Over 1-2 years, millions of WizardSession records will slow down prospect queries (via `sessions` include)
- Scaling path:
  - Implement retention policy: delete sessions older than 90-180 days, keep summary stats in NotificationLog
  - Or add soft-delete + archival job
  - Or split sessions into active/archived tables

## Dependencies at Risk

**tRPC Client/Server Version Lock:**

- Risk: tRPC dependencies are pinned to exact version: `@trpc/client 11.9.0`, `@trpc/server 11.9.0`, `@trpc/react-query 11.9.0`. If minor patches introduce inference issues, system may break.
- Impact: Cannot upgrade without thorough testing of all inference casts
- Migration plan:
  - When tRPC v12 releases with improved type inference, test locally with codebase
  - Apply GetPayload types from migration to remove `as any` casts first
  - Then upgrade version and validate no new inference issues
  - Plan ~1 week engineering effort per major upgrade

**Prisma v7 Adapter for PostgreSQL:**

- Risk: Using `@prisma/adapter-pg ^7.3.0`. PostgreSQL driver is third-party. If adapter breaks, no automatic fallback.
- Impact: Database connection issues would require immediate Prisma upgrade or config change
- Migration plan:
  - Monitor Prisma releases monthly
  - Keep `@prisma/client` and `@prisma/adapter-pg` versions in sync
  - Test schema changes with `prisma db push --skip-generate` in staging before production

**Anthropic SDK Minor Version:**

- Risk: `@anthropic-ai/sdk ^0.73.0`. AI generation features depend on this. Breaking changes in minor versions unlikely but model response format could change.
- Impact: Hypothesis generation, outreach copy, wizard content generation could fail or produce degraded output
- Migration plan:
  - Pin to major version only, allow minor patches freely
  - Add monitoring on AI generation endpoints to detect failures
  - Have fallback prompt/copy if API calls fail

## Test Coverage Gaps

**Admin Mutation State Transitions Untested:**

- What's not tested: updateProspect status changes (DRAFT→ENRICHED→READY, etc.) have no integration tests validating state machine
- Files: `server/routers/admin.ts` (updateProspect line 652)
- Risk: Invalid status transitions could silently corrupt prospect state in production
- Priority: High
- Fix: Add test suite for admin.updateProspect covering:
  - Valid transitions (DRAFT→ENRICHED, ENRICHED→READY, READY→SENT, etc.)
  - Invalid transitions (CONVERTED→DRAFT should fail)
  - Verify downstream effects (status change triggers correct wizard visibility)

**Research Run Snapshot Validation Not Tested:**

- What's not tested: inputSnapshot structure (deepCrawl boolean, other metadata) not validated on create. Data shape could be garbage JSON and code would fail at query time.
- Files: `server/routers/admin.ts` (executeResearchRun at line 346+)
- Risk: Silent snapshot corruption, listProspects failures when accessing undefined snapshot fields
- Priority: Medium
- Fix: Add Zod schema for ResearchRunInputSnapshot, test that:
  - Valid snapshots parse correctly
  - Invalid snapshots are rejected at create time
  - Queries safely handle missing optional fields

**Multi-Project Data Isolation Not Tested:**

- What's not tested: No integration test verifies that Admin from Project A cannot see Prospect from Project B
- Files: `server/routers/admin.ts` (all procedures using projectAdminProcedure)
- Risk: If projectId filter is accidentally removed or bypassed, cross-project data leaks silently
- Priority: High
- Fix: Add test suite with 2 projects, verify:
  - Admin scoped to Project A gets empty listProspects when Project B prospects queried
  - Admin cannot access getProspect for prospect in different project
  - Cascade deletes only affect correct project

**Cadence Engine Thresholds Not Tested:**

- What's not tested: buildCadenceState thresholds (baseDelayDays 3, maxTouches 4) behavior not verified with unit tests
- Files: `lib/cadence/engine.ts` (lines 93-180)
- Risk: If threshold logic changes, engagement cadence could accelerate unexpectedly
- Priority: Medium
- Fix: Add unit tests for buildCadenceState covering:
  - Touch count=4 returns isExhausted=true, nextChannel=null
  - engagementLevel='high' uses engagedDelayDays not baseDelayDays
  - Channel rotation works correctly (email→call→linkedin→whatsapp)

**QuoteLine Status Doesn't Exist (Yet):**

- What's not tested: Phase 1 will introduce Quote and QuoteLine models with new statuses (DRAFT, SENT, ACCEPTED, REJECTED). No tests exist yet.
- Files: Will be new (Quote and QuoteLine models)
- Risk: Status transitions in Quote could diverge from Prospect/Hypothesis patterns, causing confusion
- Priority: Critical for Phase 1
- Fix: Before writing Quote code, create test suite template and add to verification checklist

## Missing Critical Features

**No Audit Trail for Admin Actions:**

- Problem: Admin mutations (updateProspect status, deleteProspect, enrichProspect) have no audit log. Cannot see who changed what when.
- Blocks: Compliance, debugging, accountability
- Workaround: GateOverrideAudit model (phase 30) tracks only gate overrides. Other critical changes not logged.

**No Undo/Rollback Mechanism:**

- Problem: If admin accidentally deletes prospect or changes status incorrectly, no recovery except manual DB restore.
- Blocks: Safe exploration of data, recovery from admin errors
- Workaround: Only Klarifai admins have access; backups exist

**Quote Status Not Integrated with Prospect Status:**

- Problem: ProspectStatus will eventually include QUOTE_SENT, QUOTE_ACCEPTED, etc., but no logic defines the relationship yet.
- Blocks: Phase 1 cannot finalize quote acceptance flow without clear status mapping (e.g., does QUOTE_ACCEPTED → CONVERTED or stay separate?)
- Workaround: None—must design before implementation

**No Snapshot Comparison/Diff Tool:**

- Problem: If quote snapshot differs from research run snapshot (due to data changes), no way to visualize diff for admin debugging.
- Blocks: Troubleshooting quote accuracy issues
- Workaround: Manual JSON inspection

**Prospect Versioning Not Implemented:**

- Problem: If prospect data is updated (company name, domain, etc.), old versions are not kept. Only updatedAt timestamp exists.
- Blocks: Audit trail, understanding how prospect profile changed over time
- Workaround: None—prospect data is mutable and version history is lost

---

_Concerns audit: 2026-04-13_

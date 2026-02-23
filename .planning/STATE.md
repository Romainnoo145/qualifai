# State: Qualifai

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** Every outreach message is backed by real evidence, matched to a service Klarifai actually delivers.
**Current focus:** v2.0 — Streamlined Flow (Phase 21: Prospect Discovery + Cleanup)

## Current Position

Phase: 20 — One-Click Send Queue + Pipeline View — COMPLETE
Plan: 03 complete — action queue enhancements + inline send UI
Status: 3/3 plans complete — Phase 20 DONE
Last activity: 2026-02-23 — Phase 20 verified (7/7 must-haves passed)

## Performance Metrics

**Velocity (v1.1 + v1.2):**

- Total plans completed: 16 (v1.1, including quick tasks)
- Average duration: ~3.5 min
- Total execution time: ~56 min

**By Phase (v1.1 + v1.2):**

| Phase                      | Plans | Total     | Avg/Plan |
| -------------------------- | ----- | --------- | -------- |
| 6. Use Cases Foundation    | 3/3   | 13 min    | 4.3 min  |
| 7. Evidence Approval Gate  | 2/2   | 6 min     | 3 min    |
| 8. Deep Evidence Pipeline  | 3/3   | ~21 min   | ~7 min   |
| 9. Engagement Triggers     | 2/2   | ~5 min    | ~2.5 min |
| 10. Cadence Engine         | 4/4   | 7 min     | 1.75 min |
| 11. Prospect Dashboard     | 2/2   | ~6 min    | 3 min    |
| 12. Navigation & Language  | 2/2   | 6 min     | 3 min    |
| 13. Prospect Story Flow    | 5/5   | ~17 min   | ~3.4 min |
| 14. Campaign Reporting     | 2/2   | ~4 min    | ~2 min   |
| 15. Action Queue Dashboard | 2/2   | ~2 min    | ~1 min   |
| 17. Evidence Pipeline      | 3/3   | ~9 min    | ~3 min   |
| 18. Research Quality Gate  | 3/3   | ~11.5 min | ~3.8 min |
| 19. Client Hypothesis Val. | 2/2   | ~5 min    | ~2.5 min |

_Updated after each plan completion_
| Phase 20 P02 | 2 | 2 tasks | 5 files |
| Phase 20 P03 | ~4 min | 2 tasks | 2 files |

## Accumulated Context

### Decisions

- [Phase 12, Plan 01]: navItems is flat NavItem[] array — no group wrappers, no section labels; removed pages stay accessible via direct URL
- [Phase 12, Plan 01]: Signals label is "Signals" (not "Signals feed") for sidebar consistency
- [Phase 12, Plan 02]: Only user-visible string literals changed in TERM-01 — variable/prop names (latestLossMap, generateLossMap, CallPrepTab, etc.) left intact to avoid regressions
- [Phase 12, Plan 02]: "Workflow Reports" used for briefs page heading to match tab rename in prospect detail
- [Phase 13, Plan 01]: Mutations (startResearch, matchProof, etc.) removed from page.tsx — section components in plans 02-04 will own their own mutations locally
- [Phase 13, Plan 01]: EvidenceSection receives signals as prop from parent getProspect query (already loaded) instead of a separate query
- [Phase 13, Plan 02]: tRPC deep inference TS2589 avoided by casting listByProspect result as any at call site, re-mapped via typed toFinding() helper
- [Phase 13, Plan 02]: setHypothesisStatus mutation defined in page.tsx (not AnalysisSection) — needs prospectId for cache invalidation, already in page scope
- [Phase 13, Plan 03]: OutreachPreviewSection owns all mutations locally (generate, queueDraft, regenerateCallBrief) — page only passes latestRunId + prospect as props
- [Phase 13, Plan 03]: CallPlanGrid helper component avoids TS2589 deep type inference from Prisma JsonValue
- [Phase 13, Plan 04]: ResultsSection fetches cadence state locally via tRPC; session data passed via prospect prop (already loaded by getProspect)
- [Phase 13, Plan 04]: page.tsx at 399 lines (target was 300) — all content is purposeful; no dead code found
- [Phase 13, Plan 05]: TERM-02 scope follows TERM-01 pattern — only user-visible string literals changed, variable/prop/type names left intact
- [Phase 13, Plan 05]: Label maps (WORKFLOW_TAG_LABELS, OUTREACH_STATUS_LABELS, OUTREACH_TYPE_LABELS) co-located at file top with ?? fallback for unknown enum values
- [Phase 14, Plan 01]: nicheKey defaults to 'generic_b2b' when segment description field left blank — avoids hardcoded option list
- [Phase 14, Plan 01]: getWithFunnelData uses two separate groupBy queries (researchRuns + workflowHypotheses) to avoid TS2589 — same pattern as Phase 13
- [Phase 14, Plan 01]: Campaigns list page removes autopilot and prospect assignment UI — both belong on campaign detail page (Plan 02)
- [Phase 14, Plan 02]: api.admin.listProspects cast as any + re-typed in AddProspectPanel to avoid TS2589 — consistent with Phase 13 pattern
- [Phase 14, Plan 02]: Campaign detail page uses STAGE_ORDER array for prospect sort instead of numeric priority map — simpler and avoids duplication with backend stagePriority
- [Phase 15, Plan 01]: parseDueAt helper duplicated in admin.ts (not imported from outreach.ts) to avoid circular dependency
- [Phase 15, Plan 01]: getActionQueue uses Promise.all for four parallel Prisma queries — single tRPC call for dashboard, no waterfall
- [Phase 15, Plan 01]: Items sorted overdue-first then oldest createdAt — matches autopilot with oversight where overdue tasks need immediate attention
- [Phase 15, Plan 02]: getActionQueue.useQuery() is sole data source — getDashboardStats removed from dashboard (vanity KPIs replaced with action queue)
- [Phase 15, Plan 02]: Hypothesis rows deep-link to /admin/prospects/[id]#analysis; draft/task/reply rows link to /admin/outreach (no tab deep-link support yet)
- [Phase 15, Plan 02]: CountCard opacity-50 when count is 0 — gives visual clarity on idle action types

- [Phase 17, Plan 01]: Sitemapper catch block omits console.error — sitemap absence is structural for Dutch SMBs, not a warning
- [Phase 17, Plan 01]: snippet.length > 30 filter in discoverGoogleSearchMentions excludes stub organic results
- [Phase 17, Plan 01]: SERP_API_KEY guard reads process.env directly (not env.mjs) for testability — consistent with discoverSerpUrls pattern
- [Phase 17, Plan 02]: DB drift prevented prisma migrate dev — applied REGISTRY enum via docker exec psql + created migration file manually
- [Phase 17, Plan 02]: KvK module uses process.env directly (not env.mjs) — matches serp.ts and crawl4ai.ts pattern for testability
- [Phase 17, Plan 02]: crawl4ai fallback stub (0.55 confidence) preferred over silent skip — enables EVID-08 LinkedIn placeholders
- [Phase 17, Plan 03]: priorSnapshot must be read BEFORE run create/update — update overwrites inputSnapshot, losing cached sitemap URLs
- [Phase 17, Plan 03]: freshSitemapCache stored as undefined (not null) when sitemap empty — avoids writing zero-URL cache entry
- [Phase 17, Plan 03]: evidence cap raised from 24 to 36 — new sources add 15+ drafts, old cap would drop useful evidence
- [Phase 17, Plan 03]: Apollo-derived LinkedIn always runs (no deepCrawl gate) — uses existing DB data, zero API cost

- [Phase 18, Plan 01]: DB drift prevented prisma migrate dev — applied quality gate fields via docker exec psql + created migration file manually (same pattern as Phase 17 Plan 02)
- [Phase 18, Plan 01]: computeTrafficLight placed directly after evaluateQualityGate in workflow-engine.ts — natural co-location, both deal with evidence quality thresholds
- [Phase 18, Plan 01]: listProspects includes researchRuns with take:1 orderBy createdAt desc — latest run only, no N+1, source type diversity deferred to getRun
- [Phase 18]: STATUS_LABELS map uses 'Pending validation' for DRAFT/ACCEPTED/PENDING — all three represent the same user-visible state (awaiting prospect confirmation)
- [Phase 18]: /voor/ filter includes both ACCEPTED (legacy) and PENDING (new) — no data migration required, backward-compatible
- [Phase 18]: QualityChip fullRun data cast as any via runQuery.data — avoids TS2589 deep Prisma inference, consistent with Phase 13/14 pattern
- [Phase 18]: Traffic light on list view uses worst-case computeTrafficLight(evidenceCount, 1, 0.65) — source diversity not in list query; list is indicative, detail is definitive

- [Phase 19, Plan 01]: prospectProcedure uses getRawInput() async function (not rawInput property) — tRPC v11 middleware API changed from v10; must await before reading slug
- [Phase 19, Plan 01]: validateByProspect uses (ctx as unknown as { prospectId: string }).prospectId cast — base TRPCContext type doesn't include prospectId, middleware injects at runtime; same pattern as Phase 13 enriched context
- [Phase 19, Plan 01]: DECLINED is final state — no-op on re-submit prevents accidental reversal
- [Phase 19, Plan 01]: PENDING hypotheses accepted in all outreach gates (assets.ts x5, wizard.ts x1) — quality-approved hypotheses are outreach-eligible without prospect confirmation
- [Phase 19, Plan 02]: HypothesisData.status typed as full Prisma enum union (DRAFT | ACCEPTED | REJECTED | PENDING | DECLINED) — narrowing to subset causes TS2322 at the prop site where Prisma returns HypothesisStatus
- [Phase 19, Plan 02]: Validation section sits below the hypothesis grid as a sibling block (not embedded in cards) — keeps discovery content clean and creates a clear separate action zone
- [Phase 19, Plan 02]: Optimistic update fires before tRPC mutate() call — instant button-to-chip transition without waiting for server; buttons become unavailable once state is set (state !== null)
- [Phase 20]: listProspects sessions include filtered by callBooked:true (take:1) for booked detection without loading full session history
- [Phase 20]: detail page uses p.sessions?.some(s => s.callBooked) for hasBookedSession — getProspect returns all sessions unfiltered, must check each for callBooked flag
- [Phase 20, Plan 01]: approveDraft atomic claim uses updateMany(where: {id, status:'draft'}, data: {status:'sending'}) — CONFLICT thrown if count=0 (already claimed or not a draft)
- [Phase 20, Plan 01]: Transient send failure reverts to 'draft' (retryable); quality block keeps 'manual_review' (permanent) — clear error-type distinction
- [Phase 20, Plan 01]: bulkApproveLowRisk silently skips (continue) drafts already claimed by concurrent request — not counted as failures
- [Phase 20, Plan 01]: Missing contact email in approveDraft reverts to 'draft' (data issue, fixable) not 'manual_review' (needs human judgment)
- [Phase 20, Plan 03]: researchInProgressStatuses uses per-element 'as const' (not array 'as const') — readonly array not assignable to mutable ResearchStatus[] for Prisma { in: [...] } filter
- [Phase 20, Plan 03]: ActionRow split: draft items render as <div>+Send button, non-draft items keep <Link> wrapper — avoids invalid nested interactive HTML
- [Phase 20, Plan 03]: approveDraft onError also invalidates the cache — idempotency CONFLICT causes the stale draft row to disappear on refresh
- [Phase 20, Plan 03]: isSendPending shared across all draft rows — complements DB-level idempotency guard at the UI level

### v2.0 Architecture Notes

- Research summary recommends additive-only schema changes: `ResearchRun` gets `qualityApproved Boolean?`, `qualityReviewedAt DateTime?`, `qualityNotes String?`; `HypothesisStatus` enum gets `PENDING` and `DECLINED` values
- Build order is strict: Phase 17 (evidence) → Phase 18 (quality gate backend + admin UI) → Phase 19 (/voor/ validation) → Phase 20 (send queue + pipeline) → Phase 21 (discovery + cleanup)
- SEND-01 and SEND-02 must ship in the same phase — idempotency guard is not a follow-up
- Quality gate must use "proceed anyway" soft override (never a hard blocker) — Dutch SMBs with thin web presence structurally cannot reach green evidence thresholds
- Client-facing hypothesis validation endpoint must use slug-scoped `prospectProcedure`, not `publicProcedure` — authorization gap risk identified in research
- Quality thresholds (amber/green) need empirical calibration against existing prospects after Phase 18 ships — do not hard-code

### Pending Todos

- After Phase 18 ships: run quality scoring against all existing prospects to calibrate amber/green thresholds before surfacing indicator widely
- After Phase 19 ships: plan a real prospect validation session to test the novel hypothesis confirmation UX before building v2.x features that depend on this signal — Phase 19 is now COMPLETE, this todo is active

### Roadmap Evolution

- Phase 16 (Draft Queue Redesign) from v1.2 absorbed into v2.0 scope as Phase 20 — fundamental rethink needed, not incremental redesign
- Phases 17-21 created 2026-02-22 for v2.0 milestone

### Blockers/Concerns

- RESOLVED: Evidence pool enriched — EVID-06-09 all shipped in Phase 17, Plans 01-03
- Research quality thresholds not yet empirically validated against Qualifai's actual data (noted in research SUMMARY.md gaps)

### Quick Tasks Completed

| #   | Description                                                                                  | Date       | Commit  | Directory                                                                                         |
| --- | -------------------------------------------------------------------------------------------- | ---------- | ------- | ------------------------------------------------------------------------------------------------- |
| 1   | Merge search into prospects page, restructure detail page, fix CTA cards on /voor/ dashboard | 2026-02-21 | 42fd9ee | [1-commit-search-merge-detail-page-restruct](./quick/1-commit-search-merge-detail-page-restruct/) |
| 2   | Improve Add Contact form layout in ContactsSection — less cramped, stacked fields            | 2026-02-22 | 4653256 | [2-improve-add-contact-form-layout-in-conta](./quick/2-improve-add-contact-form-layout-in-conta/) |

## Session Continuity

Last session: 2026-02-23
Stopped at: Phase 20 Plan 03 COMPLETE — Phase 20 DONE (all 3 plans shipped)
Resume file: None — next step is Phase 21 (Prospect Discovery + Cleanup)

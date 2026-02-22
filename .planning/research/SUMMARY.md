# Project Research Summary

**Project:** Qualifai — v2.0 Streamlined Flow (Admin Oversight Console)
**Domain:** Evidence-backed B2B outbound sales automation — admin oversight UX redesign
**Researched:** 2026-02-22
**Confidence:** HIGH (architecture and pitfalls based on direct codebase analysis; features based on industry research + codebase; stack decisions are additive-zero for most capabilities)

## Executive Summary

Qualifai v2.0 is not a new product — it is a UX accountability layer over a complete backend. The core pipeline (evidence research, hypothesis generation, cadence engine, /voor/ client dashboard, outreach delivery) is fully operational from v1.1. The problem v2.0 solves is navigation: the admin currently needs ~100 clicks to process a prospect that should take 5. The research confirms the solution is three structural changes: (1) move hypothesis approval responsibility from admin to the prospect's /voor/ dashboard, replacing admin's content-review gate with a research-quality gate; (2) unify the fragmented send queue into a single per-channel action list; and (3) surface a pipeline stage per prospect so the admin can see state at a glance without entering each record.

The recommended approach is additive-only changes to the existing schema — two new ResearchRun fields (`qualityApproved`, `qualityReviewedAt`, `qualityNotes`), two new HypothesisStatus enum values (`PENDING`, `DECLINED`), and a new unified `getSendQueue` tRPC procedure. No new tables, no new infrastructure, no new packages for the core features. The only optional dependency addition is `@dnd-kit/core` + `@dnd-kit/sortable` if a kanban view is ever required — which research recommends deferring entirely. The existing stack (Next.js 16, tRPC 11, Prisma 7, TanStack Query v5, framer-motion 12, Tailwind 4) covers every v2.0 capability.

The key risk is correctness at trust boundaries. Three independent failure modes require explicit prevention before any UI is built: the `approveDraft` mutation has no idempotency guard and can double-send emails on rapid double-click or multi-tab sessions; any client-facing hypothesis interaction endpoint must use slug-scoped authorization (not `publicProcedure`) or it creates an auth gap; and the research quality gate must define explicit exit conditions (`maxRetries` + "proceed anyway" override) before being surfaced to users, because Dutch SMBs with thin web presence will never reach green evidence thresholds through automated research alone.

---

## Key Findings

### Recommended Stack

No new package installations are required for v2.0. The entire oversight console — optimistic UI, polling, list reordering, pipeline visualization — is covered by dependencies already in `package.json`. The explicit "do not install" list from STACK.md is important: XState (server-driven linear pipeline doesn't need it), recharts/chart.js (pipeline view is count display + navigation, not data visualization), WebSocket libraries (10-second `refetchInterval` polling is indistinguishable from real-time for a single-user console), and react-beautiful-dnd / react-flow (not warranted by current requirements).

**Core technologies (existing, no new installations):**

- `@tanstack/react-query@^5.59.15` via tRPC 11: optimistic UI via `mutation.variables` + `isPending`; polling via `refetchInterval: 10_000` on queue queries; cross-component mutation state via `useMutationState`
- `framer-motion@^12.29.2`: single-column queue reordering via `Reorder.Group`; entry/exit animations via `AnimatePresence`
- Prisma 7 `ProspectStatus` enum: pipeline state re-exported directly — no client-side state machine needed
- TypeScript `useReducer`: local UI state for multi-step transitions (confirm → sending → done)

**Conditional addition (only if kanban required — research recommends NOT building this for v2.0):**

- `@dnd-kit/core@^6.3.1` + `@dnd-kit/sortable@^10.0.0`: cross-column drag between pipeline stages

See `.planning/research/STACK.md` for full capability-by-capability analysis.

### Expected Features

The v2.0 feature set is narrowly scoped: what does the admin need to process prospects without navigating to individual records? Industry research across Outreach.io, Salesloft, HubSpot Breeze, Instantly.ai, and Clay.com confirms a consistent pattern — "task queue play mode" where the admin steps through a pre-built queue without page navigation. The specific Qualifai differentiator (prospect validates pain-point hypotheses on /voor/) has no direct comparator and must be treated as a design risk requiring validation after first shipment.

**Must have (v2.0 launch — table stakes):**

- Prospect pipeline stage chip — maps existing DB fields to 7-stage visual enum (IMPORTED → RESEARCHING → REVIEWING → READY → SENDING → ENGAGED → BOOKED); blocks everything else
- Research quality indicator — traffic-light (red/amber/green) per prospect based on evidence count, confidence scores, source diversity, hypothesis count, evidence age
- "Need more research" popover — explains what's missing + one-click re-run trigger via new `research.requestDeeper` procedure
- Stage-aware action queue — dashboard surfaces only actionable-stage prospects; removes research-in-progress noise
- Inline draft preview + one-click send — draft expands in queue row; send without full page navigation; idempotency guard mandatory

**Should have (v2.x — after validation):**

- Prospect-side hypothesis validation on /voor/ — prospect confirms/declines pain points; feeds future outreach generation; depends on first-email flow being established
- Confidence-gated auto-advance — auto-move to "Ready to Send" when quality score hits green; requires 2+ weeks of stable quality scoring first
- Bulk approve all low-risk drafts — add after single-approve flow is working smoothly
- Prospect activity urgency ranking — WizardSession signals (pdfDownloaded, maxStepReached, callBooked) boost task priority in queue

**Defer to v3+:**

- Kanban board — only warranted at 100+ active prospects; drag complexity is anti-feature for a single-user 20-50 prospect tool
- Autopilot auto-send — only after 50+ manually approved drafts establish trust baseline; requires explicit opt-in

**Anti-features to explicitly avoid:**

- Fully automated send without approval gate (legal risk GDPR/anti-spam NL/BE; trust not yet calibrated)
- Global research quality threshold same for all prospects (Dutch bakery vs. SaaS company have structurally different evidence availability)
- Research completeness as a hard blocker (makes system unusable for thin-presence Dutch SMBs — must always have "proceed anyway" path)
- Prospect approving the email text itself (defeats outbound purpose; approval should be at hypothesis level, not message level)

See `.planning/research/FEATURES.md` for full competitor comparison and feature dependency graph.

### Architecture Approach

All v2.0 changes are additive to the existing schema and router structure. The architecture is organized around five questions answered by direct codebase analysis: (1) research quality state lives on `ResearchRun` as three nullable fields; (2) "request more research" reuses `executeResearchRun` via a new `research.requestDeeper` procedure that spawns a new run rather than overwriting — preserving history for before/after comparison; (3) client-side hypothesis validation adds `PENDING` and `DECLINED` to `HypothesisStatus` enum and uses a slug-scoped `wizard.validateHypothesis` public procedure; (4) the send queue is a unified view query over `OutreachLog` where `status IN ('draft', 'touch_open')` — no new table; (5) three admin pages (`/admin/hypotheses`, `/admin/research`, `/admin/briefs`) are not in the nav and can be removed with low risk.

**Major components (new or modified):**

1. `ResearchQualityGate` — shows evidence count + confidence breakdown + approve/reject/request-more buttons; embedded in existing `EvidenceSection`
2. `HypothesisValidationCard` — client-facing "Applies to us / Doesn't apply" card on /voor/ dashboard; calls `wizard.validateHypothesis`
3. `SendQueueRow` — unified row for email draft or touch task; single primary action button per row; inline content preview
4. `ProspectPipelineRow` (optional extraction) — list row with research stage + outreach stage pills derived from existing DB fields
5. `outreach.getSendQueue` tRPC procedure — unified query returning email drafts + touch tasks sorted by urgency; replaces two-tab UX

**Schema migrations (both additive, no data migration required):**

- `ResearchRun`: add `qualityApproved Boolean?`, `qualityReviewedAt DateTime?`, `qualityNotes String?`
- `HypothesisStatus` enum: add `PENDING` (shown to prospect, awaiting validation), `DECLINED` (prospect said it doesn't apply)

**Build order is strict — each step unlocks the next:**

1. Research quality gate backend (schema + 3 new tRPC procedures)
2. HypothesisStatus extension + PENDING transition logic
3. Client-side hypothesis validation UI on /voor/
4. Research quality gate UI on admin prospect detail
5. Unified send queue page
6. Prospect pipeline stage view

See `.planning/research/ARCHITECTURE.md` for full data flow diagrams, procedure implementations, and component boundary table.

### Critical Pitfalls

The pitfall research is derived entirely from direct codebase analysis — these are not theoretical risks, they are patterns present in the existing code.

1. **Double-send race condition on one-click approve** — `approveDraft` has no idempotency guard; rapid double-click or two admin tabs can send the same email twice. Prevention: atomic status transition from `'draft'` to `'sending'` using `updateMany({ where: { id, status: 'draft' } })` and checking `count === 1` before proceeding; disable button on first click and never re-enable after success (row disappears); change `OutreachLog` on send success to `status: 'sent'` instead of deleting (preserves audit trail and enables idempotency check).

2. **Hypothesis approval shift creates authorization gap** — any client-facing endpoint that mutates `WorkflowHypothesis` must be slug-scoped, not `publicProcedure` and not `adminProcedure`. Create a dedicated `prospectProcedure` that validates slug → prospectId ownership before any write. Never expose `hypotheses.setStatus` to client routes.

3. **Research quality gate infinite loop without exit conditions** — Dutch SMBs with thin web presence structurally cannot reach green evidence thresholds; re-running research produces identical thin results. Prevention: `maxRetries: 3` counter, "proceed anyway" explicit override button, show admin exactly what's missing ("2 of 5 URLs returned 404") so they can make informed proceed decisions. Build exit conditions into the data model before building the gate UI.

4. **Inflated funnel counts from draft-not-sent distinction** — funnel `emailed` stage currently counts Resend API acceptance, not delivery. When one-click send makes drafts more prominent, admin will notice mismatches. Prevention: add `deliveredAt DateTime?` to `OutreachStep` wired to Resend delivery webhooks; until then, label funnel counts as "send attempted" not "delivered."

5. **UX redesign breaks hidden-section side effect timing** — Phase 13 uses CSS `hidden` (all 4 sections mounted at page load). Any query with a mount-time mutation (e.g., `markAsViewed`) fires immediately on page open regardless of which section is visible. Verify all 4 section queries are read-only before any future page restructure.

See `.planning/research/PITFALLS.md` for full recovery strategies, security mistakes table, and "looks done but isn't" checklist.

---

## Implications for Roadmap

The build order is dictated by hard dependencies — each phase must complete before the next can start. Research confirms 5-6 phases covering the full v2.0 scope.

### Phase 1: Research Quality Gate (Backend)

**Rationale:** Everything in v2.0 depends on the quality gate concept existing in the schema and router. The hypothesis PENDING transition (Phase 2), the unified send queue filter (Phase 5), and the pipeline stage derivation (Phase 6) all reference `ResearchRun.qualityApproved`. Build this first before any UI work begins.
**Delivers:** Schema migration, 3 new tRPC procedures (`approveQuality`, `rejectQuality`, `requestDeeper`), extended `getActionQueue` to surface `research_review` items
**Addresses:** "Research quality indicator" and "need more research" flow from FEATURES.md table stakes
**Avoids:** Research quality gate infinite loop pitfall — exit conditions (`maxRetries`, "proceed anyway") must be designed into the procedure inputs at this stage, not retrofitted

### Phase 2: Hypothesis Flow Redesign (Backend)

**Rationale:** Depends on Phase 1 (`approveQuality` triggers the PENDING transition). The new enum values and `validateHypothesis` procedure are prerequisites for the /voor/ UI in Phase 3.
**Delivers:** `PENDING` and `DECLINED` enum values added to `HypothesisStatus`; `approveQuality` extended to transition DRAFT → PENDING; new slug-scoped `wizard.validateHypothesis` procedure
**Addresses:** Client-side hypothesis validation dependency chain from FEATURES.md
**Avoids:** Authorization gap pitfall — `prospectProcedure` slug-scoped auth must be implemented here, not retrofitted later; chicken-and-egg anti-feature (gate hypothesis validation UI by `sequences.length > 0` — don't show /voor/ validation until first email sent)

### Phase 3: Client-Side Hypothesis Validation UI (/voor/)

**Rationale:** Depends on Phase 2 (PENDING status and `validateHypothesis` procedure). Pure frontend work with no further backend dependencies. The /voor/ dashboard already exists — this is a component addition.
**Delivers:** `HypothesisValidationCard` component; updated `DashboardClient` to wrap PENDING hypotheses; confirmed that DECLINED hypotheses are hidden from subsequent renders
**Addresses:** "Prospect-side hypothesis validation" differentiator from FEATURES.md
**Avoids:** "Prospect approves email text" anti-feature — the card must present the pain-point hypothesis, not the draft message
**Note:** This phase has LOW confidence on UX approach — no direct comparator exists in industry research. Plan an explicit validation step with a real prospect after launch before building further.

### Phase 4: Research Quality Gate UI (Admin)

**Rationale:** Depends on Phases 1-2 (backend procedures must exist). Admin's analysis view is the primary touchpoint for the new quality-gate workflow. This phase also removes the now-redundant hypothesis approve/reject buttons from `AnalysisSection`.
**Delivers:** `ResearchQualityGate` component embedded in `EvidenceSection`; `AnalysisSection` updated to show PENDING/ACCEPTED/DECLINED status badges; dashboard extended with research_review action queue section; `/admin/hypotheses`, `/admin/research`, `/admin/briefs` pages removed (not in nav — low risk, verify deep links first)
**Addresses:** "Research quality indicator" and "stage transition triggers" table stakes from FEATURES.md
**Uses:** Existing `EvidenceSection` component shell; existing `getActionQueue` with fourth query type added
**Avoids:** Phase 5 anti-pattern of building send queue before quality gate is in place (queue should filter by `qualityApproved = true`)

### Phase 5: Unified Send Queue

**Rationale:** Depends on Phases 1-4 — the unified queue should only surface prospects that passed the quality gate. This is a view change over `OutreachLog` plus a new page shell. The existing `approveDraft` and `completeTouchTask` mutations remain unchanged; they gain an idempotency guard.
**Delivers:** `outreach.getSendQueue` procedure; `SendQueueRow` component with inline preview and single action button; `/admin/outreach` page rewritten from 4-tab view to unified queue; idempotency guard added to `approveDraft` (atomic `draft → sending` status claim before Resend call)
**Addresses:** "One-click send from draft queue" table stakes; bulk approve; stage-aware queue filtering from FEATURES.md
**Avoids:** Double-send race condition pitfall — idempotency guard must ship in this phase, not as a follow-up; "send attempted vs. delivered" funnel distinction must be documented or fixed before launch

### Phase 6: Prospect Pipeline Stage View

**Rationale:** Depends on all prior phases being complete so the derived pipeline stages reflect real state. Pure UI + query enrichment — no schema changes. Framer Motion `Reorder` from existing stack handles any queue reordering needed.
**Delivers:** Pipeline stage derivation computed from existing DB fields (no new columns); stage pills on `admin/prospects` list page; scrollable funnel summary showing counts per stage on dashboard
**Addresses:** "Prospect pipeline stage as visible status" table stakes; "clear stage transition triggers" from FEATURES.md
**Uses:** Tailwind custom grid/flex layout (no chart library); `ProspectStatus` enum from Prisma (no client-side state machine)
**Avoids:** Kanban board anti-feature — list view with stage chip filter is the correct pattern at current prospect volumes (20-50 active); recharts/chart.js are unnecessary for a counts display

### Phase Ordering Rationale

- Phases 1-2 are backend-only and can ship to production without user-visible changes — they enable the remaining phases without disrupting existing flows
- Phase 3 can be developed in parallel with Phase 4 after Phase 2 completes (both depend on Phase 2 but not on each other)
- Phase 5 must follow Phase 4 — building the send queue before the quality gate means the queue would surface non-quality-gated items
- Phase 6 can be developed in parallel with Phase 5 (no mutual dependency) but is lowest priority — it's observational; the other phases are operational

### Research Flags

Phases requiring deeper research or explicit validation during planning:

- **Phase 3 (Client Hypothesis Validation UI):** Novel UX pattern with no direct comparator. Design the "Does this apply to your team?" card interaction carefully. Plan a real prospect validation session after first deploy before building v2.x features that depend on this signal.
- **Phase 5 (Unified Send Queue):** The idempotency guard requires careful implementation. Research tRPC mutation middleware patterns before implementation — there may be a cleaner way to apply the `draft → sending` atomic claim across both `approveDraft` and `bulkApproveLowRisk` without duplicating the guard logic.

Phases with well-documented patterns (standard implementation, skip research-phase):

- **Phase 1 (Research Quality Gate Backend):** Schema additions + tRPC procedures are well-understood; ARCHITECTURE.md provides full implementation including exact procedure signatures
- **Phase 2 (Hypothesis Flow Redesign Backend):** PostgreSQL `ADD VALUE` for enum extension is safe and straightforward; ARCHITECTURE.md provides exact `validateHypothesis` implementation
- **Phase 4 (Quality Gate UI Admin):** Component additions to existing page shells; ARCHITECTURE.md provides component boundaries and wire-up points
- **Phase 6 (Pipeline Stage View):** Pipeline stage derivation logic is fully specified in ARCHITECTURE.md; Tailwind column layout from STACK.md is explicit

---

## Confidence Assessment

| Area         | Confidence  | Notes                                                                                                                                                           |
| ------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack        | HIGH        | All capabilities covered by existing dependencies; no new packages for core features; version compatibility verified against package.json                       |
| Features     | MEDIUM-HIGH | Table stakes HIGH (established industry patterns from Outreach, Salesloft, HubSpot, Clay); client-side hypothesis validation LOW (novel, no direct comparators) |
| Architecture | HIGH        | Based on direct codebase analysis — schema, all relevant routers, and page implementations read directly                                                        |
| Pitfalls     | HIGH        | Derived from actual code patterns in outreach.ts, admin.ts, campaigns.ts, and voor/ page, not theoretical risks                                                 |

**Overall confidence:** HIGH for architecture and implementation path. MEDIUM for the hypothesis validation UX (novel territory with no industry playbook).

### Gaps to Address

- **Research quality thresholds need empirical validation:** The amber/green thresholds (8+ evidence items for green, 4+ with confidenceScore >= 0.6) are derived from industry patterns, not Qualifai's actual data. After Phase 1 ships, run the scoring function against existing prospects and adjust thresholds before surfacing the indicator to admin.
- **"Proceed anyway" retry counter (maxRetries: 3) needs calibration:** 3 retry attempts before auto-forcing proceed is a reasonable starting point but may need adjustment for Dutch SMB evidence patterns. Make it configurable (env var or admin setting) rather than hard-coded.
- **Resend delivery webhooks are not wired:** Funnel counts currently measure "send attempted" not "delivered." This gap is documented in PITFALLS.md as acceptable short-term if labeled correctly in the UI. Prioritize in v2.1 if campaign reporting accuracy becomes important.
- **Pages to remove need deep-link audit first:** ARCHITECTURE.md rates removal of `/admin/hypotheses`, `/admin/research`, `/admin/briefs` as MEDIUM confidence — not in nav but may have incoming links from prospect detail or other admin pages. Verify all deep links before deletion in Phase 4.
- **Hash-based deep linking to prospect detail sections is broken:** Phase 13 shipped with `useState('evidence')` as default — `#analysis` in URL does not open the Analysis section on load. Low priority but should be addressed when restructuring the prospect detail page in Phase 4.

---

## Sources

### Primary (HIGH confidence — direct codebase reads)

- `prisma/schema.prisma` — `ProspectStatus`, `ResearchStatus`, `HypothesisStatus`, `OutreachLog`, `ResearchRun` models
- `server/routers/outreach.ts` — `approveDraft`, `bulkApproveLowRisk`, `getTouchTaskQueue`, `getDecisionInbox`
- `server/routers/admin.ts` — `getActionQueue`, `listProspects`, `getDashboardStats`
- `server/routers/research.ts` — `startRun`, `retryRun`, `getRun`
- `server/routers/hypotheses.ts` — `setStatus`, `listByProspect`
- `server/routers/campaigns.ts` — `getCampaignFunnel`, funnel stage derivation
- `app/voor/[slug]/dashboard-client.tsx` — hypothesis filter, display logic
- `app/admin/page.tsx` — current action queue implementation
- `app/admin/outreach/page.tsx` — current 4-tab outreach page
- `app/admin/prospects/[id]/page.tsx` — hidden section pattern
- `package.json` — installed dependency versions
- `.planning/MILESTONES.md`, `.planning/PROJECT.md`, `.planning/ROADMAP.md`

### Secondary (MEDIUM confidence — industry research)

- Outreach.io Universal Taskflow — task queue play mode pattern
- Salesloft AI draft write-ahead pattern — queue-first daily processing
- HubSpot Breeze Prospecting Agent — research quality gating, review-before-send
- Instantly.ai HITL mode — calibration-before-autopilot
- Clay.com waterfall enrichment — quality scoring and "proceed with warning" approach
- TanStack Query v5 docs — `refetchInterval`, `mutation.variables`, `useMutationState`
- tRPC v11 subscriptions docs — SSE pattern documented for future reference (not implemented in v2.0)
- framer-motion Reorder docs — single-column limitation confirmed
- dnd-kit npm — `@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@10.0.0` versions

### Tertiary (LOW confidence — novel patterns requiring validation)

- Client-side hypothesis validation UX: no direct comparator found in industry research. Framing and interaction design are original to Qualifai — treat as design hypothesis requiring real-user testing before v2.x features depend on this signal.

---

_Research completed: 2026-02-22_
_Ready for roadmap: yes_

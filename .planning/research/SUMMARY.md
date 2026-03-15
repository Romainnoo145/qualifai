# Project Research Summary

**Project:** Qualifai — v8.0 Unified Outreach Pipeline
**Domain:** B2B sales engine — AI-driven outreach with evidence-diff signal detection
**Researched:** 2026-03-16
**Confidence:** HIGH

## Executive Summary

Qualifai v8.0 is not a greenfield build — it is a unification of two parallel email systems that grew independently. The existing codebase contains a template-based intro email path (WorkflowLossMap → assets router) and an AI-driven path (generateIntroEmail / generateFollowUp / generateSignalEmail via Gemini Flash). Both write to different staging areas, forcing the admin through two screens and two clicks to get a draft into the queue. The research confirms that every capability needed for a unified pipeline already exists in production code; the work is plumbing, cleanup, and one genuinely new module (signal diff-detection).

The recommended approach is a bottom-up build: enrich the AI context layer first (non-breaking), then consolidate the intro email creation path into a single atomic operation, then implement signal detection from evidence diffs (the only truly new logic), then wire the refresh cron to trigger detection, and finally clean up bidirectional links and dead code. This ordering respects the dependency chain — every downstream consumer (draft queue, prospect detail, automation rules) is already correct once the data feeding it is correct. The critical insight from FEATURES.md is that the Signal table being empty is the single failure point for the entire automation layer: `processSignal()`, `AUTOMATION_RULES`, and the draft queue all work today. Fix upstream detection and everything flows.

The primary risks are operational, not architectural: signal dedup must be built into the detection function from the start or the admin inbox floods with stale repeated drafts; the `classifyDraftRisk` function must be updated before bulk-approve is exposed to new draft types or all AI-generated drafts will be locked at `review` tier; and dead code removal must be preceded by a full grep audit of `emailBodyHtml/Text` references or the asset router silently sends empty emails. All three risks have concrete prevention steps documented in PITFALLS.md and are addressable within their respective phases.

## Key Findings

### Recommended Stack

v8.0 requires zero new npm dependencies. The entire capability set is achievable within the existing stack: `@google/generative-ai` 0.24.1 for AI generation (already in production), Prisma 7.3.0 for schema additions, Next.js 16 cron routes for automation triggers. The deliberate no-new-packages constraint is grounded in project reality — 34k LOC TypeScript with a clean established stack at single-user SaaS scale. Adding BullMQ, deep-diff, or any queue infrastructure would be over-engineering for a system processing fewer than 10 signals per day across 7–50 prospects.

The one schema change needed is adding `prospectId String?` to `OutreachLog` for single-hop prospect filtering in the draft queue. All other additions are pure TypeScript logic with no schema impact.

**Core technologies:**

- `@google/generative-ai` (Gemini 2.0 Flash): all email generation — already production-tested for intro, follow-up, and signal emails
- Prisma + PostgreSQL: data layer for signals, outreach logs, evidence items — no ORM or schema overhaul needed
- Next.js cron routes (`/api/internal/cron/*`): automation triggers — cadence-sweep and research-refresh already running
- Pure TypeScript diff logic: signal detection from evidence arrays — domain-specific semantics make generic diff libraries the wrong abstraction

### Expected Features

**Must have (table stakes) — v8.0:**

- Single draft queue showing all outreach types (intro, follow-up, signal-triggered) — currently two disconnected systems
- Signal detection from evidence diffs — Signal table is always empty; this unblocks all automation
- AI follow-up copy generated at step creation, not deferred to cron — current cadence has empty placeholder body bug
- Dead code cleanup (WorkflowLossMap email fields + template path) — prerequisite for queue unification clarity
- Signal-to-draft pipeline closed end-to-end — processSignal() works; upstream Signal creation is the gap
- Prospect detail showing current draft status with link to queue — OutreachPreviewSection shows stale template content today

**Should have (competitive) — v8.1 after validation:**

- Evidence-backed follow-up prompts (hypothesis titles + analysis narrative in OutreachContext)
- Signal type badge on draft queue rows showing trigger reason
- Per-prospect outreach timeline with sent dates

**Defer (v9+):**

- Configurable automation rules in UI (DB-backed rules; hardcoded in rules.ts is acceptable at current scale)
- Signal confidence scoring
- Multi-prospect signal batching

### Architecture Approach

The target architecture collapses two parallel staging areas into one: every email draft (intro, follow-up, signal-triggered) creates an `OutreachLog(status=draft)` in a single atomic operation, and the admin reviews and sends from one queue. Two new modules are required — `lib/signals/detect.ts` (evidence diff detection) and `lib/outreach/generate-intro.ts` (evidence-backed intro creator replacing the two-step template path). Four existing modules are extended (generate-outreach.ts, outreach-prompts.ts, research-refresh.ts, automation/rules.ts). One module is partially deleted (workflow-engine.ts). The cadence engine (`lib/cadence/engine.ts`) and signal processor (`lib/automation/processor.ts`) are already architecturally correct and stay unchanged.

**Major components:**

1. `lib/signals/detect.ts` (NEW) — compares two ResearchRun evidence sets, emits aggregated Signal rows (max one per type per run-pair to prevent draft flooding)
2. `lib/outreach/generate-intro.ts` (NEW) — loads hypotheses + evidence from DB, builds enriched OutreachContext, calls generateIntroEmail(), creates OutreachSequence + OutreachStep + OutreachLog atomically
3. `lib/research-refresh.ts` (EXTEND) — hooks detectSignalsFromDiff() + processUnprocessedSignals() after each successful executeResearchRun()
4. `lib/ai/outreach-prompts.ts` (EXTEND) — adds optional evidence[] + hypotheses[] to OutreachContext interface (non-breaking; existing callers unaffected)
5. `outreach-preview-section.tsx` (REWRITE) — drops WorkflowLossMap email preview; queries OutreachLog drafts by prospect directly

### Critical Pitfalls

1. **Signal dedup fires on every refresh** — Before creating a Signal, check for an existing signal of the same type for this prospect within a configurable lookback window (30–90 days by signal type). Build into detectSignalsFromDiff() from the start, not as a retrospective cleanup.

2. **classifyDraftRisk blocks new draft types from bulk approve** — Update risk classification to recognize `cadence_draft` and `signal_draft` kinds; `low` tier must be achievable on AI generation flag + CTA presence alone, without requiring a WorkflowLossMap attachment.

3. **Dead code removal breaks asset router silently** — Run full grep for `emailBodyHtml`, `emailBodyText`, `emailSubject` before touching workflow-engine.ts. Prisma returns empty string (not a compile error) when fields exist in schema but generation code is removed.

4. **OutreachLog.metadata shape inconsistency** — Define a typed `OutreachLogMetadata` discriminated union with a `kind` field before writing any new queue rendering code. The existing `as any` cast pattern must not be extended to new draft types.

5. **processSignal duplicate drafts from concurrent runs** — Add atomic claim at start of processing: `updateMany({ where: { id, isProcessed: false } })`, check `count === 1` before proceeding. This is the established idempotency pattern already used elsewhere in the codebase.

## Implications for Roadmap

Based on research, the architecture file documents an authoritative 5-phase build order derived from the actual dependency graph. The roadmap should follow this closely.

### Phase 1: Evidence-Enriched AI Context

**Rationale:** Lowest-risk first; non-breaking interface extension that all downstream consumers depend on. Must exist before any email generation uses evidence data.
**Delivers:** `OutreachContext` with optional `evidence[]` + `hypotheses[]`; updated `buildIntroEmailPrompt()` incorporating evidence when present
**Addresses:** Foundation for evidence-backed follow-ups (v8.1 differentiator); improves intro email specificity immediately
**Avoids:** Pitfall 3 (generic follow-ups) — extension is additive, existing callers unaffected

### Phase 2: Unified AI Intro Draft Creator

**Rationale:** Collapses the two-step template path into a single atomic AI operation. Clears dual-system confusion before adding more draft types.
**Delivers:** `lib/outreach/generate-intro.ts`; rewired assets.generate mutation; rewritten outreach-preview-section.tsx; deletion of createWorkflowLossMapDraft()
**Addresses:** Single draft queue (table stakes); dead code cleanup (prerequisite for all following phases)
**Avoids:** Pitfall 6 (dead code removal breaks asset router) — grep audit before deletion; Pitfall 2 (double compliance footer) — audit send-email call sites in this phase

### Phase 3: Signal Diff Detector

**Rationale:** The single unblocking feature for all automation. processSignal() and AUTOMATION_RULES already work; Signal creation is the only gap.
**Delivers:** `lib/signals/detect.ts` with NEW_JOB_LISTING + HEADCOUNT_GROWTH detection; aggregation guard (max one signal per type per run-pair)
**Addresses:** Signal detection from evidence diffs (key differentiator); closes the automation loop
**Avoids:** Pitfall 4 (signals fire on every refresh) — dedup lookback window built in from the start; Pitfall 9 (duplicate drafts) — atomic claim guard

### Phase 4: Research Refresh Hook + Automation Rule

**Rationale:** Wires the detector into the existing cron trigger. Adds the missing NEW_JOB_LISTING automation rule. Makes the end-to-end signal → draft pipeline live.
**Delivers:** research-refresh.ts extended with post-run diff detection; NEW_JOB_LISTING rule in automation/rules.ts; E2E: research refresh → signal created → AI draft in queue
**Addresses:** Signal-to-draft pipeline closure (table stakes)
**Avoids:** Pitfall 1 (classifyDraftRisk blocks new drafts) — update risk classification before this phase exposes signal drafts to bulk approve

### Phase 5: Draft Queue Bidirectional Linking + Cleanup

**Rationale:** Polish and dead code removal after the core pipeline is validated with real data.
**Delivers:** Prospect name + link on each draft card; draft count badge + queue link on prospect detail; final removal of unused WorkflowLossMap email write paths
**Addresses:** Prospect detail outreach status (table stakes); bidirectional draft-to-prospect navigation
**Avoids:** Pitfall 8 (wrong OutreachLog query) — write `getOutreachLogsForProspect()` utility used everywhere; Pitfall 5 (metadata shape inconsistency) — typed discriminated union created in this phase

### Phase Ordering Rationale

- Context extension (Phase 1) before all consumers (Phases 2–4) — non-breaking and unblocks richer prompts throughout the pipeline
- Template cleanup (Phase 2) before new draft types (Phases 3–4) — avoids layering new logic on top of a parallel system that is being removed
- Detection before wiring (Phase 3 before 4) — signal detector is unit-testable in isolation; cron wiring only after detector is verified correct
- Bidirectional linking last (Phase 5) — depends on all draft types being stable and confirmed in queue

### Research Flags

Phases with standard patterns (no additional research needed):

- **Phase 1:** OutreachContext extension is a well-understood TypeScript interface addition; Gemini Flash prompt structure is established
- **Phase 2:** Prisma atomic create pattern is established; generateIntroEmail() is production-tested; deletion is mechanical after grep audit
- **Phase 4:** Cron extension pattern already exists in research-refresh.ts; automation rule addition is a 10-line change
- **Phase 5:** UI linking is straightforward; dead code deletion is mechanical

Phases warranting a validation check before implementation:

- **Phase 3:** Signal diff detection has domain-specific edge cases — EvidenceItems are fresh extractions per run, not deduplicated by ID. Diff must be by content/sourceType pattern, not PK. Validate the algorithm against the Nedri 83-item evidence set before committing to the full detection logic. If TECHNOLOGY_ADOPTION false-positive rate is high, defer it to v8.1 and ship only NEW_JOB_LISTING + HEADCOUNT_GROWTH in v8.0.

## Confidence Assessment

| Area         | Confidence | Notes                                                                                                         |
| ------------ | ---------- | ------------------------------------------------------------------------------------------------------------- |
| Stack        | HIGH       | All findings from direct codebase analysis; no external packages to evaluate; zero ambiguity                  |
| Features     | HIGH       | First-party codebase analysis identifies exact gaps with file + line references; no user-behavior speculation |
| Architecture | HIGH       | Full codebase read; build order derived from actual dependency graph in existing production code              |
| Pitfalls     | HIGH       | All pitfalls traced to specific file paths and line numbers; no generic guesses                               |

**Overall confidence:** HIGH

### Gaps to Address

- **Signal diff algorithm edge cases:** TECHNOLOGY_ADOPTION detection is the least precise signal type (no clear sourceType tag; relies on text pattern matching across snippets). Validate with a real evidence set (Nedri 83 items) before Phase 3 implementation. Defer TECHNOLOGY_ADOPTION to v8.1 if false-positive rate is unacceptable.
- **Heijmans research run state:** MEMORY.md notes Heijmans completed with analysis-v2 data. Confirm this prospect has two completed ResearchRun records before using as the E2E test candidate for Phase 4 validation.
- **OutreachContext evidence token budget:** Adding evidence[] to follow-up prompts risks prompt bloat. PITFALLS.md recommends capping at ~300 tokens; this limit needs empirical validation against Gemini Flash output quality during Phase 1 implementation.

## Sources

### Primary (HIGH confidence)

- Direct codebase analysis: `prisma/schema.prisma`, `lib/ai/generate-outreach.ts`, `lib/ai/outreach-prompts.ts`, `lib/automation/processor.ts`, `lib/automation/rules.ts`, `lib/cadence/engine.ts`, `lib/research-refresh.ts`, `lib/workflow-engine.ts` — architecture and pitfall findings
- Direct codebase analysis: `server/routers/assets.ts`, `server/routers/outreach.ts`, `app/admin/outreach/page.tsx`, `components/features/prospects/outreach-preview-section.tsx` — feature gap and UI findings
- Direct codebase analysis: `app/api/internal/cron/cadence-sweep/route.ts`, `app/api/internal/cron/research-refresh/route.ts` — cron architecture
- Project memory: `MEMORY.md` — known tech debt (tRPC v11 inference gaps, metadata as any, idempotency pattern already established)
- npm registry: `@google/generative-ai` 0.24.1 verified current (March 2026)

### Secondary (N/A)

No external sources required — v8.0 is an internal architecture milestone with all context derivable from the existing codebase.

---

_Research completed: 2026-03-16_
_Ready for roadmap: yes_

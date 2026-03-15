# Technology Stack — v8.0 Unified Outreach Pipeline

**Project:** Qualifai — v8.0 milestone additions
**Researched:** 2026-03-16
**Scope:** NEW capabilities only. Existing validated stack is NOT re-researched.
**Confidence:** HIGH — all findings grounded in existing codebase analysis.

---

## Context: What Already Exists

Before listing what to add, this is what the codebase already has that v8.0 builds on:

| Capability                                | Where                                             | Status                                |
| ----------------------------------------- | ------------------------------------------------- | ------------------------------------- |
| `generateIntroEmail()`                    | `lib/ai/generate-outreach.ts`                     | Production, Gemini 2.0 Flash          |
| `generateFollowUp()`                      | `lib/ai/generate-outreach.ts`                     | Production, Gemini 2.0 Flash          |
| `generateSignalEmail()`                   | `lib/ai/generate-outreach.ts`                     | Production, Gemini 2.0 Flash          |
| `OutreachLog` model                       | `prisma/schema.prisma`                            | Has draft/sent/failed status          |
| `OutreachSequence` + `OutreachStep`       | `prisma/schema.prisma`                            | Cadence tracking exists               |
| `Signal` model + `SignalType` enum        | `prisma/schema.prisma`                            | Schema exists, never populated        |
| `processUnprocessedSignals()`             | `lib/automation/processor.ts`                     | Wired, never triggered with real data |
| `AUTOMATION_RULES`                        | `lib/automation/rules.ts`                         | Hardcoded, covers 4 signal types      |
| Cadence sweep cron                        | `app/api/internal/cron/cadence-sweep/route.ts`    | Running, processes `nextStepReadyAt`  |
| Research refresh cron                     | `app/api/internal/cron/research-refresh/route.ts` | Running every 14 days                 |
| `evaluateCadence()`                       | `lib/cadence/engine.ts`                           | Creates next OutreachStep in DB       |
| `WorkflowLossMap` model with email fields | `prisma/schema.prisma`                            | Template-based, to be replaced        |

---

## New Stack for v8.0

### Zero New npm Dependencies

v8.0 requires no new npm packages. Every capability needed is either already in the stack or can be implemented with pure TypeScript against existing infrastructure.

This is a deliberate constraint. The project is 34k LOC TypeScript with a clean established stack. Adding packages for features that are pure data-transformation logic creates unnecessary maintenance surface.

---

## New Capabilities and Their Implementation Approach

### 1. Signal Diff-Detection

**What:** Compare current research run's `EvidenceItem` set against the previous run's items. Detect changes in job listings, headcount mentions, funding mentions, technology references. Emit `Signal` records.

**Implementation:** Pure TypeScript function `lib/signals/diff-detector.ts`.

**How it works:**

- Takes two arrays of `EvidenceItem` from consecutive research runs for the same prospect
- Groups items by `workflowTag` and `sourceType`
- Detects new items in `CAREERS` / `JOB_BOARD` source types → emits `NEW_JOB_LISTING` signal
- Detects change in `employeeCount` or headcount language in snippets → emits `HEADCOUNT_GROWTH` signal
- Detects new items in `NEWS` with funding keywords (`financiering`, `funding`, `investering`, `serie A`) → emits `FUNDING_EVENT` signal
- Detects new technology names in evidence snippets not present in prior run → emits `TECHNOLOGY_ADOPTION` signal

**Input:** `{ previousRun: ResearchRun & { evidenceItems: EvidenceItem[] }, currentRun: ResearchRun & { evidenceItems: EvidenceItem[] }, prospect: Prospect }`

**Output:** `Signal[]` written to DB via Prisma.

**Integration point:** Called at the end of `runResearchRefreshSweep()` in `lib/research-refresh.ts` — after new run completes, load previous completed run, diff, write signals.

**Why pure TypeScript, not a library:**

- Candidate packages (`deep-diff`, `jsdiff`) operate on object trees or text, not on domain-typed evidence arrays
- The semantics are domain-specific: "more career page items = hiring signal" is not generic diff logic
- Zero runtime dependency, 100% testable with vitest mocks

**Confidence:** HIGH — straightforward array comparison, no external calls.

---

### 2. Unified Draft Queue

**What:** All outreach drafts — intro emails, follow-ups, signal-triggered emails — surface in a single query on the outreach page, linked to their prospect.

**Implementation:** Schema addition + tRPC query change. No new package.

**The problem:** `OutreachLog` is linked to `Contact` → `Prospect` (two hops). The outreach page currently filters by contact, making it hard to show all drafts with their prospect context. Signal-triggered drafts created by `processSignal()` write to `OutreachLog` but are disconnected from `OutreachSequence`.

**Schema change:** Add `prospectId String?` directly to `OutreachLog` for fast single-hop filtering and prospect-context display. Add index `@@index([prospectId, status])`.

**tRPC query change:** `outreach.listDrafts` procedure fetches `OutreachLog` where `status = 'draft'`, ordered by `createdAt DESC`, with `include: { contact: { include: { prospect: true } } }`. Renders prospect name/domain alongside draft subject.

**No new package needed.** This is a Prisma query shape change.

**Confidence:** HIGH — Prisma supports this query pattern directly.

---

### 3. Multi-Step AI Cadence Follow-Ups in Draft Queue

**What:** After an intro email is sent, the cadence engine schedules a follow-up. Currently `evaluateCadence()` creates an `OutreachStep` (in the sequence model). The new behavior: AI-generate the follow-up email at scheduling time and write it to `OutreachLog` as a draft, so it appears in the unified draft queue for review before send.

**Implementation:** Modify `evaluateCadence()` in `lib/cadence/engine.ts` to call `generateFollowUp()` when channel is `email` and write the result to `OutreachLog` as a draft. Cross-link: set `outreachLogId` on `OutreachStep`.

**The constraint:** `generateFollowUp()` already exists and takes `OutreachContext`. The cadence engine already has prospect/contact context. This is a plumbing change, not a new capability.

**Draft queue appearance:** Follow-up drafts get `type: 'FOLLOW_UP'` in `OutreachLog`, surfacing alongside intro drafts with their step number visible from `OutreachStep.stepOrder`.

**No new package needed.** All generation logic is in `lib/ai/generate-outreach.ts`.

**Confidence:** HIGH — `generateFollowUp()` is production-tested.

---

### 4. Signal → Draft Auto-Connection

**What:** When `processSignal()` creates a `Signal` and triggers `generateSignalEmail()`, the resulting `OutreachLog` draft needs to surface in the unified queue with the signal context visible.

**Implementation:** `processSignal()` in `lib/automation/processor.ts` already writes to `OutreachLog`. Add `prospectId` to that write (from `contact.prospectId`). The signal type and title go in `OutreachLog.metadata`. The draft queue UI reads `metadata.signalType` to render a signal badge.

**No new package needed.** Pure data plumbing.

**Confidence:** HIGH.

---

### 5. Research-Run Diff Trigger

**What:** The research refresh cron needs to trigger diff-detection after a new run completes.

**Implementation:** Extend `runResearchRefreshSweep()` to call `detectResearchDiff(db, prospectId)` after each successful run execution. `detectResearchDiff` loads the two most recent completed runs for the prospect, calls the diff-detector, writes signals, then calls `processUnprocessedSignals()` to turn signals into drafts.

**No new package needed.** Orchestration of existing functions.

**Confidence:** HIGH — the `collectRefreshCandidates` query pattern already handles run selection.

---

## Dead Code to Remove

These are removed as part of v8.0, reducing surface area:

| Code                                                              | Location                           | Replacement                                          |
| ----------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------- |
| `WorkflowLossMap.emailSubject/emailBodyText/emailBodyHtml` fields | `prisma/schema.prisma`             | `generateIntroEmail()` pipeline                      |
| Template-based email generation in `lib/workflow-engine.ts`       | CTA string building for email copy | AI-generated email via `OutreachContext`             |
| Legacy `generateMasterAnalysis v1` calls                          | Anywhere referencing `analysis-v1` | `ProspectAnalysis.version = 'analysis-v2'` path only |
| `Signal` processing triggered manually from UI                    | outreach router                    | Automatic trigger from research refresh              |

Note: Removing `WorkflowLossMap` email fields requires a Prisma migration (column drop). The model itself stays — it holds the markdown/HTML/PDF loss map which is still used on the discover page.

---

## Version Compatibility

No version bumps needed. All additions work within the current package versions:

| Package                 | Current                      | Note                                        |
| ----------------------- | ---------------------------- | ------------------------------------------- |
| `@google/generative-ai` | `^0.24.1` (pinned to 0.24.1) | Already used for all outreach generation    |
| `prisma`                | `^7.3.0`                     | Schema additions are standard Prisma fields |
| `zod`                   | `^4.3.6`                     | Signal schema validation if needed          |
| `next`                  | `16.1.6`                     | Cron routes use standard `app/api` pattern  |

---

## What NOT to Add

| Avoid                                | Why                                                                                | Use Instead                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `bull` / `bullmq` / Redis queues     | Adds Redis dependency; signal volumes are <10/day; cron sweep is sufficient        | Existing cron + `nextStepReadyAt` pattern                           |
| `node-diff` / `deep-diff` / `jsdiff` | Generic object diff is wrong abstraction for domain-typed evidence comparison      | Custom `detectSignals()` with typed arrays                          |
| `openai` for signal embeddings       | No semantic similarity needed; keyword matching on evidence snippets is sufficient | String includes / regex on `snippet` field                          |
| LangChain / LlamaIndex for cadence   | Over-engineered for a 4-step linear sequence                                       | Existing `evaluateCadence()` + `OutreachStep`                       |
| Separate message queue (SQS, Kafka)  | Single-user SaaS at <50 prospects; no horizontal scale requirement                 | PostgreSQL as queue via `isProcessed` flag                          |
| Webhook service (Svix, Hookdeck)     | No external webhooks needed for signal detection                                   | Internal cron trigger                                               |
| `date-fns` / `dayjs`                 | Would add package for what's 3 lines of vanilla JS                                 | Native `Date` arithmetic (pattern already used throughout codebase) |

---

## Installation

No new packages to install.

```bash
# No npm install needed for v8.0

# Schema migration (after adding prospectId to OutreachLog):
npx prisma migrate dev --name add-prospect-id-to-outreach-log
```

---

## Integration Map

```
research-refresh cron
  └── runResearchRefreshSweep()
        └── executeResearchRun()  [per prospect]
              └── [on completion] detectResearchDiff(db, prospectId)
                    ├── loads previous + current EvidenceItems
                    ├── emits Signal records to DB
                    └── processUnprocessedSignals()
                          └── processSignal()
                                ├── findMatchingRules(signalType)
                                ├── generateSignalEmail(ctx)  [Gemini 2.0 Flash]
                                └── OutreachLog.create({ status: 'draft', prospectId })

cadence-sweep cron
  └── processDueCadenceSteps()
        └── evaluateCadence()  [per due step]
              ├── [if channel = email] generateFollowUp(ctx)  [Gemini 2.0 Flash]
              ├── OutreachLog.create({ type: 'FOLLOW_UP', status: 'draft', prospectId })
              └── OutreachStep.update({ outreachLogId, nextStepReadyAt })

outreach page
  └── outreach.listDrafts tRPC query
        └── OutreachLog.findMany({ status: 'draft', orderBy: createdAt DESC })
              └── include: { contact: { include: { prospect: true } } }
                    → renders prospect name, domain, signal badge, step number
```

---

## Sources

- Codebase analysis: `prisma/schema.prisma`, `lib/ai/generate-outreach.ts`, `lib/automation/processor.ts`, `lib/cadence/engine.ts`, `lib/research-refresh.ts` — HIGH confidence (direct code inspection)
- npm registry: `@google/generative-ai` latest = 0.24.1 (verified March 2026) — HIGH confidence
- Architecture decision: no new packages — grounded in project constraints (established stack, single-user SaaS, <50 prospects) — HIGH confidence

---

_Stack research for: v8.0 Unified Outreach Pipeline_
_Researched: 2026-03-16_

# Architecture Research

**Domain:** Unified outreach pipeline with signal detection — v8.0 milestone
**Researched:** 2026-03-16
**Confidence:** HIGH (full codebase read, no external research needed — architecture derived from existing code)

---

## System Overview: Current State (Pre-v8.0)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Admin UI (Next.js 16)                           │
├───────────────────────┬─────────────────────────────────────────────────┤
│  Prospect Detail      │  /admin/outreach (Outreach Page)                │
│  outreach-preview-    │  DraftQueue  │  SentHistory  │  Settings        │
│  section.tsx          │              │               │                  │
│  assets.generate      │  getDecisionInbox (status=draft)                │
│  assets.queueOutreach │  Process Signals button                         │
│  Draft                │                                                  │
└───────────────────────┴─────────────────────────────────────────────────┘
            ↕ tRPC v11                          ↕ tRPC v11
┌──────────────────────────────────────────────────────────────────────────┐
│                         Server Routers                                    │
├─────────────────────────┬────────────────────────────────────────────────┤
│  assets.ts              │  outreach.ts                                   │
│  generate → template    │  previewEmail (AI, ad-hoc)                     │
│  (createWorkflow        │  sendDraft → Resend                            │
│   LossMapDraft)         │  getDecisionInbox → status=draft               │
│  queueOutreachDraft     │  processSignals → processUnprocessed           │
│  → Sequence + Step +    │    Signals()                                   │
│    OutreachLog(draft)   │                                                │
└─────────────────────────┴────────────────────────────────────────────────┘
            ↕ Prisma                            ↕ Prisma
┌──────────────────────────────────────────────────────────────────────────┐
│                       Business Logic Layer                                │
├─────────────┬──────────────┬──────────────┬─────────────────────────────┤
│ workflow-   │ ai/generate- │ automation/  │ cadence/engine.ts           │
│ engine.ts   │ outreach.ts  │ processor.ts │ processDueCadenceSteps()    │
│ (template:  │ generateIntro│ processSignal│ → generateFollowUp() AI     │
│ createWf    │ Email()      │ () reads     │ → OutreachLog(FOLLOW_UP)    │
│ LossMapDraft│ generateFollo│ Signal rows  │   on cron cadence-sweep     │
│ )           │ wUp()        │ → AI draft   │                             │
│             │ generateSigna│              │                             │
│             │ lEmail()     │              │                             │
└─────────────┴──────────────┴──────────────┴─────────────────────────────┘
            ↕ Prisma
┌──────────────────────────────────────────────────────────────────────────┐
│                       Data Layer (PostgreSQL via Prisma)                  │
├──────────────┬─────────────┬────────────────┬───────────────────────────┤
│ OutreachLog  │ OutreachSeq  │ Signal          │ EvidenceItem             │
│ (status=draft│ uence +     │ (isProcessed=   │ (sourceType, snippet,    │
│ /sent/retry) │ OutreachStep │ false → queue)  │  confidenceScore)        │
└──────────────┴─────────────┴────────────────┴───────────────────────────┘
            ↕
┌──────────────────────────────────────────────────────────────────────────┐
│                       Cron Layer                                          │
├──────────────────────────┬───────────────────────────────────────────────┤
│ /api/internal/cron/      │ /api/internal/cron/research-refresh           │
│ cadence-sweep            │ runResearchRefreshSweep() → executeResearch   │
│ processDueCadence        │ Run() every 14 days (staleDays env var)       │
│ Steps() → AI follow-up   │ Currently: re-runs pipeline, NO diff/signal   │
│ drafts in OutreachLog    │ detection after completion                    │
└──────────────────────────┴───────────────────────────────────────────────┘
```

### Component Responsibilities

| Component                      | Current Responsibility                                                                                                                       | v8.0 Change                                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `server/routers/assets.ts`     | Template-based email via `createWorkflowLossMapDraft()`, stores to `WorkflowLossMap`, second-step `queueOutreachDraft` creates `OutreachLog` | **Replace**: `generate` mutation calls `generateIntroEmail()` directly; no intermediate `WorkflowLossMap` email body         |
| `lib/workflow-engine.ts`       | `createWorkflowLossMapDraft()` assembles template email from hypotheses/opportunities                                                        | **Partial dead code**: delete `createWorkflowLossMapDraft()` + `createOutreachSequenceSteps()`; keep `createCallPrepDraft()` |
| `lib/ai/generate-outreach.ts`  | `generateIntroEmail()`, `generateFollowUp()`, `generateSignalEmail()` — Gemini Flash                                                         | **Extend**: accept richer `OutreachContext` with evidence snippets                                                           |
| `lib/ai/outreach-prompts.ts`   | `OutreachContext` interface, prompt builders                                                                                                 | **Extend**: add optional `evidence[]` + `hypotheses[]` to context; update `buildIntroEmailPrompt()`                          |
| `lib/automation/processor.ts`  | `processSignal()` reads existing `Signal` rows → generates AI draft → `OutreachLog`                                                          | **Stays**: already correct architecture                                                                                      |
| `lib/automation/rules.ts`      | Hardcoded `AUTOMATION_RULES` matching `SignalType` to email type                                                                             | **Extend**: add `NEW_JOB_LISTING` and `HEADCOUNT_GROWTH` rules                                                               |
| `lib/cadence/engine.ts`        | Cron-driven AI follow-up drafts after a send                                                                                                 | **Stays**: already AI-driven, no changes needed                                                                              |
| `lib/research-refresh.ts`      | Re-runs evidence pipeline on stale prospects                                                                                                 | **Extend**: call new `detectSignalsFromDiff()` + `processUnprocessedSignals()` after each successful run                     |
| `outreach-preview-section.tsx` | Shows `WorkflowLossMap` email body (template), "Generate" + "Queue Draft" two-step buttons                                                   | **Rewrite**: query `OutreachLog` drafts for prospect directly; single "Generate Draft" button                                |
| `/admin/outreach` page         | Shows all `status=draft` OutreachLogs — no prospect link on each card                                                                        | **Add**: prospect name + link to `/admin/prospects/[id]` on each draft card                                                  |

---

## New Components Required

### lib/signals/detect.ts — Evidence Diff Detector

**What:** Compares two `ResearchRun` evidence sets to emit `Signal` rows for changes that warrant outreach.

**Inputs:**

- `previousRunId: string`
- `newRunId: string`
- `prospectId: string`
- `db: PrismaClient`

**Detection logic per signal type:**

```
NEW_JOB_LISTING:
  EvidenceItems with sourceType=CAREERS in newRun
  not present (by title/URL match) in previousRun
  → ONE aggregated Signal per prospect (avoid N drafts for N jobs)
    title: "3 nieuwe vacatures gedetecteerd"
    metadata: { count, titles[] }

HEADCOUNT_GROWTH:
  Employee range/count in newRun LINKEDIN/REGISTRY evidence > previousRun
  → Signal(signalType=HEADCOUNT_GROWTH, ...)

TECHNOLOGY_ADOPTION:
  Tech mentions in newRun evidence absent from previousRun
  → Signal(signalType=TECHNOLOGY_ADOPTION, ...)
```

**Output:** Array of created `Signal.id` rows, zero to three per run pair.

**Key design decision:** Aggregate same-type signals per prospect per refresh cycle into ONE signal row. Prevents draft flooding (5 new jobs = 5 identical draft emails). Rule fires once per signal, not per evidence item.

### lib/outreach/generate-intro.ts — Evidence-Backed Intro Creator

**What:** Single function that loads research context from DB, builds enriched `OutreachContext`, calls `generateIntroEmail()`, and creates `OutreachSequence + OutreachStep + OutreachLog` in one atomic operation.

Replaces the two-step `assets.generate` (template) + `assets.queueOutreachDraft` path.

**Inputs:**

- `prospectId: string`
- `contactId: string`
- `runId: string`
- `db: PrismaClient`

**Data it loads from DB:**

- `WorkflowHypothesis` (top 3 by confidenceScore, ACCEPTED/PENDING)
- `EvidenceItem` (top 5 by confidenceScore, isApproved=true)
- `ProofMatch` titles
- Project sender settings from `Project.metadata.outreach`

**Output:** `{ sequenceId, draftId }` — same shape as current `queueOutreachDraft`.

---

## Recommended Project Structure for v8.0

```
lib/
├── ai/
│   ├── generate-outreach.ts     # EXTEND: richer OutreachContext with evidence[]
│   └── outreach-prompts.ts      # EXTEND: buildIntroEmailPrompt uses evidence data
├── automation/
│   ├── processor.ts             # STAYS: processSignal() already correct
│   └── rules.ts                 # EXTEND: add NEW_JOB_LISTING rule
├── cadence/
│   └── engine.ts                # STAYS: no changes
├── outreach/
│   ├── generate-intro.ts        # NEW: evidence-backed intro creator
│   └── send-email.ts            # STAYS
├── signals/
│   └── detect.ts                # NEW: diff-based signal detection
└── research-refresh.ts          # EXTEND: hook detectSignalsFromDiff() after run

server/routers/
├── assets.ts                    # MODIFY: generate → AI path; queueOutreachDraft → generate-intro.ts
└── outreach.ts                  # MODIFY: getDecisionInbox includes prospectId (data already there)

components/features/prospects/
└── outreach-preview-section.tsx # REWRITE: show OutreachLog drafts, not WorkflowLossMap body

app/admin/outreach/
└── page.tsx                     # MODIFY: add prospect link on each draft card
```

---

## Architectural Patterns

### Pattern 1: Single Funnel Into OutreachLog

**What:** Every email draft — intro, follow-up, signal-triggered — creates an `OutreachLog(status=draft)`. The admin reviews and sends from one queue. No parallel staging areas.

**Current violation:** `assets.generate` creates `WorkflowLossMap` with `emailBodyHtml/Text`. The draft queue (`getDecisionInbox`) queries `OutreachLog`, so template emails only appear there after `queueOutreachDraft` is called as a second step. Two screens, two clicks, two sources of truth.

**v8.0 fix:** Single mutation creates `OutreachLog` directly, AI-generated, in one step. `WorkflowLossMap` table kept for PDF/metrics but its `emailBody` fields become dead storage.

**Trade-off:** `WorkflowLossMap.emailBodyHtml/Text` become unused. Flag as legacy, delete in v9.0 cleanup. The PDF generation path (`persistWorkflowLossMapPdf`) is unaffected.

### Pattern 2: Research Refresh as Signal Source

**What:** The 14-day research refresh cycle re-runs the full evidence pipeline. Insert diff detection after each successful run. Changes in job listings, headcount, or tech emit `Signal` rows. Those signals route through the existing `processSignal()` → AI draft → `OutreachLog` path.

**Why this hook point is correct:** `runResearchRefreshSweep()` in `lib/research-refresh.ts` already has `latestRunId` (the prior run) and `result.run.id` (the new run) available in the same loop iteration. No new cron needed.

**Code shape:**

```typescript
// In runResearchRefreshSweep(), after successful executeResearchRun():
const previousRunId = candidate.latestRunId;
if (previousRunId && result.run.id) {
  await detectSignalsFromDiff({
    previousRunId,
    newRunId: result.run.id,
    prospectId: candidate.prospectId,
    db,
  });
  await processUnprocessedSignals(); // existing in lib/automation/processor.ts
}
```

### Pattern 3: OutreachContext Evidence Enrichment

**What:** Add optional `evidence[]` and `hypotheses[]` fields to `OutreachContext`. Non-breaking — existing callers that omit them get current behavior. `buildIntroEmailPrompt()` gains a pain-point section when evidence is present.

**Extension:**

```typescript
// lib/ai/outreach-prompts.ts — additive, non-breaking
export interface OutreachContext {
  contact: { firstName; lastName; jobTitle; seniority; department };
  company: {
    companyName;
    domain;
    industry;
    employeeRange;
    technologies;
    description;
  };
  signal?: { signalType; title; description };
  sender?: OutreachSender;
  discoverUrl?: string;
  // NEW optional fields:
  evidence?: Array<{
    sourceType: string; // 'LINKEDIN' | 'CAREERS' | 'REVIEWS' etc.
    workflowTag: string; // pain category
    snippet: string; // raw evidence text
    confidenceScore: number;
  }>;
  hypotheses?: Array<{
    title: string;
    description: string;
    confidenceScore: number;
  }>;
}
```

**Prompt impact:** `buildIntroEmailPrompt()` adds a section:
`"Bewijs uit eigen onderzoek: [top 3 pain points with evidence snippets]"`
The AI can then open with a specific reference rather than generic company description.

### Pattern 4: Signal Aggregation Guard

**What:** `detectSignalsFromDiff()` aggregates multiple same-type evidence changes per prospect per run into ONE `Signal` row. `AUTOMATION_RULES` then fires once, producing one draft.

**Why:** Without aggregation, 4 new job listings → 4 `NEW_JOB_LISTING` signals → 4 identical drafts. This flooding defeats the "autopilot with oversight" model.

**Implementation:** In `detectSignalsFromDiff()`, group detected changes by `SignalType`. Create at most one `Signal` per type per run-pair. Put count and titles in `Signal.metadata`.

---

## Data Flow

### Current: Two-Stage Template Intro Flow (to be replaced)

```
Admin: "Generate Email" on prospect detail
    ↓
assets.generate mutation
    ↓
createWorkflowLossMapDraft() — template, no AI
    ↓
WorkflowLossMap created (emailBodyHtml/Text stored here)
    ↓
[Admin previews in outreach-preview-section.tsx]
    ↓
Admin: "Queue Draft"
    ↓
assets.queueOutreachDraft mutation
    ↓
OutreachSequence + OutreachStep created
OutreachLog(INTRO_EMAIL, status=draft) created
    ↓
[Draft appears in /admin/outreach getDecisionInbox]
```

**Problem:** Two screens, two clicks, template email not AI-generated, preview and queue content may diverge.

### Target: Unified AI Intro Flow (v8.0)

```
Admin: "Generate Draft" on prospect detail
    ↓
outreach.generateIntroDraft mutation (or renamed assets.generate)
    ↓
Load hypotheses + evidence from DB
Build OutreachContext{evidence[], hypotheses[]}
generateIntroEmail(ctx) — AI, Gemini Flash
    ↓
OutreachSequence + OutreachStep + OutreachLog(INTRO_EMAIL, draft) ← ONE STEP
    ↓
[Draft appears immediately in /admin/outreach AND prospect detail shows pending draft]
```

### Target: Evidence-Diff Signal Flow (v8.0 new)

```
research-refresh cron fires (every 14 days)
    ↓
executeResearchRun() completes for prospect X
    ↓
detectSignalsFromDiff(previousRunId, newRunId, prospectId)
    ↓
Signal rows created:
  NEW_JOB_LISTING  — "3 nieuwe vacatures gedetecteerd"
  HEADCOUNT_GROWTH — "Headcount gegroeid van 50 naar 75"
    ↓
processUnprocessedSignals() → processSignal() per Signal
    ↓
findMatchingRules(signalType) → AUTOMATION_RULES
    ↓
generateSignalEmail(ctx) or generateIntroEmail(ctx)
    ↓
OutreachLog(SIGNAL_TRIGGERED, status=draft)
    ↓
[Draft appears in /admin/outreach queue with signal context]
```

### Target: Cadence Follow-Up Flow (unchanged — already correct)

```
Admin sends OutreachLog (draft → deleted after send)
    ↓
markSequenceStepAfterSend() → OutreachStep.status=SENT
evaluateCadence() → OutreachStep(triggeredBy=cadence, nextStepReadyAt=now+3d)
    ↓
[3 days later] cadence-sweep cron
    ↓
processDueCadenceSteps() → step.nextStepReadyAt <= now
    ↓
generateFollowUp(ctx, previousSubject) — AI
    ↓
OutreachLog(FOLLOW_UP, status=draft)
    ↓
[Draft appears in queue]
```

---

## Integration Points

### What Changes vs. What Stays

| Component                        | Status          | Notes                                                                                                 |
| -------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------- |
| `lib/ai/generate-outreach.ts`    | EXTEND          | Add evidence to context, non-breaking                                                                 |
| `lib/ai/outreach-prompts.ts`     | EXTEND          | New optional fields, update `buildIntroEmailPrompt()`                                                 |
| `lib/automation/processor.ts`    | STAYS           | Correct architecture today                                                                            |
| `lib/automation/rules.ts`        | EXTEND          | Add `NEW_JOB_LISTING` rule                                                                            |
| `lib/cadence/engine.ts`          | STAYS           | Already AI-driven and correct                                                                         |
| `lib/research-refresh.ts`        | EXTEND          | Hook diff detection + signal processing after successful run                                          |
| `lib/signals/detect.ts`          | NEW             | Diff-based signal detection from evidence sets                                                        |
| `lib/outreach/generate-intro.ts` | NEW             | Evidence-backed intro draft creator                                                                   |
| `server/routers/assets.ts`       | MODIFY          | `generate` → AI path via `generate-intro.ts`                                                          |
| `server/routers/outreach.ts`     | MINOR MODIFY    | `getDecisionInbox` already has prospect data; UI only                                                 |
| `outreach-preview-section.tsx`   | REWRITE         | Drop `WorkflowLossMap` email preview; show `OutreachLog` drafts                                       |
| `app/admin/outreach/page.tsx`    | MODIFY          | Add prospect link per draft card                                                                      |
| `lib/workflow-engine.ts`         | PARTIAL DELETE  | Remove `createWorkflowLossMapDraft()` + `createOutreachSequenceSteps()`; keep `createCallPrepDraft()` |
| `WorkflowLossMap` model          | SOFT DEPRECATED | Keep PDF/metrics fields; stop writing `emailBodyHtml/Text`                                            |

### External Service Touch Points

| Service             | Current Use               | v8.0 Change                                    |
| ------------------- | ------------------------- | ---------------------------------------------- |
| Gemini Flash        | Follow-up + signal emails | Add intro email generation (replaces template) |
| Resend              | `sendOutreachEmail()`     | No change                                      |
| SerpAPI + Scrapling | Evidence pipeline         | No change — evidence is input to diff detector |
| Cal.com             | Booking webhook           | No change                                      |

### DB Schema Changes Required

**None required.** The `Signal` model already supports all relevant `SignalType` values (`NEW_JOB_LISTING`, `HEADCOUNT_GROWTH`, `TECHNOLOGY_ADOPTION`). `OutreachContext` enrichment reads from existing `EvidenceItem` and `WorkflowHypothesis` tables.

**Optional:** Add `sourceRunId String?` to `Signal` to track which research run triggered detection. Useful for debugging. Not required for v8.0 function — can add as non-null-optional migration.

---

## Build Order

### Phase ordering rationale: dependency chain, bottom-up

Each phase creates a stable foundation for the next. Lower-level AI context changes before higher-level consumers. Detection before processing. Processing before UI.

**Phase 1: Evidence-Enriched AI Context**

- Extend `OutreachContext` with optional `evidence[]` + `hypotheses[]`
- Update `buildIntroEmailPrompt()` to incorporate them when present
- Write unit test: prompt with evidence vs without — verify evidence appears in output
- Zero caller changes — fully backward compatible

**Phase 2: Unified AI Intro Draft Creator**

- Write `lib/outreach/generate-intro.ts`
- Rewire `server/routers/assets.ts` `generate` mutation to call it
- Update `outreach-preview-section.tsx` to query `OutreachLog` drafts by prospect (not `WorkflowLossMap.emailBody`)
- Single "Generate Draft" button replaces "Generate Email" + "Queue Draft" two-step
- Delete `createWorkflowLossMapDraft()` + `createOutreachSequenceSteps()` from `workflow-engine.ts`
- Validation: generate draft on test prospect → appears in `/admin/outreach` immediately

**Phase 3: Signal Diff Detector**

- Write `lib/signals/detect.ts` with `detectSignalsFromDiff()`
- Focus on `NEW_JOB_LISTING` first (CAREERS evidence clearly tagged, highest value signal)
- Add `HEADCOUNT_GROWTH` detection from LINKEDIN/REGISTRY evidence
- Aggregation guard: max one signal per type per run pair
- Write unit tests: two mock evidence sets, assert correct signals emitted

**Phase 4: Research Refresh Hook + Automation Rule**

- Extend `lib/research-refresh.ts`: call `detectSignalsFromDiff()` + `processUnprocessedSignals()` after each successful `executeResearchRun()`
- Extend `lib/automation/rules.ts`: add `NEW_JOB_LISTING` → `DRAFT_EMAIL` rule
- E2E validation: trigger research refresh on a prospect with job listings → signal created → AI draft appears in queue

**Phase 5: Draft Queue Bidirectional Linking + Cleanup**

- `app/admin/outreach/page.tsx`: add prospect name + link to each draft card (data already in `getDecisionInbox`)
- `outreach-preview-section.tsx`: add draft count badge, link to outreach queue filtered by prospect
- Final dead code removal: unused `WorkflowLossMap.emailBodyHtml/Text` write paths

---

## Anti-Patterns

### Anti-Pattern 1: Two-Stage Email Creation

**What people do:** Generate a `WorkflowLossMap` (template), preview it, then queue a draft as a second explicit action from a different component.

**Why it's wrong:** Creates a staging area outside the main queue. Admin must visit two different screens. Template output lacks AI evidence specificity. Current `outreach-preview-section.tsx` shows potentially stale template content that may diverge from what gets queued.

**Do this instead:** One click generates an AI draft directly in `OutreachLog`. Preview happens inline in the draft queue. Prospect detail shows the live draft via `OutreachLog` query filtered by prospect.

### Anti-Pattern 2: Signal Detection Without Evidence Context

**What people do:** Detect signals only from Apollo webhooks (job change, promotion, funding) — external sources only. Ignore the evidence already collected in the research pipeline.

**Why it's wrong:** The 8-source evidence pipeline already collects job listings, headcount data, and tech stack information. CAREERS-tagged evidence items are the most reliable job listing signal available. Not using this wastes the primary data asset.

**Do this instead:** `detectSignalsFromDiff()` compares `EvidenceItem` sets across research runs. Apollo signals remain valid and are augmented by evidence-diff signals. Research refresh becomes the primary periodic signal trigger.

### Anti-Pattern 3: Per-Item Signal Creation

**What people do:** Create one `Signal` row per changed evidence item found in the diff.

**Why it's wrong:** 5 new job listings → 5 `NEW_JOB_LISTING` signals → `processUnprocessedSignals()` → 5 identical drafts in the queue. Admin inbox floods. Volume undermines the "one precise message" model and overwhelms the approval gate.

**Do this instead:** Aggregate all same-type signals per prospect per run pair into one `Signal` row. Put count and titles in `Signal.metadata`. Rules produce one AI draft per signal type per prospect per refresh cycle.

### Anti-Pattern 4: Rebuilding the Cadence Engine

**What people do:** Try to unify intro email generation by routing it through the cadence engine (which already handles follow-ups).

**Why it's wrong:** The cadence engine is cron-driven and time-triggered. It creates `OutreachStep` rows and promotes them to `OutreachLog` on schedule. This is the right architecture for timed follow-ups. Intro emails are on-demand, human-triggered. Different trigger model, different latency requirement.

**Do this instead:** Keep cadence engine strictly for post-send follow-up scheduling. Intro draft generation stays as an on-demand tRPC mutation called from prospect detail.

---

## Scaling Considerations

| Scale                 | Concern                                                 | Approach                                                                                     |
| --------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Current (7 prospects) | All patterns work                                       | No changes needed                                                                            |
| 50 prospects          | Research refresh generates many signals in one cron run | Already have `limit: 25` in `collectRefreshCandidates()`; diff detection inherits same limit |
| 200 prospects         | AI generation cost in cadence sweep                     | Gemini Flash free tier sufficient; `take: 50` already batches the cron sweep                 |
| 500+ prospects        | Cadence sweep cron duration may exceed timeout          | Move to dedicated background worker; not a v8.0 concern                                      |

At current and foreseeable scale (20-50 prospects), the monolith-in-Next.js architecture holds. No queue infrastructure (BullMQ, etc.) is needed for v8.0.

---

## Sources

All findings derived from direct codebase analysis (no external sources required for this internal architecture milestone):

- `lib/automation/processor.ts` — signal-to-draft pipeline
- `lib/automation/rules.ts` — automation rule definitions
- `lib/ai/generate-outreach.ts` + `lib/ai/outreach-prompts.ts` — AI generation layer
- `lib/cadence/engine.ts` — follow-up cadence architecture
- `lib/research-refresh.ts` — research refresh sweep and candidate structure
- `lib/workflow-engine.ts` — template generation (to be replaced)
- `server/routers/assets.ts` — current template flow
- `server/routers/outreach.ts` — `previewEmail`, `getDecisionInbox`, `sendDraft`
- `app/admin/outreach/page.tsx` — current outreach page structure
- `components/features/prospects/outreach-preview-section.tsx` — current prospect-detail outreach preview
- `prisma/schema.prisma` — Signal, OutreachLog, OutreachSequence, OutreachStep, EvidenceItem models
- `app/api/internal/cron/cadence-sweep/route.ts` + `app/api/internal/cron/research-refresh/route.ts`

---

_Architecture research for: Qualifai v8.0 Unified Outreach Pipeline_
_Researched: 2026-03-16_

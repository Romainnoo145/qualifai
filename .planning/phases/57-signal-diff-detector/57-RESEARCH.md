# Phase 57: Signal Diff Detector — Research

**Researched:** 2026-03-16
**Domain:** Evidence diff algorithm, Signal record creation, idempotency guards
**Confidence:** HIGH (full codebase read; architecture pre-defined in prior milestone research)

---

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                                                           | Research Support                                                                                                                                                                           |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SGNL-01 | After each research run, evidence items are compared with the previous run to detect changes (new job listings, headcount growth, funding events, technology changes) | EvidenceItem model has `sourceType`, `title`, `snippet`, `metadata` — all fields needed for diff. Two consecutive ResearchRun rows per prospect are the comparison unit.                   |
| SGNL-02 | Detected changes create Signal records with appropriate SignalType and link to prospect/contact                                                                       | Signal model exists with all required fields. SignalType enum covers NEW_JOB_LISTING and HEADCOUNT_GROWTH — the two primary targets for Phase 57.                                          |
| SGNL-03 | Signal detection includes lookback dedup — same unchanged conditions don't re-trigger signals every 14 days                                                           | No dedup exists today. Must query Signal table for recent same-type signals before inserting. Lookback window = 30 days minimum (covers 2 refresh cycles).                                 |
| SGNL-06 | processSignal uses atomic claim (updateMany status guard) to prevent duplicate drafts from concurrent runs                                                            | processSignal() currently uses `signal.update({ isProcessed: true })` — no atomicity guard. Must replace with `updateMany({ where: { id, isProcessed: false } })` and check `count === 1`. |

</phase_requirements>

---

## Summary

Phase 57 builds the single unblocking feature for all downstream automation: a diff-based signal detector that compares consecutive research run evidence sets and writes `Signal` records when meaningful changes are found. The `processSignal()` → AI draft pipeline already works; the `Signal` table is empty because nothing writes to it. This phase closes that gap.

The architecture is fully pre-defined in `.planning/research/ARCHITECTURE.md` and `.planning/research/STACK.md` — both authored during the v8.0 research spike. Phase 57 follows their blueprints directly. No new dependencies are needed: pure TypeScript against Prisma, the existing `Signal` model, and `EvidenceItem` records from two consecutive `ResearchRun` rows.

The two primary signals for Phase 57 are `NEW_JOB_LISTING` (CAREERS-source evidence count increased or hiring keywords detected in snippets) and `HEADCOUNT_GROWTH` (headcount figure in REGISTRY/LINKEDIN evidence increased). Aggregation guard ensures at most one Signal per type per run-pair. Lookback dedup ensures the same unchanged condition doesn't re-fire every 14 days. SGNL-06 adds atomic claim to `processSignal()` to prevent duplicate drafts from concurrent cron runs.

**Primary recommendation:** Write `lib/signals/detect.ts` with `detectSignalsFromDiff()` — pure array comparison, no external calls, full vitest unit test coverage. Then add atomic claim guard to `processSignal()` in `lib/automation/processor.ts`. Phase 58 wires both into `research-refresh.ts`.

---

## Standard Stack

### Core (all already installed)

| Library    | Version      | Purpose                              | Why Standard                                          |
| ---------- | ------------ | ------------------------------------ | ----------------------------------------------------- |
| Prisma     | ^7.3.0       | Signal/EvidenceItem reads and writes | Project ORM, all DB access                            |
| TypeScript | Project-wide | Typed diff logic                     | No runtime overhead, compile-safe                     |
| Vitest     | Project-wide | Unit tests for detect.ts             | Project test framework (`vitest.config.ts` confirmed) |

### No New Dependencies

v8.0 milestone research explicitly confirmed: zero new npm packages needed. The diff logic is domain-specific keyword matching against evidence snippets — generic diff libraries (`deep-diff`, `node-diff`, `jsdiff`) are the wrong abstraction.

---

## Architecture Patterns

### Recommended Project Structure

```
lib/
├── signals/
│   ├── detect.ts          # NEW — Phase 57 primary deliverable
│   └── detect.test.ts     # NEW — unit tests (Wave 0 gap)
├── automation/
│   ├── processor.ts       # MODIFY — add atomic claim guard (SGNL-06)
│   └── rules.ts           # STAYS in Phase 57, extended in Phase 58
```

### Pattern 1: Evidence Diff by Source Type

**What:** Compare `EvidenceItem[]` from two runs. Group by `sourceType`. Count deltas and keyword-scan snippets. Do NOT diff by item ID — items are fresh extractions per run and IDs will never match across runs.

**When to use:** Always. Every signal type derives from this pattern.

**Example:**

```typescript
// Source: .planning/research/ARCHITECTURE.md + .planning/research/FEATURES.md

// NEW_JOB_LISTING detection
const prevCareers = prevItems.filter(
  (i) => i.sourceType === 'CAREERS' || i.sourceType === 'JOB_BOARD',
);
const newCareers = newItems.filter(
  (i) => i.sourceType === 'CAREERS' || i.sourceType === 'JOB_BOARD',
);

const prevTitles = new Set(prevCareers.map((i) => normTitle(i.title ?? '')));
const novelJobs = newCareers.filter(
  (i) => !prevTitles.has(normTitle(i.title ?? '')),
);

if (novelJobs.length > 0) {
  // ONE aggregated Signal per prospect
  signals.push({
    signalType: 'NEW_JOB_LISTING',
    title: `${novelJobs.length} nieuwe vacature${novelJobs.length > 1 ? 's' : ''} gedetecteerd`,
    description: novelJobs.map((j) => j.title).join(', '),
    metadata: {
      count: novelJobs.length,
      titles: novelJobs.map((j) => j.title),
    },
  });
}
```

### Pattern 2: Aggregation Guard — One Signal Per Type Per Run-Pair

**What:** Group all same-type evidence changes from one run-pair into a single `Signal` row. Put count and titles in `Signal.metadata`.

**When to use:** Always. Applied inside `detectSignalsFromDiff()` before any DB write.

**Why critical:** 5 new job listings without aggregation = 5 `NEW_JOB_LISTING` signals = 5 identical AI drafts = inbox floods. The automation model breaks.

**Example:**

```typescript
// Output: Array<SignalCandidate> — at most ONE entry per SignalType
type SignalCandidate = {
  signalType: SignalType;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
};

// Collect all candidates, then take first per type before writing:
const byType = new Map<SignalType, SignalCandidate>();
for (const candidate of candidates) {
  if (!byType.has(candidate.signalType)) {
    byType.set(candidate.signalType, candidate);
  }
}
const dedupedCandidates = Array.from(byType.values());
```

### Pattern 3: Lookback Dedup — No Re-Triggers on Unchanged Data

**What:** Before creating a Signal, query the DB for an existing Signal of the same type for this prospect within a lookback window. Skip creation if one already exists.

**When to use:** Every signal creation path in `detectSignalsFromDiff()`.

**Lookback windows:**

- `NEW_JOB_LISTING`: 30 days (hiring is ongoing — same postings will appear 14 days later)
- `HEADCOUNT_GROWTH`: 60 days (headcount rarely changes in 14-day refresh window)
- `HEADCOUNT_GROWTH` only fires if the employee count actually increased, not just re-appears

**Example:**

```typescript
// Source: .planning/research/SUMMARY.md
const existingRecent = await db.signal.findFirst({
  where: {
    prospectId,
    signalType: candidate.signalType,
    detectedAt: {
      gte: new Date(Date.now() - LOOKBACK_MS[candidate.signalType]),
    },
  },
});
if (existingRecent) continue; // skip — already fired recently
```

### Pattern 4: Atomic Claim Guard in processSignal (SGNL-06)

**What:** Replace the final `signal.update({ isProcessed: true })` pattern with an upfront atomic `updateMany({ where: { id, isProcessed: false } })`. If `count === 0`, another worker already claimed this signal — bail out without creating a draft.

**When to use:** Start of `processSignal()` in `lib/automation/processor.ts`.

**Pattern source:** Established idempotency pattern documented in `.planning/research/SUMMARY.md` — "the established idempotency pattern already used elsewhere in the codebase" (see `lib/outreach/send-email.test.ts:141` mock of `updateMany` with `count`).

**Example:**

```typescript
// At the start of processSignal():
const claimed = await prisma.signal.updateMany({
  where: { id: signal.id, isProcessed: false },
  data: { isProcessed: true },
});
if (claimed.count === 0) {
  return { draftsCreated: 0 }; // already claimed by concurrent worker
}

// Continue with rule matching and draft creation...
// NOTE: remove the final signal.update() — already marked above
```

### Pattern 5: HEADCOUNT_GROWTH via KvK metadata

**What:** Extract `werkzamePersonen` from REGISTRY evidence `metadata.werkzamePersonen` in both runs. Compare numeric values. Only fire `HEADCOUNT_GROWTH` if the new value is strictly greater.

**When to use:** In `detectSignalsFromDiff()` after extracting REGISTRY/LINKEDIN items.

**Implementation detail:**

```typescript
function extractHeadcount(items: EvidenceItem[]): number | null {
  for (const item of items) {
    if (item.sourceType === 'REGISTRY') {
      const meta = item.metadata as { werkzamePersonen?: number } | null;
      if (meta?.werkzamePersonen && meta.werkzamePersonen > 0) {
        return meta.werkzamePersonen;
      }
    }
  }
  // Fallback: parse snippet for headcount pattern
  for (const item of items) {
    if (item.sourceType === 'REGISTRY' || item.sourceType === 'LINKEDIN') {
      const match = item.snippet.match(/Werkzame personen:\s*(\d+)/);
      if (match) return parseInt(match[1], 10);
    }
  }
  return null;
}
```

### Anti-Patterns to Avoid

- **Per-item Signal creation:** Creating one Signal per changed EvidenceItem leads to draft flooding. Always aggregate.
- **Diffing by EvidenceItem.id:** IDs are stable within a run but never shared across runs. Diff by title normalization and content fingerprinting instead.
- **Missing lookback dedup:** Without it, the 14-day refresh cycle will re-emit identical signals on unchanged data every two weeks.
- **processSignal mark-processed at end (race condition):** Current code marks `isProcessed=true` at the end of processing. Two concurrent workers could both process the same signal. Fix: claim atomically at the start.

---

## Don't Hand-Roll

| Problem                       | Don't Build                                      | Use Instead                                  | Why                                                                                                           |
| ----------------------------- | ------------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Generic object diff           | Custom recursive object comparison               | Domain-specific array filter + count         | Evidence items are typed; semantic grouping is domain logic, not structural diff                              |
| Signal dedup constraint       | DB unique constraint on (prospectId, signalType) | Lookback query with time window              | A unique constraint would prevent re-firing after genuine state change (e.g., new hiring round 90 days later) |
| Fuzzy job title matching      | Levenshtein distance or embedding similarity     | `normTitle()` lowercasing + whitespace strip | Close enough for dedup; jobs are retitled rarely within 14 days                                               |
| Queue / worker infrastructure | BullMQ, Redis queue                              | PostgreSQL `isProcessed` flag as queue       | Current scale (<10 signals/day) needs no queue infrastructure                                                 |

---

## Common Pitfalls

### Pitfall 1: Signals Re-Fire on Every 14-Day Refresh

**What goes wrong:** Every refresh cycle, the same job listings appear in CAREERS evidence. Without dedup, a new `NEW_JOB_LISTING` signal fires every 14 days even if no new listings appeared.

**Why it happens:** Evidence items are fresh web extractions each run. The same listing scraped twice has different `id` values. The diff sees it as "new" because IDs never match.

**How to avoid:** Dedup by title normalization across run pairs, THEN check lookback window before DB insert. Both guards are required.

**Warning signs:** Signal table grows uniformly every 14 days with same-titled signals per prospect.

### Pitfall 2: Missing Aggregation Causes Draft Flooding

**What goes wrong:** 4 novel job listings → 4 `NEW_JOB_LISTING` signals → `processUnprocessedSignals()` → 4 identical drafts in queue. Admin sees inbox noise, automation loses credibility.

**Why it happens:** Naive implementation creates one Signal per evidence item change.

**How to avoid:** Aggregate inside `detectSignalsFromDiff()` — max ONE Signal per type per run-pair. Count and titles go in `Signal.metadata`.

**Warning signs:** Draft queue has multiple entries with identical subjects for the same prospect.

### Pitfall 3: Concurrent processSignal Creates Duplicate Drafts

**What goes wrong:** Two cron invocations overlap. Both call `processUnprocessedSignals()`. Both find the same unprocessed Signal. Both generate the same AI draft email. Both mark `isProcessed=true` (but the second update is a no-op). Two drafts appear in queue.

**Why it happens:** `signal.update()` at the end of processing is not an atomic claim — it is a result, not a guard.

**How to avoid:** Atomic claim at the START: `updateMany({ where: { id, isProcessed: false } })`. Check `count === 1`. If 0, bail. The mark-processed at end is then removed.

**Warning signs:** Duplicate OutreachLog rows with same subject and signalId in metadata.

### Pitfall 4: HEADCOUNT_GROWTH Fires on KvK Refresh Noise

**What goes wrong:** KvK updates `totaalWerkzamePersonen` from 47 to 48 (one hire). Signal fires. This is technically correct but may feel spammy for small changes.

**How to avoid:** Add a minimum delta threshold (e.g., only fire if growth > 10% or > 5 people). Document the threshold in code as a named constant.

### Pitfall 5: CAREERS + JOB_BOARD Both Need Coverage

**What goes wrong:** `fetchLinkedInJobs()` returns `sourceType: 'CAREERS'`. Direct job board crawls use `sourceType: 'JOB_BOARD'`. Filtering only `CAREERS` misses job board evidence.

**How to avoid:** In `detectSignalsFromDiff()`, filter for both: `sourceType === 'CAREERS' || sourceType === 'JOB_BOARD'`.

---

## Code Examples

### detectSignalsFromDiff — Full Function Signature

```typescript
// Source: .planning/research/ARCHITECTURE.md

export interface DetectSignalsInput {
  previousRunId: string;
  newRunId: string;
  prospectId: string;
  db: PrismaClient;
}

export interface DetectSignalsResult {
  signalsCreated: number;
  skippedByDedup: number;
  signalIds: string[];
}

export async function detectSignalsFromDiff(
  input: DetectSignalsInput,
): Promise<DetectSignalsResult>;
```

### processSignal Atomic Claim — Replacement Pattern

```typescript
// Source: .planning/research/SUMMARY.md + established pattern from lib/outreach/send-email.ts

// BEFORE (race-prone):
await prisma.signal.update({
  where: { id: signal.id },
  data: { isProcessed: true },
});

// AFTER (atomic claim at start of processSignal):
const claimed = await prisma.signal.updateMany({
  where: { id: signal.id, isProcessed: false },
  data: { isProcessed: true },
});
if (claimed.count === 0) return { draftsCreated: 0 };
// ... proceed with draft creation, no final update needed
```

### Title Normalization for Diff

```typescript
function normTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}
```

---

## State of the Art

| Old Approach                                       | Current Approach                                       | When Changed | Impact                                                         |
| -------------------------------------------------- | ------------------------------------------------------ | ------------ | -------------------------------------------------------------- |
| Template-based email from WorkflowLossMap          | AI-generated via generateIntroEmail() — Phase 56       | 2026-03-16   | Intro drafts now use evidence context; template engine deleted |
| Manual "Process Signals" button in UI              | Will be automated via research-refresh hook — Phase 58 | Next phase   | Phase 57 builds the detector; Phase 58 wires the trigger       |
| Signal.isProcessed updated at end of processSignal | Must be atomic claim at start — SGNL-06                | Phase 57     | Prevents duplicate drafts from concurrent cron runs            |

**Current known gaps (this phase fixes):**

- `Signal` table: 0 rows (Signal creation never implemented)
- `processSignal()`: no atomic claim guard
- `detectSignalsFromDiff()`: function does not exist yet

---

## Open Questions

1. **HEADCOUNT_GROWTH minimum delta**
   - What we know: KvK returns exact `werkzamePersonen` number; the diff can be as small as 1
   - What's unclear: Is a 1-person change worth a signal + AI draft?
   - Recommendation: Default threshold = 5 people OR 10% growth, whichever is lower. Named constant `HEADCOUNT_GROWTH_MIN_DELTA = 5`. Can be tuned without code change.

2. **processUnprocessedSignals called inside detectSignalsFromDiff or outside?**
   - What we know: Phase 58 is responsible for wiring research-refresh.ts (SGNL-04). Phase 57 only writes Signal rows (SGNL-01, SGNL-02, SGNL-03).
   - What's unclear: Should `processSignal()` atomic fix (SGNL-06) be called from Phase 57's detect.ts or is it a standalone change to processor.ts?
   - Recommendation: SGNL-06 is a standalone fix to `processor.ts` — it's independent of detection. Phase 57 Plan 57-02 should cover both detect.ts creation AND the processSignal atomic fix as two changes in one plan.

3. **Signal.sourceRunId — should it be added?**
   - What we know: Architecture notes flag this as optional: "Add `sourceRunId String?` to Signal to track which research run triggered detection. Useful for debugging. Not required for v8.0."
   - Recommendation: Skip for Phase 57. Put `newRunId` in `Signal.metadata` instead — no schema migration needed, achieves same debugging value.

---

## Sources

### Primary (HIGH confidence)

- `.planning/research/ARCHITECTURE.md` — Full signal detection architecture, data flow diagrams, code shape examples
- `.planning/research/STACK.md` — Confirmed zero new dependencies, diff approach rationale
- `.planning/research/FEATURES.md:159–169` — Per-signal-type detection logic
- `.planning/research/SUMMARY.md:66–76` — Critical pitfalls list
- `prisma/schema.prisma` — Signal model, SignalType enum, EvidenceItem model confirmed
- `lib/automation/processor.ts` — processSignal() current implementation (race-prone pattern identified)
- `lib/automation/rules.ts` — AUTOMATION_RULES covers HEADCOUNT_GROWTH, FUNDING_EVENT (not yet NEW_JOB_LISTING)
- `lib/enrichment/kvk.ts` — werkzamePersonen stored in EvidenceItem.metadata as `{ werkzamePersonen: number }`
- `lib/enrichment/linkedin-jobs.ts` — fetchLinkedInJobs returns sourceType: 'CAREERS'
- `vitest.config.ts` — Test framework confirmed: vitest + jsdom + tsconfigPaths

### Secondary (MEDIUM confidence)

- `lib/outreach/send-email.test.ts:141` — updateMany `count` mock confirms pattern is used elsewhere in codebase

---

## Metadata

**Confidence breakdown:**

- Diff algorithm design: HIGH — fully spec'd in prior milestone research, confirmed against actual EvidenceItem schema
- Signal creation: HIGH — Signal model exists, all fields present
- Dedup lookback: HIGH — pattern documented in SUMMARY.md, query shape is standard Prisma
- Atomic claim guard: HIGH — updateMany count pattern confirmed by existing test mocks
- HEADCOUNT_GROWTH extraction: HIGH — werkzamePersonen in KvK metadata confirmed

**Research date:** 2026-03-16
**Valid until:** Stable — no external APIs involved, all logic is internal

# Phase 58: Signal-to-Draft Pipeline — Research

**Researched:** 2026-03-16
**Domain:** Research refresh automation, signal detection wiring, end-to-end automation loop
**Confidence:** HIGH (full codebase read; Phase 57 deliverables confirmed shipped)

---

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                    | Research Support                                                                                                                                                                            |
| ------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SGNL-04 | Signal detection is wired into research refresh cron (runs automatically after each refresh)   | `runResearchRefreshSweep` in `lib/research-refresh.ts` already receives `db` as a parameter and iterates over `executions` with `runId`. The hook point is after each successful execution. |
| SGNL-05 | Existing automation rules (AUTOMATION_RULES) trigger AI-generated drafts from detected signals | `processUnprocessedSignals()` in `lib/automation/processor.ts` already does this — it just needs to be called after signal detection runs. The NEW_JOB_LISTING rule exists.                 |

</phase_requirements>

---

## Summary

Phase 58 closes the automation loop by wiring `detectSignalsFromDiff()` (built in Phase 57) into `runResearchRefreshSweep()` so that after each research run completes, signal detection runs automatically against the new run and its predecessor.

The complete automation chain is: cron executes research refresh → each prospect's new run ID comes back → `detectSignalsFromDiff(previousRunId, newRunId)` writes Signal rows → `processUnprocessedSignals()` converts unprocessed Signals into AI-generated draft emails via the AUTOMATION_RULES (including the NEW_JOB_LISTING rule added in Phase 57).

Phase 58 is a single-plan phase. The one PLAN file modifies `lib/research-refresh.ts` and `scripts/cron-research-refresh.ts`. No new files needed; no new dependencies. The Phase 57 deliverables (`lib/signals/detect.ts`, `lib/automation/processor.ts`, `lib/automation/rules.ts`) are complete and ready to integrate.

**Primary recommendation:** In `runResearchRefreshSweep`, after each successful `executeResearchRun`, look up the previous completed run for that prospect, call `detectSignalsFromDiff`, then call `processUnprocessedSignals` once after the sweep completes. Log signal counts in the cron script output.

---

## Standard Stack

### Core (all already installed)

| Library    | Version      | Purpose                        | Why Standard                  |
| ---------- | ------------ | ------------------------------ | ----------------------------- |
| Prisma     | ^7.3.0       | DB queries for previous run ID | Project ORM — used everywhere |
| TypeScript | Project-wide | Type-safe wiring               | No runtime overhead           |

### No New Dependencies

Phase 57 confirmed zero new packages. Phase 58 adds no new packages — it is purely wiring existing functions together.

---

## Architecture Patterns

### Recommended Changes

```
lib/
├── research-refresh.ts    # MODIFY — add detectSignalsFromDiff after each execution
scripts/
└── cron-research-refresh.ts   # MODIFY — log signal detection results
```

### Pattern 1: After-Execution Hook in runResearchRefreshSweep

**What:** After each successful `executeResearchRun`, find the previous COMPLETED run for the same prospect and call `detectSignalsFromDiff`. Accumulate per-prospect signal counts into the sweep result.

**When to use:** Inside the `for (const candidate of candidates)` loop in `runResearchRefreshSweep`, in the `try` block after `executions.push({ ..., ok: true })`.

**Why this location:** `executeResearchRun` returns `{ run: completed, gate, counts }`. The returned `run.id` is the new run ID. The candidate's `latestRunId` is the previous run ID — already available in the loop.

**Example:**

```typescript
// Source: lib/research-refresh.ts (existing loop shape) + lib/signals/detect.ts (interface)
for (const candidate of candidates) {
  try {
    const result = await executeResearchRun(db, { ... });
    executions.push({ ..., runId: result.run.id, ok: true });

    // Signal detection — only when a previous run exists (diff needs two runs)
    if (candidate.latestRunId) {
      const signalResult = await detectSignalsFromDiff({
        previousRunId: candidate.latestRunId,
        newRunId: result.run.id,
        prospectId: candidate.prospectId,
        db,
      });
      // Accumulate into sweep telemetry (see RefreshSweepResult extension)
    }
  } catch (error) { ... }
}

// After the loop: process all newly created signals into drafts
await processUnprocessedSignals();
```

**Key constraint:** `detectSignalsFromDiff` only runs when `candidate.latestRunId` is non-null. First-time prospects (`reason: 'never_researched'`) have no previous run to diff against — skip them silently.

### Pattern 2: Extending RefreshSweepResult with Signal Telemetry

**What:** Add optional signal counts to the return shape so the cron script can log them.

**When to use:** Extend the existing `RefreshSweepResult` interface rather than creating a new return type. Make fields optional or give them defaults — non-breaking.

**Example:**

```typescript
export interface RefreshSweepResult {
  // existing fields...
  signalsDetected: number; // sum across all prospects
  draftsCreated: number; // from processUnprocessedSignals
}
```

**Why add to sweep result:** The cron script (`scripts/cron-research-refresh.ts`) logs `result.executed` and `result.failed`. Logging `result.signalsDetected` and `result.draftsCreated` gives operational observability without any new infrastructure.

### Pattern 3: processUnprocessedSignals Called Once After the Sweep

**What:** Call `processUnprocessedSignals()` once after the `for` loop, not once per prospect.

**Why:** `processUnprocessedSignals` queries ALL unprocessed signals at once (up to 50). Calling it inside the loop would process signals from earlier prospects before later ones are detected — minor issue but unnecessary. Calling it once after the full sweep is cleaner and handles burst scenarios correctly.

**Note:** `processUnprocessedSignals` uses the prisma singleton internally. The function signature is `processUnprocessedSignals(): Promise<{ processed: number; draftsCreated: number }>` — no parameters needed.

### Pattern 4: Handling "never_researched" Prospects

**What:** When `candidate.latestRunId` is null, the prospect has no previous run. Signal diff is impossible — skip detection for this prospect.

**When to use:** Always check `candidate.latestRunId` before calling `detectSignalsFromDiff`.

**Example:**

```typescript
if (candidate.latestRunId) {
  // diff is possible
  await detectSignalsFromDiff({ ... });
} else {
  // first run — no baseline to diff against; signals will run next refresh cycle
}
```

### Anti-Patterns to Avoid

- **Calling processUnprocessedSignals inside the loop:** Leads to partial processing mid-sweep. Call it once after the loop.
- **Calling detectSignalsFromDiff when latestRunId is null:** The function accepts `previousRunId: string` (non-nullable). Passing null will cause a Prisma query error.
- **Passing `prisma` singleton to detectSignalsFromDiff:** The function signature takes `db: PrismaClient`. In `research-refresh.ts`, use the `db` parameter already passed into `runResearchRefreshSweep` — consistent with Phase 57 testability decisions.
- **Adding signal detection to `executeResearchRun` itself:** The executor is responsible for evidence collection and analysis only. Signal detection is a post-processing concern that belongs in the sweep orchestrator.

---

## Don't Hand-Roll

| Problem                     | Don't Build             | Use Instead                               | Why                                                         |
| --------------------------- | ----------------------- | ----------------------------------------- | ----------------------------------------------------------- |
| Signal detection logic      | Any diff logic here     | `detectSignalsFromDiff` from Phase 57     | Already built, tested (11 unit tests), correct              |
| Draft creation from signals | Inline email generation | `processUnprocessedSignals` from Phase 57 | Already handles all rule types, atomic claim guard included |
| Previous run lookup         | Complex query           | `candidate.latestRunId` already in scope  | `RefreshSweepCandidate` already carries the previous run ID |

---

## Common Pitfalls

### Pitfall 1: Calling detectSignalsFromDiff Before executeResearchRun Completes

**What goes wrong:** If called before the research run is fully persisted to DB, `evidenceItem.findMany` for the new run returns zero items. Detection produces no signals.

**Why it happens:** `executeResearchRun` is async and writes evidence items during its execution. Awaiting the result is mandatory before calling detection.

**How to avoid:** Call `detectSignalsFromDiff` only after `await executeResearchRun(...)` returns. The current loop structure in `runResearchRefreshSweep` already awaits — this is preserved naturally.

### Pitfall 2: processUnprocessedSignals Uses Prisma Singleton — Not the db Parameter

**What goes wrong:** `runResearchRefreshSweep` receives `db: PrismaClient` as a parameter. `processUnprocessedSignals()` internally uses the prisma singleton (`import prisma from '@/lib/prisma'`). These can diverge in test environments where `db` is a mock.

**Why it happens:** The function was built before the "db as parameter" pattern was standardized in Phase 57.

**How to avoid:** In production (the cron script), both resolve to the same database — no operational issue. This pitfall only matters for integration tests. Document it if tests are written; no change needed for Phase 58 delivery.

**Warning signs:** Unit tests that inject a mock `db` into `runResearchRefreshSweep` will find `processUnprocessedSignals` not using that mock.

### Pitfall 3: Signal Detection After a Failed Research Run

**What goes wrong:** If `executeResearchRun` throws, the `catch` block records `ok: false`. If detection were placed outside the try block, it would still attempt to diff against an incomplete run with partial evidence.

**How to avoid:** Place `detectSignalsFromDiff` call inside the `try` block, after the `executions.push({ ok: true })` line. Detection only runs on successful runs.

### Pitfall 4: RefreshSweepResult Interface Change Breaks Callers

**What goes wrong:** Adding `signalsDetected` and `draftsCreated` as required fields breaks the API route handler that calls `runResearchRefreshSweep`.

**How to avoid:** Add new fields with default values (initialize to 0 in the function body, always returned). Optional (`?`) is also acceptable but a default of 0 is cleaner for log output.

**Warning signs:** TypeScript compile error `Property 'signalsDetected' is missing in type` — means a caller is constructing a `RefreshSweepResult` directly (should be rare since it's a return type, not input type).

---

## Code Examples

### Hook Shape Inside runResearchRefreshSweep

```typescript
// Source: lib/research-refresh.ts (existing) + lib/signals/detect.ts (Phase 57)

import { detectSignalsFromDiff } from '@/lib/signals/detect';
import { processUnprocessedSignals } from '@/lib/automation/processor';

// Inside runResearchRefreshSweep, after the executions array init:
let totalSignalsDetected = 0;

// Inside the for loop, in the try block:
const result = await executeResearchRun(db, {
  prospectId: candidate.prospectId,
  campaignId: candidate.campaignId,
  manualUrls: candidate.defaultManualUrls,
});
executions.push({
  prospectId: candidate.prospectId,
  campaignId: candidate.campaignId,
  runId: result.run.id,
  ok: true,
});

if (candidate.latestRunId) {
  const signalResult = await detectSignalsFromDiff({
    previousRunId: candidate.latestRunId,
    newRunId: result.run.id,
    prospectId: candidate.prospectId,
    db,
  });
  totalSignalsDetected += signalResult.signalsCreated;
}

// After the for loop (not inside):
const signalProcessingResult = dryRun
  ? { processed: 0, draftsCreated: 0 }
  : await processUnprocessedSignals();

return {
  // existing fields...
  signalsDetected: totalSignalsDetected,
  draftsCreated: signalProcessingResult.draftsCreated,
};
```

### Cron Script Log Addition

```typescript
// Source: scripts/cron-research-refresh.ts (existing)
// Add after the existing executed/failed logging:
if (!DRY_RUN) {
  console.log(
    `  signalsDetected=${result.signalsDetected}, draftsCreated=${result.draftsCreated}`,
  );
}
```

### dryRun Guard for processUnprocessedSignals

```typescript
// Skip signal processing in dry-run mode — no new runs were executed
const signalProcessingResult = dryRun
  ? { processed: 0, draftsCreated: 0 }
  : await processUnprocessedSignals();
```

---

## State of the Art

| Old Approach                                   | Current Approach                                    | When Changed | Impact                                                             |
| ---------------------------------------------- | --------------------------------------------------- | ------------ | ------------------------------------------------------------------ |
| Manual "Process Signals" button in admin UI    | Auto-wired into research refresh cron               | Phase 58     | Full automation loop: cron → evidence → signals → drafts           |
| detectSignalsFromDiff not called anywhere      | Called inside runResearchRefreshSweep per execution | Phase 58     | Signal table will populate on next cron cycle                      |
| processUnprocessedSignals called manually only | Called automatically after each refresh sweep       | Phase 58     | Drafts appear in queue within minutes of stale research completing |

**Phase 57 deliverables (shipped, ready to use):**

- `lib/signals/detect.ts` — `detectSignalsFromDiff(input)` with 11 unit tests
- `lib/automation/processor.ts` — `processSignal` with atomic claim, `processUnprocessedSignals`
- `lib/automation/rules.ts` — `new-job-listing` rule with `SIGNAL_TRIGGERED` emailType

---

## Open Questions

1. **Should detectSignalsFromDiff errors abort the sweep or log-and-continue?**
   - What we know: `executeResearchRun` errors are caught and result in `ok: false`. Signal detection errors are not yet handled.
   - Recommendation: Wrap `detectSignalsFromDiff` in its own try/catch inside the loop. Log the error, do not count it as a failed execution. Signal detection failure should not mark the research execution as failed — those are separate concerns.

2. **Should the dryRun flag suppress signal detection too?**
   - What we know: In dry-run mode, no research runs execute (`dryRun=true` skips the entire execution loop). Therefore `detectSignalsFromDiff` can never be reached — the guard is implicit.
   - Recommendation: No explicit dryRun check needed inside the loop for signal detection. Add explicit dryRun guard only for `processUnprocessedSignals` (which would otherwise process pre-existing unprocessed signals unrelated to the current sweep).

3. **What happens to signals created but never acted on because no contacts exist for the prospect?**
   - What we know: `processSignal` skips rule execution if `signal.contact` is null. The signal remains with `isProcessed: true` (claimed atomically at start) but `draftsCreated=0`.
   - Impact: No draft is created, but the signal is marked processed. This is acceptable — the signal served as change detection, and the absence of a contact means there is no one to email.
   - No action needed for Phase 58.

---

## Sources

### Primary (HIGH confidence)

- `lib/research-refresh.ts` — Full source read; `runResearchRefreshSweep` function, `RefreshSweepResult` interface, `RefreshSweepCandidate.latestRunId` confirmed non-null only when previous run exists
- `scripts/cron-research-refresh.ts` — Full source read; logging pattern, dryRun usage confirmed
- `lib/signals/detect.ts` — Phase 57 deliverable; `detectSignalsFromDiff` signature confirmed: `{ previousRunId, newRunId, prospectId, db }` → `Promise<DetectSignalsResult>`
- `lib/automation/processor.ts` — Full source read; `processUnprocessedSignals()` signature and behavior confirmed; atomic claim guard verified present
- `lib/automation/rules.ts` — Full source read; `new-job-listing` rule with `SIGNAL_TRIGGERED` confirmed present
- `prisma/schema.prisma` — `ResearchRun.status`, `Signal.isProcessed`, `Signal.detectedAt` confirmed
- `.planning/phases/57-signal-diff-detector/57-01-SUMMARY.md` — Phase 57 Plan 01 completion confirmed (detectSignalsFromDiff shipped, 11 tests pass)
- `.planning/phases/57-signal-diff-detector/57-02-SUMMARY.md` — Phase 57 Plan 02 completion confirmed (atomic claim + new-job-listing rule shipped)

---

## Metadata

**Confidence breakdown:**

- Wiring pattern: HIGH — `candidate.latestRunId` is the exact field needed; `executeResearchRun` return shape confirmed
- Signal detection function signature: HIGH — source read directly
- processUnprocessedSignals behavior: HIGH — source read directly; atomic claim guard confirmed present
- Result shape extension: HIGH — non-breaking addition of two fields

**Research date:** 2026-03-16
**Valid until:** Stable — no external APIs; all logic is internal; Phase 57 deliverables are finalized

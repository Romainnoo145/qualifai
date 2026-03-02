# Phase 34: AI Metric Derivation + Source Attribution - Research

**Researched:** 2026-03-02
**Domain:** LLM prompt extension, TypeScript data model, React admin UI
**Confidence:** HIGH

## Summary

Phase 34 replaces hardcoded `METRIC_DEFAULTS` in `generateHypothesisDraftsAI` with AI-derived metric ranges, and adds a `primarySourceType` field to each hypothesis so the admin detail view can display a source attribution badge. Both requirements involve the same function and the same AI prompt call, making them natural to implement together in a single plan wave.

The current AI prompt outputs a JSON schema with no metric fields — the function immediately spreads `METRIC_DEFAULTS` over every result regardless of industry or evidence. The fix is straightforward: extend the prompt's output schema to include `hoursSavedWeekLow/Mid/High`, `handoffSpeedGainPct`, `errorReductionPct`, `revenueLeakageRecoveredLow/Mid/High`, and `primarySourceType`; extend `AIHypothesisItem` to match; validate/clamp each numeric field in the mapping step; and use `METRIC_DEFAULTS` only as last-resort fallback. No schema migration is needed because all metric columns already exist as nullable on `WorkflowHypothesis`. A new `primarySourceType String?` column on `WorkflowHypothesis` IS needed (does not exist today), requiring a DB migration and schema change.

The source attribution badge is a pure UI addition in `analysis-section.tsx` `FindingCard`. The hypothesis router's `listByProspect` query already includes all fields returned by the ORM, so no router change is needed beyond adding `primarySourceType` to the Prisma `select` (it will be available automatically once the column exists).

**Primary recommendation:** Extend the AI prompt JSON schema to emit metrics + primarySourceType, add a DB migration for the new column, and add a badge in `FindingCard`. Three focused changes, zero new dependencies.

<phase_requirements>

## Phase Requirements

| ID       | Description                                                                                                                                                                       | Research Support                                                                                                                     |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| MODEL-03 | AI-estimated metric ranges (hours saved, handoff speed, error reduction, revenue leakage) replace hardcoded METRIC_DEFAULTS — contextual to each prospect's industry and evidence | Prompt schema extension; `AIHypothesisItem` extended; clamp + validate logic in mapping step; `METRIC_DEFAULTS` retained as fallback |
| ANLYS-09 | Primary source attribution badge (sourceType that most drove each hypothesis) displayed per hypothesis in admin detail view                                                       | New `primarySourceType String?` DB column; prompt emits field; `FindingCard` renders a badge                                         |

</phase_requirements>

## Standard Stack

### Core

| Library               | Version                    | Purpose                               | Why Standard                                  |
| --------------------- | -------------------------- | ------------------------------------- | --------------------------------------------- |
| Zod                   | Already in project         | Runtime JSON validation for AI output | Already used throughout for schema validation |
| Vitest                | Already in project         | Unit tests for prompt + mapping logic | Project-standard test framework               |
| Prisma                | Already in project         | DB schema + migration                 | All DB changes go through Prisma              |
| @google/generative-ai | Already in project         | Gemini Flash AI call                  | Default hypothesis model                      |
| @anthropic-ai/sdk     | ^0.73.0 already in project | Claude Sonnet AI call                 | MODEL-01 alternate path                       |

### Supporting

| Library      | Version            | Purpose                      | When to Use                                             |
| ------------ | ------------------ | ---------------------------- | ------------------------------------------------------- |
| Tailwind CSS | Already in project | Badge styling in FindingCard | Inline badge UI, consistent with existing pill patterns |

### Alternatives Considered

| Instead of                        | Could Use                               | Tradeoff                                                                                                                              |
| --------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Prompt-embedded metric derivation | Separate AI call for metrics            | A second AI call doubles latency and cost with no benefit since the model already sees all evidence context                           |
| New `primarySourceType` DB column | Compute at query time from evidenceRefs | Computing at query time requires joining evidenceItems on every load; storing it is idempotent, consistent with existing architecture |

**Installation:**
No new packages needed.

## Architecture Patterns

### Recommended Project Structure

No new files needed. Changes are surgical across:

```
lib/workflow-engine.ts          # Prompt extension, AIHypothesisItem, mapping step
prisma/schema.prisma            # New primarySourceType column
prisma/migrations/              # Manual migration file
components/features/prospects/
  analysis-section.tsx          # Badge rendering in FindingCard
```

### Pattern 1: Prompt JSON Schema Extension

**What:** Add metric fields + `primarySourceType` to the AI prompt output schema and to `AIHypothesisItem`. Keep `METRIC_DEFAULTS` as runtime fallback for out-of-range or missing values.

**When to use:** Any time new fields need to come from AI inference rather than static defaults.

**Example:**

Current prompt schema (lines 801-810 of workflow-engine.ts):

```typescript
// CURRENT — no metric fields in AI output
[
  {
    title: '...',
    problemStatement: '...',
    assumptions: ['...', '...'],
    validationQuestions: ['...', '...'],
    workflowTag: '...',
    confidenceScore: 0.0,
    evidenceRefs: ['<sourceUrl>', '...'],
  },
];
```

Extended schema (Phase 34):

```typescript
// EXTENDED — metrics + primarySourceType from AI
[
  {
    title: '...',
    problemStatement: '...',
    assumptions: ['...', '...'],
    validationQuestions: ['...', '...'],
    workflowTag: '...',
    confidenceScore: 0.0,
    evidenceRefs: ['<sourceUrl>', '...'],
    primarySourceType: 'REVIEWS',
    hoursSavedWeekLow: 6,
    hoursSavedWeekMid: 10,
    hoursSavedWeekHigh: 16,
    handoffSpeedGainPct: 28,
    errorReductionPct: 20,
    revenueLeakageRecoveredLow: 300,
    revenueLeakageRecoveredMid: 800,
    revenueLeakageRecoveredHigh: 2000,
  },
];
```

### Pattern 2: Clamp + Fallback in Mapping Step

**What:** After parsing AI JSON, validate each numeric field with min/max clamps. Fall back to `METRIC_DEFAULTS` only if the value is missing or out of a reasonable bound.

**When to use:** Whenever LLM-derived numbers drive downstream logic.

**Example:**

```typescript
// In the parsed.slice(0, targetCount).map(...) block:
const clampInt = (
  val: unknown,
  lo: number,
  hi: number,
  def: number,
): number => {
  if (typeof val !== 'number' || isNaN(val)) return def;
  return Math.round(Math.min(hi, Math.max(lo, val)));
};
const clampFloat = (
  val: unknown,
  lo: number,
  hi: number,
  def: number,
): number => {
  if (typeof val !== 'number' || isNaN(val)) return def;
  return Math.min(hi, Math.max(lo, val));
};

return {
  // ... title, problemStatement, etc.
  primarySourceType: VALID_SOURCE_TYPES.has(
    String(item.primarySourceType ?? ''),
  )
    ? String(item.primarySourceType)
    : null,
  hoursSavedWeekLow: clampInt(
    item.hoursSavedWeekLow,
    1,
    80,
    METRIC_DEFAULTS.hoursSavedWeekLow,
  ),
  hoursSavedWeekMid: clampInt(
    item.hoursSavedWeekMid,
    1,
    80,
    METRIC_DEFAULTS.hoursSavedWeekMid,
  ),
  hoursSavedWeekHigh: clampInt(
    item.hoursSavedWeekHigh,
    1,
    80,
    METRIC_DEFAULTS.hoursSavedWeekHigh,
  ),
  handoffSpeedGainPct: clampFloat(
    item.handoffSpeedGainPct,
    1,
    90,
    METRIC_DEFAULTS.handoffSpeedGainPct,
  ),
  errorReductionPct: clampFloat(
    item.errorReductionPct,
    1,
    90,
    METRIC_DEFAULTS.errorReductionPct,
  ),
  revenueLeakageRecoveredLow: clampInt(
    item.revenueLeakageRecoveredLow,
    0,
    50000,
    METRIC_DEFAULTS.revenueLeakageRecoveredLow,
  ),
  revenueLeakageRecoveredMid: clampInt(
    item.revenueLeakageRecoveredMid,
    0,
    50000,
    METRIC_DEFAULTS.revenueLeakageRecoveredMid,
  ),
  revenueLeakageRecoveredHigh: clampInt(
    item.revenueLeakageRecoveredHigh,
    0,
    50000,
    METRIC_DEFAULTS.revenueLeakageRecoveredHigh,
  ),
};
```

### Pattern 3: Prompt Instruction for Metric Ranges

**What:** The prompt must tell the model HOW to derive metrics — relative to company size (employee range), industry, and which specific evidence was most diagnostic. Range format (low/mid/high) must be explicit.

**Example instruction block to add to the existing prompt:**

```
For each hypothesis, also estimate operational impact based on the evidence and company context:
- hoursSavedWeekLow / hoursSavedWeekMid / hoursSavedWeekHigh (integer, per week): conservative / expected / optimistic estimate based on company employee count and problem scope. Dutch SMBs (10-50 employees): low=2-8, mid=4-14, high=6-20. Use context — a billing gap at a 200-employee firm saves more than at a 10-person shop.
- handoffSpeedGainPct (float, 0-90): percent reduction in inter-team handoff time. Typical range: 15-45.
- errorReductionPct (float, 0-90): percent reduction in data errors or rework. Typical range: 10-35.
- revenueLeakageRecoveredLow / Mid / High (integer EUR/month): conservative / expected / optimistic monthly revenue leakage recovery. Dutch SMB baseline: 200-5000/month depending on industry.
- primarySourceType: the source type label (e.g. "REVIEWS", "CAREERS", "LINKEDIN") of the single evidence item that most strongly supports this hypothesis.

Calibrate metrics to the specific pain identified. A hypothesis grounded in employee review complaints about manual re-entry implies different savings than one grounded in a single job posting.
```

### Pattern 4: Source Attribution Badge in FindingCard

**What:** `FindingCard` in `analysis-section.tsx` already renders status pills and type badges. Add a `primarySourceType` string to the `Finding` type and render it as a badge in the header row.

**Current `Finding` type (line 6-26 of analysis-section.tsx):**

```typescript
type Finding = {
  id: string;
  kind: 'hypothesis' | 'opportunity';
  title: string;
  summary: string;
  status: 'DRAFT' | 'ACCEPTED' | 'REJECTED' | 'PENDING' | 'DECLINED';
  confidenceScore: number;
  evidenceItems: Array<{
    id: string;
    sourceUrl: string;
    snippet: string;
    sourceType: string;
    title?: string | null;
  }>;
  proofMatches: Array<{
    id: string;
    score: number;
    proofTitle: string;
    useCase?: { id: string; title: string; category: string } | null;
  }>;
};
```

**Extended (Phase 34):**

```typescript
type Finding = {
  // ... existing fields
  primarySourceType: string | null; // new
};
```

**Badge render (inside the existing pill row at line 83-92):**

```tsx
{
  finding.primarySourceType && (
    <span className="inline-flex items-center rounded-full border border-blue-200 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-blue-700 bg-blue-50/70">
      {finding.primarySourceType.replace(/_/g, ' ')}
    </span>
  );
}
```

### Pattern 5: Prisma Schema + Migration

**What:** Add `primarySourceType String?` to `WorkflowHypothesis`. No migration for `AutomationOpportunity` — opportunities use static templates and have no AI-derived source attribution (only hypotheses have this).

**Schema change:**

```prisma
model WorkflowHypothesis {
  // ... existing fields
  primarySourceType            String?   // ANLYS-09 — source type that most drove this hypothesis
  // ... rest
}
```

**Migration SQL (apply via docker exec):**

```sql
ALTER TABLE "WorkflowHypothesis" ADD COLUMN "primarySourceType" TEXT;
```

**Manual migration file** (pattern from existing migrations):

```
prisma/migrations/YYYYMMDDHHMMSS_add_hypothesis_primary_source_type/migration.sql
```

### Anti-Patterns to Avoid

- **Deleting METRIC_DEFAULTS:** Do NOT delete the fallback object. It is the last-resort guard against NaN/undefined in the PDF render. The STATE.md decision explicitly states "METRIC_DEFAULTS retained as last-resort fallback."
- **Adding `primarySourceType` to `AutomationOpportunity`:** Opportunities are generated by static templates in `generateOpportunityDrafts()`, not by AI inference over evidence — adding this field there is meaningless.
- **Separate AI call for metrics:** A second Gemini/Claude call for metrics only doubles cost. The model already has full evidence context in the hypothesis call.
- **Storing rendered range strings (e.g. "8-12 hours/week") in DB:** Keep numeric Low/Mid/High integers in DB; render the formatted range string at display time. This preserves downstream arithmetic in `metricsFromHypotheses()`.
- **Changing `metricsFromHypotheses()`:** This aggregation function reads `hoursSavedWeekMid` etc. from DB-persisted values. The existing averaging logic remains correct — it just gets better inputs now.

## Don't Hand-Roll

| Problem                | Don't Build               | Use Instead                                                             | Why                                                                                |
| ---------------------- | ------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Numeric range clamping | Custom validation library | Inline `clampInt`/`clampFloat` helpers                                  | Two helper functions are sufficient; adding a library for this is over-engineering |
| AI schema validation   | Custom JSON parser        | Existing `extractHypothesisJson()` + `METRIC_DEFAULTS` fallback pattern | Already handles `<reasoning>` block stripping and JSON parse errors                |
| Badge styling          | New CSS class             | Existing Tailwind pill pattern from analysis-section.tsx                | Consistent with `STATUS_PILL` and source type badge patterns already in the file   |

**Key insight:** The entire feature is an extension of existing patterns, not new infrastructure.

## Common Pitfalls

### Pitfall 1: NaN/undefined in PDF When Metrics Are Missing

**What goes wrong:** If the AI returns `null` or omits a metric field, `metricsFromHypotheses()` will compute `NaN` via `average([NaN, ...])` or `Math.round(undefined)`, causing the PDF to render literal "NaN" strings.

**Why it happens:** `average([])` returns `0` safely, but `average([NaN])` returns `NaN`. The `??` operator on `null` works, but on `undefined` in TypeScript the field may be `undefined` if the LLM omits it entirely from the JSON object.

**How to avoid:** The clamp helpers (`clampInt`, `clampFloat`) must handle `typeof val !== 'number'` (catches both `null` and `undefined`) and use the `METRIC_DEFAULTS` value as the fallback. Test: assert that a prospect with `hoursSavedWeekMid: null` in the DB still produces a numeric `hoursSavedWeek` from `metricsFromHypotheses()`.

**Warning signs:** `"NaN"` text in generated PDF or `metrics.hoursSavedWeek === NaN` in the WorkflowLossMap record.

### Pitfall 2: LLM Over-Generates or Hallucinates Invalid Source Types

**What goes wrong:** The model may return a `primarySourceType` that is not a valid `EvidenceSourceType` enum value (e.g. `"EMPLOYEE_REVIEW"` instead of `"REVIEWS"`).

**Why it happens:** LLM is probabilistic; the prompt may not be tight enough to constrain the output.

**How to avoid:** Build a `VALID_SOURCE_TYPES` set from the known enum values and check `VALID_SOURCE_TYPES.has(item.primarySourceType)`. If invalid, set to `null` (badge simply does not render).

```typescript
const VALID_SOURCE_TYPES = new Set([
  'WEBSITE',
  'DOCS',
  'CAREERS',
  'HELP_CENTER',
  'JOB_BOARD',
  'REVIEWS',
  'MANUAL_URL',
  'REGISTRY',
  'LINKEDIN',
  'NEWS',
]);
```

### Pitfall 3: DB Migration Not Applied Before Code Deploy

**What goes wrong:** Code that writes `primarySourceType` to `WorkflowHypothesis` will fail at runtime if the column doesn't exist in the DB.

**Why it happens:** Migration must be applied to the running Docker DB via `docker exec` before the code change is committed, per project pattern.

**How to avoid:** Apply the `ALTER TABLE` SQL first, then add the Prisma schema change, then run `npx prisma generate`, then commit. The migration file is created manually to match.

### Pitfall 4: Two AI Paths (Gemini + Claude) Must Both Emit New Fields

**What goes wrong:** The prompt is identical for both paths (Gemini default and Claude Sonnet). If the mapping step assumes the new fields exist and one model consistently omits them, that path always falls back to METRIC_DEFAULTS, defeating the feature.

**Why it happens:** Different models may follow different output format strictness.

**How to avoid:** Test both paths in unit tests. The existing `makeHypothesisResponse` and `makeClaudeHypothesisResponse` factory functions in `workflow-engine.test.ts` must be updated to include metric fields. Add MODEL-03 tests that assert `hoursSavedWeekMid !== 8` (default value) and that the returned value matches the mock.

### Pitfall 5: `regenerateForRun` in hypotheses.ts Router Does Not Go Through AI

**What goes wrong:** `hypothesesRouter.regenerateForRun` calls the legacy `generateHypothesisDrafts` (not `generateHypothesisDraftsAI`). If the planner only updates the AI path, re-runs triggered via the admin "regenerate" button will always produce `METRIC_DEFAULTS` values and no `primarySourceType`.

**Why it happens:** The router uses the sync fallback function directly (lines 191, 192 of hypotheses.ts).

**How to avoid:** This is a PRE-EXISTING tech debt situation. For Phase 34, the scope is the AI path only (main research executor). The `regenerateForRun` router path remains on static templates — this is acceptable since it is a rarely-used admin escape hatch. Document this as known limitation in the plan.

### Pitfall 6: `prospect-dashboard-client.tsx` Shows Metrics to Prospects — Range Format Required

**What goes wrong:** The public `/discover/` dashboard (`prospect-dashboard-client.tsx` lines 537-559) renders `hoursSavedWeekLow`, `hoursSavedWeekMid`, `hoursSavedWeekHigh` as "Xū (Low–Highū) per week". If the AI returns values where `Low > Mid` or `Mid > High` (e.g. due to LLM inconsistency), this will look wrong to the prospect.

**Why it happens:** The model may not always produce a strictly ascending low/mid/high triple.

**How to avoid:** Add a post-parse normalization step: ensure `low <= mid <= high` by sorting the three values. Example:

```typescript
const sorted = [
  item.hoursSavedWeekLow,
  item.hoursSavedWeekMid,
  item.hoursSavedWeekHigh,
]
  .map((v) => clampInt(v, 1, 80, METRIC_DEFAULTS.hoursSavedWeekLow))
  .sort((a, b) => a - b);
// sorted[0] = low, sorted[1] = mid, sorted[2] = high
```

## Code Examples

### AIHypothesisItem Extended Type

```typescript
// lib/workflow-engine.ts — replace existing AIHypothesisItem interface
interface AIHypothesisItem {
  title: string;
  problemStatement: string;
  assumptions: string[];
  validationQuestions: string[];
  workflowTag: string;
  confidenceScore: number;
  evidenceRefs: string[];
  // MODEL-03: AI-derived metric ranges
  primarySourceType?: string;
  hoursSavedWeekLow?: number;
  hoursSavedWeekMid?: number;
  hoursSavedWeekHigh?: number;
  handoffSpeedGainPct?: number;
  errorReductionPct?: number;
  revenueLeakageRecoveredLow?: number;
  revenueLeakageRecoveredMid?: number;
  revenueLeakageRecoveredHigh?: number;
}
```

### HypothesisDraft Extended Type (no change needed)

`HypothesisDraft` already has all the metric fields. The `primarySourceType` field needs to be added:

```typescript
export interface HypothesisDraft {
  title: string;
  problemStatement: string;
  assumptions: string[];
  confidenceScore: number;
  evidenceRefs: string[];
  validationQuestions: string[];
  hoursSavedWeekLow: number;
  hoursSavedWeekMid: number;
  hoursSavedWeekHigh: number;
  handoffSpeedGainPct: number;
  errorReductionPct: number;
  revenueLeakageRecoveredLow: number;
  revenueLeakageRecoveredMid: number;
  revenueLeakageRecoveredHigh: number;
  primarySourceType: string | null; // ANLYS-09 — new
}
```

### research-executor.ts DB Write (update the create call)

```typescript
await db.workflowHypothesis.create({
  data: {
    // ... existing fields
    hoursSavedWeekLow: hypothesis.hoursSavedWeekLow,
    hoursSavedWeekMid: hypothesis.hoursSavedWeekMid,
    hoursSavedWeekHigh: hypothesis.hoursSavedWeekHigh,
    handoffSpeedGainPct: hypothesis.handoffSpeedGainPct,
    errorReductionPct: hypothesis.errorReductionPct,
    revenueLeakageRecoveredLow: hypothesis.revenueLeakageRecoveredLow,
    revenueLeakageRecoveredMid: hypothesis.revenueLeakageRecoveredMid,
    revenueLeakageRecoveredHigh: hypothesis.revenueLeakageRecoveredHigh,
    primarySourceType: hypothesis.primarySourceType, // ANLYS-09 — new
  },
});
```

### FindingCard Badge (analysis-section.tsx)

```typescript
// Extend Finding type:
type Finding = {
  id: string;
  kind: 'hypothesis' | 'opportunity';
  title: string;
  summary: string;
  status: 'DRAFT' | 'ACCEPTED' | 'REJECTED' | 'PENDING' | 'DECLINED';
  confidenceScore: number;
  primarySourceType: string | null;  // ANLYS-09 — new
  evidenceItems: Array<{ id: string; sourceUrl: string; snippet: string; sourceType: string; title?: string | null }>;
  proofMatches: Array<{ id: string; score: number; proofTitle: string; useCase?: { id: string; title: string; category: string } | null }>;
};

// In toFinding():
function toFinding(raw: any, kind: 'hypothesis' | 'opportunity'): Finding {
  return {
    // ... existing fields
    primarySourceType: kind === 'hypothesis' ? (raw.primarySourceType ?? null) : null,
  };
}

// In FindingCard render, inside the pills row (after the "Challenge"/"Improvement" badge):
{finding.primarySourceType && (
  <span className="inline-flex items-center rounded-full border border-blue-200 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-blue-700 bg-blue-50/70 shrink-0">
    {finding.primarySourceType.replace(/_/g, ' ')}
  </span>
)}
```

## State of the Art

| Old Approach                                       | Current Approach                        | When Changed | Impact                                                                           |
| -------------------------------------------------- | --------------------------------------- | ------------ | -------------------------------------------------------------------------------- |
| Static metric defaults spread over every AI result | AI-derived context-sensitive ranges     | Phase 34     | Different prospects in different industries will produce different metric values |
| No source attribution                              | `primarySourceType` field on hypothesis | Phase 34     | Admin can see which source type most drove each hypothesis                       |

**Deprecated/outdated:**

- `...METRIC_DEFAULTS` spread unconditionally at line 913 of workflow-engine.ts: replaced by per-field clamp with METRIC_DEFAULTS as fallback only.

## Open Questions

1. **Should `AutomationOpportunity` also get `primarySourceType`?**
   - What we know: `generateOpportunityDrafts()` is a static template function — it does not call AI or receive evidence items. The Prisma schema has the same metric fields on `AutomationOpportunity`.
   - What's unclear: Whether Phase 34 scope covers opportunities too, or only hypotheses.
   - Recommendation: Hypotheses only (ANLYS-09 says "each hypothesis card"). OpportunityDraft already has no AI path; extending it would require a separate AI refactor.

2. **What metric calibration instructions produce the most realistic ranges for Dutch SMBs?**
   - What we know: The target market is Dutch non-tech companies 10-200 employees. METRIC_DEFAULTS current mid-point is 8 hours/week.
   - What's unclear: Whether the prompt instruction should include explicit employee-range-to-metric tables or just rely on the model's reasoning from evidence.
   - Recommendation: Include soft guidance ("Dutch SMBs 10-50 employees: typical 4-14 hours/week") rather than strict tables; the model should adjust up or down based on specific evidence.

3. **Does the `regenerateForRun` admin button need to be updated?**
   - What we know: It calls the legacy `generateHypothesisDrafts` sync function, not the AI path.
   - What's unclear: Whether admins use this path in practice.
   - Recommendation: Out of scope for Phase 34 — document as known limitation. The main research executor path is the production path.

## Sources

### Primary (HIGH confidence)

- Direct codebase audit — `lib/workflow-engine.ts`, `lib/research-executor.ts`, `components/features/prospects/analysis-section.tsx`, `prisma/schema.prisma`, `server/routers/hypotheses.ts`, `server/routers/assets.ts`, `components/public/prospect-dashboard-client.tsx`
- `.planning/REQUIREMENTS.md` — MODEL-03, ANLYS-09 requirements
- `.planning/STATE.md` — METRIC_DEFAULTS retained as fallback decision; generateWorkflowLossMapContent audit note; Phase 33-02 decisions

### Secondary (MEDIUM confidence)

- Existing test patterns in `lib/workflow-engine.test.ts` — confirmed test factory functions and mock shapes for AI path tests

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries already in project, no new dependencies
- Architecture: HIGH — all affected files audited directly; data flow is fully traced
- Pitfalls: HIGH — derived from direct code inspection, not assumptions

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable codebase, no fast-moving external dependencies)

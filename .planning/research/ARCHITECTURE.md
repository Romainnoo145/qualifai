# Architecture Patterns

**Project:** Qualifai — v3.0 Sharp Analysis milestone
**Domain:** Hypothesis generation rewrite + tech debt cleanup in existing Next.js sales automation app
**Researched:** 2026-03-02
**Confidence:** HIGH — all findings from direct codebase inspection

---

## Existing Architecture (Stable — No Structural Changes)

The pipeline is established. v3.0 makes targeted edits inside specific functions, not structural changes.

### Pipeline Overview

```
[Admin triggers research]
        │
        ▼
server/routers/research.ts
  → executeResearchRun() in lib/research-executor.ts
        │
        ├── Source discovery (sitemap, SERP, manual URLs)
        ├── Web ingestion    lib/web-evidence-adapter.ts
        │   └── Scrapling stealth + Crawl4AI two-tier
        ├── Deep sources     lib/enrichment/*.ts adapters
        │   └── reviews, LinkedIn, Google News, employee reviews, LinkedIn jobs, KvK
        ├── AI evidence scoring  lib/evidence-scorer.ts       ← Gemini Flash (unchanged)
        ├── Quality gate         lib/workflow-engine.ts       ← unchanged
        │
        ▼  ← ALL v3.0 CHANGES ARE HERE
        ├── generateHypothesisDraftsAI()  lib/workflow-engine.ts
        │   → pre-process evidence into tiers
        │   → configurable model (Gemini Flash or Claude Sonnet)
        │   → 1-3 hypotheses (not forced 3)
        │   → metrics: AI-estimated or null (not hardcoded)
        │   → HypothesisDraft[] → WorkflowHypothesis records in DB
        │
        └── generateOpportunityDrafts()  (unchanged)
```

### Component Boundaries

| Component            | File                                                   | Responsibility                  | Status for v3.0                                 |
| -------------------- | ------------------------------------------------------ | ------------------------------- | ----------------------------------------------- |
| Research router      | `server/routers/research.ts`                           | tRPC entry points               | MODIFY — add optional `hypothesisModel` input   |
| Research executor    | `lib/research-executor.ts`                             | Orchestrates full pipeline      | MODIFY — thread `model` param, fix SERP re-read |
| Hypothesis generator | `lib/workflow-engine.ts::generateHypothesisDraftsAI()` | AI evidence → hypotheses        | MODIFY — prompt, tiering, model, count, metrics |
| Evidence scorer      | `lib/evidence-scorer.ts`                               | Score items for relevance/depth | UNCHANGED — stays Gemini Flash                  |
| Web adapter          | `lib/web-evidence-adapter.ts`                          | Two-tier web extraction         | UNCHANGED                                       |
| Quality config       | `lib/quality-config.ts`                                | Shared threshold constants      | UNCHANGED                                       |
| Prospect detail page | `app/admin/prospects/[id]/page.tsx`                    | Admin UI                        | MODIFY — fix `as any` casts                     |
| Dashboard client     | `components/public/prospect-dashboard-client.tsx`      | Client-facing UI                | MODIFY — remove unused `logoUrl` prop           |

---

## Change 1: Evidence Pre-processing and Prompt Rewrite

### Current Behavior

Evidence sorted by `aiRelevance ?? confidenceScore`, top 15 items passed to prompt. All items get a 600-char snippet cap. Prompt says "sorted by relevance" but treats all source types identically. Model is instructed to produce exactly 3 hypotheses regardless of evidence quality.

### Problem

Reviews, employee reviews, and job postings carry the strongest pain signal (source weights: REVIEWS 0.90, LINKEDIN 0.88, CAREERS/JOB_BOARD 0.85) but are truncated the same as WEBSITE items (weight 0.65). The AI model has no way to know which sources are high-signal external pain indicators versus generic website context. Hypothesis count is forced to 3 even when evidence supports only 1 credible hypothesis.

### Integration Points

Single function: `generateHypothesisDraftsAI()` in `lib/workflow-engine.ts` — the prompt construction block and response handling. No schema changes. No new files.

### Approach: Evidence Tiering

Add `tierEvidence()` helper inside `workflow-engine.ts`. This is a pure function, not exported.

```typescript
const HIGH_SIGNAL_SOURCES = new Set<EvidenceSourceType>([
  'REVIEWS',
  'LINKEDIN',
  'CAREERS',
  'JOB_BOARD',
  'NEWS',
  'REGISTRY',
]);

interface EvidenceTier {
  tierA: AIEvidenceInput[]; // external pain signals — reviews, hiring, LinkedIn, news, KvK
  tierB: AIEvidenceInput[]; // context — website, docs, help center, manual URLs
}

function tierEvidence(evidence: AIEvidenceInput[]): EvidenceTier {
  return {
    tierA: evidence.filter((e) => HIGH_SIGNAL_SOURCES.has(e.sourceType)),
    tierB: evidence.filter((e) => !HIGH_SIGNAL_SOURCES.has(e.sourceType)),
  };
}
```

Then in `generateHypothesisDraftsAI()`, replace the current flat sort + slice with:

```typescript
const tiers = tierEvidence(filteredEvidence);

// Sort each tier by aiRelevance, take top items from each tier
const topTierA = tiers.tierA
  .sort(
    (a, b) =>
      (parseAiRelevance(b) ?? b.confidenceScore) -
      (parseAiRelevance(a) ?? a.confidenceScore),
  )
  .slice(0, 8); // up to 8 high-signal items

const topTierB = tiers.tierB
  .sort(
    (a, b) =>
      (parseAiRelevance(b) ?? b.confidenceScore) -
      (parseAiRelevance(a) ?? a.confidenceScore),
  )
  .slice(0, 7); // up to 7 context items (8+7 = 15 total, same budget)

// Build evidence lines with different snippet budgets
const tierALines = topTierA.map((item) => {
  const relevance = parseAiRelevance(item);
  const tag = relevance !== null ? ` (relevance: ${relevance.toFixed(2)})` : '';
  return `[HIGH-SIGNAL: ${item.sourceType}]${tag} ${item.sourceUrl}: ${item.snippet.slice(0, 1200)}`;
});

const tierBLines = topTierB.map((item) => {
  const relevance = parseAiRelevance(item);
  const tag = relevance !== null ? ` (relevance: ${relevance.toFixed(2)})` : '';
  return `[CONTEXT: ${item.sourceType}]${tag} ${item.sourceUrl}: ${item.snippet.slice(0, 400)}`;
});
```

### Prompt Changes

Replace the current instruction `"identify 3 distinct workflow pain hypotheses"` with:

```
Identify 1 to 3 distinct workflow pain hypotheses, depending on how many are genuinely
supported by evidence. Only output hypotheses with confidenceScore >= 0.65. If the
evidence only clearly supports 1 hypothesis, return 1. Do not fabricate hypotheses
to reach a count of 3.

HIGH-SIGNAL evidence (reviews, hiring, LinkedIn, news, registry) is external validation
from third parties — weight it heavily. CONTEXT evidence (website pages) is supporting
background — use it to understand the company but do not treat it as pain confirmation
unless HIGH-SIGNAL evidence corroborates it.
```

### Response Handling Change

Remove implicit expectation of 3 items. Keep only the `parsed.length === 0` rejection. Add a post-parse quality filter:

```typescript
const validHypotheses = parsed.filter(
  (item) =>
    typeof item.confidenceScore === 'number' && item.confidenceScore >= 0.6,
);
if (validHypotheses.length === 0) {
  throw new Error(
    'AI returned no hypotheses meeting minimum quality threshold',
  );
}
```

### Build Order Dependency

None. Self-contained change to `generateHypothesisDraftsAI()`. Implement and test first before adding model selection.

---

## Change 2: Configurable Model Selection

### Current State

`generateHypothesisDraftsAI()` hardcodes `getGenAI().getGenerativeModel({ model: 'gemini-2.0-flash' })`. The `@anthropic-ai/sdk: ^0.73.0` package is already installed. `ANTHROPIC_API_KEY` is already declared optional in `env.mjs`. The file already uses Anthropic SDK elsewhere — `scoreWithClaude()` for proof matching at line 1408.

### Integration Points

- `lib/workflow-engine.ts` — function signature, new client init, Claude invocation path
- `lib/research-executor.ts` — pass optional `model` param through to `generateHypothesisDraftsAI()`
- `server/routers/research.ts` — add optional `hypothesisModel` input to `startRun` and `retryRun`
- `env.mjs` — no changes needed (ANTHROPIC_API_KEY already there)

### Approach: Per-Run Parameter, Not Global Config

Add `model` as an optional parameter to `generateHypothesisDraftsAI()` with a default of `'gemini-flash'`. Existing callers need zero changes because of the default.

```typescript
type HypothesisModel = 'gemini-flash' | 'claude-sonnet';

export async function generateHypothesisDraftsAI(
  evidence: AIEvidenceInput[],
  prospectContext: AIProspectContext,
  options?: { model?: HypothesisModel },
): Promise<HypothesisDraft[]>;
```

Add a lazy Anthropic client alongside the existing `genaiClient`, following the same pattern:

```typescript
import Anthropic from '@anthropic-ai/sdk';

let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY! });
  }
  return anthropicClient;
}
```

Inside `generateHypothesisDraftsAI()`, branch on model only for the actual API call. All evidence pre-processing (tiering, snippet truncation, prompt construction) is shared:

```typescript
let text: string;
if (options?.model === 'claude-sonnet') {
  const response = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });
  text = response.content[0].type === 'text' ? response.content[0].text : '';
} else {
  // default: Gemini Flash
  const model = getGenAI().getGenerativeModel({ model: 'gemini-2.0-flash' });
  const response = await model.generateContent(prompt);
  text = response.response.text();
}
```

Use `claude-sonnet-4-5` as the Claude model — production-grade balance of quality vs. cost. Opus is too expensive per research run (~$0.15 vs ~$0.02 for Sonnet). Flash is already available for the Gemini path.

### Router Change

```typescript
// server/routers/research.ts — startRun input
z.object({
  prospectId: z.string(),
  campaignId: z.string().optional(),
  manualUrls: z.array(z.string().url()).default([]),
  deepCrawl: z.boolean().default(false),
  hypothesisModel: z.enum(['gemini-flash', 'claude-sonnet']).optional(), // NEW
});
```

Thread through `executeResearchRun()` in `research-executor.ts`:

```typescript
// lib/research-executor.ts — executeResearchRun signature
export async function executeResearchRun(
  db: PrismaClient,
  input: {
    prospectId: string;
    campaignId?: string;
    manualUrls: string[];
    existingRunId?: string;
    deepCrawl?: boolean;
    hypothesisModel?: 'gemini-flash' | 'claude-sonnet'; // NEW
  },
);
```

Pass to the call site:

```typescript
const hypotheses = await generateHypothesisDraftsAI(
  evidenceRecords.map(...),
  { companyName: ..., industry: ..., specialties: ..., description: ... },
  { model: input.hypothesisModel }, // NEW
);
```

### Build Order Dependency

Implement after Change 1. The prompt rewrite should be tested and verified working before adding model-routing complexity. Both share the same prompt string, so verifying the prompt is correct on one model first reduces debugging surface.

---

## Change 3: Variable Hypothesis Count (1-3)

Covered in Change 1 (prompt instruction change and response validation). No separate integration work beyond what is described there.

The `WorkflowHypothesis` table accepts any number of rows per run. `research-executor.ts` iterates `hypotheses` array with `for...of` — a single hypothesis is as valid as three. No schema change needed.

---

## Change 4: Remove or Derive Metric Defaults

### Current Behavior

`METRIC_DEFAULTS` constant in `generateHypothesisDraftsAI()` spreads hardcoded numbers onto every hypothesis:

```typescript
const METRIC_DEFAULTS = {
  hoursSavedWeekLow: 4,
  hoursSavedWeekMid: 8,
  hoursSavedWeekHigh: 14,
  handoffSpeedGainPct: 28,
  errorReductionPct: 20,
  revenueLeakageRecoveredLow: 400,
  revenueLeakageRecoveredMid: 900,
  revenueLeakageRecoveredHigh: 2000,
};
```

### Schema Constraint

`WorkflowHypothesis` already has all metric fields as nullable (`Int?`, `Float?`). No schema migration needed to pass `null`.

### Critical Dependency Check Required Before Implementing

The loss map generator reads metrics from hypothesis records. Before removing `METRIC_DEFAULTS`, read `generateWorkflowLossMapContent()` in `lib/workflow-engine.ts` (not read in this research pass — file was too large). Determine whether it reads `hoursSavedWeekLow/Mid/High` from the DB record or re-computes them from evidence.

**If metrics are read from DB:** Removing defaults will produce null metrics in the loss map. The loss map generator must be updated to handle nulls (e.g., fallback to evidence-derived estimates or omit the metric block).

**If metrics are re-computed:** Remove `METRIC_DEFAULTS` safely, pass `null` for all metric fields to `db.workflowHypothesis.create()`.

### Recommended Approach (after dependency check)

Option A — Ask AI to estimate metrics (preferred when the dependency check clears):

Add metric fields to the JSON schema in the prompt:

```
"hoursSavedWeekLow": <integer, estimated hours saved per week, conservative>,
"hoursSavedWeekMid": <integer, estimated hours saved per week, realistic>,
"hoursSavedWeekHigh": <integer, estimated hours saved per week, optimistic>,
"errorReductionPct": <integer 0-50, estimated error rate reduction percentage>
```

Keep `METRIC_DEFAULTS` as a fallback if AI returns null/invalid values. The defaults become a last-resort fallback rather than the primary value.

### Build Order Dependency

Phase C — do after Changes 1 and 2 are verified. Read loss map generator first.

---

## Tech Debt Fixes: Integration Map

Each fix is independent. All can be done in a single cleanup phase.

### TD-1: Import Ordering in workflow-engine.ts

**Location:** Lines 538-544. A `export { ... }` re-export of `computeTrafficLight` appears before two `import` statements from the same module (`@/lib/quality-config`).

```typescript
// Line 539: export first (wrong position)
export { computeTrafficLight, type TrafficLight } from '@/lib/quality-config';
// Lines 540-544: imports after export (wrong — ESM hoisting makes it work but misleads readers)
import {
  MIN_AVERAGE_CONFIDENCE,
  PAIN_CONFIRMATION_MIN_SOURCES,
} from '@/lib/quality-config';
import type { TrafficLight } from '@/lib/quality-config';
```

**Fix:** Move the two `import` statements to the top import block of the file. Move the `export` re-export with the other re-exports (around line 539). The file already has a logical import section at the top — these two imports should be there.

**Risk:** Low. Pure cosmetic ordering. No runtime impact.

---

### TD-2: Unused logoUrl Prop in DashboardClient

**Location:** `components/public/prospect-dashboard-client.tsx` line 72 — `logoUrl: string | null` in `DashboardClientProps`.

**Verification needed first:** The grep shows `app/discover/[slug]/page.tsx:247: logoUrl={prospect.logoUrl}` — the prop IS being passed. Search inside `DashboardClient` component body for actual usage of `logoUrl` (rendering a logo image element). If the prop is in the interface but never accessed in the JSX render, it is dead code.

**Fix if unused:** Remove `logoUrl: string | null` from `DashboardClientProps` interface. Remove `logoUrl={prospect.logoUrl}` from the call site in `app/discover/[slug]/page.tsx` line 247. TypeScript will confirm no other usages.

**Risk:** Low. TypeScript catches any missed usages at compile time.

---

### TD-3: Detail-View `as any` Prisma Cast

**Location:** `app/admin/prospects/[id]/page.tsx` lines 155, 179, 194, 198, 201.

**Root cause:** The `research.listRuns` query uses `include` without explicit `select`, which should include all scalar fields. The `as any` casts appear because tRPC's deep type inference fails (TS2589 — type instantiation too deep) on the complex Prisma return type. This is the established project pattern per MEMORY.md: "TS2589 deep inference: cast Prisma results as any, re-type via helper functions."

**Fix:** Create a typed helper in the component file:

```typescript
// In app/admin/prospects/[id]/page.tsx

// tRPC inferred return type from research.listRuns
type ResearchRunRow = NonNullable<
  ReturnType<typeof api.research.listRuns.useQuery>['data']
>[number];

function getRunFields(run: ResearchRunRow) {
  // Cast once here, re-typed by the return shape
  const r = run as typeof run & {
    qualityApproved: boolean | null;
    qualityReviewedAt: Date | null;
    summary: Record<string, unknown> | null;
  };
  return {
    qualityApproved: r.qualityApproved ?? null,
    qualityReviewedAt: r.qualityReviewedAt ?? null,
    summary: r.summary,
  };
}
```

Then replace `(researchRuns.data[0] as any).qualityApproved` → `getRunFields(researchRuns.data[0]).qualityApproved` etc.

**Risk:** Low. Improves type safety. Runtime behavior unchanged.

---

### TD-4: TS2589 Deep Prisma `as any` Casts (Broader)

**Affected files:** `app/admin/prospects/page.tsx`, `app/admin/contacts/[id]/page.tsx`, `app/admin/outreach/page.tsx`, `app/admin/signals/page.tsx`, `app/admin/campaigns/[id]/page.tsx`, `app/admin/contacts/page.tsx`.

**Pattern:** Same root cause as TD-3. Apply the same typed-helper approach per file. Each cast site is a 5-10 line fix.

**Priority within tech debt:** Lower than TD-3. Fix TD-3 first as the canonical example, then apply same pattern to other files.

**Risk:** Low individually. Medium in aggregate (6 files). Run `npm run check` after each file.

---

### TD-5: E2E Send Test Bypasses tRPC Quality Gate

**Location:** Test script calls Resend API directly, bypassing the tRPC `outreach.sendSequence` mutation and its quality gate checks.

**Fix:** Rewrite the E2E send test to:

1. Set up a test prospect with `qualityApproved: true` in the DB (via tRPC `research.approveQuality` mutation)
2. Call `outreach.sendSequence` tRPC mutation (not Resend directly)
3. Assert expected Resend calls via mock/stub

**Risk:** Medium. Test infrastructure change. Validate the new test passes before removing the old one. This fix may surface bugs in the quality gate check — which is the point.

---

### TD-6: SERP Cache Re-read After Overwrite

**Location:** `lib/research-executor.ts` — the `deepCrawl` block re-reads `inputSnapshot` from DB (line ~320) after `run.create/update` already overwrote it earlier in the function.

**Root cause:** The function reads the prior snapshot for sitemap/SERP cache before the run create/update (`priorSnapshot`). Then after the run is created/updated (which overwrites `inputSnapshot`), the deepCrawl block does another `db.researchRun.findUnique` to get `serpCache`. This second read returns the newly-written snapshot which may not have the old `serpCache` key — or may have it if the write preserved it. The `useSerpFromSourceSet` flag computed before the overwrite is the correct primary guard.

**Fix:**

```typescript
// Remove this block inside the deepCrawl branch (~line 316-330):
const existingSnapshot = input.existingRunId
  ? (await db.researchRun.findUnique({ where: { id: input.existingRunId }, select: { inputSnapshot: true } }))?.inputSnapshot
  : null;
const serpCache = extractSerpCache(existingSnapshot);
const isCacheValid = useSerpFromSourceSet || (serpCache !== null && ...);
```

Replace with:

```typescript
// Use only useSerpFromSourceSet (computed before the overwrite, from priorSourceSet)
const isCacheValid = useSerpFromSourceSet;
```

If `isCacheValid` is true, reconstruct the serpResult from `priorSourceSet.urls` (filtered to `provenance === 'serp'`) — this data was already extracted before the overwrite.

**Risk:** Medium. Cache logic is subtle. Verify with a re-run test that the SERP cache is correctly reused when `serpDiscoveredAt` is less than 24 hours old, and correctly refreshed when older.

---

## Data Flow: Before and After

### Before (current v2.2)

```
evidence[] (up to 60 items, deduped)
  → scoreEvidenceBatch()    → aiRelevance/aiDepth/finalConfidence on each
  → sort all by aiRelevance, take top 15
  → truncate all snippets to 600 chars
  → single Gemini Flash call → exactly 3 hypotheses
  → spread METRIC_DEFAULTS onto each
  → save to DB
```

### After (v3.0 target)

```
evidence[] (up to 60 items, deduped)
  → scoreEvidenceBatch()    → aiRelevance/aiDepth/finalConfidence on each (unchanged)
  → tierEvidence()          → Tier A (REVIEWS/LINKEDIN/CAREERS/JOB_BOARD/NEWS/REGISTRY)
                               + Tier B (WEBSITE/DOCS/HELP_CENTER/MANUAL_URL)
  → sort each tier by aiRelevance
  → take top 8 Tier A + top 7 Tier B (= 15 total, same budget)
  → Tier A: 1200-char snippets; Tier B: 400-char snippets
  → prompt explicitly labels HIGH-SIGNAL vs CONTEXT evidence
  → configurable model: Gemini Flash (default) or Claude Sonnet (optional)
  → 1-3 hypotheses based on evidence quality (not forced 3)
  → metrics: AI-estimated with METRIC_DEFAULTS fallback (or null if loss map verified)
  → save to DB
```

### What Does Not Change

- All 8+ evidence source adapters
- `evidence-scorer.ts` — stays Gemini Flash (latency-sensitive, no benefit from Claude here)
- `evaluateQualityGate()` — unchanged
- `WorkflowHypothesis` DB schema — metric fields already nullable
- `research-executor.ts` orchestration — only the `generateHypothesisDraftsAI()` call site changes
- tRPC router structure — one new optional field per mutation

---

## Build Order

### Phase A: Prompt Rewrite + Evidence Tiering (highest value, lowest risk)

1. Add `tierEvidence()` helper function inside `lib/workflow-engine.ts`
2. Replace flat sort + 600-char truncation with tiered approach (8 Tier A + 7 Tier B)
3. Rewrite prompt to label HIGH-SIGNAL vs CONTEXT evidence
4. Change "exactly 3" to "1 to 3 based on quality"
5. Add post-parse quality filter (`confidenceScore >= 0.60`)
6. Verify with manual test run against real prospects

### Phase B: Configurable Model Selection

Dependency: Phase A complete and verified.

1. Add `anthropicClient` lazy init alongside existing `genaiClient` in `lib/workflow-engine.ts`
2. Add `model?: HypothesisModel` parameter to `generateHypothesisDraftsAI()`
3. Add Claude invocation path (branch on model, share all pre-processing)
4. Add `hypothesisModel` optional input to `research.startRun` and `research.retryRun` in router
5. Thread parameter through `executeResearchRun()` in `research-executor.ts`

### Phase C: Metric Defaults (verify dependency first)

Dependency: Read `generateWorkflowLossMapContent()` before implementing.

1. Read loss map generator — determine if metrics come from DB or are re-computed
2. If re-computed: remove `METRIC_DEFAULTS`, pass null to DB
3. If read from DB: add metric estimation to prompt, keep METRIC_DEFAULTS as fallback

### Phase D: Tech Debt (independent, any sub-order)

- TD-1: Import ordering in `workflow-engine.ts` (5 min)
- TD-2: `logoUrl` prop — verify rendering, then remove (15 min)
- TD-3: Detail-view `as any` casts via `getRunFields()` helper (30 min)
- TD-6: SERP cache re-read removal in `research-executor.ts` (45 min, logic-sensitive)
- TD-4: Remaining `as any` casts in admin pages (60 min, systematic across 6 files)
- TD-5: E2E send test tRPC refactor (60 min, requires test env)

---

## New vs Modified Components

| Component                                              | Status   | What Changes                                                       |
| ------------------------------------------------------ | -------- | ------------------------------------------------------------------ |
| `lib/workflow-engine.ts::generateHypothesisDraftsAI()` | Modified | Prompt, evidence tiering, model selection, variable count          |
| `lib/workflow-engine.ts` (module level)                | Modified | New `anthropicClient` lazy init, new `tierEvidence()` helper       |
| `lib/workflow-engine.ts` (import ordering)             | Modified | Move imports to top, fix export ordering                           |
| `lib/research-executor.ts`                             | Modified | Thread optional `model` param, remove SERP cache re-read           |
| `server/routers/research.ts`                           | Modified | Add optional `hypothesisModel` input to `startRun`/`retryRun`      |
| `app/admin/prospects/[id]/page.tsx`                    | Modified | Replace `as any` casts with `getRunFields()` typed helper          |
| `components/public/prospect-dashboard-client.tsx`      | Modified | Remove unused `logoUrl` prop from interface                        |
| `app/discover/[slug]/page.tsx`                         | Modified | Remove `logoUrl={prospect.logoUrl}` from DashboardClient call site |
| Other admin pages (6 files)                            | Modified | Apply typed-helper pattern for remaining `as any` casts            |

**No new files required.** All changes are in-place modifications to existing files.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Global Model Config via Environment Variable

Defining `HYPOTHESIS_MODEL=claude` in `.env`, read in `workflow-engine.ts`.

**Why bad:** Makes per-run model comparison impossible. Couples model selection to deployment config, not user intent. The correct scope is per-run parameter.

**Instead:** Optional `model` parameter on the function, defaulting to `gemini-flash`.

---

### Anti-Pattern 2: Separate Module for Claude Hypothesis Generation

Creating `lib/claude-hypothesis-generator.ts` that duplicates evidence formatting and prompt logic.

**Why bad:** Splits hypothesis generation across two files. Prompt improvements must be mirrored. Evidence tiering is shared regardless of model.

**Instead:** Single `generateHypothesisDraftsAI()` function that branches on `options.model` only for the API call. All pre-processing is shared.

---

### Anti-Pattern 3: Second AI Call to Re-rank Evidence

Adding another Gemini call to summarize or rank evidence before passing it to hypothesis generation.

**Why bad:** `evidence-scorer.ts` already provides `aiRelevance` on every item. The issue is not that relevance scores are absent — it is that the prompt does not communicate source-type priority to the model. Adding a second AI call doubles latency and cost for zero gain.

**Instead:** Use existing `aiRelevance` scores for sort order within each tier. Use source type membership to determine tier. Zero extra API calls.

---

### Anti-Pattern 4: Removing METRIC_DEFAULTS Without Checking Downstream

Deleting `METRIC_DEFAULTS` and passing all-null metrics to the DB without first verifying what reads those fields.

**Why bad:** `generateWorkflowLossMapContent()` in `workflow-engine.ts` may read metric fields from the DB record to populate the loss map PDF. Null metrics would break loss map generation silently — the loss map would render with no numbers, which is a worse user experience than hardcoded numbers.

**Instead:** Read the loss map generator first. If it reads from DB, update it to handle nulls before removing defaults.

---

## Scalability Considerations

Not an immediate concern at 7 prospects, documented for reference.

| Concern                          | At 50 prospects        | At 500 prospects                                    |
| -------------------------------- | ---------------------- | --------------------------------------------------- |
| Claude Sonnet per hypothesis run | ~$0.02/run, negligible | ~$10/month if all re-run monthly — still negligible |
| Gemini Flash evidence scoring    | ~$0.0004/run           | ~$0.20/month — negligible                           |
| Hypothesis count variability     | No impact              | Slightly reduces token output                       |

---

## Confidence Assessment

| Area                          | Confidence | Notes                                                                         |
| ----------------------------- | ---------- | ----------------------------------------------------------------------------- |
| Evidence tiering approach     | HIGH       | Source weights are documented in `evidence-scorer.ts` and confirmed accurate  |
| Model selection via parameter | HIGH       | Anthropic SDK already installed and used in the same file                     |
| Variable hypothesis count     | HIGH       | Schema supports any count; response handling needs only minor change          |
| Metric defaults removal       | MEDIUM     | Depends on reading `generateWorkflowLossMapContent()` — not read in this pass |
| TD-1 through TD-4             | HIGH       | All confirmed via direct code inspection                                      |
| TD-5 (E2E test)               | MEDIUM     | Test infrastructure complexity unknown without reading test files             |
| TD-6 (SERP cache)             | MEDIUM     | Logic is subtle; the fix approach is clear but carries regression risk        |

---

## Sources

All findings are from direct codebase inspection (2026-03-02):

- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/workflow-engine.ts` — full `generateHypothesisDraftsAI()` function, `METRIC_DEFAULTS`, import ordering anomaly, `scoreWithClaude()` Anthropic pattern
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/research-executor.ts` — full orchestration, SERP re-read location, `generateHypothesisDraftsAI()` call site
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/evidence-scorer.ts` — source weights, Gemini Flash integration pattern
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/web-evidence-adapter.ts` — evidence extraction, snippet lengths
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/quality-config.ts` — existing threshold constants
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/research.ts` — `startRun`, `retryRun`, `listRuns` query shape
- `/home/klarifai/Documents/klarifai/projects/qualifai/app/admin/prospects/[id]/page.tsx` — `as any` cast locations
- `/home/klarifai/Documents/klarifai/projects/qualifai/components/public/prospect-dashboard-client.tsx` — `logoUrl` prop location
- `/home/klarifai/Documents/klarifai/projects/qualifai/prisma/schema.prisma` — `WorkflowHypothesis` nullable metric fields confirmed
- `/home/klarifai/Documents/klarifai/projects/qualifai/package.json` — `@anthropic-ai/sdk: ^0.73.0` confirmed installed, `@google/generative-ai: ^0.24.1` confirmed
- `/home/klarifai/Documents/klarifai/projects/qualifai/env.mjs` — `ANTHROPIC_API_KEY` and `GOOGLE_AI_API_KEY` both declared optional

---

_Architecture research for: Qualifai v3.0 — Sharp Analysis_
_Researched: 2026-03-02_

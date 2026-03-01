# Architecture Research

**Domain:** Sales intelligence pipeline — verified pain evidence with source discovery, browser extraction, confirmation gating, and audit trail
**Researched:** 2026-03-02
**Confidence:** HIGH — based on direct codebase inspection, not search results

---

## Prior Architecture (v2.0–v2.1 Research)

The prior ARCHITECTURE.md (written for v2.0) documents the research quality gate, hypothesis status transitions, one-click send queue, and pipeline stage visibility. Those features are **implemented and live**. This document supersedes it for v2.2 planning purposes.

The key structural facts from that implementation that constrain v2.2:

- `ResearchRun` has `qualityApproved Boolean?`, `qualityReviewedAt DateTime?`, `qualityNotes String?` for the existing quality gate
- `executeResearchRun()` in `lib/research-executor.ts` orchestrates the full pipeline synchronously
- `inputSnapshot` JSON on `ResearchRun` already stores `sitemapCache` and `serpCache` objects with 24h TTL
- Scrapling microservice at port 3010 already has `/fetch` (stealth) and `/fetch-dynamic` (browser) endpoints; `fetchDynamic()` in `lib/enrichment/scrapling.ts` exists but is not called from the pipeline
- `evaluatePainConfirmation()` in `lib/workflow-engine.ts` is a prototype pain confirmation check embedded inside `evaluateQualityGate()` but its result is only advisory (stored in `summary.gate.painConfirmation`)
- The send queue in `outreach.ts` checks `qualityApproved === true` before allowing sends

---

## v2.2 Feature Map

Four features must integrate with the existing architecture:

| Feature                                        | Integration Point                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| Automatic source URL discovery with provenance | Replaces inline sitemap + default-path logic in `research-executor.ts`   |
| Browser-rendered evidence extraction           | New step in pipeline using existing `fetchDynamic()` from `scrapling.ts` |
| Pain confirmation gate blocking outreach       | New gate evaluated in pipeline; checked in send queue                    |
| Override audit trail                           | New DB model; written when admin bypasses failing gate                   |

---

## System Overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         Admin Console (Next.js 16)                          │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │  Research Panel  │  │  Evidence Viewer  │  │  Send Queue              │  │
│  │  [Start Run]     │  │  [Approve items]  │  │  [blocked by pain gate]  │  │
│  └────────┬─────────┘  └────────┬──────────┘  └─────────────┬────────────┘  │
└───────────┼────────────────────┼─────────────────────────────┼──────────────┘
            │ tRPC               │ tRPC                         │ tRPC
┌───────────▼────────────────────▼─────────────────────────────▼──────────────┐
│                         tRPC Routers (server/routers/)                        │
│  research.ts — startRun / retryRun / approveQuality [+ write GateOverrideAudit]│
│  outreach.ts — send queue [+ check painGatePassed OR override exists]          │
└────────────────────────────┬─────────────────────────────────────────────────┘
                             │ calls
┌────────────────────────────▼─────────────────────────────────────────────────┐
│                   Research Executor (lib/research-executor.ts)                 │
│                                                                                │
│  Phase 1: Source Discovery                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  [NEW] discoverSourcesForProspect() → ProspectSourceSet                 │ │
│  │    sitemap  → provenance: 'sitemap'                                     │ │
│  │    SERP     → provenance: 'serp'     (if deepCrawl)                     │ │
│  │    manual   → provenance: 'manual'                                      │ │
│  │    defaults → provenance: 'default'  (if sitemap empty)                 │ │
│  │    Sets jsHeavyHint: true for SPA-fingerprinted URLs                    │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                                │
│  Phase 2: Evidence Extraction                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  ingestWebsiteEvidenceDrafts()     → Scrapling /fetch  (unchanged)      │ │
│  │  [NEW] ingestBrowserEvidenceDrafts() → Scrapling /fetch-dynamic         │ │
│  │    └─ only for jsHeavyHint=true or stealth < 500 chars; capped at 5     │ │
│  │  [8 other source adapters: KvK, LinkedIn, Google News, etc. — unchanged]│ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                                │
│  Phase 3: Scoring + Gating                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  scoreEvidenceBatch()          → Gemini Flash  (unchanged)              │ │
│  │  evaluateQualityGate()         → TrafficLight  (unchanged)              │ │
│  │  [NEW] evaluatePainConfirmationGate() → PainGateResult                  │ │
│  │    - min 1 external source (REVIEWS or JOB_BOARD, aiRelevance >= 0.65)  │ │
│  │    - min 1 non-own-website confirmed source (cross-source requirement)  │ │
│  │    - min 2 distinct workflowTags with aiRelevance >= 0.65               │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                                │
│  Phase 4: Hypothesis Generation (unchanged)                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  generateHypothesisDraftsAI() / generateOpportunityDrafts()             │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                                │
│  Persist: ResearchRun with painGatePassed + painGateDetails (new fields)       │
└────────────────────────────┬─────────────────────────────────────────────────┘
                             │ HTTP
┌────────────────────────────▼─────────────────────────────────────────────────┐
│                          External Services                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │ Scrapling :3010   │  │ Crawl4AI :11235  │  │ SerpAPI (cloud)          │   │
│  │ /fetch (stealth)  │  │ /crawl (browser) │  │ google + maps + jobs     │   │
│  │ /fetch-dynamic    │  │                  │  │                          │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘   │
│  ┌──────────────────┐  ┌──────────────────┐                                  │
│  │ Gemini Flash      │  │ KvK API          │                                  │
│  │ evidence scoring  │  │ registry data    │                                  │
│  └──────────────────┘  └──────────────────┘                                  │
└────────────────────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────────────────┐
│                          PostgreSQL (Prisma)                                    │
│  ResearchRun (+painGatePassed, +painGateDetails)                               │
│  EvidenceItem  WorkflowHypothesis  [NEW: GateOverrideAudit]                    │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

| Component                            | Responsibility                                    | Status for v2.2                                                    |
| ------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------ |
| `lib/research-executor.ts`           | Orchestrates all pipeline phases                  | MODIFY — integrate source discovery, browser extraction, pain gate |
| `lib/enrichment/sitemap.ts`          | Discovers URLs from domain sitemap.xml            | UNCHANGED                                                          |
| `lib/enrichment/serp.ts`             | SerpAPI discovery (Google Maps, Jobs, Search)     | UNCHANGED                                                          |
| `lib/enrichment/scrapling.ts`        | Scrapling client; `fetchDynamic()` already exists | UNCHANGED — just needs to be called                                |
| `lib/enrichment/crawl4ai.ts`         | Crawl4AI browser extraction for SERP URLs         | UNCHANGED                                                          |
| `lib/web-evidence-adapter.ts`        | Converts HTML to EvidenceDraft objects            | UNCHANGED — reused by browser adapter                              |
| `lib/evidence-scorer.ts`             | Gemini Flash AI scoring                           | UNCHANGED                                                          |
| `lib/workflow-engine.ts`             | Quality gate, pain confirmation prototype         | UNCHANGED — pain gate promoted to new file                         |
| `lib/quality-config.ts`              | Traffic-light thresholds                          | ADD pain gate constants                                            |
| `server/routers/research.ts`         | tRPC research endpoints                           | MODIFY — audit log write in `approveQuality`                       |
| `server/routers/outreach.ts`         | Send queue                                        | MODIFY — add pain gate check                                       |
| `lib/enrichment/source-discovery.ts` | Unified URL discovery with provenance tagging     | NEW                                                                |
| `lib/browser-evidence-adapter.ts`    | JS-heavy page extraction via `/fetch-dynamic`     | NEW                                                                |
| `lib/pain-gate.ts`                   | Cross-source pain confirmation gate               | NEW                                                                |
| Schema: `ResearchRun` pain fields    | `painGatePassed`, `painGateDetails`               | NEW FIELDS                                                         |
| Schema: `GateOverrideAudit` model    | Immutable override audit log                      | NEW MODEL                                                          |

---

## Recommended Project Structure

v2.2 features slot into the existing structure with no new top-level directories:

```
lib/
├── enrichment/
│   ├── sitemap.ts              # UNCHANGED
│   ├── serp.ts                 # UNCHANGED
│   ├── scrapling.ts            # UNCHANGED — fetchDynamic() called by new adapter
│   ├── crawl4ai.ts             # UNCHANGED
│   ├── source-discovery.ts     # NEW — unified discovery with provenance tags
│   └── ...
├── web-evidence-adapter.ts     # UNCHANGED — extractWebsiteEvidenceFromHtml() reused
├── browser-evidence-adapter.ts # NEW — wraps fetchDynamic() for JS-heavy pages
├── pain-gate.ts                # NEW — cross-source confirmation gate
├── quality-config.ts           # MODIFIED — add PAIN_GATE_* constants
├── research-executor.ts        # MODIFIED — wire all three new components
├── workflow-engine.ts          # UNCHANGED — evaluatePainConfirmation stays as-is
└── evidence-scorer.ts          # UNCHANGED

server/routers/
├── research.ts                 # MODIFIED — GateOverrideAudit write in approveQuality
├── outreach.ts                 # MODIFIED — pain gate check in send queue
└── ...

prisma/
└── schema.prisma               # ADD painGatePassed, painGateDetails, GateOverrideAudit
```

---

## Architectural Patterns

### Pattern 1: Provenance-Tagged Source URLs

**What:** Every URL entering the evidence pipeline carries a `provenance` field indicating how it was discovered: `'sitemap'`, `'serp'`, `'manual'`, or `'default'`.

**When to use:** In the new `discoverSourcesForProspect()` function that consolidates all URL sources.

**Trade-offs:** Provenance in memory only (not persisted to DB) is cheapest. Persisting in `inputSnapshot` is the right balance — consistent with existing `sitemapCache`/`serpCache` pattern, queryable after the fact, no new table.

**Example:**

```typescript
// lib/enrichment/source-discovery.ts
export interface ProspectSourceUrl {
  url: string;
  provenance: 'sitemap' | 'serp' | 'manual' | 'default';
  discoveredAt: string;
  jsHeavyHint?: boolean; // detected from stealth response fingerprint
}

export interface ProspectSourceSet {
  urls: ProspectSourceUrl[];
  discoveredAt: string;
}

export async function discoverSourcesForProspect(input: {
  domain: string;
  companyName: string | null;
  manualUrls: string[];
  deepCrawl: boolean;
  priorSitemapCache?: SitemapCache | null;
  priorSerpCache?: SerpDiscoveryResult | null;
}): Promise<ProspectSourceSet> {
  // 1. Sitemap (with 24h cache reuse)
  // 2. SERP if deepCrawl (with 24h cache reuse)
  // 3. Manual URLs with provenance: 'manual'
  // 4. Default guessed paths if sitemap is empty, with provenance: 'default'
  // 5. Dedup — manual wins over default, sitemap wins over default
  // Returns merged, deduplicated ProspectSourceSet
}
```

**Storage:** Persist as `inputSnapshot.sourceSet` on `ResearchRun`. Backward compat: the existing `extractSitemapCache()` / `extractSerpCache()` functions continue to work if `sourceSet` is absent (old runs).

### Pattern 2: Tiered Extraction — Stealth First, Browser Fallback

**What:** Website URLs go through Scrapling `/fetch` (stealth, fast ~2s). URLs where stealth returns <500 chars, or that carry `jsHeavyHint: true`, are escalated to Scrapling `/fetch-dynamic` (browser, ~10s). Capped at 5 dynamic URLs per run to bound pipeline time.

**When to use:** For all website-type URLs in the evidence pipeline.

**Trade-offs:**

- The escalation heuristic (< 500 chars) catches SPAs and lazy-loaded pages without requiring upfront classification
- 5-URL cap keeps worst-case pipeline time addition at ~50s, acceptable at current volume
- `fetchDynamic()` in `lib/enrichment/scrapling.ts` already exists — no service changes needed

**JS-heavy detection heuristics (in stealth response):**

- HTML contains `__NEXT_DATA__` or `_next/static` → Next.js SPA
- HTML contains `<div id="root"></div>` or `<div id="app"></div>` with body text < 200 chars → React/Vue SPA
- Response length < 500 chars despite HTTP 200 → likely deferred rendering

**Example:**

```typescript
// lib/browser-evidence-adapter.ts
export async function ingestBrowserEvidenceDrafts(
  urls: ProspectSourceUrl[], // pre-filtered: jsHeavyHint=true or stealth failed
): Promise<EvidenceDraft[]> {
  const capped = urls.slice(0, 5);
  const drafts: EvidenceDraft[] = [];

  for (const sourceUrl of capped) {
    const result = await fetchDynamic(sourceUrl.url);
    if (!result.ok || result.html.length < 200) continue;

    drafts.push(
      ...extractWebsiteEvidenceFromHtml({
        sourceUrl: sourceUrl.url,
        sourceType: sourceTypeForUrl(sourceUrl.url),
        html: result.html,
      }).map((draft) => ({
        ...draft,
        metadata: {
          ...(draft.metadata ?? {}),
          adapter: 'browser-dynamic',
          provenance: sourceUrl.provenance,
        },
      })),
    );
  }

  return drafts;
}
```

`metadata.adapter = 'browser-dynamic'` is critical — `isObservedEvidence()` in `workflow-engine.ts` checks that adapter is not in `SYNTHETIC_ADAPTERS`, so browser-extracted items are counted as real observations in the pain gate.

### Pattern 3: Pain Confirmation Gate as a Separate Concern

**What:** A new gate (`evaluatePainConfirmationGate` in `lib/pain-gate.ts`) that checks minimum cross-source evidence. Runs after `evaluateQualityGate()`. Result persisted to `ResearchRun.painGatePassed` and `painGateDetails`. Send queue checks this field before allowing outreach.

**When to use:** Always — for every completed research run.

**Why it is separate from the quality gate:**

The quality gate measures evidence sufficiency (count, source type diversity, confidence average). The pain confirmation gate measures _cross-source pain signal_ specifically — whether external sources (reviews, job postings) corroborate pain, not just whether the website was crawled. A prospect could pass GREEN quality gate with 5 high-confidence WEBSITE items and still have no external confirmation.

The prototype in `workflow-engine.ts` (`evaluatePainConfirmation`) already captures this logic in advisory form. The v2.2 work promotes it to a gate that actually blocks the send queue.

**Thresholds (to add to `quality-config.ts`):**

```typescript
// lib/quality-config.ts additions
export const PAIN_GATE_MIN_EXTERNAL_ITEMS = 1; // REVIEWS or JOB_BOARD with aiRelevance >= 0.65
export const PAIN_GATE_MIN_CROSS_SOURCE_ITEMS = 1; // non-own-website confirmed source
export const PAIN_GATE_MIN_DISTINCT_PAIN_TAGS = 2; // distinct workflowTags with aiRelevance >= 0.65
export const PAIN_GATE_AI_RELEVANCE_THRESHOLD = 0.65; // higher than quality gate's 0.50
```

**Example:**

```typescript
// lib/pain-gate.ts
export interface PainGateResult {
  passed: boolean;
  requiresOverride: boolean;
  externalConfirmationCount: number;
  crossSourceCount: number;
  distinctPainTags: number;
  reasons: string[];
}

export function evaluatePainConfirmationGate(
  items: EvidenceInput[],
  domain: string,
): PainGateResult {
  const confirmed = items.filter((item) => {
    const aiRelevance = parseAiRelevanceFromEvidence(item);
    return (
      aiRelevance !== null && aiRelevance >= PAIN_GATE_AI_RELEVANCE_THRESHOLD
    );
  });

  const externalConfirmed = confirmed.filter(
    (item) => item.sourceType === 'REVIEWS' || item.sourceType === 'JOB_BOARD',
  );
  const crossSource = confirmed.filter(
    (item) => !item.sourceUrl.includes(domain),
  );
  const distinctPainTags = new Set(
    confirmed
      .map((item) => item.workflowTag)
      .filter((tag) => PAIN_WORKFLOW_TAGS.has(tag)),
  ).size;

  const reasons: string[] = [];
  if (externalConfirmed.length < PAIN_GATE_MIN_EXTERNAL_ITEMS) {
    reasons.push(
      `Min ${PAIN_GATE_MIN_EXTERNAL_ITEMS} external confirmation required (REVIEWS or JOB_BOARD with aiRelevance >= 0.65)`,
    );
  }
  if (crossSource.length < PAIN_GATE_MIN_CROSS_SOURCE_ITEMS) {
    reasons.push('At least 1 confirmed non-own-website source required');
  }
  if (distinctPainTags < PAIN_GATE_MIN_DISTINCT_PAIN_TAGS) {
    reasons.push(
      `Min ${PAIN_GATE_MIN_DISTINCT_PAIN_TAGS} distinct pain workflow tags required`,
    );
  }

  return {
    passed: reasons.length === 0,
    requiresOverride: reasons.length > 0,
    externalConfirmationCount: externalConfirmed.length,
    crossSourceCount: crossSource.length,
    distinctPainTags,
    reasons,
  };
}
```

### Pattern 4: Override Audit Trail as Append-Only Log

**What:** A `GateOverrideAudit` model that records every admin bypass of a failing gate. Written in `research.approveQuality` when `approved: true` AND either gate is not passed.

**When to use:** Any time the admin proceeds despite a gate failure. Both the quality gate and the pain gate should be audited.

**Why not extend `qualityNotes` on ResearchRun:**

`qualityNotes` is a single overwrite field — it is already used and gets replaced on each review. The audit trail must be immutable and append-only. A run may be reviewed multiple times (re-run → new gate result → another override). Each bypass event must be individually preserved. A separate model is the correct design.

**Schema:**

```prisma
model GateOverrideAudit {
  id            String   @id @default(cuid())
  createdAt     DateTime @default(now())

  researchRunId String
  researchRun   ResearchRun @relation(fields: [researchRunId], references: [id], onDelete: Cascade)

  gateType      String   // 'quality_gate' | 'pain_gate'
  gatePassed    Boolean  // gate state at time of override (always false here)
  overrideReason String  // min 12 chars, same enforcement as existing qualityNotes check
  overriddenBy  String   // admin session identifier

  gateSnapshot  Json?    // QualityGateResult or PainGateResult snapshot

  @@index([researchRunId])
  @@index([createdAt])
}
```

**tRPC integration:** In `research.approveQuality`:

```typescript
// server/routers/research.ts (inside approveQuality mutation)
if (input.approved) {
  const qualityGatePassed = gate?.passed === true;
  const painGatePassed = run.painGatePassed === true;

  if (!qualityGatePassed) {
    await ctx.db.gateOverrideAudit.create({
      data: {
        researchRunId: input.runId,
        gateType: 'quality_gate',
        gatePassed: false,
        overrideReason: overrideReason,
        overriddenBy: ctx.session?.user?.email ?? 'admin',
        gateSnapshot: toJson(gate),
      },
    });
  }

  if (!painGatePassed) {
    await ctx.db.gateOverrideAudit.create({
      data: {
        researchRunId: input.runId,
        gateType: 'pain_gate',
        gatePassed: false,
        overrideReason: overrideReason,
        overriddenBy: ctx.session?.user?.email ?? 'admin',
        gateSnapshot: toJson(run.painGateDetails),
      },
    });
  }
}
```

**UI:** Collapsible timeline in the research run detail view showing: timestamp, gate type, reason, gate state. Read-only. Include in `research.getRun` response via `include: { overrideAudits: true }`.

---

## Data Flow

### v2.2 Pipeline Flow

Changes from v2.1 are marked **[NEW]** and **[MODIFIED]**:

```
Admin: startRun(prospectId, manualUrls, deepCrawl)
  → research-executor.ts
    → [NEW] discoverSourcesForProspect()
        reads priorSitemapCache + priorSerpCache from snapshot (backward compat)
        sitemap   → provenance: 'sitemap'
        SERP      → provenance: 'serp'   (if deepCrawl)
        manual    → provenance: 'manual'
        defaults  → provenance: 'default' (if sitemap empty)
        sets jsHeavyHint per URL
        persists as inputSnapshot.sourceSet
    → ingestWebsiteEvidenceDrafts(non-jsHeavy urls)    [Scrapling stealth, UNCHANGED]
    → [NEW] ingestBrowserEvidenceDrafts(jsHeavy urls)  [Scrapling /fetch-dynamic, cap 5]
    → generateEvidenceDrafts()                         [synthetic base, UNCHANGED]
    → ingestReviewEvidenceDrafts()                     [UNCHANGED]
    → if deepCrawl:
        → ingestCrawl4aiEvidenceDrafts(serpUrls)       [UNCHANGED]
        → discoverGoogleSearchMentions()               [UNCHANGED]
        → [6 other deep sources unchanged]
    → fetchKvkData()                                   [UNCHANGED]
    → LinkedIn profile from Apollo                     [UNCHANGED]
    → scoreEvidenceBatch()                             [UNCHANGED]
    → evaluateQualityGate()                            [UNCHANGED]
    → [NEW] evaluatePainConfirmationGate()             ← new gate
    → generateHypothesisDraftsAI()                     [UNCHANGED]
    → generateOpportunityDrafts()                      [UNCHANGED]
    → [MODIFIED] ResearchRun.update(COMPLETED, summary,
        painGatePassed,     ← new field
        painGateDetails)    ← new field

Admin: approveQuality(runId, approved=true, notes)
  → [MODIFIED] if gate not passed AND approved:
      → [NEW] GateOverrideAudit.create(gateType='quality_gate', ...)
  → [MODIFIED] if painGatePassed=false AND approved:
      → [NEW] GateOverrideAudit.create(gateType='pain_gate', ...)
  → ResearchRun.update(qualityApproved=true)          [UNCHANGED logic]
```

### Send Queue Gate Check

```
Admin: send outreach for prospect
  → outreach.ts send queue
  → load ResearchRun for prospect
  → EXISTING: researchRun.qualityApproved === true
  → [NEW]: researchRun.painGatePassed === true
      OR painGatePassed IS NULL   (null = old run, legacy pass-through)
      OR GateOverrideAudit exists for this run with gateType='pain_gate'
  → if blocked: throw TRPCError('Pain gate not passed — override required in research review')
  → else: proceed with send
```

The `painGatePassed IS NULL` pass-through is critical for backward compat — the 7 existing prospects have no `painGatePassed` value and must not be suddenly blocked.

---

## Schema Changes Required

### New Fields on ResearchRun

```prisma
model ResearchRun {
  // ... all existing fields unchanged ...

  // v2.2: Pain confirmation gate
  painGatePassed    Boolean?  // null = not evaluated (old runs), true/false = result
  painGateDetails   Json?     // full PainGateResult for display

  // Relation for audit trail
  overrideAudits    GateOverrideAudit[]
}
```

### New Model: GateOverrideAudit

```prisma
model GateOverrideAudit {
  id            String   @id @default(cuid())
  createdAt     DateTime @default(now())

  researchRunId String
  researchRun   ResearchRun @relation(fields: [researchRunId], references: [id], onDelete: Cascade)

  gateType      String   // 'quality_gate' | 'pain_gate'
  gatePassed    Boolean  // gate state at time of override
  overrideReason String  // min 12 chars, enforced in tRPC
  overriddenBy  String   // admin session identifier

  gateSnapshot  Json?    // PainGateResult | QualityGateResult at override time

  @@index([researchRunId])
  @@index([createdAt])
}
```

**Migration via `docker exec psql` (established pattern from MEMORY.md):**

```sql
-- Add fields to ResearchRun
ALTER TABLE "ResearchRun" ADD COLUMN "painGatePassed" BOOLEAN;
ALTER TABLE "ResearchRun" ADD COLUMN "painGateDetails" JSONB;

-- Create GateOverrideAudit table
CREATE TABLE "GateOverrideAudit" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "researchRunId" TEXT NOT NULL,
  "gateType" TEXT NOT NULL,
  "gatePassed" BOOLEAN NOT NULL,
  "overrideReason" TEXT NOT NULL,
  "overriddenBy" TEXT NOT NULL,
  "gateSnapshot" JSONB,
  CONSTRAINT "GateOverrideAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GateOverrideAudit_researchRunId_idx" ON "GateOverrideAudit"("researchRunId");
CREATE INDEX "GateOverrideAudit_createdAt_idx" ON "GateOverrideAudit"("createdAt");
ALTER TABLE "GateOverrideAudit" ADD CONSTRAINT "GateOverrideAudit_researchRunId_fkey"
  FOREIGN KEY ("researchRunId") REFERENCES "ResearchRun"("id") ON DELETE CASCADE;
```

**Backward compatibility:** All new fields are nullable or have defaults. Existing prospects and research runs are unaffected. `painGatePassed IS NULL` is treated as "gate not evaluated" (legacy pass-through in send queue).

---

## Build Order

Dependencies determine order. Each phase is independently shippable and testable.

### Phase 28: Source Discovery with Provenance

**Dependency:** None — standalone extraction from existing sitemap + SERP logic.

**Build:**

1. `lib/enrichment/source-discovery.ts` — `discoverSourcesForProspect()` returning `ProspectSourceSet` with provenance tags per URL. Internally calls the existing `discoverSitemapUrls()`, `discoverSerpUrls()`, and the default-path logic currently inline in `research-executor.ts`.
2. Modify `lib/research-executor.ts` — replace inline sitemap + default-path block with `discoverSourcesForProspect()`. Store result in `inputSnapshot.sourceSet`. Backward compat: still read old `sitemapCache` / `serpCache` keys for retries of old runs.
3. Set `jsHeavyHint: true` in source discovery when stealth fetch fingerprint indicates SPA.

**Test:** Run a research run, inspect `inputSnapshot.sourceSet` — verify provenance tags present. Confirm sitemap URLs still discovered, SERP URLs still discovered, manual URLs preserved with `provenance: 'manual'`.

**Rationale for first:** All other features depend on knowing how URLs were discovered. Browser extraction uses `jsHeavyHint`. The pain gate benefits from knowing evidence came from multiple distinct discovered sources.

### Phase 29: Browser-Rendered Extraction

**Dependency:** Phase 28 complete (needs `jsHeavyHint` flags from source discovery).

**Build:**

1. `lib/browser-evidence-adapter.ts` — `ingestBrowserEvidenceDrafts(urls: ProspectSourceUrl[])` wrapping `fetchDynamic()` from `lib/enrichment/scrapling.ts` and reusing `extractWebsiteEvidenceFromHtml()` from `lib/web-evidence-adapter.ts`. Cap at 5 URLs. Set `metadata.adapter = 'browser-dynamic'`.
2. Wire into `lib/research-executor.ts` — after `ingestWebsiteEvidenceDrafts()`, collect URLs where stealth returned < 500 chars or `jsHeavyHint: true`, call `ingestBrowserEvidenceDrafts()` on them. Cap enforced inside the adapter.

**No service changes:** Scrapling `/fetch-dynamic` endpoint and `fetchDynamic()` client function already exist.

**Test:** Find a JS-heavy prospect (Next.js site like a SaaS product). Run pipeline. Verify evidence items with `metadata.adapter = 'browser-dynamic'` appear in DB with real content snippets (not empty fallback drafts).

**Rationale for second:** Uses `jsHeavyHint` from Phase 28. Scrapling service is already running. Bounded risk — at most 5 URLs per run, ~50s additional pipeline time.

### Phase 30: Pain Confirmation Gate + Override Audit

**Dependency:** Phases 28 and 29 complete (gate should evaluate the full evidence set including browser-extracted items).

**Build:**

1. Prisma schema — add `painGatePassed Boolean?`, `painGateDetails Json?` to `ResearchRun`; add `GateOverrideAudit` model and its relation on `ResearchRun`.
2. Apply migration via `docker exec psql`.
3. `lib/pain-gate.ts` — `evaluatePainConfirmationGate()` with `PainGateResult` return type.
4. `lib/quality-config.ts` — add `PAIN_GATE_*` threshold constants.
5. Wire into `lib/research-executor.ts` — call `evaluatePainConfirmationGate()` after `evaluateQualityGate()`. Persist `painGatePassed` and `painGateDetails` to `ResearchRun`.
6. `server/routers/research.ts` `approveQuality` — add `GateOverrideAudit` creation when admin overrides failing gate. Extend `getRun` to include `overrideAudits`.
7. `server/routers/outreach.ts` — add pain gate check to send queue guard (with `IS NULL` pass-through for legacy runs).
8. UI — collapsible override audit timeline in the research run detail Evidence tab. Display `painGateDetails` reasons when gate fails.

**Test (sequential):**

- Run research on a prospect with no external evidence (no reviews, no jobs) → verify `painGatePassed = false`
- Try to send outreach → verify TRPCError thrown
- Approve quality with notes → verify `GateOverrideAudit` row created
- Try to send outreach again → verify it proceeds
- Run research on a well-evidenced prospect → verify `painGatePassed = true`, outreach unblocked

**Rationale for last:** Pain gate evaluation requires the full evidence set including browser-extracted items from Phase 29. Schema changes are safest last to minimize migration risk. Override audit is meaningless without the gate to override.

---

## Integration Points

### External Services — No Changes

| Service         | Current Usage                               | v2.2 Change                                                               |
| --------------- | ------------------------------------------- | ------------------------------------------------------------------------- |
| Scrapling :3010 | `/fetch` (stealth) for all website URLs     | Add calls to `/fetch-dynamic` for JS-heavy URLs — endpoint already exists |
| Crawl4AI :11235 | Browser extraction for SERP-discovered URLs | Unchanged                                                                 |
| SerpAPI (cloud) | Google Maps + Jobs + Search discovery       | Unchanged                                                                 |
| Gemini Flash    | Evidence scoring                            | Unchanged                                                                 |
| KvK API         | Registry enrichment                         | Unchanged                                                                 |

### Internal Boundaries

| Boundary                                               | Communication        | v2.2 Change                                      |
| ------------------------------------------------------ | -------------------- | ------------------------------------------------ |
| `research-executor.ts` ↔ `source-discovery.ts`         | Direct function call | NEW — replaces inline sitemap/serp/default logic |
| `research-executor.ts` ↔ `browser-evidence-adapter.ts` | Direct function call | NEW                                              |
| `research-executor.ts` ↔ `pain-gate.ts`                | Direct function call | NEW                                              |
| `research.ts` (router) ↔ `GateOverrideAudit` (DB)      | Prisma               | NEW — written on override                        |
| `outreach.ts` (router) ↔ `ResearchRun.painGatePassed`  | Prisma               | NEW — read in send queue check                   |

---

## Anti-Patterns

### Anti-Pattern 1: Storing Source URLs as a Separate DB Table

**What people do:** Create a `ProspectSourceUrl` table in the DB to persist discovered URLs.

**Why it's wrong:** The existing `inputSnapshot` JSON on `ResearchRun` already stores `sitemapCache` and `serpCache` with the same pattern and 24h TTL semantics. A separate table adds migration cost, join complexity, and a new model to maintain — for no query benefit at current volumes (7-50 prospects, <30 runs). Premature normalization.

**Do this instead:** Persist `ProspectSourceSet` in `inputSnapshot.sourceSet` JSON. Upgrade to a DB table only when the admin needs to browse or filter discovered source URLs across runs — not in scope for v2.2.

### Anti-Pattern 2: Running Browser Extraction for All URLs

**What people do:** Replace all `ingestWebsiteEvidenceDrafts()` calls with browser extraction, reasoning "more sites will work."

**Why it's wrong:** `fetchDynamic()` takes ~10s per URL. At 20 URLs per prospect (current average), that is 200s added to pipeline time. Scrapling `/fetch-dynamic` uses a full Playwright browser per request — high memory, `max_workers=4` is the current limit. The stealth fetcher already handles most sites.

**Do this instead:** Use `jsHeavyHint` detection from source discovery plus stealth-failure detection to escalate only the URLs that genuinely need browser rendering. Cap at 5 URLs per run. Always run stealth first.

### Anti-Pattern 3: Making the Pain Gate a Hard Block Without Override

**What people do:** Make `painGatePassed === true` an absolute requirement with no override path.

**Why it's wrong:** Dutch SMBs have thin web presence — this is documented in the decision log ("Soft gate: amber = warn + proceed-anyway" — Key Decisions in PROJECT.md). A hard pain gate would block outreach for legitimate prospects where evidence is sparse not because pain is absent but because the company has minimal online footprint.

**Do this instead:** Gate blocks by default. Override requires a written reason (min 12 chars). Override is logged in `GateOverrideAudit`. Admin can proceed but the bypass is immutably recorded. Same pattern already proven with the quality gate.

### Anti-Pattern 4: Putting Gate Logic in the tRPC Router

**What people do:** Inline pain gate thresholds inside `outreach.ts` or `research.ts` router mutations.

**Why it's wrong:** Gate logic is already split: `evaluateQualityGate()` is in `lib/workflow-engine.ts`, thresholds are in `lib/quality-config.ts`. Duplicating into routers makes logic untestable without HTTP setup and duplicates threshold values.

**Do this instead:** Gate logic lives in `lib/pain-gate.ts` (pure functions, no DB dependency). Constants in `lib/quality-config.ts`. Routers call the library functions and throw `TRPCError` if gate fails. Consistent with the existing `evaluateQualityGate` / `computeTrafficLight` pattern.

### Anti-Pattern 5: Two Separate Override Tables per Gate Type

**What people do:** Create `QualityGateOverride` and `PainGateOverride` as separate models.

**Why it's wrong:** Identical shape (runId, reason, timestamp, snapshot). Two tables for the same structure adds migration complexity with no benefit.

**Do this instead:** Single `GateOverrideAudit` model with `gateType: String` discriminator. New gate types added as string values, no schema migration needed.

---

## Scaling Considerations

At current volumes (7-50 prospects), none of these changes introduce scaling risk.

| Scale            | Architecture Adjustment                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0-50 prospects   | Current sync pipeline handles everything. Browser extraction cap of 5 URLs adds ~50s max — within acceptable admin wait time.                                                              |
| 50-500 prospects | Move pipeline to background job queue (BullMQ + Redis already in docker-compose). Sync tRPC mutations will hit 30s serverless timeouts.                                                    |
| 500+ prospects   | Scrapling service needs horizontal scaling (`max_workers` currently 4, browser sessions are memory-heavy). Pain gate query on `ResearchRun` needs `@@index([prospectId, painGatePassed])`. |

**Immediate concern for v2.2:** The browser extraction step adds up to 5 × 10s = 50s to pipeline time. If the current admin UI shows a loading spinner with no timeout, it will appear hung. Add a UI note: "Browser extraction in progress (up to 60s)" when deepCrawl is enabled with JS-heavy URLs.

---

## Confidence Assessment

| Area                                | Confidence | Notes                                                                                                                                                                                                       |
| ----------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source discovery refactor           | HIGH       | Directly read `research-executor.ts` — the inline sitemap/default/serp logic is clear; refactoring into `source-discovery.ts` is mechanical                                                                 |
| Browser extraction via fetchDynamic | HIGH       | `fetchDynamic()` exists in `scrapling.ts`, `/fetch-dynamic` endpoint in `services/scrapling/app.py` — just needs wiring                                                                                     |
| Pain gate thresholds                | MEDIUM     | Thresholds (`aiRelevance >= 0.65`, 1 external item, 2 pain tags) are proposed based on understanding of the current scoring distribution; should be calibrated against the 7 real prospects before shipping |
| Override audit model                | HIGH       | Append-only audit log is a standard pattern; schema is straightforward                                                                                                                                      |
| Backward compatibility              | HIGH       | `painGatePassed IS NULL` pass-through in send queue is the critical guard; explicitly specified                                                                                                             |
| Build order dependencies            | HIGH       | Each phase is independently verifiable                                                                                                                                                                      |

---

## Sources

All findings are from direct codebase inspection:

- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/research-executor.ts` — full pipeline orchestration
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/workflow-engine.ts` — quality gate, pain confirmation prototype, evidence classification
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/enrichment/scrapling.ts` — `fetchStealth()`, `fetchDynamic()` clients
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/enrichment/crawl4ai.ts` — Crawl4AI client
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/enrichment/serp.ts` — SerpAPI discovery
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/enrichment/sitemap.ts` — sitemap discovery
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/evidence-scorer.ts` — AI scoring formula
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/quality-config.ts` — existing thresholds
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/web-evidence-adapter.ts` — HTML → EvidenceDraft conversion
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/research.ts` — `approveQuality` mutation
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/outreach.ts` — send queue
- `/home/klarifai/Documents/klarifai/projects/qualifai/services/scrapling/app.py` — Scrapling service endpoints
- `/home/klarifai/Documents/klarifai/projects/qualifai/prisma/schema.prisma` — full schema
- `/home/klarifai/Documents/klarifai/projects/qualifai/.planning/PROJECT.md` — v2.2 target features, key decisions

---

_Architecture research for: Qualifai v2.2 — Verified Pain Intelligence_
_Researched: 2026-03-02_

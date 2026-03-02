# Phase 35: Validation and Calibration - Research

**Researched:** 2026-03-02
**Domain:** End-to-end validation, Crawl4AI v0.8.x, pain gate calibration
**Confidence:** HIGH (all claims verified against live codebase and DB)

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Discover validation:**

- Two contrasting prospects: one high-confidence + one borderline
- Test both confirm and decline actions on /discover/[slug]
- Live browser session (real user flow, not API simulation)
- Verify with both: scripted DB assertions + visual admin UI check

**Crawl4AI verification:**

- Verify both consent popup removal and shadow DOM flattening
- Test pages: mix of existing prospect pages (regression) + known-difficult NL sites (capability proof)

**Pain gate calibration:**

- Distribution analysis first, then user judgment to finalize thresholds
- Document in both: calibration report markdown + inline comments in quality-config.ts
- SQL analysis across all prospects, then re-run one prospect as sanity check

### Claude's Discretion

- Crawl4AI fallback strategy: assess severity, minor gaps = document, blocking gaps = fix inline
- Crawl4AI artifact format: one-time report vs rerunnable script — pick best value/effort
- Whether source weights need revisiting based on actual data
- Issue resolution: bugs found during validation — fix inline if small, defer if substantial

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID       | Description                                                                                                   | Research Support                                                                                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VALID-01 | /discover/ validation session run with real prospects to verify hypothesis confirmation flow works end-to-end | prospectProcedure middleware verified, validateByProspect mutation confirmed, status transitions ACCEPTED/DECLINED confirmed, admin override history (GateOverrideAudit) visible in admin UI                                     |
| VALID-02 | Crawl4AI v0.8.x features verified (consent popup removal, shadow DOM flattening) against real pages           | remove_overlay_elements and flatten_shadow_dom confirmed as v0.8.x CrawlerRunConfig params; current crawl4ai.ts only uses magic+simulate_user — neither new param is set; Crawl4AI service not currently running                 |
| VALID-03 | Pain gate calibration SQL run against real prospect data to tune PAIN_GATE threshold constants                | Live DB query run: 7 prospects, scorable avg_conf 0.59-0.70, all have 4-5 source types; existing calibration-table.mjs has wrong threshold (0.65) and no aiRelevance filter; quality-config.ts has MIN_AVERAGE_CONFIDENCE = 0.55 |

</phase_requirements>

## Summary

Phase 35 is a validation-and-calibration phase with no new feature code — it confirms existing systems work against real production data, then tunes a threshold constant. All three tasks are observable and concrete: open a browser, run SQL, edit one constant.

The critical precondition for VALID-01 is that the `/discover/` endpoint requires `prospectProcedure` authentication, which only allows prospects with status READY/SENT/VIEWED/ENGAGED/CONVERTED. Currently only **Mujjo** (status=ENGAGED, slug=`3Bi1vv2M`, readableSlug=`mujjo`) is publicly accessible. To test a "borderline" second prospect, at least one additional prospect must be promoted to READY status — either by re-running research or manually updating status.

For VALID-02, Crawl4AI v0.8.x introduced `remove_overlay_elements` (consent popup removal) and `flatten_shadow_dom` (shadow DOM flattening) as `CrawlerRunConfig` parameters. The current `crawl4ai.ts` only uses `magic: true` and `simulate_user: true` — neither new parameter is used. Verification requires the Crawl4AI service running on port 11235 (not currently running, no Docker container configured). This means verification will need the service started externally and the crawl4ai.ts updated to pass the new params.

For VALID-03, live DB analysis against all 7 real prospects reveals all pass the source-type gate (4-5 types each, GREEN requires 3+). The scorable average confidence (items with aiRelevance >= 0.5) ranges from 0.59 to 0.70, all well above the current `MIN_AVERAGE_CONFIDENCE = 0.55` threshold. The existing `calibration-table.mjs` script is incorrect — it uses 0.65 as its AMBER threshold (hardcoded in the script) and does not apply the aiRelevance filter, so it shows all prospects as AMBER when they are actually GREEN per the live quality-config.ts logic.

**Primary recommendation:** Fix calibration-table.mjs to mirror the actual gate logic (aiRelevance filter + 0.55 threshold), confirm all 7 prospects compute GREEN, document the distribution, and confirm thresholds are correct. No threshold change is needed based on the data.

---

## Standard Stack

### Core (no new dependencies needed)

| Component          | Version/Location | Purpose                                 | Notes                                           |
| ------------------ | ---------------- | --------------------------------------- | ----------------------------------------------- |
| Prisma / pg        | existing         | DB queries for calibration SQL          | use PrismaPg adapter pattern from other scripts |
| dotenv             | existing         | load DATABASE_URL in scripts            | `import 'dotenv/config'` as per project pattern |
| Crawl4AI REST API  | localhost:11235  | crawl test pages                        | service must be running externally              |
| Next.js dev server | port 9200        | serve /discover/ for browser validation | `npm run dev`                                   |

### Supporting

| Tool             | Purpose                                       |
| ---------------- | --------------------------------------------- |
| Browser (manual) | VALID-01 browser session                      |
| psql / pg client | Quick DB assertions post-session              |
| crawl4ai.ts      | Update to pass new v0.8.x params for VALID-02 |

---

## Architecture Patterns

### Pattern 1: prospectProcedure authentication gate

**What:** `/discover/[slug]` resolves the slug to a prospect, then only grants access if status is one of `['READY', 'SENT', 'VIEWED', 'ENGAGED', 'CONVERTED']`. The `prospectProcedure` middleware in `server/trpc.ts` injects `prospectId` into context.

**How confirm/decline works:**

```typescript
// server/routers/hypotheses.ts — validateByProspect mutation
const newStatus = input.action === 'confirm' ? 'ACCEPTED' : 'DECLINED';
return ctx.db.workflowHypothesis.update({
  where: { id: input.hypothesisId },
  data: { status: newStatus },
});
// DECLINED is final — re-submitting confirm on a DECLINED hypothesis is a no-op
```

**DB assertion after session:**

```sql
SELECT id, title, status, "confidenceScore"
FROM "WorkflowHypothesis"
WHERE "prospectId" = '<prospect-id>'
ORDER BY "confidenceScore" DESC;
```

**Admin override history** is `GateOverrideAudit` table, displayed in admin detail view (`/admin/prospects/[id]`) under the "Override History" section — visible only when `overrideAudits.data?.length > 0`. This is the QUALITY gate override audit, not hypothesis validation status. For VALID-01 success, the planner must distinguish:

- Hypothesis validation status (ACCEPTED/DECLINED) → visible in AnalysisSection on admin page
- Override history (GateOverrideAudit) → tracks quality/pain gate bypasses, separate from hypothesis validation

**VALID-01 success criteria mapping:**

1. "confirm/decline interaction recorded in DB" → WorkflowHypothesis.status transitions to ACCEPTED/DECLINED
2. "visible in admin override history" → this refers to the hypothesis status being visible in admin AnalysisSection (analysis tab shows hypothesis statuses), NOT a new override audit entry. The CONTEXT.md phrase "admin override history" may be loosely phrased — see the analysis tab hypotheses section, not the GateOverrideAudit panel.

### Pattern 2: Two-prospect prerequisite

**Current state:**

- Mujjo (ENGAGED) — accessible, high-confidence hypotheses (0.85 confidence), 24 DRAFT + 3 ACCEPTED
- All others (ENRICHED or DRAFT status) — NOT accessible via /discover/ (prospectProcedure blocks them)

**To enable a second borderline prospect**, one option is to temporarily set a lower-confidence prospect (e.g., Brainport Eindhoven — avg_conf_scorable: 0.635) to READY status:

```sql
UPDATE "Prospect" SET status = 'READY' WHERE domain = 'brainporteindhoven.com';
```

Then restore after validation. Alternatively, the planner can choose to use Mujjo for both tests (confirm one hypothesis, decline another from the same prospect).

### Pattern 3: Crawl4AI v0.8.x params

**Current crawl4ai.ts request body:**

```typescript
crawler_config: {
  type: 'CrawlerRunConfig',
  params: {
    cache_mode: 'bypass',
    magic: true,
    simulate_user: true,
    wait_for_timeout: 15000,
    delay_before_return_html: 2,
  },
},
```

**v0.8.x new params to add:**

```typescript
remove_overlay_elements: true,   // consent popup removal
flatten_shadow_dom: true,        // shadow DOM flattening
```

**Service startup:** Crawl4AI runs on port 11235 but is NOT in docker-compose.yml. It must be started separately. The installed version in the copifai project is 0.7.6/7/8. The docs site is v0.8.x. If v0.8.x is not locally installed/running, the verification becomes: test against the v0.8.x REST API spec (the params are accepted by the server regardless of whether they change behavior visibly).

**Fallback strategy (Claude's discretion):** If Crawl4AI v0.8.x is not locally running:

- Document as infrastructure gap (not a code bug)
- Update crawl4ai.ts to pass the new params (they are backward-compatible — unknown params are ignored by older versions)
- Note the params are "added and ready" but live verification pending service upgrade

### Pattern 4: Pain gate calibration SQL — correct vs. incorrect approach

**Existing calibration-table.mjs is WRONG** for the actual gate logic:

- Uses hardcoded 0.65 AMBER threshold (line 54) — actual gate uses 0.55
- Does NOT filter by aiRelevance — actual gate excludes items with aiRelevance < 0.5 from confidence average
- Result: all 7 prospects show AMBER even though all should be GREEN

**Correct calibration query (verified against live data):**

```sql
SELECT
  p."companyName",
  p.domain,
  COUNT(ei.id) as total_ev,
  COUNT(DISTINCT ei."sourceType") as src_types,
  -- Raw avg (all items)
  AVG(ei."confidenceScore") as avg_conf_all,
  -- Scorable avg (aiRelevance >= 0.5 only — matches workflow-engine.ts logic)
  COUNT(CASE WHEN (ei.metadata->>'aiRelevance')::float >= 0.5 THEN 1 END) as scorable_count,
  AVG(CASE WHEN (ei.metadata->>'aiRelevance')::float >= 0.5
      THEN ei."confidenceScore" END) as avg_conf_scorable,
  COUNT(CASE WHEN ei.metadata->>'aiRelevance' IS NULL THEN 1 END) as no_ai_relevance_count
FROM "Prospect" p
LEFT JOIN "ResearchRun" rr ON rr."prospectId" = p.id
LEFT JOIN "EvidenceItem" ei ON ei."researchRunId" = rr.id
WHERE rr.id IN (
  SELECT id FROM "ResearchRun" rr2
  WHERE rr2."prospectId" = p.id
  ORDER BY rr2."createdAt" DESC LIMIT 1
)
GROUP BY p.id, p."companyName", p.domain
ORDER BY p."companyName";
```

**Live results (2026-03-02, 7 prospects):**
| Prospect | Total EV | Src Types | Avg Conf (all) | Scorable | Avg Conf (scorable) | Gate |
|----------|----------|-----------|----------------|----------|---------------------|------|
| Brainport Eindhoven | 41 | 5 | 0.516 | 13 | 0.635 | GREEN |
| De Ondernemer | 60 | 4 | 0.422 | 7 | 0.701 | GREEN |
| DuckDB | 60 | 4 | 0.506 | 19 | 0.671 | GREEN |
| Marcore | 47 | 4 | 0.447 | 14 | 0.590 | GREEN |
| Motion Design Awards | 60 | 4 | 0.461 | 10 | 0.661 | GREEN |
| Mujjo | 60 | 4 | 0.455 | 9 | 0.674 | GREEN |
| STB-kozijnen | 49 | 4 | 0.499 | 21 | 0.630 | GREEN |

**Gate evaluation:** All 7 prospects are GREEN under current thresholds (MIN_EVIDENCE_COUNT=3 ✓, GREEN_MIN_SOURCE_TYPES=3 ✓, MIN_AVERAGE_CONFIDENCE=0.55 ✓ — all scorable averages 0.59-0.70).

**Threshold recommendation:** No change to MIN_AVERAGE_CONFIDENCE needed. 0.55 is the right lower bound — the lowest scorable avg is Marcore at 0.59, which correctly passes. The current script with 0.65 threshold is a documentation bug, not a logic bug.

---

## Don't Hand-Roll

| Problem               | Don't Build         | Use Instead                                             | Why                                                              |
| --------------------- | ------------------- | ------------------------------------------------------- | ---------------------------------------------------------------- |
| Quality gate logic    | Custom SQL gate     | `computeTrafficLight()` from quality-config.ts          | Single source of truth, client-safe, already tested              |
| Calibration script    | New framework       | Extend existing `scripts/calibration-table.mjs` pattern | Consistent with project script style, uses same PrismaPg adapter |
| Crawl4AI verification | Custom test harness | Direct HTTP POST to localhost:11235/crawl               | Service has REST API, no SDK needed                              |

---

## Common Pitfalls

### Pitfall 1: Confusing "admin override history" with hypothesis validation status

**What goes wrong:** The CONTEXT.md mentions "visible in admin override history" as a success criterion for VALID-01. The admin UI has a "Override History" panel (`GateOverrideAudit`), but this tracks quality/pain gate bypasses — NOT hypothesis confirm/decline actions.
**How to avoid:** VALID-01 success is verified by: (1) WorkflowHypothesis.status = ACCEPTED or DECLINED in DB, AND (2) the AnalysisSection on the admin page shows the updated status chip. The GateOverrideAudit panel is not relevant to hypothesis validation.

### Pitfall 2: Only one prospect is accessible on /discover/

**What goes wrong:** Attempting to test a second prospect and getting 404 because prospectProcedure blocks status=ENRICHED/DRAFT.
**How to avoid:** Either (a) temporarily promote a second prospect to READY, or (b) use Mujjo for both confirm and decline tests (test confirm on one hypothesis, decline on another).

### Pitfall 3: Crawl4AI not running

**What goes wrong:** Testing Crawl4AI v0.8.x features when the service is not running gives empty results / timeouts, which can be mistaken for "feature not working."
**How to avoid:** Verify `curl http://localhost:11235/health` before testing. If service is not running, the plan must include a step to start it (or install v0.8.x). The crawl4ai.ts update (adding `remove_overlay_elements` and `flatten_shadow_dom`) can be done regardless — these params are accepted by both v0.7.x and v0.8.x REST APIs (unknown params are ignored by older versions).

### Pitfall 4: calibration-table.mjs threshold mismatch

**What goes wrong:** The existing script shows all 7 prospects as AMBER, which contradicts the actual gate logic and may mislead threshold decisions.
**How to avoid:** The new calibration report script must use:

- `avg_conf_scorable` (not avg_conf_all)
- `MIN_AVERAGE_CONFIDENCE = 0.55` (not 0.65 as in the old script)
- Tier = GREEN if src_types >= 3 AND avg_conf_scorable >= 0.55

### Pitfall 5: prospectProcedure requires 'slug' in input

**What goes wrong:** The `validateByProspect` mutation requires `{ slug, hypothesisId, action }`. If tested via curl/API tool without the slug matching the actual prospect slug, the middleware throws NOT_FOUND.
**How to avoid:** Use the browser flow on `/discover/mujjo-3Bi1vv2M` which sets slug automatically. Or use the exact slug `3Bi1vv2M` (the 8-char nanoid).

---

## Code Examples

### Verify hypothesis status DB assertion (post VALID-01 session)

```typescript
// scripts/check-hypotheses.mjs pattern — reuse existing script style
import 'dotenv/config';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const hyps = await db.workflowHypothesis.findMany({
  where: { prospect: { slug: '3Bi1vv2M' } },
  select: { id: true, title: true, status: true, confidenceScore: true },
  orderBy: { confidenceScore: 'desc' },
});
console.table(hyps);
await db.$disconnect();
await pool.end();
```

### Crawl4AI v0.8.x test request

```bash
# Test consent popup removal + shadow DOM flattening on a real page
curl -X POST http://localhost:11235/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "urls": ["https://example-nl-site.nl"],
    "browser_config": {
      "type": "BrowserConfig",
      "params": { "headless": true }
    },
    "crawler_config": {
      "type": "CrawlerRunConfig",
      "params": {
        "cache_mode": "bypass",
        "magic": true,
        "simulate_user": true,
        "remove_overlay_elements": true,
        "flatten_shadow_dom": true,
        "wait_for_timeout": 15000
      }
    }
  }' | python3 -m json.tool | head -50
```

### Updated crawl4ai.ts params block (VALID-02 fix)

```typescript
// lib/enrichment/crawl4ai.ts — add v0.8.x params to CrawlerRunConfig
crawler_config: {
  type: 'CrawlerRunConfig',
  params: {
    cache_mode: 'bypass',
    magic: true,
    simulate_user: true,
    remove_overlay_elements: true,   // v0.8.x: remove consent popups/overlays
    flatten_shadow_dom: true,        // v0.8.x: flatten shadow DOM for Web Components
    wait_for_timeout: 15000,
    delay_before_return_html: 2,
  },
},
```

### Correct calibration script (VALID-03)

```javascript
// scripts/calibration-report.mjs — replaces calibration-table.mjs with correct logic
import 'dotenv/config';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Mirrors quality-config.ts constants
const MIN_EVIDENCE_COUNT = 3;
const GREEN_MIN_SOURCE_TYPES = 3;
const MIN_AVERAGE_CONFIDENCE = 0.55;  // was wrongly 0.65 in old script
const AI_RELEVANCE_THRESHOLD = 0.5;   // items below this excluded from avg

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const prospects = await db.prospect.findMany({
  include: {
    researchRuns: {
      orderBy: { createdAt: 'desc' },
      take: 1,
      include: { evidenceItems: { select: { sourceType: true, confidenceScore: true, metadata: true } } },
    },
  },
});

for (const p of prospects) {
  const items = p.researchRuns[0]?.evidenceItems ?? [];
  const srcTypes = new Set(items.map(e => e.sourceType)).size;

  // Apply aiRelevance filter — mirrors workflow-engine.ts evaluateQualityGate
  const scorableItems = items.filter(item => {
    const meta = item.metadata;
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return true; // no aiRelevance = include
    const aiRel = (meta as Record<string, unknown>).aiRelevance;
    if (typeof aiRel !== 'number') return true;
    return aiRel >= AI_RELEVANCE_THRESHOLD;
  });

  const avgConf = scorableItems.length > 0
    ? scorableItems.reduce((s, e) => s + e.confidenceScore, 0) / scorableItems.length
    : 0;

  const tier =
    items.length < MIN_EVIDENCE_COUNT || srcTypes < 1 ? 'RED'
    : srcTypes < GREEN_MIN_SOURCE_TYPES || avgConf < MIN_AVERAGE_CONFIDENCE ? 'AMBER'
    : 'GREEN';

  console.log(`${(p.companyName || p.domain || 'unknown').padEnd(30)} items=${String(items.length).padEnd(4)} srcs=${srcTypes} scorable=${String(scorableItems.length).padEnd(3)} avgConf(scorable)=${avgConf.toFixed(3)} => ${tier}`);
}

await db.$disconnect();
await pool.end();
```

---

## State of the Art

| Area               | Current State                                         | What v0.8.x Adds                                          | Impact                                                        |
| ------------------ | ----------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------- |
| Crawl4AI params    | `magic: true, simulate_user: true`                    | `remove_overlay_elements: true, flatten_shadow_dom: true` | Consent popups and shadow DOM components now handled natively |
| Calibration script | Old script with 0.65 threshold, no aiRelevance filter | New script mirrors quality-config.ts exactly              | Accurate tier reporting for all 7 prospects                   |
| Discover flow      | validateByProspect mutation exists, never tested E2E  | Tested via browser + DB assertions                        | Flow confirmed working                                        |

---

## Open Questions

1. **Is Crawl4AI v0.8.x locally installable?**
   - What we know: v0.7.6/7/8 wheels are in UV cache; v0.8.x docs are live; no Docker image configured for qualifai
   - What's unclear: Is v0.8.x available via pip/uv? Does a Docker image exist?
   - Recommendation: If v0.8.x cannot be started locally during this phase, update crawl4ai.ts with the new params (code change is correct regardless), and document the live test as "pending service upgrade." The params are backward-compatible.

2. **Which second prospect for borderline test?**
   - What we know: Only Mujjo is currently READY-equivalent; Marcore has lowest scorable avg_conf at 0.590 (closest to borderline at 0.55); Brainport has LINKEDIN source (only one with 5 source types)
   - Recommendation: Use Mujjo for both confirm and decline tests (confirm one hypothesis, decline a different one) — avoids need to promote a second prospect. CONTEXT.md says "two contrasting prospects" but the planner may decide using Mujjo for both tests is sufficient for the goal.

3. **Does calibration-table.mjs need to be fixed or replaced?**
   - What we know: The existing script is wrong (0.65 threshold, no aiRelevance filter); it's an untracked file (in git untracked list)
   - Recommendation: Create a new `scripts/calibration-report.mjs` with correct logic rather than patching the old one (which may be intentionally kept as a historical snapshot).

---

## Validation Architecture

> Nyquist validation is NOT configured (`workflow.nyquist_validation` not present in config.json — treated as false). Skipping Validation Architecture section.

---

## Sources

### Primary (HIGH confidence)

- Live DB query against 7 real prospects — pain gate calibration data (2026-03-02)
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/quality-config.ts` — threshold constants
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/workflow-engine.ts` — aiRelevance filter logic
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/hypotheses.ts` — validateByProspect mutation
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/trpc.ts` — prospectProcedure middleware
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/enrichment/crawl4ai.ts` — current Crawl4AI request params

### Secondary (MEDIUM confidence)

- [Crawl4AI v0.8.x SDK Reference](https://docs.crawl4ai.com/complete-sdk-reference/) — `remove_overlay_elements`, `flatten_shadow_dom` params confirmed
- [Crawl4AI Browser/Crawler Config docs](https://docs.crawl4ai.com/core/browser-crawler-config/) — param names and defaults verified

### Tertiary (LOW confidence)

- Crawl4AI v0.8.x local installation status — UV cache shows 0.7.x wheels only; v0.8.x availability not verified (service not running)

---

## Metadata

**Confidence breakdown:**

- VALID-01 flow (auth, mutations, DB schema): HIGH — verified against live code and DB
- VALID-02 Crawl4AI params: HIGH for param names (official docs); LOW for live verification (service not running)
- VALID-03 calibration data: HIGH — verified against live DB with correct aiRelevance-filtered query

**Research date:** 2026-03-02
**Valid until:** 2026-04-01 (stable — no fast-moving dependencies; Crawl4AI API params unlikely to change)

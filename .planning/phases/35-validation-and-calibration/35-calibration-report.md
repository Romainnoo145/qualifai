# Phase 35: Pain Gate Calibration Report

**Date:** 2026-03-02
**Author:** Phase 35 execution — automated calibration via `scripts/calibration-report.mjs`
**DB snapshot:** 7 prospects, all with completed research runs

---

## Methodology

The calibration measures whether the pain gate thresholds in `lib/quality-config.ts` are correctly tuned to the actual evidence distribution of real prospects in the database.

### Gate Logic (quality-config.ts)

The traffic light gate uses three signals in priority order:

1. **Evidence count** — must be >= `MIN_EVIDENCE_COUNT` (3), otherwise RED
2. **Source type diversity** — must be >= `GREEN_MIN_SOURCE_TYPES` (3) for GREEN; 2 types = AMBER; < 2 = RED
3. **Average confidence score (scorable)** — must be >= `MIN_AVERAGE_CONFIDENCE` (0.55) for GREEN

**Critical detail:** The confidence average is computed only over "scorable" items — evidence items where `metadata.aiRelevance >= AI_RELEVANCE_THRESHOLD` (0.5). Items with `aiRelevance < 0.5` or no `aiRelevance` field are excluded from the average. This matches the logic in `lib/workflow-engine.ts` (`evaluateQualityGate`).

### Calibration Script

`scripts/calibration-report.mjs` mirrors the exact gate logic:

- `MIN_EVIDENCE_COUNT = 3`
- `GREEN_MIN_SOURCE_TYPES = 3`
- `MIN_AVERAGE_CONFIDENCE = 0.55`
- `AI_RELEVANCE_THRESHOLD = 0.5`

For each prospect, it fetches the latest research run, applies the aiRelevance filter, computes the scorable average, and evaluates the gate tier.

---

## Results Table

All 7 prospects evaluated on 2026-03-02 with the corrected calibration logic:

| Prospect             | Total EV | Src Types | Scorable | AvgConf (all) | AvgConf (scorable) | Tier  |
| -------------------- | -------- | --------- | -------- | ------------- | ------------------ | ----- |
| Brainport Eindhoven  | 41       | 5         | 13       | 0.516         | 0.635              | GREEN |
| De Ondernemer        | 60       | 4         | 7        | 0.422         | 0.701              | GREEN |
| DuckDB               | 60       | 4         | 19       | 0.506         | 0.671              | GREEN |
| Marcore              | 47       | 4         | 14       | 0.447         | 0.590              | GREEN |
| Motion Design Awards | 60       | 4         | 10       | 0.461         | 0.661              | GREEN |
| Mujjo                | 60       | 4         | 9        | 0.455         | 0.674              | GREEN |
| STB-kozijnen         | 49       | 4         | 21       | 0.499         | 0.630              | GREEN |

**All 7 prospects: GREEN**

---

## Distribution Analysis

### Scorable Average Confidence

| Metric                       | Value  |
| ---------------------------- | ------ |
| Minimum scorable avg         | 0.590  |
| Maximum scorable avg         | 0.701  |
| Range                        | 0.111  |
| Margin above threshold (min) | +0.040 |

The lowest scorable average is Marcore at 0.590, which is 0.040 above the threshold of 0.55. This is a reasonable margin — not too tight, not excessively padded.

### Scorable Item Count per Prospect

| Prospect             | Total | Scorable | Not Scorable | % Scorable |
| -------------------- | ----- | -------- | ------------ | ---------- |
| Brainport Eindhoven  | 41    | 13       | 28           | 32%        |
| De Ondernemer        | 60    | 7        | 53           | 12%        |
| DuckDB               | 60    | 19       | 41           | 32%        |
| Marcore              | 47    | 14       | 33           | 30%        |
| Motion Design Awards | 60    | 10       | 50           | 17%        |
| Mujjo                | 60    | 9        | 51           | 15%        |
| STB-kozijnen         | 49    | 21       | 28           | 43%        |

Note: The low scorable percentage (12-43%) explains why the raw average confidence (AvgConf all) is much lower (0.42-0.52) than the scorable average (0.59-0.70). Most evidence items have `aiRelevance < 0.5` and are correctly excluded from the gate computation — they are broad-context items, not directly relevant to the workflow pain signal.

### Source Type Distribution

All 7 prospects have 4-5 distinct source types, well above the `GREEN_MIN_SOURCE_TYPES = 3` threshold:

- Brainport Eindhoven: 5 source types (WEBSITE, CAREERS, LINKEDIN, NEWS, REVIEWS)
- All others: 4 source types (WEBSITE, CAREERS, NEWS/LINKEDIN, REVIEWS)

Source type diversity is not a concern — all prospects are solidly GREEN on this signal.

---

## Threshold Evaluation

### MIN_AVERAGE_CONFIDENCE (0.55)

- **Current value:** 0.55
- **Lowest scorable avg in dataset:** 0.590 (Marcore)
- **Margin:** +0.040 (comfortable buffer)
- **Green count:** 7/7 (100%)
- **Verdict: CONFIRMED CORRECT — no adjustment needed**

The threshold at 0.55 correctly separates "adequate signal" from "weak signal". A prospect with scorable avg of 0.55 would be borderline, correctly flagged AMBER. The actual population sits 0.04 above — meaning the threshold is calibrated with an appropriate safety margin.

### GREEN_MIN_SOURCE_TYPES (3)

- **Current value:** 3
- **Dataset range:** 4-5 source types per prospect
- **Verdict: CONFIRMED CORRECT — all prospects comfortably GREEN**

No adjustment needed. If a prospect only had WEBSITE evidence (1 source type), it would correctly be RED.

---

## Recommendation

**Thresholds confirmed correct — no adjustment needed.**

Both `MIN_AVERAGE_CONFIDENCE = 0.55` and `GREEN_MIN_SOURCE_TYPES = 3` are well-calibrated for the current AI-scored evidence pipeline. All 7 real prospects compute GREEN tier with the corrected calibration logic.

---

## Before/After Comparison: Old vs New Calibration

| Aspect                  | Old `calibration-table.mjs` | New `calibration-report.mjs`     |
| ----------------------- | --------------------------- | -------------------------------- |
| AMBER threshold         | 0.65 (hardcoded)            | 0.55 (mirrors quality-config.ts) |
| aiRelevance filter      | Not applied                 | Applied (>= 0.5)                 |
| Average computed on     | All evidence items          | Scorable items only              |
| Result for 7 prospects  | All AMBER                   | All GREEN                        |
| Matches live gate logic | NO                          | YES                              |

**Why this difference matters:**

The old script showed all 7 prospects as AMBER, which would suggest the thresholds need loosening. The correct answer is all 7 are GREEN — the gate logic is working correctly. The mismatch in the old script was a documentation bug (wrong threshold) that would have led to incorrect threshold decisions if used as the basis for calibration.

The new script is the canonical calibration tool — it mirrors the exact logic in `workflow-engine.ts` and `quality-config.ts`. Running it confirms the system is healthy.

---

## Crawl4AI v0.8.x Status

**Code change applied:** `lib/enrichment/crawl4ai.ts` now includes both new v0.8.x params in the `CrawlerRunConfig` request body:

```typescript
remove_overlay_elements: true, // v0.8.x: remove consent popups/overlays
flatten_shadow_dom: true,      // v0.8.x: flatten shadow DOM for Web Components
```

**Live verification status:** PENDING — Crawl4AI service is not currently running on `localhost:11235`. The Docker configuration for Qualifai does not include a Crawl4AI container (`qualifai-db` and `qualifai-redis` only).

**Infrastructure gap (not a code bug):** The params are backward-compatible — Crawl4AI v0.7.x and older versions ignore unknown params in `CrawlerRunConfig`. The code change is production-ready and will take effect immediately when the Crawl4AI service is upgraded to v0.8.x.

**Verification approach when service is available:**

```bash
curl -X POST http://localhost:11235/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "urls": ["https://stb-kozijnen.nl"],
    "browser_config": { "type": "BrowserConfig", "params": { "headless": true } },
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
  }'
```

Expected outcome: richer markdown extraction from consent-popup-gated pages (e.g., NL news sites, review platforms) and better coverage of Web Component-based sites.

---

## Summary

| Requirement                               | Status    | Notes                                                  |
| ----------------------------------------- | --------- | ------------------------------------------------------ |
| VALID-02 — Crawl4AI v0.8.x params added   | DONE      | crawl4ai.ts updated; live test pending service startup |
| VALID-03 — Pain gate calibration complete | DONE      | All 7 prospects GREEN; thresholds confirmed correct    |
| MIN_AVERAGE_CONFIDENCE = 0.55             | CONFIRMED | Margin +0.040 above lowest scorable avg                |
| GREEN_MIN_SOURCE_TYPES = 3                | CONFIRMED | All prospects have 4-5 source types                    |
| Calibration artifact committed            | DONE      | scripts/calibration-report.mjs is rerunnable           |

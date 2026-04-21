# Phase 69: E2E Validation — Research

**Researched:** 2026-04-21
**Domain:** Pipeline validation, before/after comparison, TypeScript type-check, discover page rendering
**Confidence:** HIGH — all findings based on direct codebase inspection

---

<phase_requirements>

## Phase Requirements

| ID       | Description                                                                                                                           | Research Support                                                                                                                                                                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VALID-02 | Full pipeline re-run for 3-5 prospects with before/after comparison on evidence count, narrative quality, and discover page rendering | All pipeline components (FUNNEL-01/02/03/04, SELECT-01, PROMPT-01/02/03) are complete. Re-run infrastructure exists via `executeResearchRun` + existing rerun scripts. Baseline snapshots captured in `.planning/baselines/analysis/`. Before/after comparison is a manual judgment call by Romano. |

</phase_requirements>

---

## Summary

Phase 69 is a **validation phase, not an implementation phase**. All v10.0 pipeline changes are in place (phases 65-68). The work is: trigger fresh pipeline runs for 3-5 existing prospects, compare evidence counts and analysis quality before/after, and confirm the discover page renders correctly end-to-end.

The phase has two automated sub-tasks and one human judgment task. Sub-task 1 is a fresh pipeline run script (extending the existing `tmp-rerun-nedri.ts` pattern to cover multiple prospects). Sub-task 2 is a TypeScript clean-check (`npx tsc --noEmit`). The judgment task is Romano reviewing side-by-side JSON diffs of `ProspectAnalysis.outputJson` and visually checking the discover page.

**The STB-kozijnen prospect is the primary success criterion target** (success criteria require it to drop below 100 EvidenceItems from ~233). However, STB-kozijnen does not appear in the existing baseline snapshots in `.planning/baselines/analysis/`, meaning it either has no prior `ProspectAnalysis` record or uses one of the raw-slug baseline files. The most likely explanation: STB-kozijnen's 233 items count is its `EvidenceItem` count (not `ProspectAnalysis` count) — it may not have had a completed analysis in the DB at baseline time.

**Primary recommendation:** Write a multi-prospect rerun script covering STB-kozijnen + 2-3 other Dutch SMB prospects (Mujjo, Nedri, Marfa), run it once, capture new baselines, compare evidence counts and `ProspectAnalysis.content` diffs.

---

## Current State — What's Already Built

All pipeline requirements for v10.0 are implemented and tested:

| Requirement | What Was Built                                               | Where                                                            |
| ----------- | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| FUNNEL-01   | HTTP 4xx/5xx gate in Crawl4AI                                | `lib/enrichment/crawl4ai.ts`, `lib/web-evidence-adapter.ts`      |
| FUNNEL-02   | fallback/notFound filter before DB insert                    | `lib/research-executor.ts` (filter after dedupeEvidenceDrafts)   |
| FUNNEL-03   | SHA-256 content hash dedup within (prospectId, sourceType)   | `lib/research-executor.ts` + `prisma/schema.prisma`              |
| FUNNEL-04   | Per-source-type relevance gate at ingestion via Gemini Flash | `lib/evidence-scorer.ts` + `lib/research-executor.ts`            |
| SELECT-01   | top-20 diversity-capped evidence selection                   | `lib/analysis/evidence-selector.ts` + `lib/research-executor.ts` |
| PROMPT-01   | Legacy v1 prompt + types deleted                             | Already done                                                     |
| PROMPT-02   | visualType/visualData stripped from masterprompt             | `lib/analysis/master-prompt.ts`                                  |
| PROMPT-03   | Downstream Gemini Flash call for visual data per section     | `lib/analysis/visual-generator.ts` + `lib/research-executor.ts`  |

---

## Architecture Patterns

### Pattern 1: Multi-Prospect Rerun Script

**What:** Extend `scripts/tmp-rerun-nedri.ts` to cover multiple prospects in sequence.

**Why:** The success criteria require re-runs on 3-5 prospects. Running them individually wastes time. A single script that loops over a list of company names (or domains) is cleaner and produces a unified evidence-count report.

**Key pattern:**

```typescript
// scripts/rerun-v10-validation.ts
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { executeResearchRun } from '../lib/research-executor';

const PROSPECTS_TO_RERUN = [
  { domain: 'stb-kozijnen.nl' }, // primary success criterion target
  { companyName: 'Mujjo' },
  { domain: 'nedri.nl' },
  { domain: 'marfa.nl' },
];
```

**Evidence count query** (run before AND after for comparison):

```typescript
const evidenceCounts = await prisma.evidenceItem.groupBy({
  by: ['prospectId', 'sourceType'],
  where: { prospectId: { in: prospectIds } },
  _count: { id: true },
});
```

**One important subtlety:** The rerun creates a NEW `ResearchRun`, which creates NEW `EvidenceItem` rows. The old `EvidenceItem` rows from previous runs remain. To measure the "after" count accurately, count only items from the NEW run's `researchRunId`, not all items for the prospect.

### Pattern 2: Before/After JSON Diff

**What:** Compare `ProspectAnalysis.content` JSON from the baseline file (phase 64) against the new analysis.

**How to diff:**

```bash
# After the rerun, capture new baselines for these prospects
npx tsx scripts/capture-baseline.ts

# Then diff specific prospect (jq extracts the narrative body)
diff \
  <(jq '.analysis.content.sections[].body' .planning/baselines/analysis/marfa_xeazma_2026-04-20T22-27-47.json) \
  <(jq '.analysis.content.sections[].body' .planning/baselines/analysis/marfa_<NEW_ANALYSIS_ID>_<NEW_TIMESTAMP>.json)
```

**The judgment** is Romano's: are narrative bodies more specific to the company, or still generic filler? This is a manual review — there is no automated quality metric.

### Pattern 3: Discover Page Rendering Check

**What:** Open `/analyse/[slug]` in browser for each re-run prospect and confirm no broken layout or console errors.

**Discover page route:** `app/analyse/[slug]/page.tsx` renders using `AnalyseBrochure` component from `components/features/analyse/analyse-brochure.tsx`.

**Slug lookup:** The discover page uses `discoverLookupCandidates(slug)` which checks both `slug` (cuid) and `readableSlug`. For the validation run, use the `readableSlug` if set (e.g., `marfa`, `nedri-spanstaal-bv`). For raw-slug prospects (gStHk4OG, qXGQngut, t63pSR0K) use the slug directly.

**What to verify:**

- `openingHook` renders as the intro text
- `executiveSummary` renders
- All `sections[]` render with `body` and `punchline`
- `visualData` renders when present (or gracefully absent)
- No Next.js console errors (hydration mismatches, missing required props)

**Dev server:** Runs on port 9200. Discover URL: `http://localhost:9200/analyse/[slug]`

### Pattern 4: TypeScript Clean-Check

**What:** `npx tsc --noEmit` across the full project after all v10.0 changes.

**Known pre-existing error:** `lib/enrichment/sitemap.test.ts` — Buffer vs BodyInit type mismatch. This was out-of-scope in phases 65/66/67/68. It is NOT a new error introduced by v10.0 and must NOT be counted against the success criteria.

**How to distinguish new vs pre-existing:** Run `npx tsc --noEmit` before and after the validation run. If the only error is the pre-existing sitemap.test.ts error, the milestone passes.

---

## STB-Kozijnen Prospect — Known Gap

The success criteria explicitly target STB-kozijnen with a count threshold of <100 EvidenceItems per run. **STB-kozijnen does not appear in the current baseline JSON files.** The baselines contain: Heijmans (x2), Mujjo, Nedri Spanstaal, Marfa, Brainport Eindhoven, De Ondernemer, DuckDB.

This means either:

1. STB-kozijnen exists in the DB but had no `ProspectAnalysis` at baseline capture time, OR
2. STB-kozijnen is a new prospect that needs to be created/seeded before the validation run

**Plan task must include:** Query the DB to confirm STB-kozijnen exists (`prisma.prospect.findFirst({ where: { domain: { contains: 'kozijnen' } } })`). If it doesn't exist, it needs to be created via admin UI or a seed script before the pipeline rerun. The 233 EvidenceItem count mentioned in planning research was from a previous pipeline run — this context predates v10.0.

**Research note (MEDIUM confidence):** The `.planning/research/STACK.md` and `PITFALLS.md` reference STB-kozijnen with 233 items and domain `stb-kozijnen.nl`. The prospect likely exists in DB since it was used as the primary example in v10.0 planning research. It just had no `ProspectAnalysis` at baseline time (i.e., never completed a full pipeline run through to analysis).

---

## Don't Hand-Roll

| Problem                       | Don't Build            | Use Instead                                                                                                |
| ----------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| Running pipeline per prospect | Custom DB logic        | `executeResearchRun(prisma, { prospectId, manualUrls: [], deepCrawl: true })` — same as tmp-rerun-nedri.ts |
| Capturing post-rerun baseline | New snapshot script    | Reuse `scripts/capture-baseline.ts` — it queries all ProspectAnalysis and writes timestamped JSON          |
| JSON diffing                  | Custom diff script     | `diff` + `jq` CLI — already proven in phase 64 baseline validation                                         |
| Discover page rendering       | Automated browser test | Manual visual check — console errors + layout check by Romano in browser                                   |
| TypeScript check              | Custom type validator  | `npx tsc --noEmit` — already established project standard                                                  |

---

## Common Pitfalls

### Pitfall 1: Counting EvidenceItems from ALL runs, not the new run

**What goes wrong:** `prisma.evidenceItem.count({ where: { prospectId } })` counts ALL historical items across every research run for the prospect. After one v10.0 run, the DB may still have 233 old items + the new 80 items = 313 total. The success criterion says "stores fewer than 100 EvidenceItems" — this means items FROM THE NEW RUN.

**How to avoid:** Count by `researchRunId`, not just `prospectId`:

```typescript
const count = await prisma.evidenceItem.count({
  where: { researchRunId: newRunId },
});
```

### Pitfall 2: STB-kozijnen not in DB

**What goes wrong:** The rerun script calls `findFirst({ where: { domain: { contains: 'kozijnen' } } })` and gets null. The script crashes or silently skips the prospect. The success criteria cannot be verified.

**How to avoid:** Add a null-check with a clear error message: "STB-kozijnen not found — create via admin UI before running validation." The plan task should include this guard.

### Pitfall 3: Old analysis persisted — discover page shows old data

**What goes wrong:** The prospect already has a `ProspectAnalysis` record with old analysis-v1 data (or old v2 data). After the new pipeline run, a second `ProspectAnalysis` record is created. The discover page queries `findFirst({ orderBy: { createdAt: 'desc' } })` which should pick up the newest, but it's worth verifying this.

**How to avoid:** Check the discover page implementation — `app/analyse/[slug]/page.tsx` queries analysis records. Confirm it orders by `createdAt` descending to always render the newest analysis.

### Pitfall 4: Pre-existing TypeScript error counted as regression

**What goes wrong:** `npx tsc --noEmit` exits non-zero due to the pre-existing `lib/enrichment/sitemap.test.ts` Buffer/BodyInit error. This is logged as "zero new TypeScript errors" but the exit code is 1. If the plan task checks exit code only, it will wrongly fail.

**How to avoid:** Document the pre-existing error. The validation check should be: "no TypeScript errors INTRODUCED by v10.0" not "TSC exits 0." The standard in phases 65-68 was to note this pre-existing error and treat it as out-of-scope.

### Pitfall 5: LINKEDIN/NEWS thresholds uncalibrated

**What goes wrong:** Phase 67 flagged LINKEDIN (0.35) and NEWS (0.35) thresholds as subject to Phase 69 empirical calibration. If the rerun on STB-kozijnen drops too many LINKEDIN or NEWS items, the narrative may lose important signals. The success criteria say "no 404-sourced items, no duplicate content" — they don't specify the threshold validation. But if the narrative quality degrades because valid items were dropped, Romano's side-by-side judgment will catch it.

**How to avoid:** In the before/after count report, include a per-sourceType breakdown. If LINKEDIN items drop dramatically from before to after, investigate whether the threshold is correctly calibrated. The `inputSnapshot.sourceBreakdown` field (added in Phase 68) makes this available without a DB query.

### Pitfall 6: Discover page not on port 9200

**What goes wrong:** Dev server not running, or running on wrong port. Opening `localhost:9200/analyse/[slug]` returns connection refused.

**How to avoid:** The plan task should remind Romano to start the dev server (project uses port 9200). The plan cannot start the server — per project instructions, never start services manually.

---

## Code Examples

### Evidence count query (per-run, not per-prospect)

```typescript
// Source: direct inspection of prisma/schema.prisma (EvidenceItem model)
const newRunCount = await prisma.evidenceItem.count({
  where: { researchRunId: result.runId },
});

// Per-sourceType breakdown for threshold calibration check
const breakdown = await prisma.evidenceItem.groupBy({
  by: ['sourceType'],
  where: { researchRunId: result.runId },
  _count: { id: true },
  orderBy: { _count: { id: 'desc' } },
});
```

### Running a full pipeline rerun (established pattern)

```typescript
// Source: scripts/tmp-rerun-nedri.ts + server/routers/research.ts
const result = await executeResearchRun(prisma as any, {
  prospectId: prospect.id,
  manualUrls: [],
  deepCrawl: true,
});
// result.runId: the new ResearchRun.id
```

### Discover page slug lookup pattern

```typescript
// Source: app/analyse/[slug]/page.tsx
// Uses discoverLookupCandidates(slug) which handles readableSlug and slug
// Dev URL: http://localhost:9200/analyse/[readableSlug or raw slug]
```

### Before/after analysis diff (CLI)

```bash
# Source: scripts/capture-baseline.ts usage docs
# After new baseline captured:
jq '.analysis.content | {openingHook, sections: [.sections[] | {id, body}]}' \
  .planning/baselines/analysis/marfa_xeazma_2026-04-20T22-27-47.json \
  > /tmp/marfa-before.json

jq '.analysis.content | {openingHook, sections: [.sections[] | {id, body}]}' \
  .planning/baselines/analysis/marfa_<NEW_ID>_<NEW_TS>.json \
  > /tmp/marfa-after.json

diff /tmp/marfa-before.json /tmp/marfa-after.json
```

---

## File Change Map

| File                              | Change Type | What                                                                    |
| --------------------------------- | ----------- | ----------------------------------------------------------------------- |
| `scripts/rerun-v10-validation.ts` | New         | Multi-prospect rerun + evidence count report + per-sourceType breakdown |
| `scripts/capture-baseline.ts`     | No change   | Reuse as-is to capture post-run baselines                               |
| No app/lib code                   | —           | Phase 69 adds NO production code — validation only                      |

**Critical constraint:** Phase 69 must NOT modify any pipeline code. If a bug is found during validation, it is fixed in a separate hotfix commit, then validation is re-run.

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                               |
| ------------------ | ----------------------------------------------------------------------------------- |
| Framework          | Vitest (confirmed present — `lib/analysis/`, `lib/research-executor.test.ts`, etc.) |
| Config file        | `vitest.config.ts` (or package.json test scripts)                                   |
| Quick run command  | `npx vitest run lib/analysis/`                                                      |
| Full suite command | `npx vitest run && npx tsc --noEmit`                                                |

### Phase Requirements → Test Map

| Req ID   | Behavior                                                                | Test Type     | Automated Command                                                                                                            | File Exists?                        |
| -------- | ----------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| VALID-02 | New ResearchRun for STB-kozijnen produces <100 EvidenceItems            | manual-script | `npx tsx scripts/rerun-v10-validation.ts`                                                                                    | Wave 0                              |
| VALID-02 | No EvidenceItems with `sourceUrl` only (no snippet/title) in new run    | manual-script | inspect output of rerun script                                                                                               | Wave 0                              |
| VALID-02 | No duplicate snippets within any sourceType in new run                  | manual-script | SQL: `SELECT content_hash, COUNT(*) FROM evidence_items WHERE research_run_id = ? GROUP BY content_hash HAVING COUNT(*) > 1` | n/a — enforced by unique constraint |
| VALID-02 | Narrative body references company-specific details (not generic filler) | manual        | Romano reviews diff output                                                                                                   | n/a                                 |
| VALID-02 | `/analyse/[slug]` renders without layout breaks or console errors       | manual        | Romano opens in browser at localhost:9200                                                                                    | n/a                                 |
| VALID-02 | `npx tsc --noEmit` shows zero NEW errors vs pre-existing baseline       | automated     | `npx tsc --noEmit`                                                                                                           | ✅ exists                           |

### Manual-Only Justifications

- **Narrative quality:** "Better narrative" is a human judgment — no automated metric can determine if Dutch boardroom prose references real company specifics vs generic filler.
- **Discover page rendering:** Visual layout correctness requires a browser. No e2e test framework (Playwright/Cypress) is in scope for v10.0.

### Sampling Rate

- **Per task commit:** `npx vitest run lib/analysis/ && npx tsc --noEmit`
- **Per wave merge:** same
- **Phase gate:** Rerun script exits 0, evidence count <100 for STB-kozijnen, Romano approves narrative quality, discover page renders correctly

### Wave 0 Gaps

- [ ] `scripts/rerun-v10-validation.ts` — multi-prospect rerun + count report (primary deliverable of Plan 69-01)

_(All other required infrastructure exists: capture-baseline.ts, executeResearchRun, prisma client pattern)_

---

## Open Questions

1. **Does STB-kozijnen exist as a Prospect in the DB?**
   - What we know: Referenced extensively in v10.0 planning research with domain `stb-kozijnen.nl` and 233 historical EvidenceItems. Not present in baseline analysis JSON files.
   - What's unclear: Whether it has a `ProspectAnalysis` record (needed for before/after narrative diff), or just raw EvidenceItems.
   - Recommendation: Plan task must start with `prisma.prospect.findFirst({ where: { domain: { contains: 'kozijnen' } } })` and report if null.

2. **Should the rerun script delete old EvidenceItems before the new run?**
   - What we know: The `tmp-rerun-nedri.ts` script does `deleteMany({ where: { prospectId, version: 'analysis-v1' } })` for analysis (not evidence). The `retryRun` tRPC mutation deletes evidence items from the OLD run. A fresh `startRun` creates NEW evidence items without deleting old ones.
   - What's unclear: The success criteria say "STB-kozijnen produces fewer than 100 stored EvidenceItems" — this is ambiguous on whether it means total stored or per-run.
   - Recommendation: Count per-run (by `researchRunId`), not total. This is the most accurate metric of the v10.0 pipeline's filtering effectiveness.

3. **Should LINKEDIN/NEWS thresholds be adjusted based on rerun results?**
   - What we know: Phase 67 set LINKEDIN/NEWS at 0.35 with explicit flag for Phase 69 calibration.
   - What's unclear: Whether 0.35 drops too aggressively on Dutch SMBs (Mujjo, Marfa) vs being appropriate.
   - Recommendation: Phase 69 observes and reports. If Romano sees narrative quality degraded due to missing signals, threshold adjustment is a hotfix commit, then rerun. Don't pre-emptively change thresholds before seeing data.

---

## Sources

### Primary (HIGH confidence)

- Direct inspection of `scripts/tmp-rerun-nedri.ts` — pipeline rerun pattern
- Direct inspection of `scripts/capture-baseline.ts` — baseline capture pattern
- Direct inspection of `.planning/baselines/analysis/*.json` — 8 existing baseline files, confirmed STB-kozijnen absent
- Direct inspection of `prisma/schema.prisma` — `EvidenceItem` model, `researchRunId` field, `contentHash` constraint
- Direct inspection of `app/analyse/[slug]/page.tsx` — discover page route, slug lookup pattern
- Phase 64-01 SUMMARY — baseline capture decisions, file naming pattern
- Phase 65-01 SUMMARY — what FUNNEL-01/02/PROMPT-01 built
- Phase 66-01 SUMMARY — what FUNNEL-03 built (SHA-256 dedup)
- Phase 67-01 SUMMARY — what FUNNEL-04 built (relevance gate, LINKEDIN/NEWS thresholds flagged)
- Phase 68-02 SUMMARY — what SELECT-01/PROMPT-02/03 built, confirmed pipeline fully wired
- `.planning/REQUIREMENTS.md` — VALID-02 requirement text
- `.planning/research/STACK.md` — STB-kozijnen 233 items context
- `server/routers/research.ts` — `startRun` and `retryRun` tRPC mutations

### Secondary (MEDIUM confidence)

- `.planning/research/PITFALLS.md` — STB-kozijnen domain reference (`stb-kozijnen.nl`), LINKEDIN/NEWS calibration note
- `.planning/STATE.md` — locked decisions from v10.0 phases

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all established patterns, no new dependencies
- Architecture: HIGH — based on direct codebase inspection; exact patterns established in phases 64-68
- Pitfalls: HIGH — derived from actual prior phase implementations and explicit notes in phase summaries

**Research date:** 2026-04-21
**Valid until:** 2026-05-05 (stable — pipeline is complete, only validation remains)

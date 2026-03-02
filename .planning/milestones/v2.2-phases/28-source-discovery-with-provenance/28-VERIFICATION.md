---
phase: 28-source-discovery-with-provenance
verified: 2026-03-02T06:29:30Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 28: Source Discovery with Provenance — Verification Report

**Phase Goal:** Admin can verify exactly which source URLs were discovered for a prospect, where they came from, and that no URL explosion or API credit burn occurred.
**Verified:** 2026-03-02T06:29:30Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                                                           | Status   | Evidence                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `buildSourceSet` merges sitemap, serp, and default URL lists into a single `DiscoveredUrl[]` with provenance labels                                                             | VERIFIED | `source-discovery.ts` lines 115-167: cap → merge → dedup → provenance tagging implemented; 55 passing Vitest tests confirm behaviour                                                                                                                                                            |
| 2   | Per-source caps prevent any single source from exceeding its configured limit                                                                                                   | VERIFIED | `CAPS = { sitemap: 25, serp: 15, default: 20 }` constant exported; `cappedSitemap = sitemapUrls.slice(0, CAPS.sitemap)` enforced before merge; 5 cap-enforcement tests pass                                                                                                                     |
| 3   | Duplicate URLs across sources are collapsed to a single entry (first-wins provenance)                                                                                           | VERIFIED | `normalizeUrlForDedup()` strips scheme/www/trailing-slash; `Set<string>` guards against re-insertion; 6 dedup tests pass (trailing slash, scheme, www, multi-source)                                                                                                                            |
| 4   | JS-heavy pages are flagged with `jsHeavyHint=true` based on URL pattern matching                                                                                                | VERIFIED | `JS_HEAVY_PATTERNS` array covers 13 patterns (linkedin, trustpilot, indeed, glassdoor, maps, werkzoeken, jobbird, monsterboard, webflow.io, framer, hash-routes); 6 jsHeavyHint tests pass                                                                                                      |
| 5   | `rawCounts` reports both discovered and capped counts per source for UI display                                                                                                 | VERIFIED | `rawCounts` built from pre-cap lengths vs post-cap lengths; confirmed by 4 rawCounts tests and summary-line rendering in `SourceSetSection`                                                                                                                                                     |
| 6   | After running research, the run's `inputSnapshot` contains a `sourceSet` with provenance-tagged `DiscoveredUrl[]` entries                                                       | VERIFIED | `research-executor.ts` lines 197-211: `initialSourceSet = buildSourceSet(...)`, persisted at lines 221-243 (`sourceSet: initialSourceSet`); full `sourceSet` persisted after deepCrawl SERP at lines 370-410                                                                                    |
| 7   | Re-running research within 24h does not trigger new SerpAPI calls — `serpDiscoveredAt` timestamp is respected                                                                   | VERIFIED | Lines 146-150 in executor: `priorSourceSet = extractSourceSet(priorSnapshot)`; `serpAge` computed; `useSerpFromSourceSet` flag guards SERP call; secondary `isCacheValid` check in deepCrawl block preserves backward-compat with pre-28 runs                                                   |
| 8   | Admin can trigger re-discovery independently of a full research run via `rediscoverSources` mutation                                                                            | VERIFIED | `server/routers/research.ts` lines 69-151: `rediscoverSources` mutation defined on `adminProcedure`, accepts `{ runId, force }`, calls `discoverSitemapUrls` + conditionally `discoverSerpUrls`, builds new `sourceSet`, updates only `inputSnapshot.sourceSet`                                 |
| 9   | Re-discovery only updates `inputSnapshot.sourceSet` — does not clear evidence, hypotheses, or change run status                                                                 | VERIFIED | Mutation spreads `existingFields` before overwriting `sourceSet` (lines 131-147); only `ctx.db.researchRun.update({ data: { inputSnapshot: updatedSnapshot } })` — no status change, no evidence/hypothesis deletes                                                                             |
| 10  | `SourceSetSection` component exists with provenance grouping, cap/dedup feedback, and re-discover button — hidden behind `qualifai-debug` localStorage toggle per user feedback | VERIFIED | `source-set-section.tsx`: 147 lines, collapsible `<details>`, summary line with "X of Y" cap format, grouped URL list by provenance, `RefreshCw` re-discover button wired to `api.research.rediscoverSources.useMutation`; gated via `{debugMode && latestRunId && ...}` in `page.tsx` line 364 |

**Score:** 10/10 truths verified

---

## Required Artifacts

| Artifact                                               | Expected                                                                                                                                                                                    | Status   | Details                                                                                                                                                                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lib/enrichment/source-discovery.ts`                   | Types (`DiscoveredUrl`, `SourceSet`, `UrlProvenance`), constants (`CAPS`), functions (`buildSourceSet`, `defaultResearchUrls`, `normalizeUrlForDedup`, `detectJsHeavy`, `extractSourceSet`) | VERIFIED | 224 lines, all 6 exports present, zero Prisma/DB imports, zero network calls                                                                                                                                       |
| `lib/enrichment/source-discovery.test.ts`              | 10+ unit tests covering caps, dedup, provenance, jsHeavyHint, extractSourceSet                                                                                                              | VERIFIED | 491 lines, 55 tests across 9 describe blocks, all 55 passing (confirmed by Vitest run)                                                                                                                             |
| `lib/research-executor.ts`                             | Calls `buildSourceSet`, persists `sourceSet` to `inputSnapshot`, derives `researchUrls` from `sourceSet.urls`, imports `defaultResearchUrls` from source-discovery (no local copy)          | VERIFIED | `buildSourceSet` imported line 33, called at lines 197 and 370; `sourceSet` persisted in all 4 `inputSnapshot` writes; `researchUrls` derived at lines 260-262; no local `defaultResearchUrls` function defined    |
| `server/routers/research.ts`                           | `rediscoverSources` mutation with `adminProcedure`, `runId + force` input, SERP cache guard, snapshot-preserving update                                                                     | VERIFIED | Lines 69-151; uses `adminProcedure`; input schema `{ runId: string, force: boolean.default(false) }`; SERP cache guard at lines 94-97; spread-existing-fields pattern at lines 131-141                             |
| `components/features/prospects/source-set-section.tsx` | Collapsible component with summary line, grouped URLs, re-discover button                                                                                                                   | VERIFIED | 147 lines (above 60-line minimum); `<details>` native element (no controlled state); summary line with provenance breakdown and "X of Y" cap format; `api.research.rediscoverSources.useMutation` wired at line 47 |
| `app/admin/prospects/[id]/page.tsx`                    | `SourceSetSection` imported and rendered, gated behind `debugMode`                                                                                                                          | VERIFIED | `import { SourceSetSection }` at line 24; `useDebugMode` hook defined lines 38-58 using `useSyncExternalStore`; `{debugMode && latestRunId && <SourceSetSection .../>}` at line 364                                |

---

## Key Link Verification

| From                                                   | To                                                     | Via                                                                                         | Status | Details                                                                                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/enrichment/source-discovery.test.ts`              | `lib/enrichment/source-discovery.ts`                   | `import { buildSourceSet } from './source-discovery'`                                       | WIRED  | Line 3-10 of test file; `buildSourceSet` called in 30+ test cases                                                                               |
| `lib/research-executor.ts`                             | `lib/enrichment/source-discovery.ts`                   | `import { buildSourceSet, defaultResearchUrls as defaultResearchUrlsFn, extractSourceSet }` | WIRED  | Lines 33-37; `buildSourceSet` called at lines 197, 370; `extractSourceSet` called at line 146; `defaultResearchUrlsFn` called at lines 205, 373 |
| `server/routers/research.ts`                           | `lib/enrichment/source-discovery.ts`                   | `import { buildSourceSet, defaultResearchUrls, extractSourceSet }`                          | WIRED  | Lines 11-15; `extractSourceSet` called at line 91; `buildSourceSet` called at line 123; `defaultResearchUrls` called at line 126                |
| `lib/research-executor.ts`                             | `prisma ResearchRun.inputSnapshot`                     | `toJson({ ...existingSnapshot, sourceSet })` spread pattern                                 | WIRED  | `sourceSet: initialSourceSet` at lines 226, 241; `sourceSet: fullSourceSet` at lines 391, 406                                                   |
| `components/features/prospects/source-set-section.tsx` | `server/routers/research.ts`                           | `api.research.rediscoverSources.useMutation`                                                | WIRED  | Line 47; `onSuccess` invalidates `research.listRuns` cache                                                                                      |
| `app/admin/prospects/[id]/page.tsx`                    | `components/features/prospects/source-set-section.tsx` | `import { SourceSetSection }`                                                               | WIRED  | Line 24; rendered at line 365 with `runId={latestRunId}` and `inputSnapshot={latestRun?.inputSnapshot ?? null}`                                 |

---

## Requirements Coverage

| Requirement | Source Plan         | Description                                                                                         | Status    | Evidence                                                                                                                                                           |
| ----------- | ------------------- | --------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DISC-01     | 28-01, 28-02, 28-03 | System discovers source URLs from sitemap, SERP, and manual seeds with provenance labels            | SATISFIED | `UrlProvenance = 'sitemap' \| 'serp' \| 'default'` type; provenance assigned in `buildSourceSet()` and carried through `inputSnapshot.sourceSet.urls[].provenance` |
| DISC-02     | 28-01               | System detects JS-heavy pages and flags them with `jsHeavyHint` for downstream routing              | SATISFIED | `detectJsHeavy()` with 13 patterns; `jsHeavyHint: boolean` field on every `DiscoveredUrl`; carried to `inputSnapshot.sourceSet.urls[].jsHeavyHint`                 |
| DISC-03     | 28-02               | SERP discovery results are cached at prospect level (`serpDiscoveredAt`) to prevent API credit burn | SATISFIED | `SourceSet.serpDiscoveredAt` field; 24h guard in both `executeResearchRun` (`useSerpFromSourceSet` flag) and `rediscoverSources` mutation (`serpCacheHit` flag)    |
| DISC-04     | 28-01, 28-03        | Per-source URL caps prevent URL explosion during the merge step                                     | SATISFIED | `CAPS = { sitemap: 25, serp: 15, default: 20 }`; `slice(0, CAPS.X)` applied before merge; `rawCounts.X.capped` reflects post-cap count                             |
| DISC-05     | 28-01, 28-03        | Duplicate URLs are deduplicated during merge via normalized URL comparison                          | SATISFIED | `normalizeUrlForDedup()` strips scheme/www/trailing-slash; first-wins policy via `Set<string>` seen tracker; `dedupRemovedCount` tracks removals                   |

All 5 DISC-\* requirements for Phase 28 are satisfied. No orphaned requirements — DISC-01 through DISC-05 were the only requirements mapped to Phase 28 in REQUIREMENTS.md.

---

## Anti-Patterns Found

No blockers or warnings found.

| File                                                   | Pattern                        | Severity | Finding                                                                                 |
| ------------------------------------------------------ | ------------------------------ | -------- | --------------------------------------------------------------------------------------- |
| `lib/enrichment/source-discovery.ts`                   | Stub/placeholder scan          | —        | None found — all functions have real implementations                                    |
| `lib/research-executor.ts`                             | Empty handler / static return  | —        | None found — `buildSourceSet` call result is persisted                                  |
| `server/routers/research.ts`                           | Static JSON return in mutation | —        | None found — `rediscoverSources` runs real sitemap + SERP discovery and persists result |
| `components/features/prospects/source-set-section.tsx` | `return null` / placeholder    | —        | `return null` on line 54 is correct defensive guard for missing sourceSet (not a stub)  |

---

## Human Verification Required

### 1. SourceSetSection Debug Visibility

**Test:** In browser console: `localStorage.setItem('qualifai-debug', 'true')`, then navigate to `/admin/prospects/{id-with-research}` and click the Evidence tab.
**Expected:** A collapsed "source URLs" section appears above the evidence groups showing URL count, provenance breakdown, dedup count if any, and relative discovery time.
**Why human:** localStorage toggle reactivity and visual rendering cannot be verified statically.

### 2. Re-discover Button Functionality

**Test:** With debug mode enabled, expand the source set section and click "Re-discover sources". Observe the spinner and completion.
**Expected:** Button shows animated RefreshCw spinner while pending, summary line updates with a refreshed discovery timestamp, and existing evidence items are unchanged.
**Why human:** tRPC mutation flow, loading state, and evidence preservation require live verification.

### 3. 24h SERP Cache Enforcement

**Test:** Trigger research twice within 24h for the same prospect with `deepCrawl=true`. Observe SERP API call count in diagnostics.
**Expected:** Second run should show "SERP cache hit" in diagnostics — no new SerpAPI credit consumed.
**Why human:** Requires two sequential research runs and SerpAPI billing verification.

---

## Deviation: SourceSetSection Behind Debug Toggle

Per user feedback at Plan 03 Task 3 checkpoint: "I hate this section. Why would we show it?" — the `SourceSetSection` component is fully implemented and wired to the tRPC mutation but is hidden by default. It is only visible when `localStorage.getItem('qualifai-debug') === 'true'` (set via browser console).

This is an **intentional deviation**, not a gap. Backend provenance tracking (Plans 01 and 02) is fully operational and feeds Phase 29's `jsHeavyHint` routing logic. The UI is available for developer inspection when needed. This does NOT affect DISC-01 through DISC-05 requirement satisfaction.

---

## Summary

Phase 28 goal is fully achieved. The complete source discovery pipeline with provenance is operational:

- **Plan 01:** Pure `source-discovery.ts` module with all types, functions, and 55 passing unit tests.
- **Plan 02:** `buildSourceSet()` integrated into `executeResearchRun` (dual-phase: initial + SERP-enriched); `rediscoverSources` tRPC mutation with 24h SERP cache guard.
- **Plan 03:** `SourceSetSection` component with collapsible grouped URL view and re-discover button; hidden behind `qualifai-debug` localStorage flag per user request.

All 5 DISC-\* requirements marked complete in REQUIREMENTS.md. TypeScript strict mode passes with zero errors. All 55 unit tests pass.

---

_Verified: 2026-03-02T06:29:30Z_
_Verifier: Claude (gsd-verifier)_

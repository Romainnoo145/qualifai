# Research Summary: v10.0 Evidence Pipeline Overhaul

**Researched:** 2026-04-20
**Confidence:** HIGH — all findings from direct codebase inspection

## Executive Summary

The v10.0 milestone is a surgical quality overhaul of an existing, working evidence pipeline — not a rebuild. The scraping infrastructure (Scrapling + Crawl4AI, 8 sources) produces valid evidence; the problem is everything that happens between collection and the AI narrative: duplicate items from multiple scrapers inflate counts to 233-427 items per prospect, low-quality fallback stubs survive into the masterprompt, and the current prompt forces Gemini Pro to simultaneously write narrative prose and generate structured visual JSON — a task split that produces frequent schema violations.

The solution is three thin layers added at precise insertion points: a content dedup + relevance gate before DB storage, a ranked top-20 selection replacing the arbitrary `.slice(0, 60)` before the masterprompt, and decomposition of visual data generation into a separate downstream Gemini Flash call.

## Stack Additions

**Zero new npm packages required.** All capabilities implementable with:

- Node.js built-in `crypto` (SHA-256 for content hashing)
- Existing `@google/generative-ai` package (Gemini Flash for relevance scoring + visual data)
- One Prisma schema addition: `contentHash String?` on EvidenceItem

**New files (3, all <100 lines):**

- `lib/evidence-filter.ts` — dedup + relevance gate + boilerplate detection
- `lib/evidence-selector.ts` — ranked top-20 selection with source diversity caps
- `lib/analysis/visual-data-generator.ts` — downstream Flash calls for visual data

## Feature Table Stakes

| Feature                                 | Complexity | AI Cost          |
| --------------------------------------- | ---------- | ---------------- |
| Crawl4AI HTTP 404 gate                  | One-liner  | None             |
| Fallback/notFound draft suppression     | One-liner  | None             |
| Content dedup (SHA-256, per sourceType) | ~50 lines  | None             |
| Dead v1 prompt deletion (260 lines)     | Deletion   | None             |
| Relevance gate at ingestion             | ~80 lines  | ~$0.002/prospect |
| Pre-ranked top-20 evidence selection    | ~60 lines  | None             |
| Masterprompt schema simplification      | Deletion   | None             |
| Downstream visual data Flash calls      | ~80 lines  | ~$0.001/section  |

## Architecture

Six discrete fixes mapped to exact insertion points. No restructuring needed:

1. Crawl4AI 404 gate → `lib/enrichment/crawl4ai.ts`
2. Fallback filter → between scoring and DB create in `research-executor.ts`
3. Content dedup → new `lib/evidence-filter.ts`, called before DB insert
4. Pre-prompt ranking → new `lib/evidence-selector.ts`, replaces `.slice(0, 60)`
5. Delete legacy v1 → `master-prompt.ts` (260 lines), `master-analyzer.ts`, `types.ts`
6. Split visualData → new `lib/analysis/visual-data-generator.ts`, remove spec from prompt builders

**Pattern:** Follows `matchProofs` decomposition blueprint (already proven in production).

## Top Pitfalls

1. **Cross-type dedup destroys corroboration** — Dedup MUST be scoped within sourceType, not across. Cross-source confirmation is what drives confidence scores.
2. **Dutch content under-scores on English rubrics** — Source-type-specific thresholds needed (WEBSITE/REGISTRY at 0.25, REVIEWS/CAREERS at 0.45). Dutch examples in Flash scoring prompt.
3. **Visual data loses citation thread** — Flash call needs cited evidence items per section, not just section body.
4. **Sync scoring adds 30-90s latency** — Score async or cap batch at 80 items/run.
5. **Baseline capture before changes** — The `.slice(0, 60)` replacement will produce different narrative output. Capture baseline JSON for all 7 prospects first.

## Recommended Phase Structure

| #   | Phase                                      | Depends On             | Risk                              |
| --- | ------------------------------------------ | ---------------------- | --------------------------------- |
| 1   | Evidence Funnel Fixes                      | None                   | LOW — zero-AI, surgical           |
| 2   | Content Deduplication                      | None (parallel with 1) | LOW — hash dedup is deterministic |
| 3   | Relevance Gate at Ingestion                | 1 + 2                  | MEDIUM — threshold calibration    |
| 4   | Pre-Ranked Evidence Selection              | 3                      | MEDIUM — quality regression       |
| 5   | Masterprompt Simplification + Visual Split | 4                      | MEDIUM — output format change     |
| 6   | E2E Validation                             | All                    | LOW — verification only           |

## Research Flags

**Needs design decision before implementation:**

- Sync vs. async scoring architecture (Phase 3)
- Dutch-language threshold calibration against real STB-kozijnen items (Phase 3)
- Discover brochure renderer handles optional visual fields? (Phase 5)

**Standard patterns (skip deep research):**

- All Phase 1 fixes are surgical one-liners
- Phase 2 SHA-256 dedup is <50 lines
- Phase 5 dead code deletion is zero-risk with grep verification

---

_Synthesized: 2026-04-20 from STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md_

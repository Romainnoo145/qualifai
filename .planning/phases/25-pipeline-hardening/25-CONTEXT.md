# Phase 25: Pipeline Hardening - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Plans 25-01 and 25-02 are complete. This context covers plan 25-03: validate that hypotheses extracted from real Dutch marketing agency websites are specific, grounded, and personalizable. Fix anything that prevents all imported real prospects from reaching amber or green quality gate score. The pipeline is not production-ready until every current prospect passes.

</domain>

<decisions>
## Implementation Decisions

### What "good" means

- Core bar: specific workflow pain, specific enough to write a credible personalized email from
- A hypothesis is bad if it is fabricated/hallucinated — not grounded in actual evidence found during research
- Validation heuristic: does this match what you know about Dutch marketing agency pain from market knowledge? If it rings true and could anchor an outreach email, it passes.
- Generic pains ("they want to grow", "they're interested in automation") are acceptable only if they're traceable — the bar is plausibility from market knowledge, not evidence trail inspection

### Validation method

- Manual review in admin UI: open each prospect's hypothesis list, read each one, judge whether it's specific and plausible
- No systematic scoring needed — read and judge
- Claude's discretion: if the UI is missing something that would make this review significantly easier (e.g., evidence alongside hypotheses), add it minimally — but don't over-engineer

### When quality is bad

- Fix extraction prompts immediately as part of 25-03 — don't defer to phase 26
- Iterate on prompts until at least one prospect has usable hypotheses, then continue checking the rest
- If a prospect has thin web presence and still produces poor quality after prompt fixes, flag it as low-confidence in .planning notes for phase 26
- Scrapling (see Specific Ideas): if poor scraping is identified as the root cause of thin/bad evidence, integrate Scrapling as part of 25-03 rather than deferring to Phase 29

### Success criteria

- ALL imported real prospects must produce at least one hypothesis that passes the quality gate (amber or green score)
- No exceptions — if any prospect fails after prompt fixes, keep iterating until they pass or are explicitly flagged as "requires more evidence sources" (input for phase 28)
- Document findings in `.planning/phases/25-pipeline-hardening/25-03-NOTES.md`: which hypotheses passed, which needed fixing, what prompt changes were made, any prospects flagged as low-confidence

### Claude's Discretion

- Whether to make any admin UI tweaks to support hypothesis review (keep minimal)
- Exact format and structure of the 25-03-NOTES.md artifact

</decisions>

<specifics>
## Specific Ideas

- **Scrapling** — User has this Python scraping library set up locally: https://github.com/D4Vinci/Scrapling. If 25-03 validation reveals that bad scraping quality (not prompt quality) is causing thin/hallucinated hypotheses, adopt Scrapling in 25-03 rather than waiting for Phase 29. Researcher should investigate Scrapling's capabilities vs current Crawl4AI approach.
- The researcher for 25-03 should check: what does the current extraction prompt look like? What evidence quality are real prospects producing today (evidence count, snippet quality)?

</specifics>

<deferred>
## Deferred Ideas

- Scrapling as a full scraper replacement (Phase 29: Browser Evidence Extraction) — only integrate in 25-03 if it's the identified root cause of poor hypothesis quality. A full architectural swap is Phase 29 scope.
- Source discovery upgrade (Phase 28) — low-confidence flagged prospects from 25-03 become input for Phase 28, not something to solve here.

</deferred>

---

_Phase: 25-pipeline-hardening_
_Context gathered: 2026-02-27_

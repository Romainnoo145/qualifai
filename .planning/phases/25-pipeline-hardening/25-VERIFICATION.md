---
phase: 25-pipeline-hardening
verified: 2026-02-27T00:00:00Z
status: human_needed
score: 4/4 must-haves verified
gaps:
  - truth: 'PIPE-03 marked Pending in REQUIREMENTS.md despite 5/5 prospects passing hypothesis gate'
    status: resolved
    reason: "REQUIREMENTS.md was last updated 2026-02-25 and still shows PIPE-03 as pending ([ ]), despite plan 25-03-SUMMARY.md claiming it complete and 25-03-NOTES.md documenting 5/5 prospects passing. The requirements traceability table shows 'Pending' status. This is a documentation/tracking inconsistency — the code and notes confirm the requirement is functionally met, but the REQUIREMENTS.md status was not updated."
    artifacts:
      - path: '.planning/REQUIREMENTS.md'
        issue: "PIPE-03 still marked '[ ]' (pending) at line 25. Traceability table says 'Pending' at line 85. Last-updated comment says 2026-02-25 after 25-01/25-02 but does not reflect 25-03 completion."
    missing:
      - "Update REQUIREMENTS.md line 25: change '- [ ] **PIPE-03**' to '- [x] **PIPE-03**'"
      - "Update REQUIREMENTS.md traceability table line 85: change 'Pending' to 'Complete' for PIPE-03"
      - 'Update the last-updated comment to reflect 25-03/25-04 completion'
human_verification:
  - test: 'Run research pipeline on one of the 5 real prospect domains after Scrapling integration'
    expected: "Pipeline completes with non-empty snippets (>200 chars) and produces at least one AI-generated hypothesis specific to the company's industry"
    why_human: 'Scrapling service was verified running and functional during 25-04, but a full end-to-end re-run validating improved snippet quality post-25-04 was documented as a smoke test result (html_length), not as a full hypothesis quality re-run. The 5/5 hypothesis pass documented in 25-03-NOTES.md was done BEFORE Scrapling was integrated (25-04 came after). If the post-Scrapling re-run was executed, its results were not separately documented.'
---

# Phase 25: Pipeline Hardening Verification Report

**Phase Goal:** The research pipeline runs successfully on real company websites and surfaces clear errors when external APIs fail, rather than silently producing empty results.
**Verified:** 2026-02-27
**Status:** gaps_found (1 gap: REQUIREMENTS.md not updated for PIPE-03; 1 human verification item)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                               | Status   | Evidence                                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Research pipeline completes successfully on at least 3 real marketing agency websites                                                               | VERIFIED | 25-01-SUMMARY.md: 5/5 prospects completed, 0 failures, 10–27 evidence items per run                                                                                                                                            |
| 2   | When Crawl4AI times out, SerpAPI hits rate limits, or KvK returns an error, the admin sees a user-visible error message — not a silent empty result | VERIFIED | research-executor.ts lines 149–518 collect named SourceDiagnostic entries for all 8 sources; evidence-section.tsx lines 462–486 render "Source Diagnostics" panel; page.tsx lines 331–332 pass latestRunSummary+latestRunError |
| 3   | Evidence extraction produces at least one relevant workflow pain point hypothesis per real prospect                                                 | VERIFIED | 25-03-NOTES.md documents 5/5 prospects with 1–3 passing AI-generated hypotheses; generateHypothesisDraftsAI() confirmed in workflow-engine.ts lines 574–732 calling gemini-2.0-flash with real evidence snippets               |
| 4   | Research quality gate correctly classifies each result as red, amber, or green                                                                      | VERIFIED | evaluateQualityGate() exists at workflow-engine.ts line 469; computeTrafficLight() at line 516 returns red/amber/green; called in research-executor.ts line 566                                                                |

**Score:** 4/4 truths verified in the code

---

## Required Artifacts

### Plan 25-03 Artifacts

| Artifact                                                | Expected                                                    | Status   | Details                                                                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| `lib/workflow-engine.ts`                                | `generateHypothesisDraftsAI` exported                       | VERIFIED | Lines 574–732: function exported, calls Gemini, falls back to `generateFallbackHypothesisDrafts` on failure |
| `lib/research-executor.ts`                              | Calls `generateHypothesisDraftsAI` with snippet + sourceUrl | VERIFIED | Lines 576–592: full evidence shape including `snippet`, `sourceUrl`, `title` passed                         |
| `.planning/phases/25-pipeline-hardening/25-03-NOTES.md` | Per-prospect hypothesis quality review                      | VERIFIED | File exists, documents all 5 prospects with pass/fail per hypothesis                                        |

### Plan 25-04 Artifacts

| Artifact                        | Expected                                                               | Status   | Details                                                                                                       |
| ------------------------------- | ---------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `services/scrapling/Dockerfile` | Uses `ghcr.io/d4vinci/scrapling:latest`                                | VERIFIED | Line 1: `FROM ghcr.io/d4vinci/scrapling:latest`; ENTRYPOINT overridden; CMD uses `uv run uvicorn`             |
| `services/scrapling/app.py`     | FastAPI with StealthyFetcher + DynamicFetcher                          | VERIFIED | Lines 6, 25, 37: imports and uses both fetchers via ThreadPoolExecutor                                        |
| `docker-compose.yml`            | `qualifai-scrapling` service on port 3010                              | VERIFIED | Lines 24–29: scrapling service defined, container_name set, port 3010 mapped                                  |
| `lib/enrichment/scrapling.ts`   | `fetchStealth` exported                                                | VERIFIED | Lines 35–39: `fetchStealth` exported; 30s timeout; error-safe return                                          |
| `lib/web-evidence-adapter.ts`   | Uses `fetchStealth` with fallback to raw fetch; snippet limits 700/600 | VERIFIED | Line 3: import; line 270–301: Scrapling-primary + raw fallback; line 103: slice(0,700); line 139–140: 700/600 |

---

## Key Link Verification

| From                          | To                            | Via                                                  | Status | Details                                                                                                             |
| ----------------------------- | ----------------------------- | ---------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| `lib/research-executor.ts`    | `lib/workflow-engine.ts`      | `generateHypothesisDraftsAI(evidenceRecords)`        | WIRED  | Import at line 5; call at line 576 with full evidence shape                                                         |
| `lib/workflow-engine.ts`      | `gemini-2.0-flash`            | `getGenAI().getGenerativeModel`                      | WIRED  | Line 655: `getGenAI().getGenerativeModel({ model: 'gemini-2.0-flash' })`                                            |
| `lib/web-evidence-adapter.ts` | `lib/enrichment/scrapling.ts` | `fetchStealth(url)`                                  | WIRED  | Import at line 3; used at line 270                                                                                  |
| `lib/enrichment/scrapling.ts` | `http://localhost:3010`       | `POST /fetch`                                        | WIRED  | SCRAPLING_BASE_URL env var with default; pattern confirmed in code                                                  |
| `lib/research-executor.ts`    | diagnostics panel             | `runSummaryPayload(gate, campaign, { diagnostics })` | WIRED  | Executor line 646–648 calls runSummaryPayload with diagnostics; evidence-section.tsx renders panel at lines 462–486 |

---

## Requirements Coverage

| Requirement | Source Plan | Description                                                                  | Status                                        | Evidence                                                                                                                                                              |
| ----------- | ----------- | ---------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PIPE-01     | 25-01       | Research pipeline runs successfully on real company websites                 | SATISFIED                                     | 5/5 prospects completed with evidence; REQUIREMENTS.md line 23 marked [x]                                                                                             |
| PIPE-02     | 25-02       | API failures surface user-visible error messages                             | SATISFIED                                     | SourceDiagnostic collection covers all 8 sources; "Source Diagnostics" UI panel rendered; REQUIREMENTS.md line 24 marked [x]                                          |
| PIPE-03     | 25-03       | Evidence extraction produces relevant hypotheses for real marketing agencies | FUNCTIONALLY SATISFIED — TRACKING DISCREPANCY | 5/5 prospects pass per 25-03-NOTES.md; AI generator confirmed wired; BUT REQUIREMENTS.md line 25 still shows `[ ]` (pending) — not updated after plan 25-03 completed |

### PIPE-03 Tracking Gap

REQUIREMENTS.md was last updated 2026-02-25, capturing PIPE-01 and PIPE-02 completion from plans 25-01 and 25-02. Plans 25-03 and 25-04 completed on 2026-02-27 but the requirements file was not updated. The SUMMARY for 25-03 claims `requirements-completed: [PIPE-01, PIPE-02, PIPE-03]` but REQUIREMENTS.md itself still shows PIPE-03 as pending.

---

## Anti-Patterns Found

| File                              | Pattern                                                                                          | Severity           | Impact                                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/rerun-hypotheses.ts`     | TypeScript error: missing `@types/pg`                                                            | INFO               | Pre-existing, unrelated to phase 25 changes; acknowledged in 25-03-SUMMARY.md and 25-04-SUMMARY.md; does not affect production app |
| `lib/workflow-engine.ts` line 736 | `generateFallbackHypothesisDrafts` re-exported as `generateHypothesisDrafts` for backward compat | INFO               | Expected: backward-compat alias documented; not a stub because the real AI generator is the primary call path                      |
| 25-03-NOTES.md                    | Old construction templates remain in DB alongside new AI hypotheses                              | WARNING (deferred) | Explicitly deferred to Phase 26 (QUAL-01/QUAL-02); documented in NOTES.md and 25-03-SUMMARY.md; no impact on new runs              |

---

## Human Verification Required

### 1. Post-Scrapling hypothesis quality

**Test:** Trigger a fresh research re-run on `hydrogen-central.com` or `us3consulting.co.uk` (the two flagged as low-confidence with thin evidence pre-Scrapling)
**Expected:** Run produces 2+ evidence items with non-placeholder snippets (>200 chars each) and at least 1 AI-generated hypothesis specific to the company's actual industry
**Why human:** The 5/5 hypothesis quality validation documented in 25-03-NOTES.md was performed BEFORE Scrapling was wired in (25-04 came after 25-03). The Scrapling smoke test confirmed HTML was returned (38KB and 322KB for the two previously blocked domains) but did not include a full hypothesis re-run. A post-Scrapling hypothesis quality check was not documented.

---

## Gaps Summary

**One tracking gap found:**

REQUIREMENTS.md still marks PIPE-03 as pending (`[ ]`) even though the implementation is complete and verified in the codebase. The requirement is fully satisfied functionally — `generateHypothesisDraftsAI()` is exported, wired into the research executor with the correct evidence shape (snippet + sourceUrl), called against Gemini, and verified to produce 5/5 prospects with usable hypotheses in 25-03-NOTES.md.

The gap is purely in the REQUIREMENTS.md status tracking file, not in the code. Closing it requires two line edits:

1. `.planning/REQUIREMENTS.md` line 25: `- [ ] **PIPE-03**` → `- [x] **PIPE-03**`
2. `.planning/REQUIREMENTS.md` line 85: `| PIPE-03 | Phase 25 — Pipeline Hardening | Pending |` → `| PIPE-03 | Phase 25 — Pipeline Hardening | Complete |`

**One human verification item:**

A post-Scrapling re-run on the two previously thin-evidence prospects (hydrogen-central.com, us3consulting.co.uk) was not documented. Given that these were the prospects most likely to benefit from Scrapling (previously returning 0 HTML due to bot detection), confirming improved hypothesis quality after 25-04 would fully close the phase.

---

_Verified: 2026-02-27_
_Verifier: Claude (gsd-verifier)_

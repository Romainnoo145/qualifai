---
phase: 33-configurable-model-selection
verified: 2026-03-02T21:05:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
human_verification:
  - test: "Run a research run with hypothesisModel='claude-sonnet' against a real prospect"
    expected: "Hypothesis generation completes via Anthropic SDK; server logs show '[generateHypothesisDraftsAI] CoT reasoning:' output; hypotheses have same shape as Gemini path"
    why_human: 'Cannot execute live API call to Anthropic in test environment; requires real ANTHROPIC_API_KEY and a prospect in DB'
---

# Phase 33: Configurable Model Selection Verification Report

**Phase Goal:** Admin can select Claude Sonnet as the hypothesis generation model for any research run via an optional parameter, and a two-pass chain-of-thought reasoning step separates evidence analysis from hypothesis synthesis.
**Verified:** 2026-03-02T21:05:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                             | Status   | Evidence                                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Passing `hypothesisModel='claude-sonnet'` to `generateHypothesisDraftsAI` invokes Anthropic SDK instead of Gemini | VERIFIED | `workflow-engine.ts:815` — `if (hypothesisModel === 'claude-sonnet') { getAnthropicClient().messages.create(...)`                                                                               |
| 2   | Omitting `hypothesisModel` or passing `'gemini-flash'` uses Gemini path unchanged from Phase 32                   | VERIFIED | `workflow-engine.ts:829-835` — `else` branch uses `getGenAI().getGenerativeModel()`                                                                                                             |
| 3   | Both models produce the same `HypothesisDraft[]` JSON shape                                                       | VERIFIED | `extractHypothesisJson` is shared; same `JSON.parse(jsonText)` cast + post-parse mapping for both paths                                                                                         |
| 4   | Chain-of-thought `<reasoning>` block appears in prompt instruction for both Gemini and Claude                     | VERIFIED | `workflow-engine.ts:792-800` — prompt contains literal `<reasoning>` XML block instruction; ANLYS-08 test confirms with `/<reasoning>/` regex                                                   |
| 5   | JSON extraction strips `<reasoning>` block before parsing                                                         | VERIFIED | `workflow-engine.ts:630-643` — `extractHypothesisJson()` uses `replace(/<reasoning>[\s\S]*?<\/reasoning>/g, '')` then extracts JSON array                                                       |
| 6   | `hypothesisModel` parameter threads from tRPC input through executor to function                                  | VERIFIED | tRPC `startRun` schema (line 30), `executeResearchRun` input type (line 109), call site (line 927) — full chain intact                                                                          |
| 7   | `hypothesisModel` is persisted in `inputSnapshot` for `retryRun` consistency                                      | VERIFIED | `research-executor.ts` lines 220, 236, 376, 392 — all 4 inputSnapshot write locations include `hypothesisModel: input.hypothesisModel ?? 'gemini-flash'`                                        |
| 8   | Anthropic mock is configurable per-test (module-level `vi.fn()`, not hardcoded rejection)                         | VERIFIED | `workflow-engine.test.ts:13-16` — `const mockAnthropicCreate = vi.fn()` + `beforeEach` reset at line 582                                                                                        |
| 9   | 3 MODEL-01 tests GREEN                                                                                            | VERIFIED | Test run output: `MODEL-01: generates hypotheses via Claude...` PASS, `MODEL-01: defaults to Gemini when omitted` PASS, `MODEL-01: defaults to Gemini when hypothesisModel='gemini-flash'` PASS |
| 10  | 2 ANLYS-08 tests GREEN                                                                                            | VERIFIED | Test run output: `ANLYS-08: prompt includes chain-of-thought reasoning instruction` PASS, `ANLYS-08: CoT reasoning block in Claude response is stripped before JSON parse` PASS                 |
| 11  | Existing 7 ANLYS tests (01-07) remain GREEN after Phase 33 changes                                                | VERIFIED | Test run: 31 passed — all ANLYS-01 through ANLYS-07 tests GREEN                                                                                                                                 |
| 12  | TypeScript compiles cleanly across all modified files                                                             | VERIFIED | `npx tsc --noEmit` exits with zero output, zero errors                                                                                                                                          |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact                      | Expected                                                                                               | Status   | Details                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------- |
| `lib/ai/constants.ts`         | `CLAUDE_MODEL_SONNET` constant                                                                         | VERIFIED | Line 5: `export const CLAUDE_MODEL_SONNET = 'claude-sonnet-4-5' as const;`                                           |
| `lib/workflow-engine.ts`      | Claude API call path, CoT prompt, `extractHypothesisJson`, lazy Anthropic client, `getAnthropicClient` | VERIFIED | Lines 11-12 (imports), 30-36 (lazy client), 630-643 (helper), 649 (param), 792-800 (prompt), 815-828 (Claude branch) |
| `lib/research-executor.ts`    | `hypothesisModel` threading to `generateHypothesisDraftsAI` + inputSnapshot persistence                | VERIFIED | Lines 109, 220, 236, 376, 392, 927 — complete threading and all 4 snapshot writes                                    |
| `server/routers/research.ts`  | `hypothesisModel` z.enum in `startRun` + retryRun snapshot read                                        | VERIFIED | Line 30 (z.enum input), line 39 (startRun pass-through), lines 52-72 (retryRun snapshot read and pass-through)       |
| `lib/workflow-engine.test.ts` | MODEL-01 + ANLYS-08 tests, configurable `mockAnthropicCreate` vi.fn()                                  | VERIFIED | Lines 13-16 (mock), 552-578 (factory), 582 (reset), 891-997 (5 test cases)                                           |

### Key Link Verification

| From                         | To                         | Via                                        | Status | Details                                                                                                  |
| ---------------------------- | -------------------------- | ------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------- |
| `server/routers/research.ts` | `lib/research-executor.ts` | `executeResearchRun input.hypothesisModel` | WIRED  | Line 39: `hypothesisModel: input.hypothesisModel` passed to `executeResearchRun`                         |
| `lib/research-executor.ts`   | `lib/workflow-engine.ts`   | `generateHypothesisDraftsAI` 4th argument  | WIRED  | Line 927: `input.hypothesisModel` passed as 4th arg to `generateHypothesisDraftsAI`                      |
| `lib/workflow-engine.ts`     | `@anthropic-ai/sdk`        | `getAnthropicClient().messages.create()`   | WIRED  | Lines 31-36 (lazy client init), line 817: `getAnthropicClient().messages.create({...})` in Claude branch |

### Requirements Coverage

| Requirement | Source Plans           | Description                                                                               | Status    | Evidence                                                                                                                                                                                                                                                                                                                    |
| ----------- | ---------------------- | ----------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MODEL-01    | 33-01-PLAN, 33-02-PLAN | Hypothesis generation supports configurable model selection via optional parameter        | SATISFIED | `hypothesisModel: 'gemini-flash' \| 'claude-sonnet'` parameter wired through full call chain; 3 MODEL-01 tests GREEN; REQUIREMENTS.md description says "env var" but RESEARCH.md and STATE.md document locked decision: per-run optional parameter (not global env var) — implementation is correct per the locked decision |
| ANLYS-08    | 33-01-PLAN, 33-02-PLAN | Two-pass chain-of-thought reasoning separates evidence analysis from hypothesis synthesis | SATISFIED | CoT `<reasoning>` prompt block at lines 792-800; `extractHypothesisJson()` strips reasoning before parse; 2 ANLYS-08 tests GREEN                                                                                                                                                                                            |

**Note on MODEL-01 description:** REQUIREMENTS.md line 24 says "via env var" which is stale — the RESEARCH.md explicitly documents the locked decision to use per-run optional parameter (not global env var). The implementation matches the locked decision. This is a stale requirements description, not an implementation gap.

**Orphaned requirements check:** No additional requirements mapped to Phase 33 in REQUIREMENTS.md traceability table beyond MODEL-01 and ANLYS-08 (lines 82-84). No orphaned requirements.

### Anti-Patterns Found

| File                          | Line | Pattern                                                                                                                                    | Severity | Impact                                                                                                                                                      |
| ----------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/workflow-engine.test.ts` | 222  | Pre-existing test failure: `uses reviews-first evidence ordering for construction/install profiles` — `expected 'WEBSITE' to be 'REVIEWS'` | INFO     | Pre-dates Phase 33 (confirmed by `git stash` verification in Plan 33-01). Logged in `deferred-items.md`. Does not affect MODEL-01 or ANLYS-08 test results. |

No blocker or warning anti-patterns found. The one failing test is pre-existing, out of scope, and formally deferred.

### Human Verification Required

#### 1. Live Claude Sonnet API call end-to-end

**Test:** In admin UI, trigger a research run for any existing prospect with `hypothesisModel='claude-sonnet'` (requires temporary UI exposure of the tRPC parameter, or direct tRPC call via test harness).
**Expected:** Server logs show `[generateHypothesisDraftsAI] CoT reasoning:` with evidence analysis text; hypothesis generation completes; hypotheses appear in admin detail view with same shape as Gemini-generated hypotheses.
**Why human:** Live Anthropic API call cannot be mocked in automated tests; requires real `ANTHROPIC_API_KEY` and a prospect with evidence in DB.

### Gaps Summary

No gaps. All 12 observable truths verified. All 4 artifacts are substantive and wired. All 3 key links confirmed. Both requirement IDs (MODEL-01, ANLYS-08) are satisfied with test evidence. TypeScript compiles cleanly. 31 of 32 tests pass — the single failing test is pre-existing, formally deferred, and unrelated to Phase 33 goals.

One item flagged for human verification: live end-to-end Claude API call. Automated checks cannot substitute for this, but it does not block phase completion — the full call chain is wired and unit-tested.

---

_Verified: 2026-03-02T21:05:00Z_
_Verifier: Claude (gsd-verifier)_

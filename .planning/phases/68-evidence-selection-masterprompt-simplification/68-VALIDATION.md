---
phase: 68
slug: evidence-selection-masterprompt-simplification
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 68 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | vitest                                                                                                                 |
| **Config file**        | vitest.config.ts                                                                                                       |
| **Quick run command**  | `npx vitest run lib/research-executor.test.ts lib/analysis/master-prompt.test.ts lib/analysis/master-analyzer.test.ts` |
| **Full suite command** | `npx vitest run`                                                                                                       |
| **Estimated runtime**  | ~8 seconds                                                                                                             |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type | Automated Command                                     | File Exists | Status     |
| -------- | ---- | ---- | ----------- | --------- | ----------------------------------------------------- | ----------- | ---------- |
| 68-01-01 | 01   | 1    | SELECT-01   | unit      | `npx vitest run lib/research-executor.test.ts`        | ✅          | ⬜ pending |
| 68-02-01 | 02   | 1    | PROMPT-02   | unit      | `npx vitest run lib/analysis/master-prompt.test.ts`   | ❌ W0       | ⬜ pending |
| 68-02-02 | 02   | 1    | PROMPT-03   | unit      | `npx vitest run lib/analysis/master-analyzer.test.ts` | ✅          | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Test files created as part of TDD within tasks.

---

## Manual-Only Verifications

| Behavior                                          | Requirement | Why Manual                                     | Test Instructions                                                           |
| ------------------------------------------------- | ----------- | ---------------------------------------------- | --------------------------------------------------------------------------- |
| Discover page renders without errors after re-run | PROMPT-03   | Requires running real pipeline + browser check | Re-run pipeline on prospect, open /discover/[slug], verify no broken blocks |
| Visual data generated per section by Flash call   | PROMPT-03   | Requires real Gemini Flash API call            | Inspect ResearchRun output for visualData on each section                   |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

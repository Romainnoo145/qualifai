---
phase: 67
slug: relevance-gate-at-ingestion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 67 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                      |
| ---------------------- | -------------------------------------------------------------------------- |
| **Framework**          | vitest                                                                     |
| **Config file**        | vitest.config.ts                                                           |
| **Quick run command**  | `npx vitest run lib/research-executor.test.ts lib/evidence-scorer.test.ts` |
| **Full suite command** | `npx vitest run`                                                           |
| **Estimated runtime**  | ~5 seconds                                                                 |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run lib/research-executor.test.ts lib/evidence-scorer.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type | Automated Command                              | File Exists | Status     |
| -------- | ---- | ---- | ----------- | --------- | ---------------------------------------------- | ----------- | ---------- |
| 67-01-01 | 01   | 1    | FUNNEL-04   | unit      | `npx vitest run lib/evidence-scorer.test.ts`   | ✅          | ⬜ pending |
| 67-01-02 | 01   | 1    | FUNNEL-04   | unit      | `npx vitest run lib/research-executor.test.ts` | ✅          | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior                                | Requirement | Why Manual                                            | Test Instructions                                                           |
| --------------------------------------- | ----------- | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| Dutch items score comparably to English | FUNNEL-04   | Requires real Gemini Flash calls on STB-kozijnen data | Run pipeline on STB-kozijnen, compare aiRelevance scores for NL vs EN items |
| Pipeline timing under 90s for 80 items  | FUNNEL-04   | Requires real pipeline execution                      | Time a full re-run on STB-kozijnen, verify total scoring time               |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

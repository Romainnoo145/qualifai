# Technology Stack — v3.0 Sharp Analysis

**Project:** Qualifai — v3.0 milestone additions
**Researched:** 2026-03-02
**Scope:** NEW capabilities only. Existing validated stack (Next.js 16, tRPC 11, Prisma 7, PostgreSQL, Anthropic Claude SDK ^0.73.0, @google/generative-ai 0.24.0, Apollo API, SerpAPI, Crawl4AI REST, Scrapling stealth fetcher, Resend, Cal.com) is NOT re-researched here.
**Confidence:** HIGH

---

## Decision: Zero New npm Dependencies

All v3.0 capability areas are achievable using the existing dependency tree.

---

## AI Model Changes

### 1. Claude Model Provider for Hypothesis Generation

**What:** Wire `@anthropic-ai/sdk` (already installed, zero production usage) as alternative model for `generateHypothesisDraftsAI`.

**Model:** `claude-haiku-4-5-20251001` — $1/$5 per MTok (comparable to Gemini Flash cost), 200K context, fast.

**Pattern:** Lazy client following existing `getGenAI()` pattern in workflow-engine.ts. Branch on `HYPOTHESIS_MODEL_PROVIDER=gemini|claude` env var (default: gemini).

**Reference:** `scoreWithClaude()` in workflow-engine.ts (line ~1408) shows the exact Anthropic SDK call pattern to follow.

### 2. Gemini Model String Upgrade

**What:** Update `gemini-2.0-flash` → `gemini-2.5-flash` across 4 files, 5 locations.

**Why:** `gemini-2.0-flash` retirement date is June 1, 2026. `gemini-2.5-flash` is drop-in replacement — same API, no code changes beyond model string.

**Files:** workflow-engine.ts, evidence-scorer.ts, serp.ts, review-adapters.ts

### 3. No SDK Migration Needed

`@google/generative-ai` → `@google/genai` migration deadline is June 24, 2026. Defer to v4.x — not in v3.0 scope.

---

## TypeScript Cleanup Fixes

| Item                         | File                                              | Fix                                                   |
| ---------------------------- | ------------------------------------------------- | ----------------------------------------------------- |
| Detail-view `as any` cast    | `app/admin/prospects/[id]/page.tsx`               | Replace with narrow typed cast                        |
| Unused logoUrl prop          | `components/public/prospect-dashboard-client.tsx` | Remove from interface + call sites                    |
| Import ordering anomaly      | `lib/workflow-engine.ts` line ~542                | Move import block to top of file                      |
| E2E send test bypass         | E2E test file                                     | Refactor to use tRPC test client                      |
| TS2589 Prisma `as any` casts | ~45 instances across ~15 files                    | Categorize into 3 types, fix each appropriately       |
| SERP cache re-read bug       | `lib/research-executor.ts`                        | Pre-read snapshot before overwrite in deepCrawl block |

---

## What NOT to Add

| Package                                      | Why Not                                    |
| -------------------------------------------- | ------------------------------------------ |
| Prompt templating library (Handlebars, etc.) | String templates sufficient for 1 prompt   |
| `@google/genai` migration                    | Defer to v4.x (deadline June 24, 2026)     |
| Anthropic Bedrock/Vertex routing             | Direct API sufficient at current volumes   |
| Chain-of-thought framework                   | Pure prompt engineering, no library needed |

---

## Build Order

1. Tech debt cleanup first — clean baseline, `npm run check` passes
2. Gemini model string upgrade — proactive, low risk
3. Hypothesis prompt rewrite — pure prompt work, no dependency changes
4. Claude model provider wiring — builds on rewritten prompt

---

## Installation

No new packages required.

```bash
# No npm install needed for v3.0
```

---

_Stack research for: Qualifai v3.0 Sharp Analysis_
_Researched: 2026-03-02_

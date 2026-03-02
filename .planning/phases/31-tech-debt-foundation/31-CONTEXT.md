# Phase 31: Tech Debt Foundation - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix 6 known tech debt items (DEBT-01 through DEBT-06) and upgrade the Gemini model string (MODEL-02) to establish a clean `npm run check` baseline. No hypothesis logic changes — this is pure cleanup before Phase 32 touches prompt generation.

</domain>

<decisions>
## Implementation Decisions

### TS2589 cleanup depth

- Fix only TS2589-related `as any` casts, not all `as any` usage in the codebase
- DEBT-04 (detail-view cast) is a separate requirement — fix it as its own item
- Other established `as any` patterns that aren't TS2589 remain untouched
- Use `Prisma.XGetPayload<>` utility types as the primary replacement pattern for deep inference casts — full type safety over narrow object casts
- Update MEMORY.md with the new pattern (remove tech debt note, document the replacement approach)
- If a cast is genuinely unfixable without major query restructuring, keep `as any` with a `// TODO: TS2589` comment — pragmatic, not dogmatic

### Gemini 2.5-flash upgrade

- String swap only across 4 files — trust Google's drop-in replacement claim
- No output comparison run needed; Phase 35 validates real output
- Extract to a shared constant (single source of truth) — Phase 33 model selection will build on this
- One constant for all 4 files (all do Gemini Flash inference for the same general purpose)
- No deadline comment in code — tracked in research docs and MEMORY.md

### Golden baseline capture

- Capture baseline in Phase 31 as handoff to Phase 32 (don't defer)
- Capture AFTER the Gemini 2.5 swap — Phase 32 comparisons isolate prompt changes only
- DB export only (no fresh AI run) — capture what's already stored for all 7 prospects
- Single summary file (baselines.json with all 7 prospects' hypotheses)
- Store in `.planning/baselines/` directory

### E2E test refactoring

- Fix just the send path (DEBT-03 scope) — no broader test coverage expansion
- Include negative case (gate rejects) to prove the quality gate works end-to-end
- Mock Resend after the quality gate — test the full tRPC path but no real email sends

### Claude's Discretion

- Exact SERP cache bug fix approach (DEBT-01 pre-read snapshot implementation)
- Import ordering fix in workflow-engine.ts (DEBT-05 — straightforward move)
- logoUrl prop removal approach (DEBT-02 — grep and remove)
- Test infrastructure setup if needed for E2E refactoring
- Baseline export script implementation details

</decisions>

<specifics>
## Specific Ideas

- The shared Gemini model constant should be positioned to make Phase 33's model selection extension natural (e.g., in a config or constants file that Phase 33 can expand)
- Baseline capture happens as the last step of Phase 31, after all fixes are applied and `npm run check` passes — confirms clean state
- TS2589 fix pattern should be consistent enough that future Prisma queries follow it without needing a style guide

</specifics>

<deferred>
## Deferred Ideas

- Google SDK migration (deadline June 24, 2026) — future milestone, not v3.0 scope
- Broader test coverage expansion — could be its own phase if test infrastructure warrants it
- All non-TS2589 `as any` cleanup — track but don't block Phase 31 on it

</deferred>

---

_Phase: 31-tech-debt-foundation_
_Context gathered: 2026-03-02_

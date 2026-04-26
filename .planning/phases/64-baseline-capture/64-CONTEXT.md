# Phase 64: Baseline Capture - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Snapshot current `ProspectAnalysis.content` JSON for all existing prospects before any v10.0 pipeline changes, enabling before/after comparison once the overhaul lands. No code changes to the pipeline itself.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

- Output location (recommend `.planning/baselines/` to keep near planning artifacts)
- File naming convention (slug + ISO timestamp)
- Whether to include metadata alongside content (inputSnapshot, modelUsed, version, evidence count) — more context for diffing is better
- Script structure (standalone `scripts/capture-baseline.ts` following existing tmp-script patterns with dotenv)
- Pretty-printed JSON for human-readable diffs
- One file per prospect (not combined) for clean per-prospect diffing

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Data model

- `prisma/schema.prisma` lines 1056-1072 — `ProspectAnalysis` model: `content` (Json), `inputSnapshot` (Json?), `modelUsed`, `version`, linked via `researchRunId` and `prospectId`

### Existing script patterns

- `scripts/tmp-run-analysis-nedri.ts` — Example of standalone script that queries ProspectAnalysis with dotenv + Prisma
- `scripts/tmp-run-klarifai-narrative.ts` — Another script pattern for prospect-scoped DB queries

### Requirements

- `.planning/REQUIREMENTS.md` — VALID-01: baseline captured before pipeline changes

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- Existing `scripts/tmp-*.ts` pattern: dotenv.config() + PrismaClient for standalone scripts
- `ProspectAnalysis` model with `content` Json field holds the master analysis output
- Prospect model has `slug` field usable for filename generation

### Established Patterns

- Scripts use `dotenv` for env access (not env.mjs)
- PrismaPg adapter with connectionString for DB access
- Idempotent scripts (existing pattern: check before write)

### Integration Points

- Phase 69 (E2E Validation) will consume these baseline files for before/after comparison
- No integration with running app — pure offline capture

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 64-baseline-capture_
_Context gathered: 2026-04-21_

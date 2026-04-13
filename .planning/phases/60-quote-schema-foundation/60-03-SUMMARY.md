---
phase: 60-quote-schema-foundation
plan: 03
subsystem: api
tags: [zod, schema, validation, quote, snapshot, vitest, foundation]

# Dependency graph
requires:
  - phase: 60-quote-schema-foundation/60-02
    provides: 'Quote.snapshotData Json? column, SnapshotStatus enum, @prisma/client Quote/QuoteLine exports'
provides:
  - 'QuoteSnapshotSchema (Zod 4 z.object) — single source of truth for what gets frozen at DRAFT→SENT'
  - 'QuoteSnapshotLineSchema with signed-int tarief (allows OFF003 Pakketkorting line tarief: -800)'
  - 'QuoteSnapshot + QuoteSnapshotLine inferred TypeScript types'
  - 'parseSnapshot(raw): unknown → QuoteSnapshot | null safe parser (returns null on null/undefined or Zod failure)'
  - 'getSnapshotField<K>(raw, key, fallback) typed accessor for reading nested fields without unsafe casts'
  - 'TEST-05 vitest coverage (8 unit tests) including OFF003 negative-tarief regression guard'
affects:
  - 60-04 (tRPC quotes router + transitionQuote helper imports QuoteSnapshotSchema for snapshot validation on DRAFT→SENT)
  - 60-05 (YAML import script can import QuoteSnapshotLineSchema to validate YAML line items)
  - 61-quote-pdf-render (PDF worker imports parseSnapshot/getSnapshotField to read snapshotData)
  - 62-client-proposal-page (web template imports parseSnapshot/getSnapshotField — never `as any`)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Single Zod schema as source of truth feeding both web template and PDF print template (per locked decision Q14)'
    - 'Safe parser pattern: parseSnapshot returns null on failure rather than throwing — caller decides between fallback and TRPCError'
    - 'Typed accessor with fallback: getSnapshotField<K extends keyof T>(raw, key, fallback): T[K] — eliminates `as any` casts on JSON columns'
    - 'Schema describes business content only (narrative/lines/totals/prospect) — render-format fields (snapshotHtml, snapshotPdfUrl) live on the Quote row itself'
    - 'Signed-int line item tarief: explicit Pitfall-5 guard against `.nonnegative()` so discount lines (Pakketkorting -800) survive validation'

key-files:
  created:
    - 'lib/schemas/quote-snapshot.ts'
    - 'lib/schemas/quote-snapshot.test.ts'
    - '.planning/phases/60-quote-schema-foundation/60-03-SUMMARY.md'
  modified: []

key-decisions:
  - 'Schema deliberately omits snapshotHtml/snapshotPdfUrl — those are render artifacts on the Quote row, not part of the immutable snapshot payload (honors locked decision Q14 dual-template requirement)'
  - 'tarief uses z.number().int() with NO .nonnegative() — OFF003 Pakketkorting line carries tarief: -800, breaking this would invalidate the Marfa import (Pitfall 5)'
  - 'parseSnapshot returns null (not throws) on failure — callers choose between fallback rendering and explicit error. quotes.update write path will use safeParse + throw TRPCError; UI read paths use getSnapshotField with sensible defaults'
  - 'getSnapshotField uses K extends keyof QuoteSnapshot generic so the return type is the actual field type (string for nummer, QuoteSnapshotLine[] for lines, etc.) — no widening to unknown'
  - 'No DTO/codec layer added — the inferred QuoteSnapshot type is the same shape as the persisted JSON column (FOUND-04 acceptance)'

patterns-established:
  - 'Zod schema module per JSON column: lib/schemas/<entity>-<field>.ts exports Schema + inferred Type + safeParse helper + typed accessor'
  - 'Co-located *.test.ts file with VALID_<NAME> fixture at top of file (matches lib/state-machines/prospect.test.ts convention)'
  - 'Pitfall comments inline at the field where the constraint matters (see tarief: SIGNED — negative allowed for discount lines)'

requirements-completed:
  - FOUND-03
  - FOUND-04
  - TEST-05

# Metrics
duration: 2min
completed: 2026-04-13
---

# Phase 60 Plan 03: Quote Snapshot Schema Summary

**Zod 4 schema and type-safe accessors for `Quote.snapshotData` — single source of truth feeding both the Phase 62 web proposal page and the PDF worker, with signed-int tarief guard for OFF003 Pakketkorting lines and 8 vitest cases proving FOUND-03/FOUND-04/TEST-05 acceptance.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-13T11:28:16Z
- **Completed:** 2026-04-13T11:30:40Z
- **Tasks:** 2
- **Files created:** 2 (lib/schemas/quote-snapshot.ts, lib/schemas/quote-snapshot.test.ts)
- **Files modified:** 0

## Accomplishments

- `QuoteSnapshotSchema` (Zod 4 z.object) covering all locked fields from RESEARCH §"Pattern 3": metadata (templateVersion, capturedAt), narrative (tagline, introductie, uitdaging, aanpak), header (nummer, onderwerp, datum, geldigTot), lines[], commercial (btwPercentage, scope, buitenScope), totals (netto, btw, bruto), and prospect (slug + denormalised company/contact)
- `QuoteSnapshotLineSchema` sub-schema with `tarief: z.number().int()` — explicitly NO `.nonnegative()` so OFF003's Pakketkorting line (`tarief: -800`) parses successfully
- `QuoteSnapshot` and `QuoteSnapshotLine` inferred TypeScript types exported for use in callers
- `parseSnapshot(raw: unknown): QuoteSnapshot | null` safe parser — returns null on null/undefined input or any Zod validation failure, never throws
- `getSnapshotField<K extends keyof QuoteSnapshot>(raw, key, fallback): QuoteSnapshot[K]` typed accessor — eliminates `as any` casts on `Quote.snapshotData` reads in admin UI (Phase 61) and client UI (Phase 62)
- 8 vitest cases covering: malformed-reject (missing nummer surfaces ZodError on path), valid-accept, OFF003 negative-tarief (regression guard), parse null/undefined, parse malformed → null, accessor present, accessor missing (null snapshot), accessor missing (malformed snapshot)
- All 8 tests pass on first run; tsc baseline unchanged (16 lines of pre-existing errors in unrelated files, none in the new touch-set)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Zod schema + accessors for Quote.snapshotData** — `3de3195` (feat)
2. **Task 2: Add Vitest coverage for QuoteSnapshotSchema (TEST-05)** — `0b06977` (test)

_Note: Plan 03 followed the plan's bundled-commit pattern (one file per task, one passing tsc/test run, one commit) rather than the strict TDD RED→GREEN split. The Zod schema is small enough that the test file is wholly meaningless without the source file already existing, so the source file was committed first and the test file second. Both commits are individually verifiable via tsc + vitest._

## Files Created/Modified

- `lib/schemas/quote-snapshot.ts` — Zod 4 schema (`QuoteSnapshotSchema`, `QuoteSnapshotLineSchema`), inferred types (`QuoteSnapshot`, `QuoteSnapshotLine`), `parseSnapshot` safe parser, `getSnapshotField` typed accessor (89 lines, single import from `zod`)
- `lib/schemas/quote-snapshot.test.ts` — 8 vitest cases with `VALID_SNAPSHOT` fixture at top of file (146 lines)

## Decisions Made

- **Schema describes business content only.** No `snapshotHtml`, `snapshotPdfUrl`, `snapshotStatus`, or `snapshotAt` fields inside the Zod schema — those are render-format artifacts living on the Quote row itself (already added in 60-02). This honors locked decision Q14 (dual-template): the same snapshot drives both the web template and the PDF print template, so it cannot bake in either rendering format.
- **`tarief: z.number().int()` with NO `.nonnegative()`.** Explicitly verified against `klarifai-core/data/quotes/2026/OFF003.yaml` per RESEARCH §"Marfa Quote Shape" (lines 877-883): the Pakketkorting line carries `tarief: -800`. Breaking this would silently fail the Plan 05 import script and invalidate the ROADMAP success criterion. The constraint is documented inline at the field with a pointer to Pitfall 5.
- **`parseSnapshot` returns null instead of throwing.** Callers decide between fallback rendering (UI read paths use `getSnapshotField` with sensible defaults) and explicit errors (Plan 04's `quotes.update` write path will use `QuoteSnapshotSchema.safeParse(...)` directly and throw `TRPCError('BAD_REQUEST')` on `success: false`). This matches the convention in the rest of the codebase where the read path is defensive but the write path is strict.
- **`getSnapshotField<K extends keyof QuoteSnapshot>` generic accessor.** The return type is `QuoteSnapshot[K]` (not `unknown`), so callers reading `getSnapshotField(snapshot, 'lines', [])` get back `QuoteSnapshotLine[]` directly with no cast.
- **No separate DTO/codec layer.** The inferred `QuoteSnapshot` type is the same shape as the persisted JSON column. FOUND-04 acceptance is satisfied because every read path imports the inferred type directly.
- **Co-located test file with top-of-file `VALID_SNAPSHOT` fixture.** Matches the `lib/state-machines/prospect.test.ts` convention shipped in Plan 01 and the `lib/outreach/send-email.test.ts` convention referenced in VALIDATION.md.

## Deviations from Plan

None — plan executed exactly as written.

The plan listed two tasks (Task 1: source file, Task 2: test file) and bundled each into a single commit. Both tasks shipped with the exact source content specified in the plan's `<action>` blocks, no edits, no scope additions.

## Issues Encountered

None.

The only friction was the husky DEPRECATED warning printed by the pre-commit hook (pre-existing tech debt unrelated to this plan, already noted in the repo). The hook still functions correctly (lint-staged runs eslint + prettier on the staged files, all clean).

## Verification

- `npm run test -- lib/schemas/quote-snapshot.test.ts --run` — ✅ 8/8 PASS in 5ms
- `npx tsc --noEmit` — ✅ 16 lines of pre-existing errors (sitemap.test.ts Buffer typing, scripts/tmp-\* stale debug scripts), 0 errors in `lib/schemas/quote-snapshot.ts` or `lib/schemas/quote-snapshot.test.ts`
- Grep `export const QuoteSnapshotSchema` in `lib/schemas/quote-snapshot.ts` — ✅ 1 match
- Grep `export function parseSnapshot` in `lib/schemas/quote-snapshot.ts` — ✅ 1 match
- Grep `export function getSnapshotField` in `lib/schemas/quote-snapshot.ts` — ✅ 1 match
- Grep `tarief: z.number().int()` in `lib/schemas/quote-snapshot.ts` — ✅ 1 match
- Grep `nonnegative` on the `tarief` field — ✅ 0 matches (only present on `uren`)
- Grep `tarief: -800` in `lib/schemas/quote-snapshot.test.ts` — ✅ 1 match (OFF003 regression guard)
- Grep `parseSnapshot(null)` in `lib/schemas/quote-snapshot.test.ts` — ✅ 1 match
- eslint --fix + prettier --write — clean (lint-staged green)

## User Setup Required

None — no external service configuration introduced.

## Next Phase Readiness

- **Plan 60-04 (`server/routers/quotes.ts` + `lib/state-machines/quote.ts`)** can now `import { QuoteSnapshotSchema, parseSnapshot } from '@/lib/schemas/quote-snapshot'`. The DRAFT→SENT transition will:
  1. Build the snapshot payload from the live Quote + QuoteLine + Prospect rows
  2. Run `QuoteSnapshotSchema.parse(payload)` (NOT safeParse — Plan 04 wants the throw)
  3. Persist to `snapshotData` only on a successful parse
     This satisfies FOUND-03 acceptance (malformed write fails BEFORE Prisma is touched).
- **Plan 60-05 (YAML import script)** can `import { QuoteSnapshotLineSchema } from '@/lib/schemas/quote-snapshot'` to validate YAML line items at import time, sharing the line schema as research recommended.
- **Phase 61 (admin UI)** and **Phase 62 (client `/voorstel/[slug]` page + PDF worker)** can use `parseSnapshot` and `getSnapshotField` to read `Quote.snapshotData` without any `as any` casts. The accessor pattern is now established and ready for adoption.
- **No outstanding blockers** for Plan 60-04 / 60-05.
- **No tech debt added** — the only repo-level tech debt (husky pre-commit deprecation warning) is pre-existing and unrelated.

## Self-Check: PASSED

Files verified on disk:

- ✅ `lib/schemas/quote-snapshot.ts`
- ✅ `lib/schemas/quote-snapshot.test.ts`
- ✅ `.planning/phases/60-quote-schema-foundation/60-03-SUMMARY.md` (this file)

Commits verified in git history:

- ✅ `3de3195` — Task 1: add Zod schema + accessors for Quote.snapshotData
- ✅ `0b06977` — Task 2: add Vitest coverage for QuoteSnapshotSchema (TEST-05)

Test run verified:

- ✅ `npm run test -- lib/schemas/quote-snapshot.test.ts --run` — 8/8 PASS

Type check verified:

- ✅ `npx tsc --noEmit` — baseline unchanged (16 pre-existing errors, 0 in new files)

---

_Phase: 60-quote-schema-foundation_
_Plan: 03_
_Completed: 2026-04-13_

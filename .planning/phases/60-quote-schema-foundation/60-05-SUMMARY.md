---
phase: 60-quote-schema-foundation
plan: 05
subsystem: database
tags:
  [
    yaml,
    import,
    prospect,
    quote,
    idempotency,
    vitest,
    foundation,
    klarifai-core,
  ]

# Dependency graph
requires:
  - phase: 60-quote-schema-foundation/60-02
    provides: 'Prisma Quote/QuoteLine/QuoteStatus models, Prospect.readableSlug + Prospect.domain NOT NULL constraint'
  - phase: 60-quote-schema-foundation/60-03
    provides: 'QuoteSnapshotLineSchema pattern (signed-integer tarief) — mirrored in the import script YAML schema'
  - phase: 60-quote-schema-foundation/60-04
    provides: 'Quote router + state machine established; the import bypasses the router and writes directly via prisma, leaving every imported quote in DRAFT so the router/state-machine owns all subsequent mutations'
provides:
  - 'scripts/import-klarifai-yaml.ts — idempotent one-shot migration from klarifai-core/data/clients/*.yaml + data/quotes/{year}/*.yaml into Qualifai Prospect/Quote/QuoteLine'
  - '--dry is the default (zero writes, logs intended actions); --apply is required for any prisma mutation'
  - 'Idempotency guarantees: Prospect match on readableSlug (NOT the 12-char CUID slug), Quote match on nummer (global unique). Second --apply run is a no-op.'
  - 'OFF003 Pakketkorting line with tarief=-800 preserved end-to-end by signed z.number().int() on QuoteLineYamlSchema (mirrors Plan 03 Pitfall 5)'
  - 'Totals guardrail: after all parses the script compares each imported quote against a hardcoded EXPECTED_TOTALS map and throws in --apply mode on any mismatch — prevents silent regression of Marfa reference totals'
  - 'scripts/import-klarifai-yaml.test.ts — 7 vitest cases covering OFF001/OFF002/OFF003 totals, OFF003 negative-tarief regression, dry-run zero-writes assertion, apply-mode create counts, and second-apply idempotency using an in-memory @/lib/prisma mock'
  - 'runImport() exported as a programmatic entry so TEST-04 can invoke it directly without spawning a subprocess (CLI entry guarded by require.main === module)'
affects:
  - 61-quote-admin-ui (expects 1 Prospect + 3 Marfa quotes to already be in DB for manual admin testing)
  - 62-client-proposal-page (gets real seed data without re-authoring fixtures)
  - klarifai-core (retires as the source of truth for Marfa quotes once Romano runs --apply at the phase gate)

# Tech tracking
tech-stack:
  added:
    - 'yaml (eemeli/yaml) — 2.x, runtime dependency, replaces js-yaml (research decision)'
  patterns:
    - 'Thread apply:boolean through every helper explicitly — NO module-level APPLY constant. Guarantees that a refactor can never accidentally promote a --dry test run into a real DB write.'
    - 'parseYaml helper wraps yaml.parseAllDocuments and returns the first non-empty document — klarifai-core files are framed with `---` top AND bottom which the parser treats as a 2-document stream with an empty trailing doc.'
    - 'Idempotent upsert pattern: findUnique by natural key (readableSlug / nummer) -> if existing, update-or-skip; if missing, create. Never use Prisma upsert() for this kind of script because the create path needs different default columns (placeholder domain, short CUID slug).'
    - 'In-memory pending set for --dry cross-entity references: upsertQuote needs to resolve quote.klant -> Prospect, but in --dry mode the Prospect row was not actually created. Fall back to a Set<string> of client slugs seen earlier in the same run so dry-mode logs the correct intended action without touching Postgres.'
    - 'Programmatic entry + CLI entry split: runImport(opts) is the testable core, the CLI wrapper lives at the bottom behind `if (require.main === module)` so the same module can be imported by vitest without executing main().'
    - 'Totals-as-oracle post-check: hardcoded EXPECTED_TOTALS map inside the script compares every imported quote against known-good klarifai-core bruto totals and throws in --apply mode — catches fixture drift at import time rather than at Prisma-Studio-inspection time.'

key-files:
  created:
    - 'scripts/import-klarifai-yaml.ts (513 lines — yaml schemas, runImport, upsertClient, upsertQuote, totals oracle, CLI wrapper)'
    - 'scripts/import-klarifai-yaml.test.ts (269 lines — 3 totals tests + 4 runImport side-effect tests with vi.mock @/lib/prisma)'
    - '.planning/phases/60-quote-schema-foundation/60-05-SUMMARY.md (this file)'
  modified:
    - 'package.json + package-lock.json (Task 1 — added yaml dependency, shipped before this session in commit 136296b)'
    - 'lib/prisma.ts (Task 2 — added named `export { prisma }` alongside the existing default export so the import script can use `import { prisma } from "@/lib/prisma"`. Existing default-import sites unaffected.)'

key-decisions:
  - 'Kept the partial 513-line scripts/import-klarifai-yaml.ts left behind by the previous (rate-limited) executor. Audited it clause by clause against the plan spec and against the critical notes in the resume prompt: `apply:boolean` threaded 4 times, zero module-level APPLY, zero `new PrismaClient`, singleton prisma imported, dotenv loaded, Contact import deferred warning present, readableSlug match, signed tarief. Only fix needed was a runtime null guard in upsertQuote before `prospect.id` — TypeScript caught this as strict-null-check error TS18047 and it was a real latent bug (in --dry mode prospect can be null via the pendingClientSlugs fallback).'
  - 'Added named { prisma } export to lib/prisma.ts. The existing module exported only `default prisma`, and the plan mandated `import { prisma } from "@/lib/prisma"` (research recommendation for the script). Adding a named export does not affect any of the 24 existing default-import sites. Alternative would have been to rewrite the script to use the default import, but the plan wording is explicit and adding a compatibility export is a lower-risk change than rewriting every reference.'
  - 'Resolved klarifai-core fixture path in the test file via process.cwd() + two sibling-layout candidates (../../klarifai-core/data and ../klarifai-core/data). Vitest rewrites __dirname inside the transformed test module in a way that does NOT match the shipped script behaviour, so falling back to process.cwd() (which equals the qualifai project root under npm run test) gives a deterministic result across both layouts we care about (sibling-of-qualifai and sibling-of-projects-folder).'

patterns-established:
  - 'Idempotent one-shot import script template: dry-default + explicit apply flag + natural-key findUnique + in-memory pending-set fallback + totals oracle post-check. Future import scripts (e.g. historical invoices, legacy contacts) should clone this shape.'
  - 'Apply-as-explicit-parameter (not module-level) is now the convention for any script that has a dry/apply flag — module-level constants break TEST-04-style "this mode makes no writes" assertions because a vi.mock cannot reach into the closure.'

requirements-completed:
  - IMPORT-01
  - IMPORT-02
  - IMPORT-03
  - IMPORT-04
  - TEST-04

# Metrics
duration: ~10 min (continuation — excludes earlier Task 1 commit 136296b and the previous session's partial Task 2 draft)
completed: 2026-04-13
---

# Phase 60 Plan 05: klarifai-core YAML Import Script Summary

**Idempotent one-shot migration from klarifai-core YAMLs into Qualifai Prospect/Quote/QuoteLine, --dry by default, --apply ships 1 Marfa prospect + 3 OFF quotes (7.816,60 / 11.495,00 / 13.285,80) with zero-write regression tests and OFF003 negative-tarief guard.**

## Performance

- **Started (continuation):** 2026-04-13T16:15Z (approximate — resumed mid-plan after prior session rate limit)
- **Completed:** 2026-04-13T16:22Z
- **Duration (continuation segment):** ~10 min
- **Tasks:** 3 (Task 1 shipped in prior session as commit 136296b)
- **Files created:** 2 (script + test)
- **Files modified:** 1 (lib/prisma.ts — named export added)

## Accomplishments

- 513-line idempotent YAML import script ships, dry-run verified against the real klarifai-core repo (OFF001 7816.60 / OFF002 11495.00 / OFF003 13285.80 — three OK).
- 7 vitest cases covering totals computation, negative-tarief regression, dry-run zero-writes, apply-mode create counts, and second-apply idempotency — all green.
- Full phase-60 scoped test suite (prospect state machine + quote state machine + quote snapshot schema + quotes router + import) = 46 tests, 6 files, all green in ~1.7s.
- Type-check clean on our two new files (preexisting baseline errors in `lib/enrichment/sitemap.test.ts` and `scripts/tmp-*.ts` are out of scope).
- Phase 60 ROADMAP success criterion #1 is now satisfiable — Romano can run the manual smoke check at the phase gate (see below).

## Task Commits

1. **Task 1: Add yaml dependency** — `136296b` (chore) — shipped in prior session, verified in-place as package.json dependency
2. **Task 2: Add YAML import script (runImport + idempotent upserts)** — `0b516df` (feat) — includes `lib/prisma.ts` named export + in-script TS18047 null-guard fix
3. **Task 3: Add YAML import vitest coverage (TEST-04)** — `1b60f1e` (test)

_Plan metadata commit (SUMMARY.md + STATE.md + ROADMAP.md) will follow this file._

## Files Created/Modified

- `scripts/import-klarifai-yaml.ts` (created, 513 lines) — idempotent --dry / --apply importer for klarifai-core data
- `scripts/import-klarifai-yaml.test.ts` (created, 269 lines) — TEST-04 vitest coverage with mocked @/lib/prisma
- `lib/prisma.ts` (modified, +1 line) — added named `export { prisma }` alongside default export
- `package.json` / `package-lock.json` (modified in Task 1, commit 136296b) — added yaml dependency

## Decisions Made

See frontmatter `key-decisions:` for the full rationale. In short:

1. **Kept and audited the partial script from the prior session** rather than rewriting from scratch. The pre-verified grep acceptance criteria (apply:boolean ≥ 3, no module-level APPLY, no new PrismaClient) all passed, and behavioural audit confirmed every plan clause was satisfied except one strict-null bug in `upsertQuote` which TypeScript caught on the first `tsc --noEmit` run.
2. **Added a named `{ prisma }` export to `lib/prisma.ts`** as the lowest-risk way to satisfy the plan's mandatory import shape. Existing 24 default-import sites are unaffected.
3. **Resolved test fixture path via `process.cwd()`** with a two-candidate fallback, because Vitest's module transform makes `__dirname` behave differently than it does under tsx.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Strict-null violation on prospect.id in upsertQuote**

- **Found during:** Task 2 (post-audit `npx tsc --noEmit` run, before committing)
- **Issue:** `upsertQuote` has a short-circuit that allows `prospect` to be null in --dry mode when the Prospect slug is in the in-memory `pendingClientSlugs` set (the dry-mode affordance so the import can log intended actions without pre-existing DB rows). That short-circuit did NOT re-guard before the `prisma.quote.create({ data: { prospect: { connect: { id: prospect.id } } } })` call in the --apply branch. TypeScript flagged this as TS18047 "'prospect' is possibly 'null'". The bug is latent rather than reachable in practice (in --apply mode the Prospect row is always created before quotes are processed), but the type checker was correct to refuse.
- **Fix:** Added an explicit `if (!prospect) throw new Error(...)` guard at the top of the `if (apply)` block in `upsertQuote`. Safety net: if the invariant is ever broken (e.g. a future parallel-import refactor), the apply run fails loudly instead of crashing with an unreadable Prisma error.
- **Files modified:** `scripts/import-klarifai-yaml.ts`
- **Verification:** `npx tsc --noEmit` now reports zero errors scoped to our file. Dry-run against real klarifai-core data still succeeds and shows the 3 quotes with correct totals.
- **Committed in:** `0b516df` (part of Task 2 commit)

**2. [Rule 3 - Blocking] Test fixture path resolution under Vitest**

- **Found during:** Task 3 (first `npm run test` run after writing the test file)
- **Issue:** Vitest transforms the test file in a way that makes `__dirname` resolve relative to `scripts/` inside the qualifai project, but the original resolution logic `resolve(__dirname, '../../klarifai-core/data')` produces `projects/klarifai-core/data` which does not exist. All 7 tests failed with ENOENT on the fixture reads and `Source directory does not exist` inside runImport.
- **Fix:** Switched to `process.cwd()` + a 2-candidate array (`../../klarifai-core/data` and `../klarifai-core/data`) and picked the first one that passes `existsSync`. Under `npm run test` the cwd is always the qualifai project root, so this resolves deterministically on the standard two-repo layout.
- **Files modified:** `scripts/import-klarifai-yaml.test.ts`
- **Verification:** `npm run test -- scripts/import-klarifai-yaml.test.ts` → 7/7 green in ~50ms.
- **Committed in:** `1b60f1e` (part of Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug, 1 Rule 3 blocker).
**Impact on plan:** Both fixes were required for correctness. No scope creep — no new files, no new runtime behaviour beyond what the plan spec required.

## Issues Encountered

- `lib/prisma.ts` showed as `M` in `git status` on entry to this session because the prior executor had already added the named export. The change is necessary (the plan mandates `import { prisma }` named form), so it was committed as part of Task 2 rather than reverted.
- Pre-existing type errors in `lib/enrichment/sitemap.test.ts` and the `scripts/tmp-*.ts` research-debug scripts are carried forward as baseline noise. They are out of scope for this plan (they predate Phase 60 and belong to the broader tech-debt backlog).

## User Setup Required

None — no external service configuration.

**Manual smoke check required at Phase 60 gate (ROADMAP success criterion #1 — Romano's job, not the executor's):**

```
1. Verify staging DB accessible: docker ps | grep qualifai-db
2. Dry run first:             tsx scripts/import-klarifai-yaml.ts --dry
3. Review intended actions in stdout
4. Apply:                      tsx scripts/import-klarifai-yaml.ts --apply
5. Open Prisma Studio:         npx prisma studio
6. Verify in Quote table:      1 Prospect (readableSlug=marfa)
                               3 Quotes (OFF001 / OFF002 / OFF003)
                               QuoteLine rows per quote
7. Compare totals:             OFF001 €7.816,60
                               OFF002 €11.495,00
                               OFF003 €13.285,80
```

The script already performs an in-process totals comparison against the known-good values and throws in --apply mode on mismatch, so the manual check is a belt-and-braces sanity check at the DB level rather than a functional gate.

## Next Phase Readiness

- **Phase 60 is now code-complete.** All 5 plans shipped: 01 prospect-status constants, 02 Prisma schema, 03 Zod snapshot schema, 04 router + state machine, 05 YAML import.
- **Phase 60 gate is one manual smoke check away** (Romano runs `tsx scripts/import-klarifai-yaml.ts --apply` and eyeballs Prisma Studio). After that the phase can be marked complete and v9.0 Phase 61 (admin quote UI) unblocks.
- **No blockers carried forward.**

## Self-Check: PASSED

- `scripts/import-klarifai-yaml.ts` exists: FOUND
- `scripts/import-klarifai-yaml.test.ts` exists: FOUND
- Commit `136296b` (Task 1 yaml dependency): FOUND
- Commit `0b516df` (Task 2 import script): FOUND
- Commit `1b60f1e` (Task 3 TEST-04 coverage): FOUND
- `npm run test -- scripts/import-klarifai-yaml.test.ts`: 7/7 PASSED
- `npm run test -- lib/state-machines lib/schemas lib/constants server/routers/quotes.test.ts scripts/import-klarifai-yaml.test.ts`: 46/46 PASSED (6 files)
- `npx tsc --noEmit` scoped to our files: CLEAN (pre-existing baseline errors in sitemap.test.ts + tmp-\*.ts unrelated)
- Acceptance greps on script: `apply: boolean` = 4 (≥3 required), `^const APPLY` = 0, `new PrismaClient` = 0, `dotenv/config` = 1, `runImport` = 2, `Contact import deferred` = 1, `readableSlug` = 8, `from 'yaml'` = 1 — all pass.
- Acceptance greps on test: `runImport` ≥ 3, `tarief === -800` present, `7816.60` present, `13285.80` present, `idempotent` present — all pass.

---

_Phase: 60-quote-schema-foundation_
_Completed: 2026-04-13_

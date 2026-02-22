---
phase: 18-research-quality-gate
verified: 2026-02-22T17:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: 'Open admin prospect list and confirm traffic-light chips appear per row next to the status badge'
    expected: 'THIN/LIMITED/SOLID chip visible for every prospect that has a research run; no chip for prospects without a run'
    why_human: 'Visual rendering of traffic-light colors and chip placement cannot be confirmed from static analysis'
  - test: 'Click a quality chip and inspect the breakdown panel'
    expected: "Panel shows Bewijsstukken count, Brontypen count, Gem. betrouwbaarheid %, Hypothesen count, and any gate-failure reasons in Dutch; amber prospects show 'Beperkt bewijs — toch doorgaan?' warning"
    why_human: 'Lazy-loaded getRun query and conditional reason-display logic requires runtime execution to verify'
  - test: "Click 'Onderzoek goedkeuren' on an unreviewed prospect; reload the page"
    expected: "Chip shows a checkmark suffix; breakdown panel shows 'Beoordeeld op [date]' with green check; decision persists on reload"
    why_human: 'Mutation + cache invalidation + page-reload persistence requires live session to verify'
  - test: "For a LIMITED (amber) prospect, click 'Toch goedkeuren (beperkt)'"
    expected: "System stores qualityNotes = 'Proceed with limited research — amber override'; chip updates to show approval mark; outreach is not blocked"
    why_human: 'Amber-override note stored in qualityNotes field requires DB inspection after action'
  - test: 'Open prospect detail for any prospect with a research run'
    expected: 'Quality chip visible in the back-row alongside the StatusBadge; breakdown works identically to list view'
    why_human: 'Visual placement and full-data breakdown require runtime verification'
  - test: 'Open the Analysis tab of any prospect detail; confirm no Accept/Reject/Reset buttons exist'
    expected: "Each hypothesis shows only a read-only badge: 'Pending validation', 'Skipped', or 'Declined by prospect' — no action buttons"
    why_human: 'Absence of buttons requires visual inspection; badge labels need language verification'
  - test: 'Open /voor/[slug] for a prospect that has PENDING hypotheses (post-Phase 18 research)'
    expected: 'Hypotheses with status PENDING appear in the /voor/ dashboard alongside any legacy ACCEPTED ones'
    why_human: 'Requires a live prospect with PENDING-status hypotheses; backward-compatibility with ACCEPTED needs live data'
---

# Phase 18: Research Quality Gate — Verification Report

**Phase Goal:** Admin reviews whether research is sufficient before approving for outreach — using a traffic-light quality indicator — and hypothesis approve/reject is removed from the admin because prospects will validate hypotheses themselves on /voor/.

**Verified:** 2026-02-22T17:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                        | Status   | Evidence                                                                                                                                                                                                                                                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Every prospect row shows a traffic-light chip (red/amber/green) without opening the prospect                                 | VERIFIED | `QualityChip` imported at line 22 and rendered at line 193 of `app/admin/prospects/page.tsx`, consuming `researchRuns[0]._count.evidenceItems` from the extended `listProspects` query                                                                                                                                                                     |
| 2   | Admin can click the quality chip to see a breakdown: evidence count, average confidence, source type count, hypothesis count | VERIFIED | `quality-chip.tsx` lines 56-59: lazy `getRun.useQuery` fires only when `open=true`; breakdown panel (lines 152-181) renders Bewijsstukken, Brontypen, Gem. betrouwbaarheid, Hypothesen rows                                                                                                                                                                |
| 3   | Admin can mark research as reviewed or request another research run — decision stored and visible on subsequent visits       | VERIFIED | `approveQuality` mutation at `research.ts:190` writes `qualityApproved`, `qualityReviewedAt`, `qualityNotes` to DB; DB columns confirmed live (`\d ResearchRun`); reviewed state re-hydrated from `listProspects` on subsequent page loads                                                                                                                 |
| 4   | Admin can proceed with amber-quality prospect by confirming "proceed with limited research" — override recorded              | VERIFIED | `quality-chip.tsx` lines 249-264: amber-specific "Toch goedkeuren (beperkt)" button calls `approveQuality.mutate({ runId, approved: true, notes: 'Proceed with limited research — amber override' })`; notes field persisted in `qualityNotes` column                                                                                                      |
| 5   | Hypothesis approve/reject buttons are gone from admin Analysis section; hypotheses show read-only status badges              | VERIFIED | `analysis-section.tsx`: zero matches for `onSetStatus`, `Accept`, `Reject`, `setHypothesisStatus`; `STATUS_LABELS` map at line 38 + passive `<span>` badge at line 63-65; `app/admin/prospects/[id]/page.tsx` line 264: `<AnalysisSection prospectId={id} />` with no `onSetStatus` prop; `setHypothesisStatus` mutation hook: zero matches in detail page |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact                                                                 | Expected                                                  | Status   | Details                                                                                                                                                                                                        |
| ------------------------------------------------------------------------ | --------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                                                   | ResearchRun quality fields + PENDING/DECLINED enum values | VERIFIED | Lines 74-80: `HypothesisStatus` enum includes PENDING and DECLINED; lines 339-341: `qualityApproved Boolean?`, `qualityReviewedAt DateTime?`, `qualityNotes String?` on ResearchRun                            |
| `prisma/migrations/20260222165000_add_quality_gate_fields/migration.sql` | Migration SQL applied                                     | VERIFIED | File exists; SQL confirmed: `ALTER TYPE "HypothesisStatus" ADD VALUE`, `ALTER TABLE "ResearchRun" ADD COLUMN` for all three quality fields                                                                     |
| `lib/workflow-engine.ts`                                                 | `computeTrafficLight` exported                            | VERIFIED | Lines 393-422: `TrafficLight` type, `QualityBreakdown` interface, and `computeTrafficLight` function all exported; thresholds: red < 3 evidence, amber < 2 source types OR < 0.65 confidence, green = all pass |
| `server/routers/research.ts`                                             | `approveQuality` tRPC mutation                            | VERIFIED | Lines 190-208: `adminProcedure` mutation taking `{runId, approved, notes?}`; updates `qualityApproved`, `qualityReviewedAt`, `qualityNotes` via `ctx.db.researchRun.update`                                    |
| `server/routers/admin.ts`                                                | `listProspects` extended with research run quality data   | VERIFIED | Lines 401-411: `researchRuns` include with `orderBy: { createdAt: 'desc' }`, `take: 1`, selecting `id`, `status`, `qualityApproved`, `qualityReviewedAt`, `_count.evidenceItems`, `_count.workflowHypotheses`  |
| `components/features/prospects/quality-chip.tsx`                         | QualityChip component (min 80 lines)                      | VERIFIED | 347 lines; renders traffic-light chip, lazy breakdown panel, approve/amber-override/re-run buttons; uses `computeTrafficLight` and `api.research.approveQuality`                                               |
| `app/admin/prospects/page.tsx`                                           | QualityChip in each prospect row                          | VERIFIED | Import at line 22; rendered at lines 190-199 inside prospect row, consuming `run.qualityApproved` and `run.qualityReviewedAt`                                                                                  |
| `app/admin/prospects/[id]/page.tsx`                                      | QualityChip in prospect detail header                     | VERIFIED | Import at line 27; rendered at lines 95-110 in the back-row alongside StatusBadge                                                                                                                              |
| `components/features/prospects/analysis-section.tsx`                     | Read-only hypothesis status badges with STATUS_LABELS     | VERIFIED | `STATUS_LABELS` at line 38; passive `<span>` badge at lines 63-65; no Accept/Reject/Reset buttons; `onSetStatus` prop fully removed                                                                            |
| `components/features/prospects/command-center.tsx`                       | Hypothesis section without accept/reject buttons          | VERIFIED | `onSetHypothesisStatus` removed; `pendingCount` counts ACCEPTED+PENDING combined; read-only badge renders "Declined" or "Pending validation" at line 224                                                       |
| `app/voor/[slug]/page.tsx`                                               | Hypothesis filter including PENDING status                | VERIFIED | Line 47: `where: { status: { in: ['ACCEPTED', 'PENDING'] } }` — backward-compatible with legacy ACCEPTED and new PENDING                                                                                       |

### Key Link Verification

| From                                | To                           | Via                                       | Status | Details                                                                                                     |
| ----------------------------------- | ---------------------------- | ----------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| `quality-chip.tsx`                  | `server/routers/research.ts` | `api.research.approveQuality.useMutation` | WIRED  | Line 61: mutation bound; called at lines 242 and 252 with runId and approved params                         |
| `quality-chip.tsx`                  | `server/routers/research.ts` | `api.research.getRun.useQuery`            | WIRED  | Lines 56-59: lazy query enabled only when breakdown is open; result consumed for breakdown display          |
| `app/admin/prospects/page.tsx`      | `quality-chip.tsx`           | `import { QualityChip }`                  | WIRED  | Import at line 22; JSX usage at line 193 with all required props                                            |
| `app/admin/prospects/[id]/page.tsx` | `quality-chip.tsx`           | `import { QualityChip }`                  | WIRED  | Import at line 27; JSX usage at line 96 with all required props                                             |
| `server/routers/research.ts`        | `prisma.researchRun.update`  | `approveQuality` mutation body            | WIRED  | Lines 199-204: `ctx.db.researchRun.update` with `qualityApproved`, `qualityReviewedAt`, `qualityNotes`      |
| `server/routers/admin.ts`           | `prisma.prospect.findMany`   | `listProspects` include researchRuns      | WIRED  | Lines 401-411: `researchRuns` include with `take: 1` orderBy createdAt desc, quality fields selected        |
| `app/voor/[slug]/page.tsx`          | `prisma.prospect.findUnique` | workflowHypotheses where filter           | WIRED  | Line 47: `where: { status: { in: ['ACCEPTED', 'PENDING'] } }` confirmed                                     |
| `app/admin/prospects/[id]/page.tsx` | `analysis-section.tsx`       | `<AnalysisSection prospectId={id} />`     | WIRED  | Line 264: invocation with only `prospectId` prop — no `onSetStatus` prop passed, confirming buttons removed |

### Database Verification (Live)

| Check                                                                   | Result                                                                   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `ResearchRun` columns: qualityApproved, qualityReviewedAt, qualityNotes | Confirmed via `\d "ResearchRun"` — all three nullable columns present    |
| `HypothesisStatus` enum values                                          | Confirmed: `{DRAFT,ACCEPTED,REJECTED,PENDING,DECLINED}`                  |
| Migration file exists                                                   | `prisma/migrations/20260222165000_add_quality_gate_fields/migration.sql` |

### Commit Verification

All 6 commits cited in SUMMARYs confirmed present in git history:

| Hash      | Message                                                                                               |
| --------- | ----------------------------------------------------------------------------------------------------- |
| `3d582c2` | feat(18-01): add quality gate schema — ResearchRun quality fields + HypothesisStatus enum extension   |
| `9e0754f` | feat(18-01): add computeTrafficLight, approveQuality mutation, extend listProspects with quality data |
| `fa51ccb` | feat(18-02): add QualityChip component with traffic-light and inline breakdown                        |
| `821c570` | feat(18-02): wire QualityChip into prospect list and detail header                                    |
| `2a25f7f` | feat(18-03): replace hypothesis accept/reject buttons with read-only status badges                    |
| `69113cb` | feat(18-03): remove hypothesis accept/reject from command-center, update /voor/ filter                |

### Anti-Patterns Found

| File                  | Pattern       | Severity | Assessment                                                             |
| --------------------- | ------------- | -------- | ---------------------------------------------------------------------- |
| `quality-chip.tsx:95` | `return null` | Info     | Correct behavior — no chip shown when prospect has no research run yet |

No blockers or warnings found. The `return null` is intentional and correct per the plan specification.

### Human Verification Required

7 items need human testing (detailed in frontmatter). All involve visual rendering, live mutations, or runtime data states that cannot be confirmed from static code analysis. No items represent uncertainty about implementation — the code is wired correctly; these are confirmation checks.

### Gaps Summary

No gaps. All 5 observable truths are verified at all three levels (exists, substantive, wired). The phase goal is achieved:

1. Traffic-light quality gate is implemented end-to-end: schema fields in DB, `computeTrafficLight` function, `approveQuality` mutation, `listProspects` with quality data, and `QualityChip` component wired into both admin list and detail views.
2. Amber override path is implemented and records qualityNotes.
3. Hypothesis approve/reject UI is fully removed from both `AnalysisSection` and `CommandCenter`; replaced with read-only status badges.
4. `/voor/` filter now includes both ACCEPTED (legacy) and PENDING (new) hypotheses — backward-compatible.

---

_Verified: 2026-02-22T17:00:00Z_
_Verifier: Claude (gsd-verifier)_

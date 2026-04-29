# Prospect Creation Flow Rebuild — Design Spec

**Date:** 2026-04-29
**Status:** Approved (brainstorm)
**Next:** writing-plans → plan-eng-review → execute
**Trigger:** Manual creation of `mujjo.com` test prospect surfaced legacy `analysis-v1` placeholder content rendering on `/analyse/[slug]` while real `analysis-v2` master analyzer was still running. Status `READY` was a lie — the prospect was not actually ready to share with a client.

---

## 1. Goal

Every prospect that reaches `status: READY` is genuinely ready to ship to a client. No placeholder content. No drift between status and reality. One deterministic path from `/admin/prospects/new` to a populated `AnalyseBrochure`.

## 2. Problem statement

Current `createAndProcess` mutation (`server/routers/admin.ts:499-688`):

1. Creates Prospect with `status: DRAFT`.
2. Runs Apollo + KvK enrichment.
3. **Sets status to `GENERATING`.**
4. **Calls `generateWizardContent()` synchronously** — generates legacy `analysis-v1` JSON (`heroContent`, `dataOpportunities`, `automationAgents`, `successStories`, `aiRoadmap`) directly on the Prospect row. This is placeholder content ("AI opportunities for X / Initial draft generated from profile data").
5. **Sets status to `READY`.** Mutation returns to client.
6. Fire-and-forgets logo resolution.
7. Fire-and-forgets `executeResearchRun()` — only here does the _real_ `analysis-v2` narrative get generated and persisted to `ProspectAnalysis`.

`/analyse/[slug]` (`app/analyse/[slug]/page.tsx:272-433`) renders:

- If active research run → `<ActiveRunPoller>`
- Else if `analysis-v2` exists → `<AnalyseBrochure>`
- **Else → `<DashboardClient>` with legacy v1 fields**

The fallback chain means a client visiting the public URL between `READY` (legacy v1 written) and `analysis-v2` completion sees the legacy placeholder. This is exactly what surfaced with `mujjo.com`.

Two parallel content systems exist (v1 sync + v2 async). v1 was supposed to be deprecated but its writers and readers are still wired in.

## 3. Design

### 3.1 Status model

Replace ambiguous states with a deterministic creation pipeline:

```prisma
enum ProspectStatus {
  // Creation pipeline (pre-pitch)
  DRAFT       // just created, pre-enrichment (transient, <1s)
  ENRICHING   // Apollo + KvK + readableSlug in progress
  ANALYZING   // research run + master-analyzer in progress (60-180s)
  READY       // analysis-v2 exists in ProspectAnalysis, shippable
  FAILED      // hard failure; admin retries

  // Pitch lifecycle (post-create) — unchanged
  SENT
  VIEWED
  ENGAGED
  QUOTE_SENT
  CONVERTED
  ARCHIVED
}
```

**Removed:** `ENRICHED` (random in-between state), `GENERATING` (legacy wizard concept).

**Added Prospect columns:**

- `failureReason: String?` — populated when status transitions to `FAILED`. Surfaced in admin retry banner.
- `analysisCompletedAt: DateTime?` — set when transitioning to `READY`. Drives "analyse 3u oud" labels and stale detection (future).

**Sub-stage progression** is **not** duplicated on Prospect. The existing `ResearchRun.status` enum (`PENDING/CRAWLING/EXTRACTING/HYPOTHESIS/BRIEFING/COMPLETED/FAILED`) drives live progress UI on prospect detail. Prospect-level status is the gate; ResearchRun-level status is the live ticker.

### 3.2 createAndProcess rewrite — Wave 1 / Wave 2 split

**Wave 1 (synchronous, awaited, ~2-5s):**

1. Create Prospect with `status: DRAFT` (transient, sub-second before next update).
2. **Update status to `ENRICHING`** (visible in admin list during Apollo work).
3. Apollo + KvK enrichment via `enrichCompany` + `mergeApolloWithKvk`.
4. Generate `readableSlug`.
5. Apply enrichment data (sticky guard for manual fields stays).
6. Branch:
   - **Apollo no coverage + no manual fields provided in form** → `status: FAILED`, `failureReason: "Onvoldoende bedrijfsdata — vul handmatig aan"`. Mutation returns. Wave 2 does not start.
   - **Apollo error (network/quota) thrown** → `status: FAILED`, `failureReason: "Apollo: {error.message slice 100}"`. Mutation returns.
   - **Otherwise** (Apollo success OR no-coverage but manual fields present) → `status: ANALYZING`. Continue to Wave 2.
7. Mutation returns prospect. Client redirects to `/admin/prospects/[id]`.

**Wave 2 (background fire-and-forget, 60-180s):**

1. Logo resolution (existing `resolveLogoUrl`, fire-and-forget within Wave 2).
2. `executeResearchRun(db, { prospectId, manualUrls: [] })` — full pipeline.
3. Inside `executeResearchRun`: `generateNarrativeAnalysis` (or `generateKlarifaiNarrativeAnalysis` for non-Atlantis projects) populates `ProspectAnalysis` with `analysis-v2` JSON.
4. Match proofs for hypotheses (existing logic).
5. Branch:
   - **All steps succeeded + `analysis-v2` row exists** → `status: READY`, `analysisCompletedAt: now()`.
   - **Any step threw** → `status: FAILED`, `failureReason: "{step}: {error.message slice 200}"`. Existing `recordAnalysisFailure` helper extends to also set top-level Prospect status.

The `generateWizardContent` call (step 4 in current code) is **deleted**. The legacy v1 fields are never written.

### 3.3 retryAnalysis procedure (new)

`admin.retryAnalysis` tRPC mutation:

```ts
input: { id: string }
behavior:
  - Multi-tenant scope check (existing pattern).
  - Read prospect; assert status === FAILED.
  - If lushaRawData IS NOT NULL (enrichment previously succeeded):
    - status → ANALYZING
    - Skip Wave 1, run Wave 2 only.
  - Else (enrichment never completed):
    - status → ENRICHING
    - Run Wave 1 + Wave 2.
  - Clear failureReason on transition.
```

UI: red banner on prospect detail when `status === FAILED` shows `failureReason` + "Opnieuw proberen" button calling this mutation.

### 3.4 Public route guard — `/analyse/[slug]`

Replace the three-branch render with a strict guard:

```ts
const PUBLIC_VISIBLE_STATUSES = [
  'READY',
  'SENT',
  'VIEWED',
  'ENGAGED',
  'QUOTE_SENT',
  'CONVERTED',
];

if (!prospect || !PUBLIC_VISIBLE_STATUSES.includes(prospect.status)) {
  notFound(); // Next.js helper — falls back to default 404
}
```

Then render `<AnalyseBrochure>` directly. **No fallback. No `<DashboardClient>`. No `<ActiveRunPoller>` on the public route** — the poller infra moves entirely to admin side where it belongs.

In scope: add `app/not-found.tsx` with Klarifai-branded "Pagina niet gevonden" page (navy bg + Sora typography + gold accent). Currently no custom 404 exists; default Next.js 404 is unbranded.

If `analysis-v2` row is missing for a `READY+` prospect (data integrity failure): log loudly, render an error page directing admin to investigate. This should never happen given the new flow but defensive log helps catch regressions.

### 3.5 Admin UI gating

**`/admin/prospects` (list/kanban):**

- Cards for `ENRICHING` / `ANALYZING` status: render with skeleton overlay (existing skeleton from `prospects-list-skeleton`), `cursor: not-allowed`, `pointer-events: none`. Status chip shows "Verrijken..." / "Analyseert...".
- Cards for `FAILED`: red border + status chip "Mislukt — {short reason}". Clickable (admin must view to retry).
- `READY+` cards: normal interactive behavior.

**`/admin/prospects/[id]` (detail):**

- `ENRICHING` / `ANALYZING`: hero block "Analyse loopt — stap X van Y" pulling sub-stage from latest `ResearchRun.status`. Existing `RerunLoadingScreen` component fits. Disable "Bekijk pitch" button (gold gradient → muted). Disable "Nieuwe offerte" button (premature).
- `FAILED`: red banner top-of-page with `failureReason` + "Opnieuw proberen" button (calls `retryAnalysis`). Rest of UI is read-only context.
- `READY+`: full UI as today.

**`/admin/prospects/new`:**

- `ProcessStage` enum updated: `idle | creating | enriching | done | failed`. (Wave 2 progression watched on detail page after redirect, not in form.)
- After successful Wave 1 (status = ANALYZING returned), redirect to `/admin/prospects/[id]` immediately. The detail page handles all further status display.
- If Wave 1 returns `FAILED` (Apollo no coverage + no manual): show form-level error suggesting "+ optionele verrijking" expansion.

### 3.6 Legacy v1 cleanup (big bang)

**Database migration:**

- Pre-flight script: count Prospects with non-null `heroContent` AND null `analysisCompletedAt` (i.e. legacy-only). If <5: hand-fix via re-run. If >5: write data migration that nulls fields safely first.
- Migration drops columns: `heroContent`, `dataOpportunities`, `automationAgents`, `successStories`, `aiRoadmap`.
- Data migration for status enum: `GENERATING` rows → `FAILED` (assume stuck), `ENRICHED` rows → `READY` if `ProspectAnalysis` exists, else `ANALYZING` (will be picked up by stale-detection cron).

**Code deletes:**

- `lib/ai/generate-wizard.ts` — entire file.
- All `lib/ai/wizard-*` prompt builders if exclusively used by `generateWizardContent` (verify during execution).
- `components/public/prospect-dashboard-client.tsx` — entire file (~1100 lines).
- All imports of the above.

**Code rewrites:**

- `server/routers/admin.ts` — `createAndProcess` body (Wave 1/Wave 2 split). New `retryAnalysis` procedure. Existing `generateContent` mutation deleted (it was the legacy regenerate-wizard path).
- `app/analyse/[slug]/page.tsx` — strip fallback chain, strip `ActiveRunPoller` branch, narrow data-fetch to only what `AnalyseBrochure` consumes.
- `app/admin/prospects/[id]/page.tsx` — gating UI for `ENRICHING/ANALYZING/FAILED` states.
- `app/admin/prospects/page.tsx` — card gating.
- `app/admin/prospects/new/page.tsx` — adjusted ProcessStage.

**Naming cleanup:**

- `lib/prospect-url.ts`: rename `buildDiscoverPath` → `buildAnalysePath`, `discoverLookupCandidates` → `analyseLookupCandidates`, `buildDiscoverSlug` → `buildAnalyseSlug`. Update all imports.
- `lib/constants/prospect-statuses.ts`: stale `/discover/[slug]` comment → `/analyse/[slug]`.

### 3.7 Stale-detection cron

New endpoint: `app/api/internal/cron/stale-analysis-detection/route.ts`.

```ts
// Runs hourly via crontab.
// Find prospects: status === ANALYZING AND createdAt < now - 30min AND analysisCompletedAt IS NULL.
// Update each: status → FAILED, failureReason → "Pipeline timeout (>30min)".
// Log count flagged for observability.
```

Crontab entry: `0 * * * *` calling `scripts/cron-stale-analysis-detection.ts` (mirrors existing `cron-research-refresh.ts` pattern).

Reason: Vercel function timeout is 300s (5min). Research runs occasionally exceed this (slow scrapers, retry loops). Without this cron, a function-killed prospect stays in `ANALYZING` forever, blocking the gated UI permanently.

## 4. Error handling matrix

| Failure                                            | Detection                                        | New status            | failureReason                                  | Retry path                             |
| -------------------------------------------------- | ------------------------------------------------ | --------------------- | ---------------------------------------------- | -------------------------------------- |
| Apollo no coverage + no manual form fields         | `enrichCompany` returns null + form fields empty | `FAILED`              | "Onvoldoende bedrijfsdata — vul handmatig aan" | Reopen form with domain prefilled      |
| Apollo error (network / quota / 5xx)               | try/catch around `enrichCompany`                 | `FAILED`              | `"Apollo: " + error.message.slice(0, 100)`     | `retryAnalysis`                        |
| KvK lookup fails                                   | non-blocking warning logged                      | `ANALYZING` continues | —                                              | n/a (best-effort)                      |
| Research run hard crash                            | try/catch around `executeResearchRun`            | `FAILED`              | `"Research pipeline: " + step + " failed"`     | `retryAnalysis`                        |
| Master analyzer JSON parse fail (after 2 attempts) | existing logic in `master-analyzer.ts`           | `FAILED`              | "Master analyzer: invalid JSON"                | `retryAnalysis`                        |
| Master analyzer Gemini quota                       | 429 response                                     | `FAILED`              | "Gemini quota exceeded"                        | `retryAnalysis` after quota reset      |
| Pipeline timeout (Vercel kills function)           | stale-detection cron                             | `FAILED`              | "Pipeline timeout (>30min)"                    | `retryAnalysis`                        |
| `analysis-v2` missing despite COMPLETED run        | `recordAnalysisSuccess` post-condition check     | `FAILED`              | "Analysis row missing post-pipeline"           | `retryAnalysis` (data integrity guard) |

## 5. Testing strategy

### 5.1 Unit tests (vitest)

- `server/routers/admin.createAndProcess.test.ts` (extends existing): table-driven status-transition test covering each branch (success / Apollo no-coverage soft / Apollo no-coverage hard-fail / master-analyzer crash / master-analyzer quota).
- `server/routers/admin.retryAnalysis.test.ts` (new): asserts skip-enrichment-when-already-enriched, runs full pipeline when not.
- `app/analyse/[slug]/page.test.ts` (new): public guard — table-driven test for each status, expect `notFound()` for non-`PUBLIC_VISIBLE_STATUSES`, expect `<AnalyseBrochure>` for visible.
- `lib/prospect-url.test.ts` (extends): rename coverage.

### 5.2 Integration tests (real DB via Docker, existing pattern)

- Full happy path: create → wait for READY → assert `ProspectAnalysis` row + `version: 'analysis-v2'` content.
- Soft-fail enrichment: Apollo mocked to no-coverage, manual fields set in input → assert ANALYZING continues, eventually READY.
- Hard-fail analyse: master-analyzer mocked to throw → assert FAILED + `failureReason` set + `retryAnalysis` recovers.
- Stale-detection cron: insert ANALYZING prospect with `createdAt = now - 31min`, run cron → assert FAILED.

### 5.3 Manual UAT post-execution

1. Create new prospect (real Apollo, real Gemini): observe status transitions in admin (DRAFT briefly → ENRICHING → ANALYZING → READY), skeleton on card during pipeline, "Bekijk pitch" disabled until READY, `AnalyseBrochure` renders cleanly.
2. Create with unknown domain (no Apollo coverage), no manual fields: expect FAILED + retry link in form.
3. Create with unknown domain, fill manual fields: expect ANALYZING continues, READY.
4. Manually set a prospect to FAILED in DB (or simulate via mock failure): retry button works, transitions through pipeline, ends READY.
5. Visit `/analyse/[slug]` for non-READY prospect: expect 404.
6. Visit `/analyse/[slug]` for READY prospect: expect `AnalyseBrochure` (no DashboardClient, no placeholder).

## 6. Out of scope (follow-up milestones)

- **Skeleton mismatch local↔prod** — separate small fix, validate after this milestone deploys.
- **Concurrent prospect creation in queue** — assume parallel via Vercel functions; no queue infra.
- **Evidence Pipeline Refinement** — scraping quality for D2C/e-commerce archetype prospects (mujjo.com surface). Track separately based on UAT findings of this milestone.

## 7. Migration risk & mitigation

**Risk 1: Existing prospects in `GENERATING` or `ENRICHED` state on production.**
Mitigation: data migration runs first, maps to new states deterministically. Pre-deploy SQL count to confirm migration touches the expected number of rows.

**Risk 2: Dropping legacy v1 columns is irreversible.**
Mitigation: pre-flight script counts legacy-only prospects (have `heroContent`, no `ProspectAnalysis`). If <5, hand-fix via re-run before drop. Backup DB snapshot before migration runs.

**Risk 3: Wave 2 fire-and-forget swallows errors silently.**
Mitigation: every Wave 2 catch block writes `failureReason`; cron catches stuck prospects. Admin retry path covers recovery.

**Risk 4: Public route lockdown breaks an existing live link.**
Mitigation: query production DB pre-deploy for prospects in non-`PUBLIC_VISIBLE_STATUSES` (i.e. `DRAFT/ENRICHING/ANALYZING/FAILED/ARCHIVED`). Confirm none have been shared externally. The current behavior already 404s on `ARCHIVED`; we're extending the same guard.

## 8. Success criteria

- Zero rendering of legacy `<DashboardClient>` on `/analyse/*` routes (component file is deleted).
- Zero Prospect rows with `heroContent != null` post-migration (column dropped).
- Every prospect in `READY` status has a corresponding `ProspectAnalysis` row with `version: 'analysis-v2'`.
- Manual UAT scenarios 1-6 (§5.3) all pass on a fresh staging deploy.
- No regressions on existing prospects: Maintix (CONVERTED), Marfa (ENGAGED), STB Kozijnen (READY) continue to render correctly post-migration.

---

**Approved by:** Romano (brainstorm 2026-04-29)
**Next step:** invoke `superpowers:writing-plans` to produce phased implementation plan.

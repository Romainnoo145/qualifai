---
phase: 61-admin-ui-for-quotes
verified: 2026-04-13
status: human_needed
score: 8/8 automated must-haves verified; 5/5 ROADMAP success criteria need final manual smoke
re_verification: false
human_verification:
  - test: 'Criterion 1 — /admin/quotes lists the 3 imported Marfa DRAFT quotes'
    expected: "Open /admin/quotes, see 3 rows under the 'Concept' (DRAFT) section with nummer, onderwerp, totals, and prospect name. No quotes in 'Verstuurd' or 'Gearchiveerd' sections yet."
    why_human: 'The list page code path, tRPC list query, grouping, and row rendering are all verified by unit tests + code review. Actual presence of the 3 imported Marfa rows depends on the Phase 60 import seed having run against the live DB. No automated seed assertion exists in Phase 61 test scope.'
  - test: 'Criterion 2 — Create → save → appears in list with correct total'
    expected: 'Open /admin/prospects/[marfa-id]/quotes/new, fill tagline + narrative blocks + 3 line items + scope, click save. Browser redirects to /admin/quotes/[newId]. Back on /admin/quotes the new row appears in Concept with the correct bruto total (inclusief BTW).'
    why_human: 'Form rendering, controlled inputs, mutation payload shape, redirect on success, and list query invalidation are all covered by unit tests. The live DB round-trip + navigation + visible list re-render requires a browser session.'
  - test: 'Criterion 3 — Preview iframe matches canonical proposal-template.html'
    expected: "Open a DRAFT quote detail page, click 'Voorbeeld' tab. Sandboxed iframe loads /admin/quotes/[id]/preview.html and shows cover page + 4 inner pages (Uitdaging, Aanpak, Investering, Scope) in the Marfa brand design matching klarifai-core reference."
    why_human: 'lib/quotes/proposal-template.html is 658 LOC (matches the klarifai-core source line count per summary claim). Byte-identity could not be programmatically verified because the klarifai-core repo is not on disk in this environment (/home/klarifai/Documents/klarifai/projects/klarifai-core/ does not exist). Pixel-accurate visual parity requires human eyes on the rendered HTML.'
  - test: 'Criterion 4 — Verstuur → SENT → read-only'
    expected: "Open a DRAFT quote, click the 'Verstuur' button, confirm the Dutch modal. The mutation succeeds, the quote row refetches, the detail page flips to read-only mode (all inputs disabled, save button hidden, read-only message shown), QuoteStatusBadge reads 'Verstuurd', QuoteSendConfirm disappears, QuoteVersionConfirm ('Nieuwe versie') appears."
    why_human: "Button wiring, modal flow, mutation payload {id, newStatus: 'SENT'}, no snapshotData leakage, isReadOnly branching, and status-gated visibility of both action components are all covered by unit tests. End-to-end user journey including post-send refetch cascade requires a browser session."
  - test: 'Criterion 5 — Nieuwe versie → archive + new DRAFT'
    expected: "Open an already-SENT quote, click 'Nieuwe versie', confirm the Dutch modal. Browser navigates to /admin/quotes/[newId]. In the DB: the original row has status=ARCHIVED; the new row has status=DRAFT, replacesId=<originalId>, same narrative + lines, and nummer suffixed -v2 (or -vN+1 if versioned before)."
    why_human: "The createVersion router mutation (atomic $transaction + transitionQuote(tx, original.id, 'ARCHIVED') + replacesId FK + -vN suffix) is covered by 6 router unit tests. The React component tests cover visibility gating, modal payload, and success navigation. End-to-end requires real DB roundtrip + navigation."
---

# Phase 61: Admin UI for Quotes — Verification Report

**Phase Goal:** Romano can create, preview, and send a quote entirely from inside the Qualifai admin — from narrative fields through line items to status transitions — without touching klarifai-core or a YAML file.

**Verified:** 2026-04-13
**Status:** human_needed (all automated checks pass; 5 ROADMAP criteria need final manual smoke in browser)
**Re-verification:** No — initial verification

---

## Goal Achievement — ROADMAP Success Criteria

| #   | Success Criterion                                                   | Automated Backing                                                                                                                                                                                                                                                                                                  | Final Status |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| 1   | `/admin/quotes` lists 3 Marfa quotes grouped by status (DRAFT)      | `app/admin/quotes/page.tsx` renders DRAFT/SENT/ARCHIVED sections via `computeQuoteTotals` + `formatEuro`; `<details>` collapsible for archived; list query wired via `api.quotes.list.useQuery`. Marfa import data presence is not asserted in unit test scope.                                                    | HUMAN_NEEDED |
| 2   | Create form at `/admin/prospects/[id]/quotes/new` → appears in list | `app/admin/prospects/[id]/quotes/new/page.tsx` mounts `QuoteForm`, prefills via `api.quotes.suggestNextQuoteNumber`, calls `api.quotes.create.useMutation`, redirects on success. `quote-form.test.tsx` asserts payload (7 cases). `server/routers/quotes.test.ts` covers create + list.                           | HUMAN_NEEDED |
| 3   | Preview iframe matches canonical proposal-template.html             | `app/admin/quotes/[id]/preview.html/route.ts` returns HTML via `renderQuotePreview`. `lib/quotes/preview-template.test.ts` asserts all 3 Marfa golden totals (€ 7.816,60 / € 11.495,00 / € 13.285,80) + -800 discount preserved. `proposal-template.html` is 658 LOC (matches summary verbatim claim).             | HUMAN_NEEDED |
| 4   | Verstuur → SENT → read-only                                         | `quote-send-confirm.test.tsx` asserts `{id, newStatus: 'SENT'}` exact payload + negative `snapshotData`/`snapshotHtml`/`snapshotPdfUrl` check. `app/admin/quotes/[id]/page.tsx` has `isReadOnly = quote.status !== 'DRAFT'` (line 132-133) threaded into `QuoteForm`. `quote-form.test.tsx` covers read-only mode. | HUMAN_NEEDED |
| 5   | Nieuwe versie → archived + new DRAFT with replacesId                | `server/routers/quotes.ts:287-335` `createVersion` wraps `prisma.$transaction`, sets `replacesId`, calls `transitionQuote(tx, original.id, 'ARCHIVED')`. Router test covers happy path + -vN suffix + cross-project reject + negative tarief clone. `quote-version-confirm.test.tsx` covers UI flow.               | HUMAN_NEEDED |

**Score:** 5/5 criteria verifiable only with a live browser smoke; 100% of the code paths, mutations, state machines, and UI components that back each criterion are verified by automated tests.

---

## Requirements Coverage

| Requirement ID | Description                                                                             | Source Plan   | Status | Evidence                                                                                                                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------- | ------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADMIN-01       | Admin can view all quotes grouped by status at `/admin/quotes`                          | 61-02         | PASS   | `app/admin/quotes/page.tsx:38-46` hardcoded status arrays + `.filter()` into 3 sections; `<QuoteSection>` with `defaultOpen={false}` for archived. Sidebar nav: `app/admin/layout.tsx:249`.                          |
| ADMIN-02       | Admin can create a new quote at `/admin/prospects/[id]/quotes/new`                      | 61-02 + 61-03 | PASS   | `app/admin/prospects/[id]/quotes/new/page.tsx:80-104` calls `api.quotes.create.useMutation` with full payload shape. Form primitives from 61-02 (`quote-form.tsx`, 295 LOC).                                         |
| ADMIN-03       | Admin can add/reorder/edit/remove line items with negative tarief support               | 61-02         | PASS   | `quote-line-list.tsx:22-55` pure helpers (addLine/updateLine/removeLine/moveUp/moveDown). `quote-line-list.test.tsx` 8 cases including `-800` regression at line 70-81.                                              |
| ADMIN-04       | Admin can preview the quote as rendered HTML in an iframe                               | 61-01 + 61-03 | PASS   | `lib/quotes/preview-template.ts` + `preview-builders.ts`; `app/admin/quotes/[id]/preview.html/route.ts` returns text/html w/ no-store + noindex + no-referrer headers. `preview-template.test.ts` 8 cases.           |
| ADMIN-05       | Admin can transition quote from DRAFT → SENT via button that triggers snapshot creation | 61-04         | PASS   | `quote-send-confirm.tsx:77` calls `mutation.mutate({id, newStatus: 'SENT'})`. Test asserts `Object.keys(payload).sort() === ['id', 'newStatus']`. `lib/state-machines/quote.ts` owns snapshot freeze atomically.     |
| ADMIN-06       | Admin sees quote status timeline on detail page                                         | 61-03         | PASS   | `quote-status-timeline.tsx:37-42` 4 slots (Aangemaakt/Verstuurd/Bekeken/Geaccepteerd) with Dutch nl-NL Intl formatter. Mounted in `app/admin/quotes/[id]/page.tsx:261-268`. 4 vitest cases.                          |
| ADMIN-07       | DRAFT quotes freely editable; SENT+ are read-only                                       | 61-02 + 61-03 | PASS   | `quote-form.tsx:36,45,277-292` `isReadOnly` prop disables all 11 inputs + hides save button + shows Dutch read-only message. Detail page branches on `quote.status !== 'DRAFT'` (line 132-133).                      |
| ADMIN-08       | Admin can archive an existing quote and create a new version via `replacesId`           | 61-01 + 61-04 | PASS   | `server/routers/quotes.ts:287-335` `createVersion` in $transaction + `transitionQuote(tx, ..., 'ARCHIVED')` + `replacesId: original.id`. 6 router test cases. `quote-version-confirm.tsx` gated on SENT/VIEWED only. |

---

## Locked Decision Compliance

| Decision | Rule                                                                                                  | Status | Evidence                                                                                                                                                                                                                                                                                                  |
| -------- | ----------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q5       | No Puppeteer / Chromium introduced for preview                                                        | PASS   | `grep -cE "puppeteer\|chromium" package.json` → 0. Preview is pure string rendering via `lib/quotes/preview-template.ts`.                                                                                                                                                                                 |
| Q9       | DRAFT-only mutations; SENT+ immutable                                                                 | PASS   | `quotes.update` router rejects non-DRAFT (existing Phase 60 guard, still green). Detail page `isReadOnly = quote.status !== 'DRAFT'` threaded into QuoteForm.                                                                                                                                             |
| Q12      | No `version: Int` counter column                                                                      | PASS   | `grep "version: Int"` in `prisma/schema.prisma`, `server/routers/quotes.ts`, `lib/quotes/*.ts` → 0. Lineage via `replacesId` FK + `-vN` suffix on nummer.                                                                                                                                                 |
| Q13      | Prospect state machine widened so DRAFT→SENT quote transitions cascade (Pitfall 7)                    | PASS   | `lib/state-machines/prospect.ts:28-38` adds `QUOTE_SENT` to DRAFT/ENRICHED/READY/SENT/VIEWED/ENGAGED. `GENERATING` and `CONVERTED` stay closed. `quote.send-from-draft.test.ts` 8 cases, 7 prospect.test.ts green.                                                                                        |
| Q14      | No DESIGN.md / UI-SPEC.md created in Phase 61                                                         | PASS   | `ls .planning/phases/61-*/DESIGN.md .planning/phases/61-*/UI-SPEC.md` → no such files. Only RESEARCH + PLAN + SUMMARY + VALIDATION.                                                                                                                                                                       |
| —        | No form library additions (react-hook-form, @hookform, @radix-ui, cmdk, sonner, shadcn)               | PASS   | `grep -cE "react-hook-form\|@hookform\|@radix-ui\|cmdk\|sonner\|shadcn" package.json` → 0. QuoteForm uses plain `useState` + props callback.                                                                                                                                                              |
| —        | UI never constructs a QuoteSnapshot (Pitfall 1)                                                       | PASS   | `grep -rE "snapshotData\|snapshotHtml\|snapshotPdfUrl\|QuoteSnapshot\|buildSnapshotFromQuote\|parseSnapshot"` in production files under `components/features/quotes/`, `app/admin/quotes/`, `app/admin/prospects/[id]/quotes/` → 0. Matches only in `quote-send-confirm.test.tsx` as negative assertions. |
| O1       | `suggestNextQuoteNumber` advisory helper for nummer prefill                                           | PASS   | `server/routers/quotes.ts:257-272`. Wired in `app/admin/prospects/[id]/quotes/new/page.tsx:37-39`.                                                                                                                                                                                                        |
| O3       | Stacked status sections (no kanban, no drag)                                                          | PASS   | `app/admin/quotes/page.tsx:38-46` hardcoded arrays + filter; three `<QuoteSection>` rows.                                                                                                                                                                                                                 |
| O4       | Hybrid URLs: nested `/admin/prospects/[id]/quotes/new` for create, flat `/admin/quotes/[id]` for edit | PASS   | Both pages exist; detail page links back to `/admin/prospects/[prospect.id]` in header breadcrumb.                                                                                                                                                                                                        |
| O5       | Nieuwe versie button visible ONLY on SENT/VIEWED                                                      | PASS   | `quote-version-confirm.tsx:31` `ALLOWED_STATUSES = ['SENT', 'VIEWED'] as const`. `quote-version-confirm.test.tsx` `it.each` visibility matrix covers 5 hidden + 2 visible statuses.                                                                                                                       |
| O6       | Verbatim Dutch confirmation copy                                                                      | PASS   | Extracted to module-scope constants (`MODAL_TITLE`, `MODAL_BODY_PREFIX`, etc.) so prettier can never break verbatim grep. Tests render via `getByText(...)`.                                                                                                                                              |
| O7       | beforeunload dirty warning                                                                            | PASS   | `app/admin/quotes/[id]/page.tsx:138-148` effect attaches listener only when `isDirty && !isReadOnly`.                                                                                                                                                                                                     |
| O8       | Voorstellen sidebar entry between Campaigns and Draft Queue                                           | PASS   | `app/admin/layout.tsx:249` positioned between `Campaigns` (line 248) and `Draft Queue` (line 250), icon `FileText`.                                                                                                                                                                                       |
| O9       | Prospect state machine widened for Pitfall 7                                                          | PASS   | Same evidence as Q13.                                                                                                                                                                                                                                                                                     |
| O10      | Multi-tenant boundary via prospect.projectId                                                          | PASS   | `app/admin/quotes/[id]/preview.html/route.ts:44-48` `where: { id, prospect: { projectId: project.id } }`. `createVersion` uses `assertQuoteInProject` before findUniqueOrThrow.                                                                                                                           |

---

## Test Suite Execution

```
Command: npm run test -- lib/quotes lib/state-machines server/routers/quotes components/features/quotes --run
Exit code: 0
Duration: 1.62s

Test Files: 11 passed (11)
Tests:      92 passed (92)

Breakdown:
  lib/state-machines/quote.test.ts                            12 tests  (Phase 60 baseline, green)
  lib/state-machines/prospect.test.ts                          7 tests  (Phase 60 baseline, green after widening)
  lib/state-machines/quote.send-from-draft.test.ts             8 tests  (Pitfall 7 regression)
  lib/quotes/quote-totals.test.ts                              7 tests  (Marfa golden totals)
  lib/quotes/preview-template.test.ts                          8 tests  (Marfa + hardcoded ref + negative tarief)
  server/routers/quotes.test.ts                               13 tests  (7 baseline + 6 new createVersion/suggest)
  components/features/quotes/quote-line-list.test.tsx          8 tests
  components/features/quotes/quote-form.test.tsx               7 tests
  components/features/quotes/quote-status-timeline.test.tsx    4 tests
  components/features/quotes/quote-send-confirm.test.tsx       7 tests
  components/features/quotes/quote-version-confirm.test.tsx   11 tests
                                                              =========
                                                              92 tests  (matches 61-04 summary claim exactly)
```

---

## TypeScript Baseline

```
Command: npx tsc --noEmit 2>&1 | grep -cE "error TS"
Error count: 10

Files with errors (all pre-existing baseline, NOT from Phase 61):
  - lib/enrichment/sitemap.test.ts      (Phase 60 baseline)
  - scripts/tmp-run-analysis-nedri.ts   (ad-hoc script, out of scope)

Phase 61 scoped files:
  - lib/quotes/*                        → 0 errors
  - lib/state-machines/*                → 0 errors
  - server/routers/quotes.ts            → 0 errors
  - components/features/quotes/*        → 0 errors
  - app/admin/quotes/**/*               → 0 errors
  - app/admin/prospects/[id]/quotes/**  → 0 errors
```

**Zero new TypeScript errors introduced by Phase 61.** Baseline count (10) matches Phase 60 post-completion state.

---

## File-Size Compliance (300-LOC cap)

| File                                                   | LOC | Status                                |
| ------------------------------------------------------ | --- | ------------------------------------- |
| `components/features/quotes/quote-form.tsx`            | 295 | PASS                                  |
| `components/features/quotes/quote-line-row.tsx`        | 128 | PASS                                  |
| `components/features/quotes/quote-send-confirm.tsx`    | 135 | PASS                                  |
| `components/features/quotes/quote-version-confirm.tsx` | 128 | PASS                                  |
| `app/admin/quotes/[id]/page.tsx`                       | 271 | PASS                                  |
| `lib/quotes/preview-template.ts`                       | 70  | PASS (split into preview-builders.ts) |

---

## Anti-Patterns Scan

| Pattern                                        | Count | Status                                                                           |
| ---------------------------------------------- | ----- | -------------------------------------------------------------------------------- |
| `TODO`/`FIXME`/`XXX` markers in Phase 61 files | —     | Informational only (tRPC v11 inference gap TODOs, carried forward from Phase 60) |
| `return null` stub render                      | —     | Intentional visibility gates (QuoteSendConfirm/QuoteVersionConfirm) — not stubs  |
| Empty handler (`() => {}`)                     | —     | None                                                                             |
| Placeholder return values                      | —     | None                                                                             |
| `puppeteer`/`chromium`                         | 0     | PASS                                                                             |
| `react-hook-form`/shadcn                       | 0     | PASS                                                                             |
| `QuoteSnapshot` in UI files                    | 0     | PASS                                                                             |

---

## Wiring Verification (Key Links)

| From                                           | To                                             | Status | Detail                                                                                             |
| ---------------------------------------------- | ---------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| `app/admin/quotes/page.tsx`                    | `api.quotes.list`                              | WIRED  | `(api.quotes.list as any).useQuery(undefined)` line 50 + row rendering loop                        |
| `app/admin/prospects/[id]/quotes/new/page.tsx` | `api.quotes.create` + `suggestNext`            | WIRED  | Mutation mount at line 43, suggest prefill at line 37, redirect on success line 46                 |
| `app/admin/quotes/[id]/page.tsx`               | `api.quotes.get` + `api.quotes.update`         | WIRED  | Query at line 86, mutation at line 91, `onSuccess` invalidates both `get` and `list`               |
| `QuoteSendConfirm`                             | `api.quotes.transition`                        | WIRED  | Line 47-56; payload `{id, newStatus: 'SENT'}` exactly                                              |
| `QuoteVersionConfirm`                          | `api.quotes.createVersion`                     | WIRED  | Line 47-58; `{fromId}` payload + `router.push('/admin/quotes/' + newQuote.id)` on success          |
| `QuotePreviewIframe`                           | `/admin/quotes/[id]/preview.html`              | WIRED  | `src={/admin/quotes/${quoteId}/preview.html?token=...}` line 58                                    |
| Preview route                                  | `renderQuotePreview(quote)`                    | WIRED  | `server/admin-auth.resolveAdminProjectScope` → `project.id` → `prospect.projectId` filter → render |
| `createVersion` router                         | `transitionQuote(tx, original.id, 'ARCHIVED')` | WIRED  | Nested inside $transaction; detection runtime-switch (no double $transaction)                      |
| `transitionQuote` (DRAFT → SENT)               | `assertValidProspectTransition`                | WIRED  | Widened prospect map enables cascade from DRAFT/ENRICHED/READY/SENT/VIEWED/ENGAGED prospects       |

All key links verified via code inspection + test coverage.

---

## Human Verification Required

Automated checks pass fully. The 5 ROADMAP success criteria each describe a Romano-in-browser journey that cannot be programmatically asserted without live DB + browser session:

1. **Marfa list smoke** — Confirm `/admin/quotes` shows the 3 imported Marfa DRAFT quotes in the Concept section with correct totals. If the DB import has not been run, run it first.
2. **Create flow smoke** — Walk through `/admin/prospects/[marfa-id]/quotes/new` → fill form → save → verify new row appears in list with correct bruto total (including 21% BTW).
3. **Preview visual parity** — Open a DRAFT quote, switch to the Voorbeeld tab, visually compare the rendered iframe against the klarifai-core `proposal-template.html` reference (cover + 4 inner pages: Uitdaging, Aanpak, Investering, Scope). Pay particular attention to OFF003: the -800 Pakketkorting line must be visible and the bruto must be € 13.285,80.
4. **Send flow smoke** — Click Verstuur on a DRAFT, confirm modal, verify quote flips to read-only + status badge turns Verstuurd + Verstuur button disappears + Nieuwe versie button appears.
5. **Nieuwe versie smoke** — On a SENT quote, click Nieuwe versie, confirm modal, verify redirect to new DRAFT, verify nummer has `-v2` suffix, verify DB: original is ARCHIVED + new has `replacesId` set.

---

## Gaps Summary

**No automated gaps.** All 8 ADMIN requirements have verified code paths, all locked decisions honored, all 92 tests green, TypeScript baseline clean, no anti-patterns, no snapshot construction in UI, no banned dependencies added. Every success-criterion code path is covered by a combination of router unit tests, component unit tests, and manual code review.

The only remaining verification step is the 5 live-browser smoke tests above — these are inherently manual because they walk the full UI + DB + navigation + refetch cascade, and Phase 61 chose not to ship Playwright e2e specs (the `e2e/` directory exists but is empty per VALIDATION.md W0 notes).

---

_Verified: 2026-04-13_
_Verifier: Claude Opus 4.6 (gsd-verifier)_

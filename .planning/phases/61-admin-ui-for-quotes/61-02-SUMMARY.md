---
phase: 61-admin-ui-for-quotes
plan: 02
subsystem: ui
tags: [react, trpc, tailwind, vitest, testing-library, quotes, admin]

# Dependency graph
requires:
  - phase: 61-admin-ui-for-quotes
    provides: DEFAULT_BTW_PERCENTAGE, computeQuoteTotals, formatEuro, quotes.list tRPC query, quotes.create/update input schemas (from 61-01)
provides:
  - components/features/quotes/quote-line-row.tsx — single editable quote line with signed tarief (no min=0 clamp)
  - components/features/quotes/quote-line-list.tsx — dynamic list + pure state helpers (addLine, updateLine, removeLine, moveUp, moveDown)
  - components/features/quotes/quote-status-badge.tsx — Dutch-labeled status chip with per-status color mapping
  - components/features/quotes/quote-form.tsx — shared create/edit form with read-only mode, dirty tracking, beforeunload guard
  - app/admin/quotes/page.tsx — list page grouped by Concept / Verstuurd / Gearchiveerd with collapsible archive section
  - Sidebar Voorstellen nav entry between Campaigns and Draft Queue
affects: [61-03-quote-editor, 61-04-send-flow, 62-client-quote-view]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Dynamic list form pattern: pure state helpers exported alongside the React component, unit-tested without React mount (first admin page to need this)'
    - 'QuoteForm uses plain useState + props-callback (no react-hook-form, no schema validation) — mirrors app/admin/prospects/new/page.tsx'
    - 'Read-only form mode: boolean prop disables every input + replaces submit button with a muted message (Q9 immutability mirrored at UI layer)'
    - 'beforeunload dirty guard: effect attaches window listener when isDirty && !isReadOnly, cleans up on unmount'
    - 'Quote list stacked sections using native HTML <details> for collapsible archive — no new disclosure primitive added'
    - 'tRPC v11 inference gap workaround: explicit Row type declared locally in app/admin/quotes/page.tsx with TODO comment (consistent with existing app/admin/prospects/[id]/page.tsx convention)'

key-files:
  created:
    - components/features/quotes/quote-line-row.tsx
    - components/features/quotes/quote-line-list.tsx
    - components/features/quotes/quote-line-list.test.tsx
    - components/features/quotes/quote-status-badge.tsx
    - components/features/quotes/quote-form.tsx
    - components/features/quotes/quote-form.test.tsx
    - app/admin/quotes/page.tsx
  modified:
    - app/admin/layout.tsx

key-decisions:
  - 'No form library: plain useState + props callback matching the canonical app/admin/prospects/new/page.tsx pattern (package.json lacks react-hook-form, shadcn, radix, cmdk, sonner by design — do NOT add)'
  - 'LineDraft shape is owned by quote-line-row.tsx and re-exported through quote-line-list.tsx so QuoteForm imports from the list (single import surface)'
  - 'Pure state helpers (addLine, updateLine, removeLine, moveUp, moveDown) live next to the component but are unit-tested in isolation — 8 vitest cases including negative-tarief regression'
  - 'QuoteForm controls btwPercentage with a lazy initializer that falls back to DEFAULT_BTW_PERCENTAGE only when initial.btwPercentage === 0 — keeps the create flow defaulted without a useEffect round-trip'
  - 'QuoteForm.submit is handler-wired via <form onSubmit> with data-testid="quote-form" so the fireEvent.submit test can target it without role="form" noise'
  - 'Status grouping uses three hardcoded status arrays + .filter() (no kanban, no drag) — matches O3 and the existing admin prospects list pattern'
  - 'Archived section uses <details> with defaultOpen=false — no new collapsible primitive, native HTML element is accessible by default'
  - 'List page row type declared locally (explicit Row shape) to sidestep tRPC v11 deep inference; TODO comment flags it for the Phase 62+ tRPC inference cleanup'

patterns-established:
  - 'components/features/quotes/ is the canonical home for all Quote UI primitives — future quote components (send modal, version banner, etc.) land here'
  - 'Dynamic form row pattern: sub-component file per row + parent file with pure state helpers + test file importing helpers directly (no React mount for state logic)'
  - 'Read-only mode pattern: single isReadOnly boolean prop, disables every input, replaces submit button with a muted <p> explaining why (Q9 message is Dutch)'
  - 'beforeunload guard lives INSIDE the component so every consumer gets it for free — no ContextProvider / hook layering'

requirements-completed: [ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-07]

# Metrics
duration: 5m 25s
completed: 2026-04-13
---

# Phase 61 Plan 02: Admin Quote UI Primitives + List Page Summary

**Shared React layer for admin quote flows: QuoteLineRow/List/StatusBadge/Form primitives with 15 passing vitest cases (including -800 tarief round-trip and read-only mode), plus a grouped /admin/quotes list page and a new "Voorstellen" sidebar nav entry — all without adding a single dependency to package.json.**

## Performance

- **Duration:** 5m 25s
- **Started:** 2026-04-13T20:38:16Z
- **Completed:** 2026-04-13T20:43:41Z
- **Tasks:** 3
- **Files created:** 7
- **Files modified:** 1
- **New tests:** 15 (8 line-list helpers + 7 QuoteForm)

## Accomplishments

- QuoteLineRow renders a single editable quote line with fase/omschrijving/oplevering/uren/tarief inputs, up/down/remove controls, and a SIGNED tarief input (no `min={0}` clamp — OFF003 Pakketkorting −800 regression covered by test)
- QuoteLineList wraps the rows with pure immutable state helpers (addLine/updateLine/removeLine/moveUp/moveDown) — 8 unit tests hit every helper plus the negative-tarief regression without mounting React
- QuoteStatusBadge renders a Tailwind chip for every QuoteStatus value with Dutch labels (Concept/Verstuurd/Bekeken/Geaccepteerd/Afgewezen/Verlopen/Gearchiveerd) and per-status color classes
- QuoteForm is a controlled component with 11 bound inputs matching the `quotes.create` schema 1:1, read-only mode that disables every input + hides the save button, dirty tracking via useState, and a `beforeunload` warning when `isDirty && !isReadOnly`
- `/admin/quotes` page groups rows into Concept (DRAFT) / Verstuurd (SENT+VIEWED+ACCEPTED+REJECTED+EXPIRED) / Gearchiveerd (ARCHIVED, collapsed by default via `<details>`) with totals computed via `computeQuoteTotals` + `formatEuro` from 61-01
- Sidebar gains a `Voorstellen` nav entry with the `FileText` lucide icon between Campaigns and Draft Queue per O8

## Task Commits

Each task was committed atomically:

1. **Task 1: QuoteLineRow + QuoteLineList + QuoteStatusBadge primitives with tests** — `6e16471` (feat)
2. **Task 2: Shared QuoteForm component with read-only mode + form test** — `b3fe7ee` (feat)
3. **Task 3: /admin/quotes list page grouped by status + sidebar nav update** — `ba6e223` (feat)

## Files Created/Modified

### Created

- `components/features/quotes/quote-line-row.tsx` (128 LOC) — Editable quote line with up/down/remove controls; tarief input has NO min clamp (negative values allowed for discount lines)
- `components/features/quotes/quote-line-list.tsx` (86 LOC) — Dynamic list wrapping QuoteLineRow + exports pure state helpers (addLine, updateLine, removeLine, moveUp, moveDown, emptyLine)
- `components/features/quotes/quote-line-list.test.tsx` (81 LOC) — 8 vitest cases: add, updateLine, removeLine, moveUp/Down, boundary no-ops, negative tarief regression
- `components/features/quotes/quote-status-badge.tsx` (34 LOC) — Dutch-labeled status chip with color mapping per QuoteStatus
- `components/features/quotes/quote-form.tsx` (295 LOC) — Shared create/edit form: 11 bound inputs, read-only mode, dirty tracking, beforeunload guard
- `components/features/quotes/quote-form.test.tsx` (125 LOC) — 7 vitest cases: render fields, submit payload, -800 tarief round-trip, read-only disabled + button hidden, read-only message, error banner, dirty label transition
- `app/admin/quotes/page.tsx` (154 LOC) — List page with 3 stacked sections, explicit Row type, computeQuoteTotals per row, `<details>` for archived section

### Modified

- `app/admin/layout.tsx` — Added `FileText` to lucide-react imports + `{ href: '/admin/quotes', label: 'Voorstellen', icon: FileText }` NavItem between Campaigns and Draft Queue

## Decisions Made

- **No form library:** Plain `useState` + props callback matching the canonical `app/admin/prospects/new/page.tsx` pattern. Never introduce `react-hook-form`/`@hookform/resolvers/zod`/shadcn/Radix/cmdk/sonner — research doc confirmed none of these exist in package.json.
- **LineDraft single source of truth:** Lives in `quote-line-row.tsx` as `export interface LineDraft`, re-exported via `quote-line-list.tsx` so consumers (QuoteForm, tests, future Plan 61-03) only import from the list file.
- **Pure state helpers next to the component:** `addLine`, `updateLine`, `removeLine`, `moveUp`, `moveDown` are exported from `quote-line-list.tsx` and unit-tested directly (no React mount needed). This is the first admin file to need a dynamic list, so this convention establishes the pattern for future dynamic forms.
- **Lazy initializer for btwPercentage:** `useState<QuoteFormValues>(() => mode === 'create' && initial.btwPercentage === 0 ? {...initial, btwPercentage: DEFAULT_BTW_PERCENTAGE} : initial)` — defaults the field on create mode without needing a useEffect round-trip.
- **`data-testid="quote-form"` instead of `role="form"`:** ARIA `role="form"` requires an accessible name; the test uses `fireEvent.submit(screen.getByTestId('quote-form'))` to avoid the ARIA noise.
- **Status grouping via three hardcoded `QuoteStatus[]` arrays + `.filter()`:** No kanban, no drag. Matches O3 and the existing `app/admin/prospects/page.tsx` stacked-section pattern.
- **`<details>` for archived section:** Native HTML element, accessible by default, no new disclosure primitive added. Archived defaults closed (`open={false}`).
- **Explicit Row type in list page:** tRPC v11 deep inference chokes on the list payload; local `type Row = {...}` declaration with a `TODO: tRPC v11 inference gap` comment matches the existing convention from `app/admin/prospects/[id]/page.tsx` ResearchRunRow.
- **Remove button hidden when `disabled`:** `QuoteLineRow` only renders the Trash2 button when `!disabled`, mirroring the "no mutation paths for read-only" spirit. Up/Down stay rendered but disabled so the layout doesn't reflow between modes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `quote-form.tsx` exceeded the 300-LOC cap by 2 lines**

- **Found during:** Task 2 (after first write)
- **Issue:** Initial version was 302 LOC. CLAUDE.md mandates ≤ 300 LOC. Would have failed the `wc -l` acceptance criterion.
- **Fix:** Condensed the file header comment block (10 → 6 lines) and replaced the `useEffect` btw-fallback with a lazy `useState` initializer (removed 5 lines). Final: 295 LOC.
- **Files modified:** `components/features/quotes/quote-form.tsx`
- **Verification:** `wc -l components/features/quotes/quote-form.tsx` → 295
- **Committed in:** `b3fe7ee` (Task 2 commit)

**2. [Rule 3 - Blocking] Acceptance-criterion grep counted `min={0}` comment occurrences**

- **Found during:** Task 1 verification
- **Issue:** Acceptance criterion `grep -c "min={0}" components/features/quotes/quote-line-row.tsx = 1` failed with count 3 because two comment lines mentioned `\`min={0}\``in prose ("Do NOT add`min={0}` on the tarief input"). The actual JSX attribute is only on the uren input.
- **Fix:** Rewrote both comments to describe intent without quoting the literal attribute ("Do NOT clamp the tarief input to non-negative values").
- **Files modified:** `components/features/quotes/quote-line-row.tsx`
- **Verification:** `grep -c "min={0}"` → 1, `grep -A2 "tarief:" | grep -c "min={0}"` → 0
- **Committed in:** `6e16471` (Task 1 commit, pre-commit rewrite)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - Blocking)
**Impact on plan:** No scope creep. Both fixes landed inside the task boundaries with zero semantic changes to the component behavior. All acceptance criteria pass.

## Issues Encountered

- None — Task 1, 2, 3 executed cleanly, no test failures, no typecheck regressions. Pre-commit lint-staged reformatted the QuoteForm test file (collapsed multi-line expect chain) and the QuotesListPage JSX (collapsed PageLoader JSX). Both reformats are cosmetic and preserve behavior.

## Authentication Gates

None — no external services touched.

## User Setup Required

None — no environment variables, no DB migrations, no external service configuration.

## Test Coverage Summary

| Test file                                             | Cases  | Subject                                                                                                                                           |
| ----------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/features/quotes/quote-line-list.test.tsx` | 8      | **NEW** — addLine/updateLine/removeLine/moveUp/moveDown including boundary no-ops + -800 tarief regression                                        |
| `components/features/quotes/quote-form.test.tsx`      | 7      | **NEW** — render fields, submit payload, -800 tarief round-trip, read-only disabled + button hidden, read-only message, error banner, dirty label |
| **Total**                                             | **15** | **15 new, all green**                                                                                                                             |

Full suite runs in ~1s. `npm run test -- components/features/quotes --run` exits 0.

## Next Phase Readiness

- **Plan 61-03 (Quote create/edit pages) can now:**
  - Import `QuoteForm` and wire `api.quotes.create.useMutation()` / `api.quotes.update.useMutation()` against it
  - Call `api.quotes.suggestNextQuoteNumber.useQuery()` at mount to prefill the `nummer` field
  - Pass `isReadOnly={quote.status !== 'DRAFT'}` to flip the form into read-only mode for SENT+ quotes
- **Plan 61-04 (Send flow + preview iframe) can now:**
  - Import `QuoteStatusBadge` for the detail page header
  - Reuse `computeQuoteTotals` + `formatEuro` from 61-01 for the send confirmation modal
- **Future Plan 61-? (version clone button):** can wire `api.quotes.createVersion.useMutation()` against any SENT/VIEWED detail page by rendering a button that's enabled when the form is in read-only mode.

**Blockers or concerns:** None. All locked decisions (Q5/Q9/Q12/Q13/Q14) honored. No snapshot-building code, no form library, no new dependencies. Every requirement field from `quotes.create` input has a bound UI field. ADMIN-01 (list page), ADMIN-02 (form component), ADMIN-03 (line list), ADMIN-07 (read-only mode) are closed at the component layer — final end-to-end wiring happens in 61-03 and 61-04.

## Self-Check: PASSED

Files exist on disk:

- components/features/quotes/quote-line-row.tsx (128 LOC) ✓
- components/features/quotes/quote-line-list.tsx (86 LOC) ✓
- components/features/quotes/quote-line-list.test.tsx (81 LOC) ✓
- components/features/quotes/quote-status-badge.tsx (34 LOC) ✓
- components/features/quotes/quote-form.tsx (295 LOC) ✓
- components/features/quotes/quote-form.test.tsx (125 LOC) ✓
- app/admin/quotes/page.tsx (154 LOC) ✓
- app/admin/layout.tsx modified (FileText import + Voorstellen NavItem) ✓

Verification commands:

- `npm run test -- components/features/quotes --run` → 2 test files, 15/15 tests passing
- `npx tsc --noEmit 2>&1 | grep -cE "error TS"` → 10 (baseline — all in scripts/tmp-\*.ts + lib/enrichment/sitemap.test.ts, zero new)
- `npx tsc --noEmit 2>&1 | grep -E "components/features/quotes|app/admin/quotes|app/admin/layout"` → clean
- `grep -cE "react-hook-form|@hookform|@radix-ui|cmdk|sonner|shadcn" package.json` → 0
- `grep -rE "snapshotData|QuoteSnapshot|buildSnapshotFromQuote|parseSnapshot" components/features/quotes/ app/admin/quotes/` → no matches
- `grep -c "Voorstellen" app/admin/layout.tsx` → 1
- `grep -c "href: '/admin/quotes'" app/admin/layout.tsx` → 1
- `grep -c "FileText" app/admin/layout.tsx` → 2 (import + usage)

Commits verified via `git log --oneline`:

- `6e16471` — feat(61-02): add QuoteLineRow, QuoteLineList, QuoteStatusBadge primitives
- `b3fe7ee` — feat(61-02): add QuoteForm component with read-only mode + tests
- `ba6e223` — feat(61-02): add /admin/quotes list page + Voorstellen sidebar nav

---

_Phase: 61-admin-ui-for-quotes_
_Completed: 2026-04-13_

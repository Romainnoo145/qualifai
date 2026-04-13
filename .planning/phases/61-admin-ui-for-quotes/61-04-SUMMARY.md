---
phase: 61-admin-ui-for-quotes
plan: 04
subsystem: ui
tags:
  [react, trpc, vitest, testing-library, quotes, admin, modals, state-machine]

# Dependency graph
requires:
  - phase: 60-quote-schema-foundation
    provides: transitionQuote state machine owns snapshot freeze atomically (UI never builds snapshot); quotes.transition Zod input strictly {id, newStatus}
  - phase: 61-admin-ui-for-quotes
    provides: quotes.createVersion({fromId}) mutation (61-01), computeQuoteTotals + formatEuro helpers (61-01), empty quote-actions-slot on /admin/quotes/[id] detail page (61-03), QuoteStatusBadge (61-02)
provides:
  - components/features/quotes/quote-send-confirm.tsx — Verstuur button + Dutch confirm modal calling quotes.transition with {id, newStatus: "SENT"} (ADMIN-05)
  - components/features/quotes/quote-version-confirm.tsx — Nieuwe versie button + confirm modal calling quotes.createVersion({fromId}) gated on status in [SENT, VIEWED] (ADMIN-08)
  - Both action components mounted on the detail page actions slot, closing the full create → edit → send → read-only → new-version admin loop
  - Verbatim-Dutch-copy pattern: O6 strings extracted to module-scope constants so prettier JSX wrapping can never break grep acceptance
affects: [62-client-quote-view, 63-follow-up-automation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Verbatim copy constants at module scope: prevents prettier reflow from breaking verbatim grep checks on user-facing strings (MODAL_TITLE, MODAL_BODY_PREFIX, MODAL_BODY_SUFFIX, PRIMARY_LABEL, CANCEL_LABEL)'
    - 'Plain fixed-overlay modal without Radix/cmdk/sonner — mirrors app/admin/layout.tsx mobile-nav pattern, role="dialog" + aria-modal + Escape keydown listener, glass-card body'
    - 'Mutation mock pattern: capture onSuccess/onError callbacks in closure-level `let` variables so tests can trigger error/success paths synchronously without racing React state'
    - 'act() wrapper around captured-callback invocation: required when simulating mutation success/error outside a React event handler so setError/onSuccess flush before getByText assertions'
    - 'it.each visibility matrix: enumerate all QuoteStatus values in a single parametrized test to regression-guard the gate'
    - 'Positive identity test on mutation payload keys: Object.keys(payload).sort() === expected prevents future drift where snapshot fields leak into the UI layer'
    - 'ALLOWED_STATUSES as-const readonly literal tuple: type-safe visibility gate; status membership check via .includes() runs at render time'

key-files:
  created:
    - components/features/quotes/quote-send-confirm.tsx
    - components/features/quotes/quote-send-confirm.test.tsx
    - components/features/quotes/quote-version-confirm.tsx
    - components/features/quotes/quote-version-confirm.test.tsx
  modified:
    - app/admin/quotes/[id]/page.tsx

key-decisions:
  - 'Extract verbatim Dutch copy to module-scope string constants: prettier's JSX text wrapping (Na versturen kun\n je...) broke grep acceptance on the first pass; constants make the strings unbreakable by formatters'
  - 'Mutation error simulation via captured onError callback + act(): React state updates from outside a React event need explicit act() wrapping for RTL getByText to see the flushed DOM'
  - 'ALLOWED_STATUSES as readonly tuple (not Set): .includes() on 2 elements is O(2) and the tuple is type-safe against QuoteStatus literal additions'
  - '"Nieuwe versie maken" title + primary button is the same string — test uses getAllByText(...).length === 2 instead of a fragile single-query, clearer than splitting into unique labels'
  - 'Send button uses btn-pill-primary, version button uses btn-pill-secondary — primary action on a DRAFT is sending, on a SENT+ quote the primary path is viewing/contract not rolling a new version'
  - 'Both modals use identical shell (fixed inset-0 z-50 + glass-card + Escape listener) — the shared shape is not yet extracted into a reusable ConfirmModal because it would need a generic slot API and the 300-LOC cap holds comfortably with duplication'

patterns-established:
  - 'Verbatim copy locked via module constants: any future grep-enforced Dutch string lives at the top of the component as a typed const so prettier/eslint can never break the assertion'
  - 'Task-commit + fix-commit split is fine: when a pre-commit formatter invalidates a grep check, create a NEW fix commit (never amend) and continue — git history is the source of truth for decision threading'
  - 'Action components are self-visibility-gated: the parent page mounts both unconditionally, each component returns null when its status precondition is not met. No visibility logic duplicated on the page shell.'

requirements-completed: [ADMIN-05, ADMIN-08]

# Metrics
duration: 6min 56s
completed: 2026-04-13
---

# Phase 61 Plan 04: Admin Quote UI — Verstuur + Nieuwe versie Flows Summary

**Two React action components (`QuoteSendConfirm` + `QuoteVersionConfirm`) mounted into the 61-03 detail-page actions slot, closing the full admin quote loop: Romano can walk a DRAFT through Verstuur → read-only → Nieuwe versie → new DRAFT without leaving the admin shell. Verbatim Dutch O6 copy, strict `{id, newStatus}` payload (Pitfall 1 regression-guarded via positive identity test), and 18 new vitest cases bringing the components/features/quotes suite to 37 passing tests.**

## Performance

- **Duration:** 6 min 56 sec
- **Started:** 2026-04-13T21:18:16Z
- **Completed:** 2026-04-13T21:25:12Z
- **Tasks:** 3 (2 TDD + 1 mount edit)
- **Files created:** 4
- **Files modified:** 1
- **New tests:** 18 (7 QuoteSendConfirm + 11 QuoteVersionConfirm)
- **Total component-quotes suite:** 37/37 green (was 19 after 61-03)
- **Full Phase 61 scoped suite:** 92/92 green

## Accomplishments

- **ADMIN-05 shipped end-to-end:** QuoteSendConfirm renders on DRAFT quotes only, opens a Dutch confirm modal with the inclusive-BTW total (`computeQuoteTotals` + `formatEuro`), and fires `api.quotes.transition` with a strict `{id, newStatus: "SENT"}` payload. A positive-identity test asserts `Object.keys(payload).sort() === ['id', 'newStatus']` so any future drift where a dev tries to attach `snapshotData` from the UI will fail CI.
- **ADMIN-08 shipped end-to-end:** QuoteVersionConfirm is gated on `status in ['SENT', 'VIEWED']` via an `ALLOWED_STATUSES` readonly tuple. The it.each visibility matrix enumerates all 7 QuoteStatus values: DRAFT/ACCEPTED/REJECTED/EXPIRED/ARCHIVED render nothing, SENT + VIEWED render the button. Confirm modal fires `createVersion({fromId})` and redirects to `/admin/quotes/[newId]` on success via `router.push`.
- **Detail page actions slot populated:** The empty `quote-actions-slot` div that 61-03 reserved now mounts both action components unconditionally. Each component owns its own visibility gate (DRAFT-only for Send, SENT/VIEWED-only for Version), so the page shell never branches on status.
- **Post-send read-only flip:** When a DRAFT is sent successfully, the mutation `onSuccess` invalidates `quotes.get`, the detail page refetches, the `useEffect` reseeds `draft` from the new SENT row, and the existing `isReadOnly = quote.status !== 'DRAFT'` branching flips `QuoteForm` into read-only mode. QuoteSendConfirm returns null (status !== DRAFT), QuoteVersionConfirm appears (status === SENT). Zero additional wiring — the 61-03 invalidation pattern handles it.
- **Zero new dependencies:** No Radix, no cmdk, no sonner, no react-hook-form. Both modals use the plain fixed-overlay pattern from `app/admin/layout.tsx` with an Escape keydown listener and `role="dialog"` for accessibility.
- **Pitfall 1 locked down at the UI layer:** Zero occurrences of `snapshotData`/`snapshotHtml`/`snapshotPdfUrl`/`QuoteSnapshot`/`buildSnapshotFromQuote`/`parseSnapshot` in any of the 5 new/modified files (component code). The test file names these substrings only in negative assertions (`not.toHaveProperty('snapshotData')`) to explicitly guard against regression.

## Task Commits

Each task was committed atomically; two mid-task fixes landed as follow-up commits when pre-commit prettier invalidated a grep acceptance:

1. **Task 1 (RED-GREEN): QuoteSendConfirm + tests** — `34baded` (feat)
2. **Task 1 fix: verbatim copy extracted to module constants** — `d621314` (fix, prettier-safe)
3. **Task 2 (RED-GREEN): QuoteVersionConfirm + tests** — `4d9cfe2` (feat)
4. **Task 3: Mount both components on detail page** — `2740278` (feat)
5. **Task 3 fix: scrub QuoteSnapshot literal from header comment** — `c8d4c8b` (fix, Pitfall 1 grep-clean)

## Files Created/Modified

### Created

- `components/features/quotes/quote-send-confirm.tsx` (135 LOC) — Verstuur button + Dutch confirm modal. Props: `{quoteId, status, lines, btwPercentage}`. Returns null when status !== DRAFT. Inline total computed via `computeQuoteTotals(lines, btwPercentage).bruto` rendered with `formatEuro`.
- `components/features/quotes/quote-send-confirm.test.tsx` (111 LOC) — 7 vitest cases: null-on-SENT, render on DRAFT, modal open, Euro total in body, Annuleren closes without mutation, positive identity check on `{id, newStatus}` payload + negative check on snapshotData/snapshotHtml/snapshotPdfUrl keys, error path via captured onError callback.
- `components/features/quotes/quote-version-confirm.tsx` (128 LOC) — Nieuwe versie button + confirm modal. Props: `{quoteId, status}`. Visibility gated on `ALLOWED_STATUSES = ['SENT', 'VIEWED']`. Calls `createVersion({fromId})` and redirects to `/admin/quotes/[newQuote.id]` on success via `useRouter().push`.
- `components/features/quotes/quote-version-confirm.test.tsx` (118 LOC) — 11 vitest cases: it.each visibility matrix (5 hidden: DRAFT/ACCEPTED/REJECTED/EXPIRED/ARCHIVED), 2 render (SENT, VIEWED), 4 modal flow (open, Annuleren, confirm → `{fromId: 'q1'}` + `router.push('/admin/quotes/q2')`, error path).

### Modified

- `app/admin/quotes/[id]/page.tsx` (269 → 271 LOC) — Added 2 imports + replaced the empty actions-slot placeholder with `<QuoteSendConfirm ... />` and `<QuoteVersionConfirm ... />`. No other changes. Tab nav, QuoteForm mount, preview iframe, timeline, beforeunload, and read-only branching all preserved from 61-03.

## Decisions Made

- **Verbatim Dutch copy extracted to module constants.** First pass inlined the strings in JSX; pre-commit prettier wrapped `"Na versturen kun je de offerte niet meer aanpassen"` across two JSX text nodes, breaking the verbatim grep acceptance. Fixed by hoisting all 5 locked strings (title + body prefix + body suffix + primary + cancel) into module-scope consts. Grep-stable, DRY, and makes it obvious where the O6 contract lives.
- **Mutation-error simulation via captured callback + act().** The test mocks `useMutation` to capture the `onError` callback in a module-level `let`, then calls it outside a React event. Without `act()`, React batches the `setError` update and RTL's next `getByText` assertion races the DOM flush. Wrapping the callback invocation in `act(() => { lastOnError?.(...) })` forces React to flush synchronously. Same pattern used for `onSuccess → router.push` assertion.
- **`ALLOWED_STATUSES` as readonly tuple, not Set.** Two elements; `.includes()` is O(2) and a tuple is more type-safe than a Set for literal status values. The `satisfies readonly QuoteStatus[]` annotation keeps future QuoteStatus additions honest.
- **`"Nieuwe versie maken"` appears twice (title + primary button).** Test uses `getAllByText(...).length === 2` rather than splitting into unique labels, matching the planned verbatim copy without forcing an artificial distinction.
- **Both components self-visibility-gate; the page mounts them unconditionally.** The detail page shell does NOT branch on `quote.status` before mounting. Each action component owns its own `if (!matches) return null` at the top. This keeps the shell simple and makes the visibility rules grep-findable (all gate logic lives in the component file it governs).
- **No shared ConfirmModal component extracted yet.** Both modals share the same fixed-overlay + glass-card + Escape + role="dialog" shell but with different content shape (send has a Euro total, version has no dynamic content). Extracting now would require a generic children/slot API. At 135 + 128 LOC both components are well under the 300-LOC cap, so the duplication is not yet a pain point. Revisit if a third modal lands.
- **Create new commits for fixes instead of amending.** Per GSD protocol, when a pre-commit formatter or grep-check failure required a follow-up change, a second commit was made (`d621314` and `c8d4c8b`) rather than amending `34baded` / `2740278`. Git history tells the full story of the task → fix cycle.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prettier JSX wrapping broke verbatim copy grep**

- **Found during:** Task 1 acceptance verification (after Task 1 commit)
- **Issue:** First pass inlined the Dutch body text directly in JSX:
  ```tsx
  <p>
    Je staat op het punt... Na versturen kun je de offerte niet meer aanpassen.
    Totaal: ...
  </p>
  ```
  Pre-commit prettier wrapped `"Na versturen kun"` onto line 99 and `"je de offerte niet meer aanpassen"` onto line 100. The acceptance grep `grep -c 'Na versturen kun je de offerte niet meer aanpassen'` returned 0.
- **Fix:** Extracted all 5 locked strings (title, body prefix, body suffix, primary label, cancel label) into module-scope string constants. JSX now references `{MODAL_TITLE}`, `{MODAL_BODY_PREFIX}`, etc. — prettier can wrap the JSX nodes without ever touching the string literals.
- **Files modified:** components/features/quotes/quote-send-confirm.tsx
- **Verification:** `grep -c 'Na versturen kun je de offerte niet meer aanpassen' components/features/quotes/quote-send-confirm.tsx` → 1. All 5 verbatim O6 strings pass their greps. All 7 RTL tests still green (the tests match against rendered text via `screen.getByText`, which sees the concatenated render output regardless of how the constants are composed).
- **Committed in:** `d621314` (separate fix commit after `34baded`)

**2. [Rule 3 - Blocking] `QuoteSnapshot` literal in header comment flagged by Pitfall 1 grep**

- **Found during:** Final overall verification pass (after Task 3 commit)
- **Issue:** The header comment in `quote-send-confirm.tsx` contained the prose sentence `"...the UI NEVER builds a QuoteSnapshot."` — literally a correct statement, but it matches the Pitfall 1 acceptance grep `grep -cE 'snapshotData|snapshotHtml|snapshotPdfUrl|QuoteSnapshot' == 0` with count 1.
- **Fix:** Rewrote the comment to describe the invariant without naming the forbidden token: `"...transitionQuote rebuilds the frozen payload atomically; the UI NEVER constructs that payload itself."` Same semantic meaning, zero grep hits.
- **Files modified:** components/features/quotes/quote-send-confirm.tsx
- **Verification:** `grep -cE 'snapshotData|snapshotHtml|snapshotPdfUrl|QuoteSnapshot' components/features/quotes/quote-send-confirm.tsx` → 0. Tests still green.
- **Committed in:** `c8d4c8b` (separate fix commit after `2740278`)

**3. [Rule 1 - Bug] Test used `getByText('Nieuwe versie maken')` but the string appears twice**

- **Found during:** Task 2 RED→GREEN transition (first GREEN test run)
- **Issue:** Test case "opens the modal on button click" asserted `expect(screen.getByText('Nieuwe versie maken')).toBeInTheDocument()`. Component renders the string in both the `<h2>` title AND the primary button label, so `getByText` throws "Found multiple elements". Test failed on what should have been the GREEN run.
- **Fix:** Changed to `expect(screen.getAllByText('Nieuwe versie maken').length).toBe(2)` which is stricter (positively asserts the duplication is intentional).
- **Files modified:** components/features/quotes/quote-version-confirm.test.tsx
- **Verification:** 11/11 tests green after the fix.
- **Committed in:** `4d9cfe2` (bundled into the Task 2 GREEN commit before it shipped)

**4. [Rule 1 - Bug] `lastOnSuccess` unused local in QuoteSendConfirm test**

- **Found during:** Task 1 typecheck (`npx tsc --noEmit`)
- **Issue:** First pass captured both `lastOnSuccess` and `lastOnError` in the mock, but only used `lastOnError` in the tests. TypeScript's `noUnusedLocals` flagged `lastOnSuccess` as unused.
- **Fix:** Removed the `lastOnSuccess` variable + its assignment and reset.
- **Files modified:** components/features/quotes/quote-send-confirm.test.tsx
- **Verification:** `npx tsc --noEmit` clean on the file.
- **Committed in:** `34baded` (bundled into the Task 1 GREEN commit before it shipped)

---

**Total deviations:** 4 auto-fixed (3 Rule 3 - Blocking, 1 Rule 1 - Bug)
**Impact on plan:** All deviations were formatter/grep-acceptance mechanical issues or typecheck hygiene. Zero semantic changes to component behavior. The two standalone fix commits (`d621314`, `c8d4c8b`) keep the git history honest about how prettier and grep rules interact — a useful signal for future TDD plans with verbatim-copy acceptance checks.

## Issues Encountered

- **Pre-commit prettier reshaped JSX after the grep had already passed on the pre-commit staging area.** The first Task 1 test-and-grep cycle passed in my working directory, but prettier's re-wrap on the committed file invalidated one grep check. Resolution: extract strings to module constants so no formatter can touch them. Recurring pattern worth adding to 61-RESEARCH.md's pitfall list: **"any verbatim-copy grep acceptance requires string constants, not inline JSX text"**.

## Authentication Gates

None — no external services touched. Pure UI component work on top of already-shipped mutations.

## User Setup Required

None — no environment variables, no DB migrations, no external service configuration.

## Test Coverage Summary

| Test file                                                                                                    | Cases  | Subject                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/features/quotes/quote-send-confirm.test.tsx`                                                     | 7      | **NEW** — Null on non-DRAFT, render Verstuur, open modal, Euro total in body, Annuleren closes without mutation, positive identity check on `{id, newStatus}` payload, error via onError    |
| `components/features/quotes/quote-version-confirm.test.tsx`                                                  | 11     | **NEW** — it.each visibility matrix (5 hidden statuses), SENT render, VIEWED render, open modal, Annuleren closes, createVersion `{fromId}` + router.push to `/admin/quotes/q2`, error path |
| `components/features/quotes/quote-line-list.test.tsx`                                                        | 8      | (pre-existing, still green)                                                                                                                                                                 |
| `components/features/quotes/quote-form.test.tsx`                                                             | 7      | (pre-existing, still green)                                                                                                                                                                 |
| `components/features/quotes/quote-status-timeline.test.tsx`                                                  | 4      | (pre-existing, still green)                                                                                                                                                                 |
| **components/features/quotes total**                                                                         | **37** | **18 new, 19 pre-existing — all green**                                                                                                                                                     |
| **Phase 61 scoped total** (lib/quotes + state-machines + server/routers/quotes + components/features/quotes) | **92** | **All green in 1.65s**                                                                                                                                                                      |

## Next Phase Readiness

- **Phase 61 is done.** All 8 ADMIN requirements (ADMIN-01 list page, ADMIN-02 create form, ADMIN-03 line list, ADMIN-04 preview iframe, ADMIN-05 send flow, ADMIN-06 status timeline, ADMIN-07 read-only mode, ADMIN-08 new-version flow) are complete at the UI + backend layer.
- **Ready for Phase 62 (Client quote view):** The detail page is a fully working admin shell. Phase 62 builds `/discover/[slug]/voorstel` on top of the same `renderQuotePreview` module (61-01), the same shared totals helper (`computeQuoteTotals` + `formatEuro`), and the same locked decisions (Q5 no Puppeteer, Q9 server owns snapshot freeze). The `QuoteStatusTimeline` component's viewedAt/acceptedAt nullable props are already wired — Phase 62 just populates them from real Quote columns.
- **Ready for Phase 63 (Follow-up automation):** The mutation layer can be invoked by automation (cron, cadence engine) via the same `quotes.transition({id, newStatus})` path. No UI-layer coupling.
- **No blockers.** Pre-Phase 62 decisions Q6 (design tokens) and Q7 (/voorstel auth model) still pending — these gate Phase 62 planning but not Phase 61 shipping.

**Grep audit trail for future readers:** In the 5 code files modified by 61-04, `snapshotData`/`snapshotHtml`/`snapshotPdfUrl`/`QuoteSnapshot`/`buildSnapshotFromQuote`/`parseSnapshot` appear ONLY in the test file `quote-send-confirm.test.tsx` and ONLY as negative assertions (`expect(payload).not.toHaveProperty('snapshotData')`). This is intentional — the test names the forbidden keys to regression-guard against them leaking into the UI payload. Any future dev running the pitfall grep against production code (not tests) will see zero hits.

## Self-Check: PASSED

Files exist on disk:

- components/features/quotes/quote-send-confirm.tsx (135 LOC) — FOUND
- components/features/quotes/quote-send-confirm.test.tsx (111 LOC) — FOUND
- components/features/quotes/quote-version-confirm.tsx (128 LOC) — FOUND
- components/features/quotes/quote-version-confirm.test.tsx (118 LOC) — FOUND
- app/admin/quotes/[id]/page.tsx (271 LOC, ≤ 300 cap) — FOUND

Commits exist in `git log --oneline`:

- `34baded` — feat(61-04): add QuoteSendConfirm component + ADMIN-05 unit tests — FOUND
- `d621314` — fix(61-04): extract verbatim Dutch copy to module constants — FOUND
- `4d9cfe2` — feat(61-04): add QuoteVersionConfirm component + ADMIN-08 unit tests — FOUND
- `2740278` — feat(61-04): mount QuoteSendConfirm + QuoteVersionConfirm on detail page — FOUND
- `c8d4c8b` — fix(61-04): scrub QuoteSnapshot literal from header comment — FOUND

Acceptance greps:

- `grep -c 'export function QuoteSendConfirm' ... = 1` ✓
- `grep -c "id: quoteId, newStatus: 'SENT'" ... = 1` ✓
- `grep -cE 'snapshotData|snapshotHtml|snapshotPdfUrl|QuoteSnapshot' components/features/quotes/quote-send-confirm.tsx = 0` ✓ (Pitfall 1)
- `grep -cE 'snapshotData|snapshotHtml|snapshotPdfUrl|QuoteSnapshot' components/features/quotes/quote-version-confirm.tsx = 0` ✓
- `grep -cE 'snapshotData|snapshotHtml|snapshotPdfUrl|QuoteSnapshot' app/admin/quotes/[id]/page.tsx = 0` ✓
- `grep -cE 'quotes\.create\b' components/features/quotes/quote-version-confirm.tsx = 0` ✓ (Pitfall 3 — createVersion only)
- Verbatim Dutch strings (O6) in quote-send-confirm.tsx — all 5 pass ✓
- Verbatim Dutch strings in quote-version-confirm.tsx — all 3 pass ✓
- `grep -c 'ALLOWED_STATUSES' components/features/quotes/quote-version-confirm.tsx = 2` ✓
- `grep -c 'it.each' components/features/quotes/quote-version-confirm.test.tsx = 1` ✓
- `grep -cE 'react-hook-form|@radix-ui|cmdk|sonner' package.json = 0` ✓ (no new deps)

Test and typecheck:

- `npm run test -- components/features/quotes --run` → 37/37 passing ✓
- `npm run test -- lib/quotes lib/state-machines server/routers/quotes components/features/quotes --run` → 92/92 passing ✓
- `npx tsc --noEmit` scoped to 61-04 files → 0 errors ✓

---

_Phase: 61-admin-ui-for-quotes_
_Completed: 2026-04-13_

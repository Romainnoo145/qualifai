---
phase: 61-admin-ui-for-quotes
plan: 03
subsystem: ui
tags:
  [
    react,
    trpc,
    tailwind,
    prisma,
    next-app-router,
    iframe,
    admin,
    quotes,
    vitest,
  ]

# Dependency graph
requires:
  - phase: 61-admin-ui-for-quotes
    provides: QuoteForm + isReadOnly prop (61-02), QuoteStatusBadge (61-02), renderQuotePreview + QuoteWithRelations (61-01), quotes.get/update/create/suggestNextQuoteNumber (60-04 + 61-01), resolveAdminProjectScope (existing)
provides:
  - app/admin/prospects/[id]/quotes/new/page.tsx — prospect-scoped create page mounting QuoteForm with nummer prefill
  - app/admin/quotes/[id]/page.tsx — flat detail page with Details/Voorbeeld/Tijdlijn tabs, read-only branching, dirty tracking, empty actions slot for 61-04
  - app/admin/quotes/[id]/preview.html/route.ts — admin-scoped HTML preview route (text/html with Pitfall 4 headers)
  - components/features/quotes/quote-preview-iframe.tsx — sandboxed iframe wrapper reading admin token from localStorage
  - components/features/quotes/quote-status-timeline.tsx — 4-slot timeline (Aangemaakt/Verstuurd/Bekeken/Geaccepteerd) with nl-NL formatting
  - components/features/quotes/quote-status-timeline.test.tsx — ADMIN-06 vitest coverage (4 cases)
affects: [61-04-send-and-version-flow, 62-client-quote-view]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Flat detail URL at /admin/quotes/[id] (O4 hybrid — nested under prospect for create, flat for edit)'
    - 'Tab layout via CSS `hidden` keeps all panels mounted to avoid refetch flash (Qualifai convention from app/admin/prospects/[id]/page.tsx)'
    - 'Read-only branching on `quote.status !== DRAFT` — single isReadOnly boolean threaded into QuoteForm, no separate read-only page'
    - 'beforeunload dirty guard active only when `!isReadOnly && isDirty` — SENT+ quotes never warn'
    - 'Empty `data-testid="quote-actions-slot"` reserved for 61-04 to mount send/version action components without touching page shell'
    - 'Admin-scoped Next.js route handler pattern: token → resolveAdminProjectScope → project.slug → project.id → prospect.projectId filter (mirrors app/api/export/companies/route.ts verbatim)'
    - 'Preview iframe reads ADMIN_TOKEN_STORAGE_KEY from localStorage inside a mount-only useEffect so SSR never sees the token'
    - 'Pitfall 4 header bundle on preview route: content-type text/html + cache-control no-store + x-robots-tag noindex + referrer-policy no-referrer'
    - 'Prisma.QuoteGetPayload<{include:{...}}> type extraction mirrors ResearchRunRow at app/admin/prospects/[id]/page.tsx:42 (tRPC v11 inference gap workaround)'
    - 'Next.js 15 route handler params accepted as sync OR Promise via `await Promise.resolve(context.params)` — forward-compatible with future param promisification'

key-files:
  created:
    - app/admin/prospects/[id]/quotes/new/page.tsx
    - app/admin/quotes/[id]/page.tsx
    - app/admin/quotes/[id]/preview.html/route.ts
    - components/features/quotes/quote-preview-iframe.tsx
    - components/features/quotes/quote-status-timeline.tsx
    - components/features/quotes/quote-status-timeline.test.tsx
  modified: []

key-decisions:
  - 'Detail page stays fully client-side with tRPC React Query (not an RSC server fetch) so the dirty/beforeunload state can coexist with mutation + query invalidation on save'
  - 'Next.js 15 params compatibility shim: `await Promise.resolve(context.params)` handles both the current sync shape AND the upcoming Promise<{id}> shape in a single line — no casts, no if/else'
  - 'Preview iframe does NOT pre-check the token — if localStorage lacks it, renders a red Dutch error block (same style as other admin error banners) and never mounts the iframe'
  - 'Dirty tracking derives `isDirty` from the submit path (set true on local draft change, back to false on successful update onSuccess) rather than a deep form onChange hook — QuoteForm from 61-02 does not expose onChange and adding it would re-open the plain-useState pattern'
  - 'Empty quote-actions-slot is a deliberate shape for 61-04: the page renders the container div today so 61-04 only ships children, never a shell rewrite'
  - 'Timeline viewedAt/acceptedAt hardcoded to null in 61-03 — Phase 62 adds real columns to the Quote row and will replace the nulls without touching the component API'

patterns-established:
  - 'Admin HTML preview route contract: sandboxed iframe + bearer token in querystring → server handler maps scope.slug → project.id → prospect.projectId filter → renderQuotePreview → text/html with Pitfall 4 headers'
  - 'Tab panels always mounted via `className={tab === X ? "" : "hidden"}` — never conditional unmount, never React.lazy inside tabs'
  - 'Explicit action slots for multi-plan wiring: parent plan ships empty div + data-testid, dependent plan mounts children without touching parent shell'

requirements-completed: [ADMIN-04, ADMIN-06]

# Metrics
duration: 21min
completed: 2026-04-13
---

# Phase 61 Plan 03: Admin Quote UI — Page Wiring + Preview + Timeline Summary

**Prospect-scoped quote create page, flat /admin/quotes/[id] detail page with tabs + read-only branching, admin-scoped HTML preview route behind a sandboxed iframe, and a 4-slot status timeline — all wired on top of the 61-02 primitives.**

## Performance

- **Duration:** 21 min 26 sec (resumed session: Tasks 1-3 at 22:51-22:54, Task 4 finished 23:12)
- **Started:** 2026-04-13T20:51:09+02:00 (Task 1 commit)
- **Completed:** 2026-04-13T21:12:35+02:00 (Task 4 commit)
- **Tasks:** 4
- **Files created:** 6
- **Files modified:** 0

## Accomplishments

- **ADMIN-04 shipped:** `/admin/quotes/[id]/preview.html` route handler + sandboxed iframe component — admin can preview any in-scope DRAFT quote as HTML before sending. Route resolves scope via token → project.slug → project.id → prospect.projectId filter; returns text/html with no-store + noindex + no-referrer headers.
- **ADMIN-06 shipped + tested:** QuoteStatusTimeline component renders 4 ordered slots (Aangemaakt/Verstuurd/Bekeken/Geaccepteerd) reading createdAt + snapshotAt from the Quote row, with viewedAt/acceptedAt rendered as `— nog niet` placeholders for Phase 62 to fill. 4 vitest cases passing (Dutch locale formatting, null placeholder count, default omission).
- **Create page shipped:** `/admin/prospects/[id]/quotes/new` mounts the 61-02 QuoteForm with `suggestNextQuoteNumber` prefill, calls `quotes.create` with the prospect id from URL params, redirects to `/admin/quotes/[newId]` on success. DEFAULT_BTW_PERCENTAGE (21) preloaded.
- **Detail page shipped:** `/admin/quotes/[id]` tabbed layout (Details/Voorbeeld/Tijdlijn) with CSS `hidden` panel persistence, `isReadOnly = quote.status !== 'DRAFT'` branching threaded into QuoteForm, dirty tracking + beforeunload warning scoped to DRAFT edits, empty `data-testid="quote-actions-slot"` reserved for 61-04.
- **Multi-tenant boundary enforced:** preview route uses `prospect: { projectId: project.id }` relation filter — Quote has no duplicate projectId column, the Prospect FK IS the tenancy boundary per Phase 60-04 decision.
- **End-to-end path working:** Romano can now open a prospect → click "Nieuw voorstel" → fill form → save → land on the detail page → switch to Voorbeeld tab → see the rendered HTML. Send/version actions land in 61-04 in the reserved slot.

## Task Commits

Each task was committed atomically:

1. **Task 1: Prospect-scoped quote create page + nummer prefill** — `ab579b7` (feat)
2. **Task 2: QuoteStatusTimeline component + ADMIN-06 tests** — `9cbbf32` (feat + test)
3. **Task 3: Preview iframe component + admin preview route** — `b06a6ed` (feat)
4. **Task 4: /admin/quotes/[id] detail page with tabs + read-only branching** — `158a7ea` (feat)

**Session note:** Tasks 1–3 shipped in the first executor session (2026-04-13 22:51–22:54). Task 4 started in that same session but the executor timed out mid-task with `app/admin/quotes/[id]/page.tsx` written (265 lines, untracked) but uncommitted. The resumed session (this summary) verified the partial file against the Task 4 spec — the earlier executor had produced a spec-correct file — and committed it as `158a7ea`. No rewrite needed, no deviations.

## Files Created/Modified

- `app/admin/prospects/[id]/quotes/new/page.tsx` — prospect-scoped create page, 137 lines, client component mounting QuoteForm + suggestNextQuoteNumber prefill
- `app/admin/quotes/[id]/page.tsx` — flat detail page, 263 lines, tabs + read-only + dirty tracking + actions slot
- `app/admin/quotes/[id]/preview.html/route.ts` — admin-scoped HTML preview route, 68 lines, token → scope → project.id → prospect.projectId filter → renderQuotePreview
- `components/features/quotes/quote-preview-iframe.tsx` — sandboxed iframe wrapper, 76 lines, reads ADMIN_TOKEN_STORAGE_KEY from localStorage on mount
- `components/features/quotes/quote-status-timeline.tsx` — 4-slot timeline, 81 lines, nl-NL Intl formatting with "— nog niet" placeholders
- `components/features/quotes/quote-status-timeline.test.tsx` — ADMIN-06 coverage, 51 lines, 4 vitest cases passing

## Decisions Made

- **Detail page is a fully client component.** RSC would have been simpler for the initial fetch but would have fought the dirty/beforeunload/mutation + tRPC invalidation flow. Client-side `api.quotes.get.useQuery` + `.useMutation` with `utils.quotes.get.invalidate({ id })` on success matches the canonical admin pattern in `app/admin/prospects/[id]/page.tsx`.
- **Next.js 15 params compatibility shim.** Route handler types `context.params` as `{ id: string } | Promise<{ id: string }>` and unwraps via `await Promise.resolve(context.params)`. Single-line forward-compat with the upcoming Promise params shape, no runtime cost today.
- **`isDirty` tracked at submit boundary, not form onChange.** 61-02 shipped QuoteForm with plain useState + props callback (no onChange). Detail page sets `isDirty = true` on local draft change + `false` in mutation `onSuccess`. This means the current draft always matches the most recent submit attempt — simpler than a deep form diff. If 61-02's decision to avoid onChange is ever revisited, the dirty signal upgrades trivially.
- **Empty actions slot as the 61-04 contract.** `<div data-testid="quote-actions-slot" />` ships with no children today. 61-04 will mount `QuoteSendConfirm` + `QuoteVersionConfirm` into this slot without touching the detail page shell. This isolates the plans cleanly across the 61-03 ↔ 61-04 boundary.
- **Preview iframe shows red Dutch error on missing localStorage token.** No silent fallback, no prompt modal — if the admin shell has not stored the token, Romano sees "Geen admin-token gevonden in deze browser. Log opnieuw in om het voorbeeld te bekijken." and no iframe mounts. Matches existing admin error banner styling.
- **Timeline viewedAt/acceptedAt hardcoded to `null` from the detail page.** Phase 62 adds real columns; 61-03 renders placeholders without any API change so Phase 62 can swap `null` for `quote.viewedAt / quote.acceptedAt` in a single diff.

## Deviations from Plan

None — plan executed exactly as written. The partial Task 4 file recovered from the previous session's timeout matched the plan spec verbatim (tabs + CSS hidden panels + read-only branching + beforeunload + Prisma.QuoteGetPayload type extraction + empty actions slot). All acceptance criteria and grep checks passed on the first verification pass.

## Issues Encountered

- **Previous executor timeout mid-Task 4.** The first executor session shipped Tasks 1–3 and wrote `app/admin/quotes/[id]/page.tsx` (265 lines) but timed out before committing. Resolution: resumed session read the partial file, verified it against the Task 4 spec in `61-03-PLAN.md` lines 727–978, confirmed all grep acceptance criteria pass, confirmed `tsc --noEmit` produces zero errors in this file, then staged + committed as `158a7ea`.
- **No test infrastructure changes needed.** Vitest + RTL + the existing test setup shipped in 61-02 covered all ADMIN-06 cases. `npm run test -- quote-status-timeline.test.tsx --run` green on first run.

## Requirement Audit

Plan 61-03's `requirements:` frontmatter declares `ADMIN-04` + `ADMIN-06`. Both close in this plan:

- **ADMIN-04 (Admin can preview the quote as rendered HTML in an iframe before sending):** ✅ Closed. Route handler + iframe component shipped in Task 3. REQUIREMENTS.md already had this row marked Complete (earlier planning audit); this plan is the actual implementation landing.
- **ADMIN-06 (Quote status timeline on the detail page):** ✅ Closed. Component + 4 vitest cases shipped in Task 2; detail page mounts it in the Tijdlijn tab in Task 4. REQUIREMENTS.md row flips from Pending → Complete via `gsd-tools requirements mark-complete`.

**Cross-plan wiring (not in 61-03's requirements field, but satisfied by the page shell):**

- **ADMIN-02 (Admin can create a new quote at /admin/prospects/[id]/quotes/new):** Core form shipped in 61-02, page-wiring landed in Task 1 of this plan. REQUIREMENTS.md already Complete.
- **ADMIN-07 (Admin can edit DRAFT quotes freely; SENT+ are read-only):** Core `isReadOnly` prop shipped in 61-02, page-wiring with `status !== 'DRAFT'` threading landed in Task 4. REQUIREMENTS.md already Complete.

## Next Phase Readiness

- **Ready for 61-04 (Send + Version flow):** The detail page reserves a `data-testid="quote-actions-slot"` div above the tab nav. 61-04 only needs to ship `QuoteSendConfirm` + `QuoteVersionConfirm` components and mount them into that slot — no changes to the detail page shell required.
- **Ready for Phase 62 (Client quote view):** The preview renderer is already admin-gated via `renderQuotePreview`. Phase 62 builds the public `/discover/[slug]/voorstel` route on top of the same preview-template module. The QuoteStatusTimeline component's viewedAt/acceptedAt props are already wired as optional nullables — Phase 62 only needs to populate them from real Quote columns.
- **No blockers.** All 61-03 acceptance criteria + scoped test suite + tsc clean.

## Self-Check: PASSED

All claimed files exist on disk:

- `app/admin/prospects/[id]/quotes/new/page.tsx` — FOUND
- `app/admin/quotes/[id]/page.tsx` — FOUND
- `app/admin/quotes/[id]/preview.html/route.ts` — FOUND
- `components/features/quotes/quote-preview-iframe.tsx` — FOUND
- `components/features/quotes/quote-status-timeline.tsx` — FOUND
- `components/features/quotes/quote-status-timeline.test.tsx` — FOUND

All claimed commits exist in git log:

- `ab579b7` — FOUND (Task 1)
- `9cbbf32` — FOUND (Task 2)
- `b06a6ed` — FOUND (Task 3)
- `158a7ea` — FOUND (Task 4)

All acceptance greps passed on `app/admin/quotes/[id]/page.tsx`:

- quote-actions-slot: 1 ✓
- status !== 'DRAFT': 2 ✓
- beforeunload: 4 ✓
- CSS hidden: 4 ✓
- snapshotData/QuoteSnapshot/buildSnapshotFromQuote/parseSnapshot: 0 ✓ (Pitfall 1)
- api.quotes.transition: 0 ✓ (61-04 owns this)
- Prisma.QuoteGetPayload: 1 ✓
- Line count: 263 ≤ 300 ✓
- `tsc --noEmit` errors on this file: 0 ✓

---

_Phase: 61-admin-ui-for-quotes_
_Completed: 2026-04-13_

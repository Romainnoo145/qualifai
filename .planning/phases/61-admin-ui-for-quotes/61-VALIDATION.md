---
phase: 61
slug: admin-ui-for-quotes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 61 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from RESEARCH.md `## Validation Architecture` section.

---

## Test Infrastructure

| Property               | Value                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Framework**          | Vitest 4.0.18 + jsdom + @vitejs/plugin-react (unit/integration) + Playwright (e2e, `e2e/` directory exists but is empty) |
| **Config file**        | `vitest.config.ts` + `playwright.config.ts` (both exist)                                                                 |
| **Co-location**        | `*.test.ts[x]` next to source file                                                                                       |
| **Quick run command**  | `npm run test -- <pattern> --run`                                                                                        |
| **Full suite command** | `npm run test -- --run`                                                                                                  |
| **Type check**         | `npx tsc --noEmit`                                                                                                       |
| **Phase 60 baseline**  | 48 tests across 7 files (all green as of Phase 60 completion)                                                            |
| **Phase 61 projected** | +10–15 new tests (Vitest unit/integration) and optionally 3 Playwright specs                                             |

---

## Sampling Rate

- **After every task commit:** `npm run test -- <changed test file> --run` + `npx tsc --noEmit` (scoped to touched files)
- **After every plan wave:** `npm run test -- lib/quotes lib/state-machines server/routers/quotes components/features/quotes --run` (Phase 61 scoped suite, target < 30s)
- **Before `/gsd:verify-work`:** Full `npm run test -- --run` green + `npx tsc --noEmit` clean + `npm run lint` clean
- **Manual Playwright / smoke check at phase gate:** Romano opens `/admin/quotes`, verifies the 3 imported Marfa quotes appear grouped under DRAFT, creates a new quote via the form, previews it, sends it, verifies the transition is visible in the list and the form flips to read-only. Optionally runs a "nieuwe versie" from the detail page and confirms `replacesId` linkage in the DB.
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

_Wave/Plan assignments are preliminary — will be finalized by gsd-planner. Task IDs follow `{phase}-{plan}-{task}` convention._

| Req ID   | Behavior                                                                                                                         | Test Type        | Automated Command                                                                           | File Exists                  | Status     |
| -------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------- | ---------------------------- | ---------- |
| ADMIN-01 | `quotes.list` returns quotes scoped to active project (existing coverage)                                                        | unit (existing)  | `npm run test -- server/routers/quotes.test.ts --run`                                       | ✅ (60-04)                   | ⬜ pending |
| ADMIN-01 | `/admin/quotes` page renders quotes grouped by status                                                                            | e2e (Playwright) | `npm run test:e2e -- e2e/admin-quotes-list.spec.ts`                                         | ❌ W0                        | ⬜ pending |
| ADMIN-01 | `/admin/quotes` page renders grouped sections via server component — smoke                                                       | unit/manual      | manual navigation + screenshot                                                              | —                            | ⬜ pending |
| ADMIN-02 | `<QuoteForm>` calls `quotes.create` with correct input (mocked mutation)                                                         | unit             | `npm run test -- components/features/quotes/quote-form.test.tsx --run`                      | ❌ W0                        | ⬜ pending |
| ADMIN-02 | Create + redirect to detail happy path                                                                                           | e2e (Playwright) | `npm run test:e2e -- e2e/admin-quote-create.spec.ts`                                        | ❌ W0                        | ⬜ pending |
| ADMIN-03 | Add/reorder/remove line items produces correct in-memory state                                                                   | unit             | `npm run test -- components/features/quotes/quote-line-list.test.tsx --run`                 | ❌ W0                        | ⬜ pending |
| ADMIN-03 | Negative tarief (−800) survives round-trip from form to mutation payload                                                         | integration      | `npm run test -- components/features/quotes/quote-form.test.tsx --run -t 'negative tarief'` | ❌ W0                        | ⬜ pending |
| ADMIN-04 | `renderQuotePreview(quote)` produces expected HTML + correct totals for all 3 Marfa quotes (€7.816,60 / €11.495,00 / €13.285,80) | unit             | `npm run test -- lib/quotes/preview-template.test.ts --run`                                 | ❌ W0                        | ⬜ pending |
| ADMIN-04 | `/admin/quotes/[id]/preview.html` route returns rendered HTML with correct status                                                | e2e              | `npm run test:e2e -- e2e/admin-quote-preview.spec.ts`                                       | ❌ W0                        | ⬜ pending |
| ADMIN-05 | `<QuoteSendConfirm>` calls `quotes.transition({id, newStatus: 'SENT'})` with NO snapshotData in payload                          | unit             | `npm run test -- components/features/quotes/quote-send-confirm.test.tsx --run`              | ❌ W0                        | ⬜ pending |
| ADMIN-05 | State machine DRAFT→SENT freezes snapshot + syncs Prospect to QUOTE_SENT (existing coverage)                                     | unit (existing)  | `npm run test -- lib/state-machines/quote.test.ts --run`                                    | ✅ (60-04)                   | ⬜ pending |
| ADMIN-05 | Prospect source statuses allowed to reach QUOTE_SENT via Quote DRAFT→SENT are enumerated and tested (Pitfall 7)                  | unit (new)       | `npm run test -- lib/state-machines/quote.send-from-draft.test.ts --run`                    | ❌ W0                        | ⬜ pending |
| ADMIN-06 | `<QuoteStatusTimeline>` renders 4 slots (Created, Sent, Viewed, Accepted) with available timestamps                              | unit             | `npm run test -- components/features/quotes/quote-status-timeline.test.tsx --run`           | ❌ W0                        | ⬜ pending |
| ADMIN-07 | `<QuoteForm>` disables all inputs and hides save button when `status !== 'DRAFT'`                                                | unit             | `npm run test -- components/features/quotes/quote-form.test.tsx --run -t 'read-only'`       | ❌ W0                        | ⬜ pending |
| ADMIN-07 | `quotes.update` router rejects update on non-DRAFT quotes (existing coverage)                                                    | unit (existing)  | `npm run test -- server/routers/quotes.test.ts --run -t 'non-draft'`                        | ✅ (60-04)                   | ⬜ pending |
| ADMIN-08 | New `quotes.createVersion({fromId})` mutation clones fields and archives the original in one Prisma `$transaction`               | unit (new)       | `npm run test -- server/routers/quotes.test.ts --run -t 'createVersion'`                    | ❌ W0 (extend existing file) | ⬜ pending |
| ADMIN-08 | `<QuoteVersionConfirm>` calls `quotes.createVersion({fromId})` and navigates to the new DRAFT detail page                        | unit             | `npm run test -- components/features/quotes/quote-version-confirm.test.tsx --run`           | ❌ W0                        | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

All net-new files (no existing Phase 61 scaffolding):

**Library / pure logic (unit-testable):**

- [ ] `lib/quotes/proposal-template.html` — copied verbatim from `klarifai-core/docs/design/proposal-template.html` (structural file, not a test)
- [ ] `lib/quotes/preview-template.ts` — `renderQuotePreview(quote)` + helpers with regex-based structural substitution of pillar/phase/pricing blocks
- [ ] `lib/quotes/preview-template.test.ts` — covers all 3 Marfa quote totals + token substitution + negative tarief regression
- [ ] `lib/quotes/quote-totals.ts` — shared totals math helper (ex/incl BTW, line subtotals)
- [ ] `lib/quotes/constants.ts` — `DEFAULT_BTW_PERCENTAGE = 21` (O2 decision)

**State machine extension (unit-testable):**

- [ ] `lib/state-machines/quote.send-from-draft.test.ts` — new test file covering which Prospect source-statuses cascade cleanly into `QUOTE_SENT` (Pitfall 7 resolution). May trigger a small widening of `lib/state-machines/prospect.ts` if valid source set is too narrow — that change must stay inside Phase 61.

**tRPC router extension:**

- [ ] `server/routers/quotes.ts` — extend with `createVersion({fromId})` mutation (Pitfall 3 gap)
- [ ] `server/routers/quotes.ts` — add server-side `suggestNextQuoteNumber()` helper used by the create form prefill (O1 decision)
- [ ] `server/routers/quotes.test.ts` — extend with `createVersion` coverage (clones fields, sets `replacesId`, archives original, all in one `$transaction`)

**React components (unit-testable with RTL):**

- [ ] `components/features/quotes/quote-form.tsx` — shared create/update form (narrative + line items + scope)
- [ ] `components/features/quotes/quote-form.test.tsx` — render, fire events, assert mutation payload, read-only mode
- [ ] `components/features/quotes/quote-line-row.tsx` — single line item sub-component (fase / omschrijving / oplevering / uren / tarief)
- [ ] `components/features/quotes/quote-line-list.tsx` — dynamic list with add / reorder / remove
- [ ] `components/features/quotes/quote-line-list.test.tsx` — pure state manipulation tests
- [ ] `components/features/quotes/quote-status-badge.tsx`
- [ ] `components/features/quotes/quote-status-timeline.tsx`
- [ ] `components/features/quotes/quote-status-timeline.test.tsx`
- [ ] `components/features/quotes/quote-preview-iframe.tsx`
- [ ] `components/features/quotes/quote-send-confirm.tsx`
- [ ] `components/features/quotes/quote-send-confirm.test.tsx`
- [ ] `components/features/quotes/quote-version-confirm.tsx`
- [ ] `components/features/quotes/quote-version-confirm.test.tsx`

**Next.js App Router pages / routes:**

- [ ] `app/admin/quotes/page.tsx` — list grouped by status (DRAFT / SENT / ARCHIVED sections, O3 decision)
- [ ] `app/admin/quotes/[id]/page.tsx` — detail + edit + timeline + send/version actions (O4 hybrid URL decision)
- [ ] `app/admin/quotes/[id]/preview.html/route.ts` — server route that calls `renderQuotePreview(quote)` and returns HTML
- [ ] `app/admin/prospects/[id]/quotes/new/page.tsx` — create form scoped to a prospect (O4 nested URL)
- [ ] `app/admin/layout.tsx` — sidebar nav update, add "Voorstellen" between "Campaigns" and "Draft Queue" (O8 decision)

**E2E (optional, Wave 0 infra):**

- [ ] `e2e/admin-quotes-list.spec.ts` — e2e directory is empty, this is net-new Playwright infra
- [ ] `e2e/admin-quote-create.spec.ts`
- [ ] `e2e/admin-quote-preview.spec.ts`

**Framework install:** None — Vitest + Playwright already configured. No new dependencies needed (cheerio NOT introduced; regex-based structural substitution is the chosen approach).

---

## Manual-Only Verifications

| Behavior                                                                            | Requirement       | Why Manual                                                                                                                   | Test Instructions                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visual parity of preview iframe with klarifai-core template (cover + 4 inner pages) | ADMIN-04          | Pixel-accurate visual check requires human eyes on the rendered HTML. Automated test only asserts content presence + totals. | 1. `npm run dev` (port 9200)<br>2. Open `/admin/quotes`<br>3. Click preview on a Marfa DRAFT<br>4. Visually confirm cover page, 4 inner pages render, totals match klarifai-core                                                                                                                                 |
| End-to-end "create → preview → send → read-only" smoke                              | ADMIN-02/04/05/07 | Romano runs the golden path once per phase gate. Exercises the full stack from form to state machine to re-render.           | 1. Open `/admin/prospects/[id]/quotes/new`<br>2. Fill tagline, narrative, 3 line items, scope<br>3. Save → redirected to detail<br>4. Preview → iframe renders<br>5. Click Verstuur → confirm modal → confirm<br>6. Form flips read-only, status shows SENT<br>7. Check Prospect row now shows status QUOTE_SENT |
| "Nieuwe versie" full flow                                                           | ADMIN-08          | Exercises new router mutation + cross-row archival + prefill                                                                 | 1. Open SENT quote detail<br>2. Click "Nieuwe versie" → confirm<br>3. New DRAFT quote opens prefilled<br>4. Check DB: new Quote has `replacesId = <original.id>`, original Quote has `status = ARCHIVED`                                                                                                         |
| Quote list grouping visual check                                                    | ADMIN-01          | Stacked sections rendering, DRAFT-first ordering, collapse-archived behavior                                                 | 1. Open `/admin/quotes`<br>2. Verify DRAFT section shows 3 Marfa quotes<br>3. Send one → it moves to SENT section<br>4. Archive one → it moves to ARCHIVED section (collapsed by default)                                                                                                                        |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies listed above
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all ❌ W0 entries above
- [ ] No watch-mode flags in commands (scoped runs only)
- [ ] Feedback latency < 30s (scoped test runs verified against existing Vitest configuration)
- [ ] Pitfall 7 (prospect source-status compatibility with QUOTE_SENT cascade) has an explicit test file committed
- [ ] `nyquist_compliant: true` set in frontmatter once planner confirms every task maps into this document

**Approval:** pending

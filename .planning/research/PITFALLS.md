# Pitfalls Research

**Domain:** Admin UX redesign for existing sales automation tool — adding oversight console, research quality gating, client-side approval shift, one-click send queues, and pipeline visualizations on top of a complete backend
**Researched:** 2026-02-22
**Confidence:** HIGH (derived from direct codebase analysis — all patterns verified against actual code in `server/routers/`, `app/admin/`, `prisma/schema.prisma`)

---

## Critical Pitfalls

Mistakes that cause rewrites, data corruption, or trust-breaking double-sends.

---

### Pitfall 1: Double-Send on One-Click Approve (Race Condition via Optimistic UI)

**What goes wrong:** When Phase 16 adds a one-click "Send" button to each draft row, clicking the button fires `approveDraft` and the UI optimistically removes the row. If the user clicks before the tRPC mutation resolves (network latency, slow send), a second click fires a second `approveDraft` call on the same `OutreachLog` ID. The first call deletes the record on success (`ctx.db.outreachLog.delete({ where: { id: input.id } })`). The second call hits `findUniqueOrThrow` and throws a Prisma 404 — but by then the first email already sent. Worse: if two admin tabs are open, both tabs show the same draft and can trigger two sends independently.

**Why it happens:** The `approveDraft` mutation (line 496 of `server/routers/outreach.ts`) has no idempotency guard. It does not check whether the draft was already sent before calling `sendOutreachEmail`. The ORM-level delete is not a lock — between `findUniqueOrThrow` and `delete`, another request can pass the same `findUniqueOrThrow` and also proceed to send.

**How to avoid:**

- Add an optimistic lock: before calling `sendOutreachEmail`, update the status from `'draft'` to `'sending'` in a single atomic write. Use `updateMany` with `where: { id, status: 'draft' }` and check `count === 1` before proceeding. If count is 0, a concurrent send already claimed it — return early without sending.
- Disable the send button on the first click and keep it disabled until the mutation resolves or errors, never re-enabling silently after first submission.
- Do not delete `OutreachLog` records on send success — change the record to `status: 'sent'` instead. Deletion removes the ability to audit and breaks idempotency.
- Apply the same guard to `bulkApproveLowRisk`: filter only `status: 'draft'` records, then use a status-update atomic claim before sending.

**Warning signs:** Resend dashboard shows duplicate messages to the same recipient. `OutreachLog` records show `status: 'retry'` for records that Resend received successfully. Contacts report receiving the same email twice.

**Phase to address:** Phase 16 (Draft Queue Redesign) — the idempotency guard and status-machine approach must be designed before any "one-click send" UI is built.

---

### Pitfall 2: Moving Hypothesis Approval to Client Breaks the /voor/ Dashboard Display

**What goes wrong:** The `/voor/[slug]` page reads `workflowHypotheses` filtered to `status: 'ACCEPTED'`. Currently, approval lives entirely in admin. If v2.0 adds any mechanism for clients to "confirm" or "acknowledge" pain points on the prospect dashboard, and those interactions mutate hypothesis status or create new display content, the existing filter `where: { status: 'ACCEPTED' }` becomes ambiguous — does `ACCEPTED` mean admin-approved, client-confirmed, or both? Displaying unreviewed AI output on the client dashboard risks surfacing wrong or embarrassing hypotheses to the prospect.

**Why it happens:** The approval flow is one-sided by design (admin-only), which is stated as the product differentiator in `REQUIREMENTS.md` (`Auto-approval of hypotheses: Out of Scope`). Introducing any client-side acknowledgment mechanism without adding a separate status field creates implicit state coupling between two independent flows.

**How to avoid:**

- Keep `WorkflowHypothesis.status` values (`DRAFT`, `ACCEPTED`, `REJECTED`) as admin-only. These represent whether admin has reviewed and signed off.
- If client interaction needs tracking (e.g., "client viewed this pain point"), add a separate model (`HypothesisClientView`) or a boolean column (`clientAcknowledgedAt DateTime?`) — never reuse the admin status enum.
- The `/voor/` page query must always filter `status: 'ACCEPTED'` and never fall back to `DRAFT` even when no hypotheses are accepted. Show empty state rather than unreviewed content.
- Audit all query paths that touch `workflowHypothesis` before adding any client-facing interactions.

**Warning signs:** `/voor/` page shows hypotheses that have not been reviewed by admin. Client receives an email about a pain point that admin never approved. Hypothesis list on admin page and client dashboard show different counts for the same prospect.

**Phase to address:** Phase 16 if any client-visible approval concept is introduced — enforce the admin-only gate as an explicit constraint at the router level before building client interactions.

---

### Pitfall 3: Research Quality Gate Creates Infinite Loop Without Explicit Exit Conditions

**What goes wrong:** A "research quality gate" — where admin can mark a prospect's research as insufficient and trigger re-research — has no natural stopping point. The loop is: research runs → admin reviews → marks insufficient → research runs again → admin reviews again → repeat. Without explicit exit criteria (minimum evidence count, maximum re-run attempts, or a "proceed anyway" override), a single difficult prospect blocks the entire pipeline indefinitely. When the 404-skip fix (`commit 1ae3470`) caused thin evidence pools, re-triggering research produces the same thin results, and the gate loops forever.

**Why it happens:** Quality gates are designed around the happy path (research improves on retry). For Dutch SMBs with minimal web presence, the evidence pool is structurally limited — no Glassdoor, few public reviews, constructed URLs 404. Re-running research does not improve evidence when the problem is the source, not the scraper.

**How to avoid:**

- Define explicit exit conditions before building the gate UI:
  - `maxRetries: 3` — after 3 re-runs, the gate auto-approves with a warning that evidence is thin
  - `proceedAnywayButton` — admin can manually override the gate and mark research "sufficient despite thin evidence"
  - `minimumEvidenceCount` — what constitutes "sufficient" must be a hard number (e.g., 3 evidence items with `confidenceScore >= 0.5`), not a vague judgment call
- Store `researchAttempts: Int` on `ResearchRun` or on the prospect — the gate reads this counter before prompting re-run
- Show the admin exactly why quality is insufficient (e.g., "2 of 5 URLs returned 404, 1 is a cookie wall") so they can make an informed "proceed anyway" decision
- Do NOT make the gate mandatory on every review — make it opt-in ("flag this research as needing improvement") so that most prospects flow through without blocking

**Warning signs:** The same prospect shows up in the hypothesis review queue multiple times with identical (thin) evidence. `ResearchRun` count for a single prospect exceeds 3. Admin is waiting on research that never improves.

**Phase to address:** Phase 16 or the research quality gate phase — define the exit conditions and counter field in the data model before building any gate UI.

---

### Pitfall 4: Pipeline Stage Counts Show Inflated or Wrong Numbers (Funnel Arithmetic Error)

**What goes wrong:** The campaign funnel in `server/routers/campaigns.ts` uses cumulative counting: a prospect classified as `replied` also counts toward `imported`, `researched`, `approved`, and `emailed`. The code at lines 322–328 implements this correctly. But when Phase 16 adds a "one-click send" queue that creates `OutreachLog` records with `status: 'draft'` before the admin sends, the `funnelStage` logic classifies prospects as `emailed` based on `EMAILED_SEQUENCE_STATUSES` containing `'SENT'`. If a draft exists but is not sent, and the cadence engine has already set the sequence status to `SENT` prematurely (Pitfall 8 from v1.1 research), a prospect appears in `emailed` funnel stage before any email was actually delivered.

**Why it happens:** Funnel stage is derived from `outreachSequences[].status` and `contacts[].outreachStatus` — both of which can be updated by the cadence engine or by partial approval flows independently of whether Resend actually delivered the email. Sequence status `SENT` is set by `markSequenceStepAfterSend` whenever a step is sent, but the function does not verify delivery — it fires on `result.success` from `sendOutreachEmail`, which itself only checks that the Resend API accepted the request, not that the email was delivered.

**How to avoid:**

- Add a `deliveredAt DateTime?` field to `OutreachStep` that is set only after a Resend delivery webhook fires, not after send attempt
- The funnel's `isEmailed` check should use `deliveredAt IS NOT NULL` not `status IN ('SENT', ...)`
- Until delivery webhooks are wired, the funnel is technically measuring "send attempts" not "emails received" — document this clearly in the UI ("X emailed (send attempted)") to set correct expectations
- When redesigning the pipeline view in Phase 16, show draft count separately from sent count so admin can see the distinction

**Warning signs:** Funnel `emailed` count exceeds the number of emails Resend shows delivered. Prospects classified as `emailed` have no record in Resend's dashboard. Campaign response rate shows 0% despite high `emailed` count.

**Phase to address:** Phase 16 (Draft Queue Redesign) — the funnel query and draft/sent distinction must be resolved before the queue redesign makes the distinction meaningful.

---

### Pitfall 5: UX Redesign Breaks Hidden Backend State That Pages Implicitly Depend On

**What goes wrong:** When admin pages are restructured (Phase 13 replaced 7 tabs with 4 sections), each section imports a separate component (`EvidenceSection`, `AnalysisSection`, `OutreachPreviewSection`, `ResultsSection`). The original 7-tab implementation may have mounted components eagerly on page load — sharing state between tabs via a single tRPC query result. The new implementation uses `hidden` CSS (`display: none`) on inactive sections, which keeps all sections mounted. This means 4 tRPC queries fire on every page load instead of lazily on tab switch. If any query has side effects (e.g., marking items as "viewed" on fetch), those side effects fire immediately on page open regardless of which section is active.

**Why it happens:** Restructuring page layout changes the React mount lifecycle. Moving from lazy-mounted tabs to always-mounted-but-hidden sections changes when queries fire. Developers focus on the visual layout change and miss the implicit timing assumptions in the data layer.

**How to avoid:**

- Audit every tRPC query in each section component for side effects before merging section components into an always-mounted layout
- If any query has a mutation as a side effect (e.g., `markAsViewed` called from `useEffect` on mount), wrap it with a condition checking whether the section is actually visible (`isVisible` prop) before firing
- The current Phase 13 implementation uses `hidden` CSS (`activeTab === 'evidence' ? '' : 'hidden'`), which mounts all 4 sections on page load — verify that all 4 section queries are read-only and have no mount-time mutations

**Warning signs:** Prospects show `status: 'VIEWED'` in the admin list immediately after being opened, before the admin actually reads anything. Signal counts change unexpectedly after a page reload. Notification logs show events that should only trigger on explicit action.

**Phase to address:** Phase 13 is already shipped; this pitfall is a verification task. Any future page restructure must include an audit of query side effects.

---

### Pitfall 6: Approval Responsibility Shift Creates Authorization Gap

**What goes wrong:** If v2.0 moves hypothesis approval from admin-only (guarded by `adminProcedure`) to an endpoint that clients can reach (e.g., a prospect clicking "Yes, this is a pain point I recognize"), the authorization model changes. The `hypotheses.setStatus` mutation currently uses `adminProcedure`, which checks for admin session. If a new client-facing endpoint is added that calls the same mutation without admin auth, or calls a new endpoint that modifies hypothesis status, any person who knows the prospect's URL can approve or reject hypotheses without admin oversight.

**Why it happens:** The `/voor/[slug]` page is public — no authentication required. The slug is a random ID but is shared with the prospect via email. If client-confirmation calls an unauthenticated tRPC procedure that modifies `WorkflowHypothesis.status`, it bypasses the entire admin approval gate.

**How to avoid:**

- Client-facing procedures that affect hypothesis display must use a separate procedure type (not `adminProcedure` and not `publicProcedure`) — create a `prospectProcedure` that validates the slug against a prospect record and checks that the caller is the intended recipient
- Never expose `hypotheses.setStatus` to client routes, even read-only variants — create a separate `clientFeedback` router with its own schema and authorization
- Rate-limit client-facing state-mutation endpoints — slugs are guessable if the random namespace is small, and a brute-force attempt could mass-approve hypotheses

**Warning signs:** Hypothesis status changes without any admin action recorded in the admin audit trail. Prospects receive content that admin did not explicitly approve. `WorkflowHypothesis.status` shows `ACCEPTED` for records where no admin user session touched the mutation.

**Phase to address:** Any phase that adds client-interaction to hypothesis data — must be gated behind explicit authorization design before implementation begins.

---

### Pitfall 7: Prospect Pipeline View Stage Transitions Are Not Reversible (One-Way Ratchet)

**What goes wrong:** The funnel stage logic in `campaigns.ts` is purely additive — once a prospect is classified as `emailed`, it stays `emailed` even if the outreach sequence fails, the email bounces, or the admin deletes the draft. There is no downgrade path. A prospect in `replied` stage cannot move back to `approved` if the reply is marked as unsubscribe. This makes the funnel view misleading during a campaign cleanup where admin removes failed sequences.

**Why it happens:** Funnel stage is computed from the presence of records (`outreachSequences.some(...)`, `contacts.some(...)`), not from an explicit stage field. Deleting a sequence removes the evidence for `emailed` stage but the admin rarely deletes sequences — they mark them `CLOSED_LOST`. `CLOSED_LOST` is not in `EMAILED_SEQUENCE_STATUSES`, so a `CLOSED_LOST` sequence correctly removes the prospect from `emailed` stage. But this creates a different problem: admin closing out a lost sequence moves a prospect backward in the funnel unexpectedly.

**How to avoid:**

- Add explicit documentation in the funnel UI explaining what each stage means and that stages can move backward when sequences are closed
- The current funnel stages are: `imported → researched → approved → emailed → replied → booked`. Add a `lost` stage that is separate from downgrading — a prospect that replied with "not interested" should show as `replied/lost` not fall back to `emailed`
- Do not add new pipeline stages without also defining how transitions work bidirectionally — each new stage needs both promotion and demotion logic

**Warning signs:** Campaign funnel count decreases unexpectedly after admin marks sequences as `CLOSED_LOST`. Admin reports that a prospect "disappeared from the funnel" after closing a lost opportunity. Funnel count is lower than expected after a batch cleanup.

**Phase to address:** Phase 14 is already shipped with the current logic; this is a design constraint for any future pipeline stage additions.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut                                                                                     | Immediate Benefit                                    | Long-term Cost                                                        | When Acceptable                                                                                                             |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Delete `OutreachLog` after send success (current in `approveDraft`)                          | Simple — no status management                        | No audit trail, breaks idempotency, double-send risk                  | Never — change to status update                                                                                             |
| Store `dueAt` in JSON metadata (current touch task pattern)                                  | Fast to implement                                    | Cannot index for cron queries, must parse in application              | Acceptable until cadence volume requires indexed queries (already migrated for cadence — apply same pattern to touch tasks) |
| Use CSS `hidden` on inactive tab sections (current Phase 13)                                 | All sections stay mounted, no re-fetch on tab switch | All 4 queries fire on page load — 4x DB cost per prospect open        | Acceptable for admin-only pages with small user count                                                                       |
| Funnel stage derived from record presence not explicit field                                 | No schema migration needed                           | Cannot ratchet, no bidirectional transitions, stage is fragile        | Acceptable for MVP campaign reporting; will break at scale                                                                  |
| `any` type casts on prospect data in prospect detail page (`const p = prospect.data as any`) | Avoids typing complex Prisma includes                | TypeScript cannot catch field renames, breaking changes at type level | Acceptable as technical debt, must be addressed before major page restructure                                               |

---

## Integration Gotchas

Common mistakes when connecting to external services or internal APIs during the redesign.

| Integration                                  | Common Mistake                                                                                                            | Correct Approach                                                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| tRPC cache invalidation after batch approve  | Invalidate only `outreachLog` queries but forget `admin.getActionQueue` — dashboard count badge stays stale               | After any mutation that changes OutreachLog status, invalidate both `outreach.*` and `admin.getActionQueue`                    |
| Resend delivery webhook for funnel accuracy  | Using API response `success` as delivery confirmation                                                                     | Resend sends `email.delivered` webhook events — wire these to update `OutreachStep.deliveredAt` before trusting funnel counts  |
| Cal.com booking as pipeline signal           | Cal.com fires booking webhook to `/api/webhooks/calcom` — sequence status must be updated there                           | Verify that `outreachSequence.status = 'BOOKED'` is set inside the Cal.com webhook handler, not just on wizard session         |
| Multi-tab admin sessions                     | Two tabs open, both show same draft queue — first tab sends, second tab shows stale list                                  | Use `useQuery` with `refetchOnWindowFocus: true` (tRPC React Query default) and ensure mutation invalidates shared queries     |
| Deep links from dashboard to prospect detail | Dashboard links to `/admin/prospects/${id}#analysis` — fragment routing is client-side only, page loads on `evidence` tab | Phase 13 implementation uses `useState('evidence')` — hash-based deep linking requires reading `window.location.hash` on mount |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap                                                                                                        | Symptoms                                                           | Prevention                                                                                                                                 | When It Breaks                    |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| `getActionQueue` runs 4 parallel queries each fetching up to 50 records with full contact+prospect includes | Dashboard loads slowly as prospect count grows                     | Add `select` clauses to limit fields fetched — currently fetches entire contact records when only `companyName` and `domain` are displayed | At ~500 active outreach records   |
| Campaign funnel query fetches all contacts and sequences per prospect to derive stage                       | `getCampaignFunnel` slow as contacts per prospect grows            | Move funnel stage derivation to a DB view or materialized column rather than application-side computation                                  | At ~1000 contacts per campaign    |
| `bulkApproveLowRisk` loops sequentially through drafts calling `sendOutreachEmail` per draft                | Approval of 20 drafts takes 20 × network round-trip time to Resend | Batch the Resend API calls or run with `Promise.all` with concurrency limit (3-5 simultaneous)                                             | At 20+ drafts in a bulk approval  |
| All sections mounted on prospect detail page loads 4 queries simultaneously                                 | Each prospect open fires 4 parallel DB queries                     | Convert inactive sections to lazy-mounted (only mount when tab is first clicked, then keep mounted)                                        | At ~100 concurrent admin sessions |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake                                                            | Risk                                                                        | Prevention                                                                                                  |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Adding client-acknowledgment endpoint without prospect-scoped auth | Any public user who knows the slug can mutate hypothesis display state      | Create `prospectProcedure` that validates slug ownership before any write                                   |
| One-click send endpoint without idempotency key                    | Duplicate emails to same prospect — relationship damage, spam reports       | Add optimistic-lock status transition (`draft → sending`) before calling Resend                             |
| Exposing `admin.getActionQueue` data in client-facing pages        | Admin outreach context (company analysis, internal notes) leaks to prospect | Keep `adminProcedure` on all queue endpoints — never downgrade to `publicProcedure` for admin routes        |
| Deep link to prospect detail includes `id` in URL                  | Prospect ID is a cuid — low risk but not semantic; readable slug is better  | Already partially solved with `readableSlug` for `/voor/` — admin internal URLs using raw id are acceptable |

---

## UX Pitfalls

Common user experience mistakes in this domain's admin console redesign.

| Pitfall                                                                    | User Impact                                                           | Better Approach                                                                                  |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Approval button active while mutation is in-flight                         | Admin clicks twice, sees confusing error or sends twice               | Disable button on first click, re-enable only on error, never on success (row should disappear)  |
| Research quality gate with no "proceed anyway" option                      | Admin blocked indefinitely on thin-evidence prospects                 | Always provide override path with a warning: "Research is thin — proceed anyway?"                |
| Pipeline funnel shows percentages at early stage when denominator is tiny  | "100% booked rate" when only 1 prospect has been emailed — misleading | Hide percentage metrics until denominator ≥ 5 prospects at that stage                            |
| Dashboard action queue mixes urgency levels without clear visual hierarchy | Admin misses overdue calls buried among normal drafts                 | Sort order: overdue first (red indicator), then by age; group by type with visual section breaks |
| One-click send shows no preview of what will be sent                       | Admin approves without seeing content — mistakes go out               | Show subject line and first 100 chars of body in the row before the send button                  |
| Stage transition not confirmed to admin after one-click action             | Admin unsure if action succeeded; may click again                     | Show inline success state ("Sent") on the row for 2 seconds before removing it from the queue    |

---

## "Looks Done But Isn't" Checklist

Things that appear complete in the UI but are missing critical backend pieces.

- [ ] **One-click send queue:** Often missing idempotency guard — verify that rapid double-clicks or multi-tab sessions cannot send the same email twice
- [ ] **Research quality gate:** Often missing exit conditions — verify that `maxRetries` counter exists in DB and "proceed anyway" override is implemented before shipping the gate UI
- [ ] **Pipeline stage visualization:** Often missing "send attempted vs. delivered" distinction — verify that funnel `emailed` count reflects Resend delivery confirmations, not just API acceptance
- [ ] **Dashboard deep links:** Often missing hash fragment handling — verify that `/admin/prospects/${id}#analysis` actually opens the Analysis section on load, not just the default Evidence section
- [ ] **Client-side hypothesis acknowledgment:** Often missing authorization scope — verify that any client-facing endpoint that reads or writes hypothesis data uses slug-scoped authorization, not admin auth
- [ ] **Cache invalidation after bulk send:** Often missing cross-router invalidation — verify that `bulkApproveLowRisk` success invalidates both `outreach.listDrafts` and `admin.getActionQueue` so count badges update
- [ ] **Empty state on quality gate:** Often shown as generic "No data" — verify that the gate distinguishes between "research not run yet", "research ran but thin", and "research sufficient" as three distinct states
- [ ] **Funnel stage after sequence closure:** Often not tested — verify that marking a sequence `CLOSED_LOST` correctly removes the prospect from `emailed` funnel stage, not from `replied` or `booked`

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall                                                 | Recovery Cost | Recovery Steps                                                                                                                                         |
| ------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Double-send email delivered to prospect                 | HIGH          | Contact prospect to apologize, mark sequence `CLOSED_LOST`, investigate `OutreachLog` for duplicate records and add idempotency guard                  |
| Research quality gate in infinite loop                  | MEDIUM        | Add `force_proceed` flag directly in DB for affected prospect, then fix exit conditions in code                                                        |
| Wrong funnel counts visible in campaign reporting       | LOW           | Funnel is read-only computed data — fix the query logic and refresh, no data migration needed                                                          |
| Client-side approval exposed unauthorized state changes | HIGH          | Immediately restrict endpoint to admin auth, audit all `WorkflowHypothesis` records for unauthorized status changes, revert affected records           |
| Dashboard deep link opens wrong section                 | LOW           | Add `useEffect` to read `window.location.hash` on mount and set `activeTab` accordingly                                                                |
| Bulk approve sends to blocked contacts                  | MEDIUM        | Resend accepts but bounces — check `contact.outreachStatus` filter in `bulkApproveLowRisk` includes `QUEUED` only, audit sent log for blocked contacts |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall                                         | Prevention Phase                              | Verification                                                                                      |
| ----------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Double-send race condition                      | Phase 16 (Draft Queue Redesign)               | Verify: rapid double-click on send button in dev tools does not produce two Resend API calls      |
| Hypothesis approval shift auth gap              | Phase 16 or any client-interaction phase      | Verify: unauthenticated POST to any hypothesis mutation endpoint returns 401                      |
| Research quality gate infinite loop             | Research quality gate phase (not yet planned) | Verify: prospect with 0 evidence items hits "proceed anyway" after 3 re-runs                      |
| Inflated funnel counts from draft-not-sent      | Phase 16 (Draft Queue Redesign)               | Verify: funnel `emailed` count matches Resend delivered count within 5%                           |
| UX redesign breaks mounted-section side effects | Phase 13 (shipped) — retroactive verification | Verify: opening prospect detail does not set `status: 'VIEWED'` without admin viewing the content |
| Authorization gap on client-facing procedures   | Any client-interaction phase                  | Verify: public slug URL cannot call any `adminProcedure` endpoint                                 |
| Pipeline stage backward transition on closure   | Phase 14 (shipped) — design constraint        | Verify: campaign funnel correctly decrements `emailed` count when sequence is closed              |
| Hash deep link not handled on page load         | Phase 16 or next prospect detail work         | Verify: `/admin/prospects/[id]#analysis` loads with Analysis section visible, not Evidence        |

---

## Sources

- Codebase analysis (direct): `server/routers/outreach.ts` (approveDraft, bulkApproveLowRisk, markSequenceStepAfterSend), `server/routers/admin.ts` (getActionQueue, getDashboardStats), `server/routers/campaigns.ts` (getCampaignFunnel, funnelStage derivation), `server/routers/hypotheses.ts` (setStatus mutation, authorization pattern), `app/admin/prospects/[id]/page.tsx` (hidden section pattern, activeTab state), `app/voor/[slug]/page.tsx` (hypothesis filter: status ACCEPTED only), `prisma/schema.prisma` (OutreachLog model, ResearchRun status enum)
- Project memory: Known issues — `commit 1ae3470` (404 pages skipped, thin evidence pool), session memory (user wants "autopilot with oversight", manual approval gates are the product differentiator)
- Engineering patterns: Optimistic locking via status-transition in distributed send queues; idempotency via pre-claim atomic writes; React mount lifecycle effects on always-mounted vs. lazy-mounted sections
- Domain knowledge: Sales automation UX — one-click approval queues require idempotency; B2B Dutch SMB evidence is structurally thin (minimal web presence); funnel arithmetic errors common when stage is derived from record presence not explicit state field

---

_Pitfalls research for: Qualifai v2.0 admin UX redesign — oversight console, research quality gating, client-side approval, one-click send queues, pipeline visualization_
_Researched: 2026-02-22_

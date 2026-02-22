# Architecture Patterns

**Domain:** Evidence-backed B2B outbound — admin oversight console, research quality gate, client-side hypothesis validation, unified send queue, prospect pipeline view
**Researched:** 2026-02-22
**Milestone:** v2.0 — Streamlined Flow

---

## Prior Architecture (v1.1 Research)

The original ARCHITECTURE.md (written for v1.1) documents the integration of SerpAPI deep crawl, UseCase model, proof matching, engagement triggers, and the cadence engine. Those patterns are now **implemented and live**. This document supersedes it for v2.0 planning purposes.

The key structural facts from that implementation that constrain v2.0:

- `ResearchRun` tracks status via `ResearchStatus` enum (PENDING → CRAWLING → EXTRACTING → HYPOTHESIS → BRIEFING → FAILED → COMPLETED)
- `WorkflowHypothesis` has `HypothesisStatus` enum: DRAFT | ACCEPTED | REJECTED — admin sets this via `hypotheses.setStatus`
- `OutreachLog` stores both email drafts (`status: 'draft'`) and manual touch tasks (`status: 'touch_open'`, `channel: 'call'|'linkedin'|'whatsapp'|'email'`)
- `getActionQueue` in admin router aggregates 4 parallel Prisma queries: DRAFT hypotheses + draft OutreachLogs + touch_open OutreachLogs + FOLLOW_UP received OutreachLogs
- Prospect detail page at `/admin/prospects/[id]` has 4 CSS-hidden sections: Evidence, Analysis, Outreach Preview, Results
- Client dashboard at `/voor/[slug]` shows only ACCEPTED hypotheses (server-side filter in `page.tsx`)

---

## v2.0 Feature Map

Five features must integrate with the existing architecture:

| Feature                           | Description                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------- |
| Admin oversight console           | Unified flow: enter prospect → review research → approve outreach → track       |
| Research quality gate             | Admin reviews research _sufficiency_ (not hypothesis content), can request more |
| Client-side hypothesis validation | Prospect validates hypotheses on /voor/ dashboard, not admin                    |
| One-click send queue              | Per-channel send buttons per row, one click per action                          |
| Prospect pipeline view            | Stage visibility across all prospects at a glance                               |

---

## Question 1: Where Does Research Quality State Live?

**Finding:** Add two fields to the existing `ResearchRun` model. No new table needed.

**Rationale:** Research quality is a property of a specific research run, not the prospect as a whole. A prospect can have multiple runs; each run may or may not pass the quality gate. The admin reviews a run and decides whether to proceed with hypothesis generation or request more evidence.

**Schema change (additive, no data migration needed):**

```prisma
model ResearchRun {
  // ... all existing fields unchanged ...

  // v2.0: Research quality gate
  qualityApproved   Boolean?  // null = not reviewed, true = approved, false = rejected
  qualityReviewedAt DateTime?
  qualityNotes      String?   // admin's reason if rejecting / requesting more
}
```

**Why not a new enum value on `ResearchStatus`?** The status enum tracks pipeline execution state (what the background job is doing). Quality approval is a human decision that can happen after COMPLETED. Mixing execution state with human approval state in one enum creates ambiguous transitions (e.g., COMPLETED → APPROVED or COMPLETED → REJECTED_QUALITY are meaningless to the pipeline). Separate Boolean is cleaner.

**Why not on `Prospect`?** The prospect may have multiple research runs. The admin needs to see which run passed quality, and the latest run's quality state drives what's available. Storing on ResearchRun allows the UI to show "Run 3 of 3 — approved" without ambiguity.

**Where the state is read:**

- `research.listRuns` query already includes the run; add `qualityApproved` to the select
- Prospect detail Analysis tab: show quality indicator next to each run
- `getActionQueue` in admin router: add a fourth query type — ResearchRuns that are COMPLETED but `qualityApproved IS NULL` — these are "runs needing quality review"

**New tRPC procedures (add to `researchRouter`):**

```typescript
approveQuality: adminProcedure
  .input(z.object({ runId: z.string(), notes: z.string().optional() }))
  .mutation(async ({ ctx, input }) => {
    return ctx.db.researchRun.update({
      where: { id: input.runId },
      data: {
        qualityApproved: true,
        qualityReviewedAt: new Date(),
        qualityNotes: input.notes ?? null,
      },
    });
  }),

rejectQuality: adminProcedure
  .input(z.object({ runId: z.string(), notes: z.string().optional() }))
  .mutation(async ({ ctx, input }) => {
    return ctx.db.researchRun.update({
      where: { id: input.runId },
      data: {
        qualityApproved: false,
        qualityReviewedAt: new Date(),
        qualityNotes: input.notes ?? null,
      },
    });
  }),
```

---

## Question 2: How Does "Request More Research" Work?

**Finding:** Reuse the existing `research.retryRun` procedure with an enhanced input, and add a dedicated `research.requestDeeper` procedure that spawns a new run with extended config.

**Current flow:** `research.retryRun` re-runs with the same `inputSnapshot` config (reusing `deepCrawl` flag and `manualUrls`). It deletes old evidence and hypotheses then calls `executeResearchRun` fresh.

**Problem:** "Request more research" needs to convey _what kind_ of additional research the admin wants — more URLs, deeper crawl, specific sources. Simply retrying with the same config produces the same thin results.

**Solution: New `research.requestDeeper` procedure:**

```typescript
requestDeeper: adminProcedure
  .input(z.object({
    runId: z.string(),
    additionalUrls: z.array(z.string().url()).default([]),
    deepCrawl: z.boolean().default(true),           // force deep crawl on retry
    notes: z.string().optional(),                   // admin's note on what to look for
  }))
  .mutation(async ({ ctx, input }) => {
    const existing = await ctx.db.researchRun.findUniqueOrThrow({
      where: { id: input.runId },
    });

    // Mark current run as requiring more research (not quality-approved)
    await ctx.db.researchRun.update({
      where: { id: input.runId },
      data: {
        qualityApproved: false,
        qualityNotes: input.notes ?? 'More research requested',
      },
    });

    // Merge additional URLs with any from the original snapshot
    const existingUrls = manualUrlsFromSnapshot(existing.inputSnapshot);
    const mergedUrls = [...new Set([...existingUrls, ...input.additionalUrls])];

    // Spawn a new run (does NOT delete the old run — keeps history)
    return executeResearchRun(ctx.db, {
      prospectId: existing.prospectId,
      campaignId: existing.campaignId ?? undefined,
      manualUrls: mergedUrls,
      deepCrawl: input.deepCrawl,
    });
  }),
```

**Key decisions:**

- **New run, not overwrite:** `retryRun` deletes old evidence and overwrites. For quality review, the admin may want to compare the original run to the new one. A new run preserves history and lets the admin see evidence count before/after.
- **`deepCrawl: true` by default on requestDeeper:** The likely reason research is insufficient is that the default fetch-only crawl returned 404s or thin pages (as documented in MEMORY.md). Deeper crawl is the logical next step.
- **No new background job infrastructure needed:** `executeResearchRun` is already async-capable; the existing callback route handles out-of-process execution if needed.

**UI integration:** In the Evidence section of prospect detail, show a "Request More Research" button when `qualityApproved === false` or when evidence count is below threshold. This calls `research.requestDeeper`.

---

## Question 3: Where Does Client-Side Hypothesis Approval Live?

**Finding:** Extend the existing `HypothesisStatus` enum with a new value and add a client-accessible tRPC procedure. No new table needed.

**Current state:** `HypothesisStatus` has `DRAFT | ACCEPTED | REJECTED`. Admin sets status via `hypotheses.setStatus`. The /voor/ dashboard shows only ACCEPTED hypotheses (server-side filter). The admin is expected to approve hypotheses on behalf of the prospect — which the v1.2 retrospective identified as wrong ("Hypothesis approval is in the wrong place").

**v2.0 change:** The prospect approves or rejects hypotheses on their /voor/ dashboard. The admin no longer approves hypothesis content; admin only approves research quality (Question 1).

**Schema change:**

```prisma
enum HypothesisStatus {
  DRAFT         // AI generated, not yet seen
  PENDING       // Shown to prospect on /voor/, awaiting their response
  ACCEPTED      // Prospect confirmed this pain point is real
  REJECTED      // Admin rejected (low confidence, wrong data)
  DECLINED      // Prospect said this doesn't apply to them
}
```

**Why add PENDING and DECLINED rather than reuse existing values?**

- PENDING distinguishes "sent to prospect but not yet responded" from DRAFT (not yet sent). This is needed for admin to know which hypotheses are awaiting prospect action.
- DECLINED is distinct from REJECTED — REJECTED means admin culled it, DECLINED means the prospect said it doesn't fit. Different signals for sales strategy.

**New tRPC procedure (public, no admin token):**

This needs to be callable from /voor/ without authentication. The existing wizard router handles unauthenticated requests via session slug. The same pattern applies:

```typescript
// Add to server/routers/wizard.ts (or new client-facing router)
validateHypothesis: publicProcedure
  .input(z.object({
    prospectSlug: z.string(),     // nanoid slug — proves caller is on the right page
    hypothesisId: z.string(),
    decision: z.enum(['ACCEPTED', 'DECLINED']),
  }))
  .mutation(async ({ ctx, input }) => {
    // Verify hypothesis belongs to the prospect with this slug
    const prospect = await ctx.db.prospect.findUnique({
      where: { slug: input.prospectSlug },
      select: { id: true },
    });
    if (!prospect) throw new TRPCError({ code: 'NOT_FOUND' });

    const hypothesis = await ctx.db.workflowHypothesis.findFirst({
      where: { id: input.hypothesisId, prospectId: prospect.id },
    });
    if (!hypothesis) throw new TRPCError({ code: 'NOT_FOUND' });

    return ctx.db.workflowHypothesis.update({
      where: { id: input.hypothesisId },
      data: { status: input.decision },
    });
  }),
```

**Security:** The prospectSlug acts as a capability token — knowledge of it proves access to that prospect's dashboard. This is the same security model already used for the /voor/ route (slug in URL = access granted). No additional auth needed.

**Admin flow change:** Admin no longer approves hypothesis content. Admin reviews research quality (Question 1). Once quality is approved, hypotheses are automatically marked PENDING and shown on the /voor/ dashboard. The admin's job is: enter prospect → approve research quality → track whether prospect validated hypotheses.

**Transition to PENDING:** When admin calls `research.approveQuality`, add logic to update all DRAFT hypotheses for that run to PENDING:

```typescript
// Inside approveQuality mutation, after updating ResearchRun:
await ctx.db.workflowHypothesis.updateMany({
  where: { researchRunId: input.runId, status: 'DRAFT' },
  data: { status: 'PENDING' },
});
```

**Dashboard display:** /voor/ dashboard shows hypotheses with status PENDING or ACCEPTED. DECLINED hypotheses are hidden. A "Does this apply to your team?" UI element on each hypothesis card triggers `validateHypothesis`.

---

## Question 4: How to Unify the Send Queue Across Channels?

**Finding:** A single query against `OutreachLog` with discriminated status values already covers all channels. The unification is a UI refactor plus one new procedure, not a data model change.

**Current state:** The send queue is fragmented:

- Email drafts: `outreachLog.status = 'draft'`, `channel = 'email'` → `outreach.getDecisionInbox`
- Touch tasks: `outreachLog.status = 'touch_open'`, `channel` ∈ {'call', 'linkedin', 'whatsapp', 'email'} → `outreach.getTouchTaskQueue`
- These are two separate queries, two separate UI sections

**Observation:** Both live in `OutreachLog`. The `channel` field discriminates email vs. non-email. The `status` field discriminates pending-send ('draft') from pending-action ('touch_open'). The data model is already unified — the UI just treats them separately.

**New unified query (`outreach.getSendQueue`):**

```typescript
getSendQueue: adminProcedure
  .input(z.object({
    limit: z.number().min(1).max(200).default(100),
  }).optional())
  .query(async ({ ctx, input }) => {
    const limit = input?.limit ?? 100;

    const items = await ctx.db.outreachLog.findMany({
      where: {
        status: { in: ['draft', 'touch_open'] },
        // Exclude internal system items if needed
      },
      orderBy: [
        // Overdue tasks first, then by creation date
        { createdAt: 'asc' },
      ],
      take: limit,
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            primaryEmail: true,
            primaryPhone: true,
            linkedinUrl: true,
            prospect: {
              select: { id: true, companyName: true, domain: true },
            },
          },
        },
        outreachSteps: { orderBy: { stepOrder: 'asc' }, take: 1 },
      },
    });

    // Enrich with risk classification for email drafts
    return items.map((item) => ({
      ...item,
      actionType: item.status === 'draft'
        ? 'send_email'
        : `do_${item.channel}`,  // 'do_call', 'do_linkedin', 'do_whatsapp', 'do_email'
      // Risk only applies to email drafts
      risk: item.status === 'draft' ? classifyDraftRisk(item) : null,
      isOverdue: item.status === 'touch_open'
        ? isDueDatePast(item.metadata)
        : false,
    }));
  }),
```

**Why not merge the existing procedures?** `getDecisionInbox` has risk classification logic; `getTouchTaskQueue` has overdue detection. The new `getSendQueue` merges both. The old procedures remain for backward compat but the new UI only uses `getSendQueue`. This is additive — no existing functionality breaks.

**One-click actions per row:** The UI renders a single row per OutreachLog item. Each row has exactly one primary action button:

| `actionType`  | Button Label  | Calls                                |
| ------------- | ------------- | ------------------------------------ |
| `send_email`  | "Send"        | `outreach.approveDraft({ id })`      |
| `do_call`     | "Mark Called" | `outreach.completeTouchTask({ id })` |
| `do_linkedin` | "Mark Done"   | `outreach.completeTouchTask({ id })` |
| `do_whatsapp` | "Mark Sent"   | `outreach.completeTouchTask({ id })` |
| `do_email`    | "Mark Sent"   | `outreach.completeTouchTask({ id })` |

All existing mutation procedures (`approveDraft`, `completeTouchTask`, `bulkApproveLowRisk`) remain unchanged.

**Bulk approve:** For low-risk email drafts, the existing `outreach.bulkApproveLowRisk` works. The new queue page can show a "Send All Low-Risk" button that calls this.

**Channel content preview:** Each row expands to show content preview. For email drafts, show subject + body preview. For touch tasks, show notes + due date. This is all present in the current OutreachLog data; it's a UI-only change.

---

## Question 5: What Pages Can Be Simplified or Removed vs. What Needs New Routes?

**Finding based on full page audit:**

### Pages to Remove

| Current Route                   | Reason to Remove                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `app/admin/hypotheses/page.tsx` | Hypothesis approval moving to client (/voor/). Admin no longer reviews hypothesis content. This page becomes unnecessary. |
| `app/admin/research/page.tsx`   | Research management merges into prospect detail (Evidence tab). Standalone research page has no unique value.             |
| `app/admin/briefs/page.tsx`     | Briefs (Call Prep / PDF) surface through prospect detail Outreach Preview tab. Standalone page is navigation dead-end.    |

**Before removing:** Confirm these pages are reachable from nav. From layout.tsx, nav has 6 items: Dashboard, Companies, Campaigns, Draft Queue, Use Cases, Signals. Hypotheses, Research, and Briefs are NOT in the nav — they are only reachable via direct URL or links from other pages. Removing them is low-risk.

### Pages to Modify

| Current Route                          | v2.0 Change                                                                                                                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/admin/page.tsx`                   | Add "Research Quality Review" section to action queue. Currently shows: hypotheses, drafts, tasks, replies. Add: completed research runs with `qualityApproved IS NULL`.      |
| `app/admin/outreach/page.tsx`          | Replace 4-tab view (Drafts Queue / Multi-touch Tasks / Replies / Sent History) with unified send queue. The "Drafts Queue" and "Multi-touch Tasks" tabs merge into one table. |
| `app/voor/[slug]/dashboard-client.tsx` | Add hypothesis validation UI — "Does this apply to your team?" per hypothesis card. Calls `validateHypothesis` mutation.                                                      |
| `app/admin/prospects/[id]/page.tsx`    | Replace Analysis tab hypothesis approval buttons with research quality gate. Admin now approves/rejects the _run_, not individual hypotheses.                                 |
| `app/admin/prospects/page.tsx`         | Add pipeline stage column showing research status / outreach stage per row. Currently shows status badge only.                                                                |

### New Routes Needed

| New Route                                      | Purpose                                                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `app/admin/prospects/page.tsx` → pipeline view | Not a new route — modify the existing prospects list page to show pipeline stage per row as a visual funnel (stage pill). |

No new top-level routes are needed. All v2.0 features integrate into existing page shells.

---

## Component Boundaries: v2.0

### New Components to Create

| Component                  | Location                                                  | Purpose                                                                                       | Consumes                                                                      |
| -------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `ResearchQualityGate`      | `components/features/prospects/research-quality-gate.tsx` | Shows evidence count, quality indicators, approve/reject buttons for a ResearchRun            | `research.approveQuality`, `research.rejectQuality`, `research.requestDeeper` |
| `HypothesisValidationCard` | `components/features/voor/hypothesis-validation-card.tsx` | Client-facing hypothesis card with "applies / doesn't apply" buttons                          | `wizard.validateHypothesis`                                                   |
| `SendQueueRow`             | `components/features/outreach/send-queue-row.tsx`         | Unified row for email draft or touch task — shows content, channel icon, single action button | `outreach.approveDraft` or `outreach.completeTouchTask`                       |
| `ProspectPipelineRow`      | `components/features/prospects/prospect-pipeline-row.tsx` | Row in prospects list with research stage + outreach stage pills                              | Admin prospect data                                                           |

### Components to Modify

| Component                   | Location                                             | Change                                                                                                                                |
| --------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `EvidenceSection`           | `components/features/prospects/evidence-section.tsx` | Embed `ResearchQualityGate` below evidence list. Show quality approval state for latest run.                                          |
| `AnalysisSection`           | `components/features/prospects/analysis-section.tsx` | Remove approve/reject buttons from hypothesis cards (admin no longer approves). Show PENDING/ACCEPTED/DECLINED status badges instead. |
| `DashboardClient`           | `app/voor/[slug]/dashboard-client.tsx`               | Wrap each hypothesis in `HypothesisValidationCard` when `status === 'PENDING'`.                                                       |
| `AdminDashboard` (page.tsx) | `app/admin/page.tsx`                                 | Add research quality review section using extended `getActionQueue`.                                                                  |

---

## Data Flow: v2.0 Oversight Console

### Flow 1: Research Quality Gate

```
Admin creates prospect (admin.createAndProcess)
    → Research pipeline runs automatically (executeResearchRun)
    → ResearchRun.status = COMPLETED
    → ResearchRun.qualityApproved = null (not yet reviewed)

getActionQueue now includes:
    → db.researchRun.findMany({
        where: { status: 'COMPLETED', qualityApproved: null }
      })
    → Returns as type: 'research_review' action items

Admin clicks "Research Quality Review" item
    → Navigates to /admin/prospects/[id] → Evidence tab
    → EvidenceSection shows ResearchQualityGate component
    → Admin sees: evidence count, source diversity, confidence scores

Admin approves quality:
    → research.approveQuality({ runId })
        → ResearchRun.qualityApproved = true
        → WorkflowHypothesis.updateMany({ status: DRAFT → PENDING })

Hypotheses now visible on /voor/[slug] dashboard
```

### Flow 2: Client-Side Hypothesis Validation

```
Prospect visits /voor/[slug]
    → Server loads hypotheses WHERE status IN ('PENDING', 'ACCEPTED')
    → DashboardClient renders HypothesisValidationCard per hypothesis

Prospect clicks "Applies to us" on a hypothesis
    → wizard.validateHypothesis({ prospectSlug, hypothesisId, decision: 'ACCEPTED' })
        → WorkflowHypothesis.status = ACCEPTED

Prospect clicks "Doesn't apply" on a hypothesis
    → wizard.validateHypothesis({ prospectSlug, hypothesisId, decision: 'DECLINED' })
        → WorkflowHypothesis.status = DECLINED
        → Hypothesis hidden from dashboard on next render

Admin sees in dashboard: prospect validated 2/3 hypotheses
    → ACCEPTED hypotheses drive outreach generation
```

### Flow 3: One-Click Send Queue

```
Outreach sequence generated → OutreachLog.status = 'draft'
Cadence engine fires → OutreachLog.status = 'touch_open'

Admin opens /admin/outreach
    → outreach.getSendQueue({ limit: 100 })
    → Returns unified list: email drafts + touch tasks, sorted by urgency

Admin sees row: "Pieter de Vries @ Agentuur BV — Send Email — [Risk: low]"
    → Clicks "Send"
    → outreach.approveDraft({ id })
    → Email sent, OutreachLog deleted

Admin sees row: "Pieter de Vries @ Agentuur BV — Call — [Overdue 2d]"
    → Makes the call
    → Clicks "Mark Called"
    → outreach.completeTouchTask({ id })
    → Cadence engine fires, schedules next step
```

---

## Schema Migration Plan

All changes are **additive** — no existing fields removed, no data migration needed for existing rows.

### Migration 1: ResearchRun quality fields

```sql
ALTER TABLE "ResearchRun" ADD COLUMN "qualityApproved" BOOLEAN;
ALTER TABLE "ResearchRun" ADD COLUMN "qualityReviewedAt" TIMESTAMP(3);
ALTER TABLE "ResearchRun" ADD COLUMN "qualityNotes" TEXT;
```

Existing rows: `qualityApproved = NULL` (not yet reviewed). The null state is the correct initial state — it means "admin has not yet reviewed this run."

### Migration 2: HypothesisStatus enum extension

```sql
ALTER TYPE "HypothesisStatus" ADD VALUE 'PENDING';
ALTER TYPE "HypothesisStatus" ADD VALUE 'DECLINED';
```

PostgreSQL `ADD VALUE` does not require a table rewrite. Existing DRAFT/ACCEPTED/REJECTED rows are unaffected.

**Prisma schema diff for HypothesisStatus:**

```prisma
enum HypothesisStatus {
  DRAFT
  PENDING    // NEW: shown to prospect, awaiting validation
  ACCEPTED
  REJECTED
  DECLINED   // NEW: prospect said it doesn't apply
}
```

No migration for PENDING rows — existing DRAFT hypotheses stay DRAFT until admin approves research quality (which transitions them to PENDING).

---

## Suggested Build Order

Dependencies flow strictly bottom-to-top. Each step is independently shippable.

### Step 1: Research Quality Gate (schema + backend)

**What:** Add `qualityApproved`, `qualityReviewedAt`, `qualityNotes` to ResearchRun. Add `research.approveQuality`, `research.rejectQuality`, `research.requestDeeper` tRPC procedures.

**Why first:** Everything else depends on this. The quality gate is the new entry point to the approval flow. Hypothesis status transition (Step 2) is triggered by `approveQuality`. The send queue (Step 4) only surfaces items that have passed the quality gate.

**Files to change:**

- `prisma/schema.prisma` — add 3 fields to ResearchRun
- `server/routers/research.ts` — add 3 new procedures
- `prisma/migrations/` — generate migration

**Test:** Run `research.approveQuality({ runId })`, verify ResearchRun updated, no side effects yet.

### Step 2: HypothesisStatus Extension + PENDING transition

**What:** Add PENDING and DECLINED to HypothesisStatus enum. Wire `approveQuality` to transition DRAFT → PENDING. Add `wizard.validateHypothesis` public procedure.

**Why second:** Depends on Step 1 (approveQuality must exist to trigger PENDING transition). PENDING hypotheses are the input to the /voor/ client validation UI (Step 3).

**Files to change:**

- `prisma/schema.prisma` — add PENDING, DECLINED to HypothesisStatus enum
- `server/routers/research.ts` — extend approveQuality to updateMany hypotheses
- `server/routers/wizard.ts` — add validateHypothesis public procedure
- `app/voor/[slug]/page.tsx` — update WHERE clause to include PENDING status

**Test:** Approve quality → verify hypotheses move to PENDING. Visit /voor/ → verify PENDING hypotheses visible. Call validateHypothesis → verify status changes.

### Step 3: Client-Side Hypothesis Validation UI

**What:** Build `HypothesisValidationCard` component. Integrate into `DashboardClient` for PENDING hypotheses. Show decision confirmation state.

**Why third:** Depends on Step 2 (PENDING status and validateHypothesis procedure). Pure UI work with no further backend deps.

**Files to change:**

- `components/features/voor/hypothesis-validation-card.tsx` — NEW
- `app/voor/[slug]/dashboard-client.tsx` — wrap hypotheses in validation card
- Update `/voor/` page query to pass hypotheses with status

**Test:** Visit /voor/ as prospect, validate a hypothesis, verify status persists on refresh.

### Step 4: Research Quality Gate UI (admin)

**What:** Build `ResearchQualityGate` component. Embed in EvidenceSection of prospect detail. Remove hypothesis approve/reject buttons from AnalysisSection. Update getActionQueue to include research_review items.

**Why fourth:** Depends on Steps 1-2 (backend procedures must exist). UI work, no further backend deps.

**Files to change:**

- `components/features/prospects/research-quality-gate.tsx` — NEW
- `components/features/prospects/evidence-section.tsx` — embed quality gate
- `components/features/prospects/analysis-section.tsx` — remove approve/reject buttons, add status badges
- `server/routers/admin.ts` (getActionQueue) — add research_review query
- `app/admin/page.tsx` — add research review section to dashboard

**Test:** Complete a research run. Verify it appears in action queue as research_review. Approve quality. Verify hypotheses move to PENDING. Verify they disappear from admin's analysis action queue.

### Step 5: Unified Send Queue

**What:** Add `outreach.getSendQueue` procedure. Build `SendQueueRow` component. Rewrite `/admin/outreach` page to use unified queue.

**Why fifth:** Depends on Steps 1-4 (send queue should only surface prospects that passed quality gate — enforce this in the query via join to ResearchRun.qualityApproved). Can be built incrementally as a view change.

**Files to change:**

- `server/routers/outreach.ts` — add getSendQueue procedure
- `components/features/outreach/send-queue-row.tsx` — NEW
- `app/admin/outreach/page.tsx` — replace 4-tab view with unified queue

**Test:** Create a draft OutreachLog and a touch_open OutreachLog. Call getSendQueue. Verify both appear in unified list. Complete each action. Verify correct mutation called.

### Step 6: Prospect Pipeline View

**What:** Add pipeline stage computation to `admin.listProspects`. Add stage pills to prospects list page.

**Why last:** Depends on all other steps being in place so the pipeline stages make sense. Pure UI + query enrichment. No schema changes.

**Files to change:**

- `server/routers/admin.ts` (listProspects) — include pipeline stage in response
- `app/admin/prospects/page.tsx` — add stage column to list
- `components/features/prospects/prospect-pipeline-row.tsx` — NEW (optional extraction)

**Pipeline stages computed from existing data:**

```
STAGE_IMPORTED    → Prospect exists, no ResearchRun
STAGE_RESEARCHING → ResearchRun.status in (PENDING, CRAWLING, EXTRACTING, HYPOTHESIS, BRIEFING)
STAGE_REVIEWING   → ResearchRun.status = COMPLETED, qualityApproved IS NULL
STAGE_READY       → qualityApproved = true, no OutreachLog with status='draft'
STAGE_SENDING     → OutreachLog.status = 'draft' exists
STAGE_ENGAGED     → Prospect.status in (VIEWED, ENGAGED)
STAGE_BOOKED      → OutreachSequence.status = BOOKED
```

This is fully derivable from existing columns — no new data needed.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Making HypothesisStatus Dual-Purpose

**What:** Reusing ACCEPTED to mean "client approved" and adding a separate `adminApproved` Boolean to WorkflowHypothesis.

**Why bad:** Splits the concept of "approved" across two fields. Queries become `WHERE status = 'ACCEPTED' AND adminApproved = true`, which is confusing and the two can get out of sync.

**Instead:** The status enum is the single source of truth. ACCEPTED = prospect confirmed. DECLINED = prospect rejected. Admin no longer has an approval role on individual hypotheses; their gate is at the run level (qualityApproved on ResearchRun).

### Anti-Pattern 2: New Table for Send Queue

**What:** Creating a `SendQueueItem` table that aggregates email drafts and touch tasks.

**Why bad:** OutreachLog already stores all this data. A secondary aggregation table would need to stay in sync with OutreachLog state changes, creating a dual-write problem. The existing status fields on OutreachLog (`'draft'` and `'touch_open'`) are the queue.

**Instead:** `getSendQueue` is a query view over OutreachLog with a multi-status WHERE clause. No new table.

### Anti-Pattern 3: Hypothesis Approval Gating Outreach Generation

**What:** Blocking `generateOutreach` unless at least one hypothesis is ACCEPTED by the prospect.

**Why bad:** The pipeline order is: quality gate → prospect sees PENDING hypotheses → prospect validates. But outreach generation (creating OutreachLog draft) happens before prospect validation — the admin sends the /voor/ link as part of the outreach. If outreach generation requires validated hypotheses, you have a circular dependency.

**Instead:** Outreach generation gates on `ResearchRun.qualityApproved = true` (admin approved research quality), not on hypothesis validation. Prospect validation of hypotheses is feedback that informs future outreach, not a prerequisite for the first send.

### Anti-Pattern 4: Removing Old Procedures Before New UI Ships

**What:** Deleting `getDecisionInbox` and `getTouchTaskQueue` when the new `getSendQueue` is built.

**Why bad:** Old procedures may be called from other parts of the UI (action queue dashboard, prospect detail Results tab). Removing them before verifying all consumers breaks the existing action queue.

**Instead:** Add `getSendQueue` as a new procedure. The new outreach page uses it. The old procedures remain until all consumers are migrated. Only then remove.

---

## Scalability Considerations

| Concern                                         | Current (< 100 prospects)   | At 500 prospects                              | At 5000 prospects                                           |
| ----------------------------------------------- | --------------------------- | --------------------------------------------- | ----------------------------------------------------------- |
| `getSendQueue` query                            | Single query, < 1ms         | Add index on `OutreachLog(status, createdAt)` | Paginate; the queue should not be > 200 items               |
| Research quality review items in getActionQueue | 4 parallel queries + 1 new  | Acceptable                                    | Add `@@index([status, qualityApproved])` on ResearchRun     |
| HypothesisStatus PENDING queries for /voor/     | Point lookup by prospectId  | Acceptable                                    | `@@index([prospectId, status])` already exists              |
| validateHypothesis (public endpoint)            | Low volume (1 per prospect) | Acceptable                                    | No rate limiting needed — slug is capability token          |
| Pipeline stage computation in listProspects     | O(n) derived fields         | Acceptable — derive in query                  | If slow, add materialized `pipelineStage` field to Prospect |

---

## Confidence Assessment

| Area                                           | Confidence | Notes                                                              |
| ---------------------------------------------- | ---------- | ------------------------------------------------------------------ |
| ResearchRun quality fields                     | HIGH       | Schema fully read; additive change, no migration complexity        |
| HypothesisStatus extension                     | HIGH       | PostgreSQL ADD VALUE is safe; existing rows unaffected             |
| validateHypothesis security model              | HIGH       | Matches existing /voor/ slug-as-capability pattern; read wizard.ts |
| getSendQueue unification                       | HIGH       | OutreachLog schema fully read; status values fully understood      |
| approveQuality → PENDING transition            | HIGH       | updateMany is a one-liner; pattern well established                |
| Pipeline stage derivation                      | HIGH       | All source fields exist and indexed                                |
| Pages to remove (hypotheses, research, briefs) | MEDIUM     | Not in nav; need to verify no remaining deep links before deleting |
| Build order dependencies                       | HIGH       | Each step tested before next proceeds                              |

---

## Sources

All sources are from reading the live codebase:

- `/home/klarifai/Documents/klarifai/projects/qualifai/prisma/schema.prisma` — full schema
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/admin.ts` — getActionQueue, listProspects, getProspect
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/research.ts` — startRun, retryRun, getRun
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/hypotheses.ts` — listByProspect, setStatus
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/outreach.ts` — getDecisionInbox, getTouchTaskQueue, approveDraft, bulkApproveLowRisk
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/sequences.ts` — list, get, getCadenceState
- `/home/klarifai/Documents/klarifai/projects/qualifai/app/admin/layout.tsx` — nav items (6 confirmed)
- `/home/klarifai/Documents/klarifai/projects/qualifai/app/admin/page.tsx` — current action queue dashboard
- `/home/klarifai/Documents/klarifai/projects/qualifai/app/admin/outreach/page.tsx` — current 4-tab outreach page
- `/home/klarifai/Documents/klarifai/projects/qualifai/app/admin/prospects/[id]/page.tsx` — prospect detail with 4 CSS-hidden sections
- `/home/klarifai/Documents/klarifai/projects/qualifai/app/voor/[slug]/dashboard-client.tsx` — client dashboard, hypothesis display
- `/home/klarifai/Documents/klarifai/projects/qualifai/.planning/MILESTONES.md` — v1.2 retrospective findings
- `/home/klarifai/Documents/klarifai/projects/qualifai/.planning/PROJECT.md` — v2.0 target features
- `/home/klarifai/Documents/klarifai/projects/qualifai/.planning/ROADMAP.md` — phase 16 context

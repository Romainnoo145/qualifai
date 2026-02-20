# Architecture Patterns

**Domain:** Evidence-backed B2B outbound — deep crawl pipeline, use cases catalog, engagement-driven cadence
**Researched:** 2026-02-20
**Milestone:** Adding SerpAPI + Playwright crawl, Use Cases model, smart proof matching, engagement-triggered multi-touch cadence

---

## Existing Architecture Baseline

Before mapping the new features, this is what exists and must be respected:

### Current Data Flow (Research Pipeline)

```
admin trigger
    → researchRouter.startRun
    → executeResearchRun() [lib/research-executor.ts]
        → ingestWebsiteEvidenceDrafts() [fetch + HTML parse]
        → generateEvidenceDrafts() [deterministic templates from company data]
        → ingestReviewEvidenceDrafts() [review URL ingestion]
        → dedupeEvidenceDrafts()
        → db.evidenceItem.create() x N (max 24)
        → evaluateQualityGate()
        → generateHypothesisDrafts()
        → generateOpportunityDrafts()
        → db.researchRun.update(COMPLETED)
```

### Current Data Flow (Proof Matching)

```
proofRouter.matchForRun
    → matchProofs() [lib/workflow-engine.ts]
        → loadProofCatalog() — reads JSON files from OBSIDIAN_INVENTORY_JSON_PATH / OBSIDIAN_CLIENT_OFFERS_JSON_PATH
        → scoreProof() — token overlap scoring
    → db.proofMatch.create() per hypothesis/opportunity
```

The proof catalog currently lives in flat JSON files on disk. ProofMatch records link to WorkflowHypothesis or AutomationOpportunity.

### Current Data Flow (Touch Task Queue)

```
outreachRouter.queueTouchTask
    → db.outreachLog.create({ status: 'touch_open', metadata: { kind: 'touch_task', priority, dueAt } })

outreachRouter.getTouchTaskQueue
    → db.outreachLog.findMany({ status: { in: ['touch_open', 'touch_done', 'touch_skipped'] } })
    → enriches with overdue flag from metadata.dueAt

outreachRouter.completeTouchTask
    → db.outreachLog.update({ status: 'touch_done' })
    → db.contact.update({ lastContactedAt })
```

Tasks are stored in OutreachLog with `kind: 'touch_task'` in metadata. No scheduling logic, no cadence state machine.

### Current Engagement Events

```
wizard-client.tsx (browser)
    → api.wizard.startSession    → WizardSession.create, Prospect.status = VIEWED
    → api.wizard.trackProgress   → WizardSession.update(currentStep, maxStepReached), Prospect.status = ENGAGED (at step 3+)
    → api.wizard.trackPdfDownload → WizardSession.update(pdfDownloaded), notifyAdmin()
    → api.wizard.trackCallBooked  → WizardSession.update(callBooked), Prospect.status = CONVERTED
```

Engagement events update WizardSession and Prospect.status but do NOT feed into the touch task queue or cadence logic.

---

## Integration Architecture: Four New Systems

### System 1: SerpAPI + Playwright Deep Crawl Pipeline

**Integration point:** Alongside `ingestWebsiteEvidenceDrafts()` in `lib/research-executor.ts`.

**Current problem:** `ingestWebsiteEvidenceDrafts()` does a plain fetch with 9-second timeout. JavaScript-rendered pages return empty body. SERPs and review sites block vanilla fetch. This limits evidence quality, especially for careers pages (Greenhouse, Workday) and review aggregators.

**New component:** `lib/enrichment/deep-crawler.ts`

This is a new file, not a modification of the existing web-evidence-adapter. It implements:

- SerpAPI queries for `"{companyName}" reviews`, `"{companyName}" job openings`, `"{domain}" site:trustpilot.com`
- Playwright headless browser for JavaScript-rendered pages that fail the plain fetch
- Falls back gracefully: if SerpAPI key is absent, skip; if Playwright fails, return fallback draft

```typescript
// lib/enrichment/deep-crawler.ts

export interface DeepCrawlResult {
  serpEvidence: EvidenceDraft[]; // From SerpAPI SERP results
  playwrightEvidence: EvidenceDraft[]; // From Playwright-rendered HTML
}

export async function deepCrawlProspect(
  prospect: ProspectForCrawl,
  options: { useSerpApi: boolean; usePlaywright: boolean },
): Promise<DeepCrawlResult>;
```

**How research-executor.ts changes:**

Add an optional `deepCrawl` flag to the `executeResearchRun` input. When true, call `deepCrawlProspect()` and merge its drafts into the evidence collection before deduplication. The existing 24-item cap and `dedupeEvidenceDrafts()` handle overflow automatically.

```
executeResearchRun()
    → [existing] ingestWebsiteEvidenceDrafts(researchUrls)
    → [existing] generateEvidenceDrafts(prospect, manualUrls)
    → [NEW]      deepCrawlProspect(prospect) → serpEvidence + playwrightEvidence
    → dedupeEvidenceDrafts([...reviewDrafts, ...websiteDrafts, ...baseDrafts, ...serpDrafts, ...playwrightDrafts])
    → .slice(0, 24)  ← cap still applies
```

**Prisma schema change:** None. The deep crawl outputs `EvidenceDraft[]` which persist to `EvidenceItem` through the existing create loop. The `metadata.adapter` field distinguishes origin (`'serp-api'` or `'playwright'`).

**Worker callback route:** The existing `app/api/internal/research/callback/route.ts` already accepts evidence payloads from external workers. If Playwright is moved to a separate worker process (recommended for memory isolation), it posts to this route with `x-worker-signature`. No route changes needed.

**New enum value for EvidenceSourceType:** Add `SERP_RESULT` to the Prisma enum. SerpAPI organic results are a distinct source type distinct from WEBSITE, warranting their own sourceType for quality gate evaluation.

---

### System 2: Use Cases Model + CRUD

**Integration point:** Replaces the flat JSON file proof catalog (`OBSIDIAN_INVENTORY_JSON_PATH`, `OBSIDIAN_CLIENT_OFFERS_JSON_PATH`) with a database-managed `UseCase` model.

**Current problem:** `matchProofs()` in `lib/workflow-engine.ts` reads JSON files from the filesystem via `readJsonSafe()`. This means proof content cannot be managed through the admin UI, requires filesystem access, and cannot be updated at runtime.

**New Prisma model:**

```prisma
model UseCase {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  title       String
  summary     String
  category    String          // 'workflow' | 'automation' | 'intake' | 'reporting' | etc.
  keywords    String[]        // pre-tokenized, replaces runtime toTokens()
  industry    String[]        // optional industry scoping
  isActive    Boolean  @default(true)
  isShipped   Boolean  @default(true)  // false = custom/planned
  sourceRef   String?          // original proofId from JSON migration
  externalUrl String?

  proofMatches ProofMatch[]

  @@index([isActive, isShipped])
  @@index([category])
}
```

**How ProofMatch changes:**

Add `useCaseId String?` foreign key to `ProofMatch`. The existing `proofId` field (String) stays for backwards compatibility with legacy JSON-backed matches. New matches from the database use `useCaseId`.

```prisma
model ProofMatch {
  // ... existing fields ...
  useCaseId   String?
  useCase     UseCase? @relation(fields: [useCaseId], references: [id], onDelete: SetNull)
}
```

**New router:** `server/routers/use-cases.ts`

```typescript
export const useCasesRouter = router({
  list:    adminProcedure ...   // filter by category, isActive, isShipped
  create:  adminProcedure ...
  update:  adminProcedure ...
  delete:  adminProcedure ...   // soft delete via isActive=false
  migrate: adminProcedure ...   // one-shot: reads JSON files, creates UseCase records
})
```

**How matchProofs() changes:**

Replace `loadProofCatalog()` (which reads files) with a database query. The function signature stays the same but the implementation shifts:

```typescript
// lib/workflow-engine.ts — matchProofs() becomes:
export async function matchProofs(
  db: PrismaClient, // ADD: db parameter
  query: string,
  limit = 4,
): Promise<ProofMatchResult[]>;
```

This is a breaking change to `matchProofs()` — all callers (currently only `server/routers/proof.ts`) must pass `ctx.db`. The proof router already has `ctx.db` available; the change is a one-liner at the call site.

**Admin UI:** New page `app/admin/use-cases/` with list + create/edit form. This is a standard CRUD page following the pattern of existing admin pages.

---

### System 3: Engagement Events Feeding Into Cadence Engine

**Integration point:** `server/routers/wizard.ts` (existing) → new cadence trigger logic.

**Current problem:** `trackProgress`, `trackPdfDownload`, and `trackCallBooked` update `WizardSession` and `Prospect.status` but do not trigger any outreach action. Engagement signals are not connected to the touch task queue.

**New concept:** Engagement events become cadence triggers. When a prospect engages (views wizard, downloads PDF), the cadence engine evaluates whether a follow-up touch task should be queued.

**New utility:** `lib/cadence/triggers.ts`

```typescript
export interface EngagementEvent {
  type: 'wizard_view' | 'wizard_step_3' | 'pdf_download' | 'email_open';
  prospectId: string;
  contactId?: string; // if known, from OutreachLog metadata
  metadata?: Record<string, unknown>;
}

export async function handleEngagementEvent(
  db: PrismaClient,
  event: EngagementEvent,
): Promise<void>;
```

This function checks whether an open touch task already exists for the prospect/contact, and if not, creates one with appropriate priority (pdf_download = high, wizard_view = medium).

**How wizard.ts changes:**

`trackPdfDownload` and `trackProgress` (at step 3) add a fire-and-forget call to `handleEngagementEvent()`:

```typescript
// server/routers/wizard.ts — trackPdfDownload mutation
await Promise.all([
  ctx.db.wizardSession.update({ ... }),
  // EXISTING: notifyAdmin(...)
  // NEW:
  handleEngagementEvent(ctx.db, {
    type: 'pdf_download',
    prospectId: session.prospectId,
  }).catch(console.error),
]);
```

**Email open tracking:** The `OutreachLog` model already has `openedAt DateTime?`. Resend webhooks can POST to a new route `app/api/webhooks/email-events/route.ts` that:

1. Matches the Resend message ID to an `OutreachLog` record (store `resendMessageId` in metadata at send time)
2. Sets `outreachLog.openedAt`
3. Calls `handleEngagementEvent()` with `type: 'email_open'`

No schema change to OutreachLog needed beyond noting `resendMessageId` in the metadata JSON field (already exists).

**Deduplication guard in handleEngagementEvent:** Before creating a touch task, query for existing open touch tasks for this prospect's contacts within the last N days. If one exists, skip. This prevents spam from repeated wizard visits.

---

### System 4: Cadence Engine Extending the Touch Task Queue

**Integration point:** Extends `outreachRouter` — does NOT replace the existing `queueTouchTask` / `getTouchTaskQueue` / `completeTouchTask`. The cadence engine sits above these primitives.

**Current state:** The touch task queue is manual. A human queues tasks via `queueTouchTask`. There is no automatic scheduling, no step sequencing, no engagement-driven next-step logic.

**New concept:** A `CadenceRule` configuration (not a database model — configuration-driven) maps prospect/contact state to the next touch. The cadence engine is called after engagement events and after touch task completion.

**New lib:** `lib/cadence/engine.ts`

```typescript
export interface CadenceState {
  prospectId: string;
  contactId: string;
  sequenceStatus: SequenceStatus;
  lastTouchAt: Date | null;
  touchCount: number;
  lastEngagementEvent: string | null;
  engagementScore: number; // 0-100, computed from WizardSession + OutreachLog events
}

export interface CadenceDecision {
  action: 'queue_touch' | 'wait' | 'close_lost' | 'escalate';
  channel: 'email' | 'call' | 'linkedin';
  priority: 'low' | 'medium' | 'high';
  dueAt: Date;
  reason: string;
}

export async function evaluateCadence(
  db: PrismaClient,
  state: CadenceState,
): Promise<CadenceDecision>;
```

**Cadence rules (configuration, not database):**

```
wizard_view (step 1-2) + no prior touch  → queue 'email' touch, medium, due +1 day
wizard_step_3 (engaged)                  → queue 'email' touch, high, due same day
pdf_download                             → queue 'call' touch, high, due +1 day
email_open + no reply within 3 days      → queue 'linkedin' touch, medium, due +3 days
touch_done (completed call) + interested → escalate to 'book_teardown', close sequence
touch_count >= 4 + no engagement         → action: 'close_lost'
outreachStatus = REPLIED + triage=later  → queue 'email' touch, low, due +deferDays
```

**How completeTouchTask changes:**

After marking a task done, call `evaluateCadence()` to determine the next step. If the decision is `queue_touch`, call `queueTouchTask` internally. This creates a chain.

```typescript
// outreachRouter.completeTouchTask — after db.outreachLog.update
const cadenceState = await buildCadenceState(ctx.db, task.contactId);
const decision = await evaluateCadence(ctx.db, cadenceState);
if (decision.action === 'queue_touch') {
  await ctx.db.outreachLog.create({
    /* touch task from decision */
  });
}
```

**buildCadenceState()** queries:

- `outreachLog` count for this contact (touchCount)
- `outreachLog` most recent sentAt (lastTouchAt)
- `wizardSession` maxStepReached, pdfDownloaded (engagement signals)
- `outreachSequence` status for this contact
- Derives `engagementScore` from: pdfDownloaded(+40) + maxStepReached\*5 + replyIntent bonuses

**What does NOT change:**

The existing `getTouchTaskQueue` query is unchanged. The cadence engine writes to the same `OutreachLog` table with `kind: 'touch_task'` in metadata. The admin UI queue view works without modification. The only addition is a new `kind: 'cadence_task'` value in metadata to distinguish engine-created tasks from manually queued ones.

---

## Component Boundaries After Integration

| Component                                | Responsibility                                                 | New vs Modified                  | Communicates With                       |
| ---------------------------------------- | -------------------------------------------------------------- | -------------------------------- | --------------------------------------- |
| `lib/enrichment/deep-crawler.ts`         | SerpAPI + Playwright crawl, returns EvidenceDraft[]            | NEW                              | research-executor.ts                    |
| `lib/research-executor.ts`               | Orchestrates research runs, merges evidence sources            | MODIFIED (add deepCrawl flag)    | deep-crawler.ts, workflow-engine.ts, db |
| `lib/workflow-engine.ts`                 | matchProofs() takes db parameter                               | MODIFIED (matchProofs signature) | db (UseCase queries)                    |
| `server/routers/use-cases.ts`            | CRUD for UseCase catalog                                       | NEW                              | db                                      |
| `server/routers/proof.ts`                | Passes ctx.db to matchProofs()                                 | MODIFIED (1 line)                | workflow-engine.ts                      |
| `lib/cadence/triggers.ts`                | Maps engagement events to cadence decisions                    | NEW                              | cadence/engine.ts, db                   |
| `lib/cadence/engine.ts`                  | Evaluates CadenceState → CadenceDecision                       | NEW                              | db, outreachLog primitives              |
| `server/routers/wizard.ts`               | Fires handleEngagementEvent after trackPdf/trackProgress       | MODIFIED (add calls)             | cadence/triggers.ts                     |
| `server/routers/outreach.ts`             | completeTouchTask calls evaluateCadence after completion       | MODIFIED (add call)              | cadence/engine.ts                       |
| `app/api/webhooks/email-events/route.ts` | Resend email open/click webhook → engagement event             | NEW                              | cadence/triggers.ts, db                 |
| `prisma/schema.prisma`                   | UseCase model, ProofMatch.useCaseId FK, SERP_RESULT enum value | MODIFIED                         | —                                       |
| `app/admin/use-cases/`                   | CRUD UI for use cases catalog                                  | NEW                              | use-cases router                        |

---

## Data Flow After Integration

### Deep Crawl Research Run

```
Admin: research.startRun({ prospectId, deepCrawl: true })
    → executeResearchRun()
        → [existing] fetch-based ingestWebsiteEvidenceDrafts()
        → [NEW] deepCrawlProspect()
            → SerpAPI: query "{company} reviews" → SERP_RESULT evidence drafts
            → SerpAPI: query "{company} jobs {year}" → CAREERS evidence drafts
            → Playwright: render careers.{domain}.com → richer HTML → evidence drafts
        → dedupeEvidenceDrafts([all sources]).slice(0, 24)
        → [unchanged] hypothesis + opportunity generation
        → [unchanged] quality gate evaluation
```

### Proof Match (Database-Backed)

```
Admin: proof.matchForRun({ runId })
    → for each hypothesis:
        → matchProofs(ctx.db, queryText, 4)
            → db.useCase.findMany({ isActive: true })  ← database, not filesystem
            → scoreProof() using UseCase.keywords[]
            → db.proofMatch.create({ useCaseId: ... })  ← FK to UseCase
```

### Engagement → Cadence Chain

```
Prospect opens wizard email (Resend webhook)
    → POST /api/webhooks/email-events
        → find OutreachLog by resendMessageId in metadata
        → OutreachLog.openedAt = now()
        → handleEngagementEvent({ type: 'email_open', prospectId, contactId })
            → evaluateCadence(db, buildCadenceState())
                → decision: { action: 'queue_touch', channel: 'linkedin', dueAt: +3d }
            → db.outreachLog.create({ status: 'touch_open', metadata.kind: 'cadence_task' })

Admin views getTouchTaskQueue() → sees new linkedin task
Admin marks task complete via completeTouchTask()
    → [existing] status = 'touch_done', lastContactedAt updated
    → [NEW] evaluateCadence() called again
        → if touchCount >= 4 and no engagement: decision 'close_lost'
        → if contactStatus = REPLIED + triage = interested: decision 'escalate'
```

### Wizard PDF Download → High-Priority Call Task

```
Prospect clicks "Download Report" in wizard
    → api.wizard.trackPdfDownload({ sessionId })
        → WizardSession.pdfDownloaded = true
        → notifyAdmin() [existing]
        → [NEW] handleEngagementEvent({ type: 'pdf_download', prospectId })
            → evaluateCadence() → decision: { action: 'queue_touch', channel: 'call', priority: 'high', dueAt: +1d }
            → db.outreachLog.create({ touch_task, priority: 'high' })
```

---

## Suggested Build Order

Dependencies flow strictly from bottom to top. Each step is shippable and testable before the next.

### Step 1: UseCase Model + CRUD (Foundation for Proof)

**Why first:** The proof matching improvement (Step 2) and cadence scoring (Step 4) both depend on Use Cases being in the database. Migration from JSON files must happen before anything reads from the DB.

What to build:

- Add `UseCase` model to `prisma/schema.prisma`
- Add `useCaseId` FK to `ProofMatch`
- Write `server/routers/use-cases.ts` with CRUD procedures
- Write migration script: reads `OBSIDIAN_INVENTORY_JSON_PATH` + `OBSIDIAN_CLIENT_OFFERS_JSON_PATH` → creates UseCase records
- Add `useCasesRouter` to `server/routers/_app.ts`
- Build `app/admin/use-cases/` admin page

No changes to research pipeline or cadence. Proof matching still works via JSON files during this step.

### Step 2: DB-Backed Proof Matching

**Why second:** Depends on Step 1 (UseCase records must exist). Isolated change with clear test surface.

What to build:

- Modify `matchProofs()` in `lib/workflow-engine.ts` to accept `db` parameter
- Replace `loadProofCatalog()` with `db.useCase.findMany()`
- Update `server/routers/proof.ts` to pass `ctx.db` to `matchProofs()`
- Update `ProofMatch.create()` to set `useCaseId` when matched from DB

This is a pure swap — same behavior, different data source.

### Step 3: SerpAPI + Playwright Deep Crawl

**Why third:** Standalone. Does not depend on Use Cases or cadence. Can be developed and tested independently by adding evidence drafts to existing research runs.

What to build:

- Create `lib/enrichment/deep-crawler.ts` (SerpAPI client + Playwright launcher)
- Add `SERP_RESULT` to `EvidenceSourceType` enum in `prisma/schema.prisma`
- Add `deepCrawl?: boolean` input to `researchRouter.startRun`
- Modify `executeResearchRun()` to call `deepCrawlProspect()` when flag is set
- Add env vars: `SERPAPI_API_KEY`, `PLAYWRIGHT_TIMEOUT_MS`
- Update quality gate in `evaluateQualityGate()` to recognize SERP_RESULT as a valid source type

Test by running a research run with `deepCrawl: true` and inspecting evidence items. No downstream effects.

### Step 4: Engagement Event Triggers

**Why fourth:** Depends on the OutreachLog touch task primitives (already exist) but NOT on cadence engine (Step 5). Engagement events can queue tasks using the existing `db.outreachLog.create()` pattern before the full cadence engine exists.

What to build:

- Create `lib/cadence/triggers.ts` with `handleEngagementEvent()`
- Implement deduplication guard (check for existing open tasks)
- Modify `server/routers/wizard.ts`: `trackPdfDownload` and `trackProgress` (step >= 3) fire `handleEngagementEvent`
- Create `app/api/webhooks/email-events/route.ts` for Resend open/click webhooks
- At send time in `lib/outreach/send-email.ts`: store `resendMessageId` in OutreachLog metadata

At this point, engagement events create touch tasks without the full cadence state machine. Manually review the queue.

### Step 5: Cadence Engine

**Why fifth:** Builds on top of all previous steps. Uses UseCase engagement scoring signals, touch task primitives, and engagement event data from Step 4.

What to build:

- Create `lib/cadence/engine.ts` with `buildCadenceState()` and `evaluateCadence()`
- Define cadence rules as a configuration object (not database — config changes require deploy, which is acceptable for rule changes)
- Modify `outreachRouter.completeTouchTask` to call `evaluateCadence()` after marking done
- Upgrade `lib/cadence/triggers.ts` to use `evaluateCadence()` instead of hardcoded task creation
- Add `kind: 'cadence_task'` metadata flag to distinguish engine-created from manual tasks
- Admin UI: add cadence history view to `app/admin/outreach/` (show what the engine decided and why)

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Modifying matchProofs() to Accept Both File and DB Sources

**What:** Making `matchProofs()` conditionally read from files OR database based on env var.

**Why bad:** Creates a split-brain data source that's impossible to test reliably. During migration, you can't know which source is authoritative.

**Instead:** Migrate all use cases to the DB in Step 1. Once the migration script has run and is verified, remove the file-reading code entirely. The JSON file env vars (`OBSIDIAN_INVENTORY_JSON_PATH`) become dead config.

---

### Anti-Pattern 2: Making the Cadence Engine a Separate Database Model

**What:** Creating a `CadenceRule` Prisma model to store rules in the database, with admin UI to edit them.

**Why bad:** Cadence rules encode business logic and outreach strategy. Making them editable at runtime without deploy creates untested combinations. The rules are changed rarely and benefit from code review.

**Instead:** Configuration object in `lib/cadence/rules.ts`. Change rules via PR. The only state in the database is touch task history and engagement events — the inputs to the engine, not the engine itself.

---

### Anti-Pattern 3: Storing Playwright/SerpAPI Results Separately from EvidenceItem

**What:** Creating a `SerpResult` or `PlaywrightCrawl` model to cache raw crawl output.

**Why bad:** Adds complexity without benefit. Raw crawl output is intermediate data. What matters is the extracted evidence. The existing `EvidenceItem.metadata` JSON field is sufficient to store `adapter: 'serp-api'` or `adapter: 'playwright'` for provenance.

**Instead:** Deep crawl outputs `EvidenceDraft[]` just like all other adapters. The 24-item cap and deduplication handle overflow. If raw HTML caching is needed for debugging, store it in `metadata.rawHtml` truncated to 2000 chars.

---

### Anti-Pattern 4: Triggering Cadence on Every Wizard Step

**What:** Calling `handleEngagementEvent` on every `trackProgress` call.

**Why bad:** A prospect clicking through all 6 steps would create 6 separate touch tasks in minutes.

**Instead:** Only trigger on meaningful engagement thresholds: step >= 3 (the `ENGAGED` status transition that already exists), PDF download, and email open. One trigger per event type per prospect per 24 hours (deduplication guard in `handleEngagementEvent`).

---

## Scalability Considerations

| Concern           | Current (single prospect)             | At 100 prospects/day | At 1000 prospects/day                                                                                     |
| ----------------- | ------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------- |
| Research runs     | Synchronous in tRPC call, ~10-15s     | Acceptable           | Queue needed — use internal worker + callback route (already wired in app/api/internal/research/callback) |
| Playwright        | In-process, single browser            | Memory spike per run | Move to separate worker process; Next.js app only fires research jobs                                     |
| Proof matching    | DB query per hypothesis (3-5 per run) | Trivial              | Add `@@index([isActive, isShipped])` on UseCase (already in schema above)                                 |
| Cadence engine    | Called on task completion             | Acceptable           | Add DB index on `OutreachLog(contactId, status, createdAt)` for `buildCadenceState` queries               |
| Engagement events | Fire-and-forget with `.catch`         | Acceptable           | If email open volume becomes high (bulk sends), process via queue not webhook                             |

---

## Confidence Assessment

| Area                                       | Confidence | Notes                                                                                         |
| ------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------- |
| Integration points (research pipeline)     | HIGH       | Read source fully; insertion point is clear                                                   |
| Integration points (proof/use cases)       | HIGH       | matchProofs signature and proof.ts call site fully understood                                 |
| Integration points (wizard engagement)     | HIGH       | wizard.ts and WizardSession schema fully read                                                 |
| Integration points (touch task queue)      | HIGH       | outreach.ts completeTouchTask fully read                                                      |
| SerpAPI + Playwright implementation detail | MEDIUM     | API patterns standard; exact Playwright setup for Next.js App Router context needs validation |
| Cadence rule correctness                   | MEDIUM     | Rules are business logic; exact thresholds need validation with product owner                 |
| Migration of JSON → UseCase                | MEDIUM     | JSON file structure known from workflow-engine.ts; migration script straightforward           |

---

## Sources

- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/research-executor.ts` — read in full
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/workflow-engine.ts` — read in full
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/web-evidence-adapter.ts` — read in full
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/outreach.ts` — read in full
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/proof.ts` — read in full
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/research.ts` — read in full
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/wizard.ts` — read in full
- `/home/klarifai/Documents/klarifai/projects/qualifai/prisma/schema.prisma` — read in full
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/enrichment/service.ts` — read in full
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/outreach/reply-workflow.ts` — read in full
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/automation/processor.ts` — read in full
- `/home/klarifai/Documents/klarifai/projects/qualifai/app/discover/[slug]/wizard-client.tsx` — read in full
- `/home/klarifai/Documents/klarifai/projects/qualifai/app/api/internal/research/callback/route.ts` — read in full
- `/home/klarifai/Documents/klarifai/projects/qualifai/app/api/webhooks/inbound-reply/route.ts` — read in full
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/outreach/send-email.ts` — read in full
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/research-refresh.ts` — read in full

# Phase 10: Cadence Engine — Research

**Researched:** 2026-02-21
**Domain:** Multi-touch cadence state machine, Prisma schema migration, Next.js cron route, tRPC
**Confidence:** HIGH (all findings from direct codebase inspection; no new third-party libraries required)

---

## Summary

Phase 10 adds an engagement-driven cadence engine that automatically schedules and creates the next touch task after each touch is completed. This is a pure business-logic layer built on top of the existing `OutreachLog`/`OutreachStep`/`OutreachSequence` infrastructure from earlier phases.

The core challenge is schema: cadence scheduling timestamps currently live in JSON metadata (`metadata.dueAt`), which cannot be queried efficiently by a cron job. The plan calls for adding real DB columns to `OutreachStep` (`scheduledAt`, `triggeredBy`, `nextStepReadyAt`) so that a cron can do a simple `WHERE nextStepReadyAt <= NOW()` query. This is a focused Prisma migration — no new models, no new enums needed beyond what exists.

The cadence engine itself is a pure TypeScript function: `buildCadenceState` reads all completed/open touches for a sequence, and `evaluateCadence` decides what the next step should be and when. Engagement scoring (wizard depth, PDF download) gates the timing: a high-engagement prospect gets a shorter follow-up interval. The cron handler at `/api/internal/cron/cadence-sweep` follows the identical pattern of the existing research-refresh cron, authorized by `x-cron-secret` / `INTERNAL_CRON_SECRET`.

The UI requirement (CADNC-05) is a new "Cadence" tab or panel inside the outreach detail view for a prospect/contact. The pattern used is the same tab-switching approach seen in `app/admin/outreach/page.tsx` and `app/admin/prospects/[id]/page.tsx`.

**Primary recommendation:** No new dependencies. Extend `OutreachStep` with three DB columns, write the cadence engine in `lib/cadence/engine.ts`, wire `completeTouchTask` to call it, add a cron route, and render history in the existing outreach UI.

---

## Standard Stack

### Core (no new packages needed)

| Library            | Version            | Purpose                                               | Why Standard                                       |
| ------------------ | ------------------ | ----------------------------------------------------- | -------------------------------------------------- |
| Prisma             | ^7.3.0 (installed) | Schema migration, DB columns for cadence timestamps   | Already in project; migration pattern established  |
| tRPC               | 11.9.0 (installed) | Cadence state query endpoint, completeTouchTask hook  | All server state goes through tRPC in this project |
| Next.js App Router | 16.1.6 (installed) | Cron POST route at `/api/internal/cron/cadence-sweep` | Established pattern in project                     |
| TypeScript         | ^5 (installed)     | Cadence engine types, CadenceConfig, CadenceStep      | All business logic is typed                        |

### Supporting (no new packages)

| Library         | Version            | Purpose                                      | When to Use                                                        |
| --------------- | ------------------ | -------------------------------------------- | ------------------------------------------------------------------ |
| Zod             | ^4.3.6 (installed) | Validate cadence config schema, cron payload | Input validation on cron endpoint                                  |
| date arithmetic | native `Date`      | Calculate `scheduledAt + delayDays`          | No date library is used anywhere in the project — use plain `Date` |

### Alternatives Considered

| Instead of                        | Could Use                  | Tradeoff                                                                                                                             |
| --------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Plain `Date` arithmetic           | `date-fns` or `dayjs`      | Project uses no date library; adding one for simple +N days is not justified                                                         |
| Next.js cron route + Railway cron | BullMQ / pg-boss / Inngest | These require new infrastructure. The project already uses Next.js POST routes + Railway cron for research-refresh — stay consistent |
| New `CadenceStep` model           | Extending `OutreachStep`   | A new model would break the existing step/sequence graph. The roadmap explicitly says add columns to `OutreachStep`                  |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure

```
lib/cadence/
├── engine.ts          # buildCadenceState, evaluateCadence, CadenceConfig
└── engine.test.ts     # unit tests (vitest, same pattern as quality.test.ts)

app/api/internal/cron/
└── cadence-sweep/
    └── route.ts       # POST handler, mirrors research-refresh/route.ts

server/routers/
└── outreach.ts        # completeTouchTask now calls evaluateCadence after marking done
```

The cadence history UI panel lives inside the existing outreach page or prospect detail — no new page route needed.

### Pattern 1: DB Columns for Cron-Queryable Timestamps

**What:** Add `scheduledAt DateTime?`, `triggeredBy String?`, and `nextStepReadyAt DateTime?` columns to `OutreachStep`. The cron queries `WHERE nextStepReadyAt <= NOW() AND status = 'DRAFTED'`.

**Why:** The existing `metadata.dueAt` (JSON) pattern used in `OutreachLog` cannot be queried with a simple `WHERE` clause. Prisma's JSON path filter (`metadata: { path: ['dueAt'], equals: ... }`) exists but is not efficient for date range comparisons and does not support `lte` on DateTime-typed JSON values in PostgreSQL without casting. The roadmap decision locks this to real DB columns.

**Example migration:**

```sql
ALTER TABLE "OutreachStep"
  ADD COLUMN "scheduledAt"    TIMESTAMP(3),
  ADD COLUMN "triggeredBy"    TEXT,
  ADD COLUMN "nextStepReadyAt" TIMESTAMP(3);

CREATE INDEX "OutreachStep_nextStepReadyAt_idx" ON "OutreachStep"("nextStepReadyAt");
```

**Prisma schema addition:**

```prisma
model OutreachStep {
  // ...existing fields...
  scheduledAt     DateTime?
  triggeredBy     String?      // 'manual' | 'cadence' | TriggerSource
  nextStepReadyAt DateTime?

  @@index([nextStepReadyAt])
}
```

### Pattern 2: Cadence Engine — buildCadenceState + evaluateCadence

**What:** Two pure functions that read completed touches and decide on the next step.

**When to use:** Called by `completeTouchTask` (via tRPC) after a task is marked done, and by the cron sweep.

**Conceptual shape (to be defined precisely in PLAN):**

```typescript
// lib/cadence/engine.ts

export interface CadenceConfig {
  baseDelayDays: number;        // e.g. 3 — default interval between touches
  engagedDelayDays: number;     // e.g. 1 — interval when prospect is high-engagement
  maxTouches: number;           // e.g. 4 — after which, close_lost
  channels: ('email' | 'call' | 'linkedin' | 'whatsapp')[];
}

export interface CadenceState {
  touchCount: number;
  lastTouchAt: Date | null;
  nextChannel: 'email' | 'call' | 'linkedin' | 'whatsapp' | null;
  nextScheduledAt: Date | null;
  isExhausted: boolean;         // true when touchCount >= maxTouches
  engagementLevel: 'high' | 'normal';
}

export function buildCadenceState(
  completedTouches: Array<{ completedAt: Date; channel: string; stepOrder: number }>,
  engagementSignals: { wizardMaxStep: number; pdfDownloaded: boolean },
  config: CadenceConfig,
): CadenceState { ... }

export async function evaluateCadence(
  db: PrismaClient,
  sequenceId: string,
  config: CadenceConfig,
): Promise<{ created: boolean; stepId: string | null; scheduledAt: Date | null }> { ... }
```

**Key logic:**

- `engagementLevel = 'high'` when `wizardMaxStep >= 3 || pdfDownloaded`
- `delayDays = high ? engagedDelayDays : baseDelayDays`
- `nextChannel` is picked by rotating through `config.channels` based on `touchCount % channels.length`
- `isExhausted` when `touchCount >= maxTouches` — no new step created; sequence status set to `CLOSED_LOST`
- Creates a new `OutreachStep` with `stepOrder = touchCount + 1`, `scheduledAt = now`, `nextStepReadyAt = lastTouchAt + delay`, `triggeredBy = 'cadence'`

**IMPORTANT — thresholds need product owner sign-off:** The specific values for `baseDelayDays`, `engagedDelayDays`, `maxTouches`, and `channels` are locked as a prior decision: "Phase 10 cadence rule thresholds need product owner sign-off before implementation." The PLAN must include a step to get these values confirmed, or use conservative defaults with a config object that is easy to adjust without code changes.

### Pattern 3: completeTouchTask Wiring (CADNC-03)

**What:** After `completeTouchTask` marks an `OutreachLog` as `touch_done` and updates `lastContactedAt`, call `evaluateCadence` to schedule the next step.

**Where:** `server/routers/outreach.ts` — `completeTouchTask` mutation, at the end, after the contact update.

**Pattern (matching Phase 9 engagement trigger approach):**

```typescript
// At the end of completeTouchTask mutation, after contact update:
const sequenceId = metadataAsObject(task.metadata).outreachSequenceId;
if (typeof sequenceId === 'string' && sequenceId) {
  evaluateCadence(ctx.db, sequenceId, DEFAULT_CADENCE_CONFIG).catch(
    console.error,
  );
}
```

Fire-and-forget with `.catch(console.error)` — completing a task must never fail because the cadence engine errored.

**Gap to resolve:** Currently `queueTouchTask` and `createEngagementCallTask` do NOT store `outreachSequenceId` in metadata. The `completeTouchTask` wiring needs to know which sequence to advance. Two options:

1. Store `outreachSequenceId` in `OutreachLog.metadata` when creating cadence-driven tasks (cadence engine does this naturally when creating the next step).
2. The cron-based approach bypasses this: it queries `OutreachStep` directly by `nextStepReadyAt`.

**Recommendation:** The cadence engine should create `OutreachStep` records (not `OutreachLog` records) for scheduled future touches. The cron then promotes `OutreachStep` rows with due `nextStepReadyAt` into `OutreachLog` touch_task records. This keeps the touch task queue clean and queryable.

### Pattern 4: Cron Route — /api/internal/cron/cadence-sweep

**What:** POST endpoint that the Railway cron hits on schedule. Queries `OutreachStep WHERE nextStepReadyAt <= NOW() AND status = 'DRAFTED'`, creates `OutreachLog` touch tasks for each due step.

**Pattern (exact copy of research-refresh/route.ts):**

```typescript
// app/api/internal/cron/cadence-sweep/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { env } from '@/env.mjs';
import { processDueCadenceSteps } from '@/lib/cadence/engine';

function isAuthorized(req: NextRequest): boolean {
  const provided = req.headers.get('x-cron-secret') ?? '';
  const expected = env.INTERNAL_CRON_SECRET ?? env.ADMIN_SECRET;
  return provided.length > 0 && provided === expected;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: 'Unauthorized cron request' },
      { status: 401 },
    );
  }
  const result = await processDueCadenceSteps(prisma);
  return NextResponse.json({ success: true, ...result });
}
```

**Railway cron configuration:** Railway cron is set in the Railway dashboard as a service with a cron schedule (e.g. `0 * * * *` = hourly). It hits the Next.js POST endpoint with the secret in `x-cron-secret`. No `railway.toml` is present in the project — Railway config is done via the dashboard. The `INTERNAL_CRON_SECRET` env var already exists in `env.mjs`.

### Pattern 5: Cadence History UI (CADNC-05)

**What:** Admin sees cadence history and current cadence state for a prospect in the outreach detail view.

**Where:** Add a new view tab `'cadence'` to the existing view switcher in `app/admin/outreach/page.tsx` (which already has `'queue' | 'tasks' | 'replies' | 'sent'`), OR add a tab panel to the prospect detail page (`app/admin/prospects/[id]/page.tsx`).

**Recommended placement:** Prospect detail page tab (alongside existing `company | contacts | signals | wizard | research | hypotheses | lossmap | callprep`). This keeps cadence state scoped to a prospect, which matches the success criterion: "Admin can see the cadence history and current cadence state for any prospect in the outreach detail view."

**Data:** A new tRPC query `sequences.getCadenceState({ sequenceId })` or `outreach.getCadenceHistory({ prospectId })` that returns:

- List of completed `OutreachStep` records (stepOrder, channel, scheduledAt, sentAt/completedAt, triggeredBy)
- Current pending `OutreachStep` if any (nextStepReadyAt, channel)
- Cadence state summary (touchCount, engagementLevel, isExhausted)

### Anti-Patterns to Avoid

- **Storing scheduled timestamps only in JSON metadata:** Cannot be queried with `lte` in a cron sweep. Use real DB columns.
- **Blocking completeTouchTask on cadence evaluation:** If the cadence engine errors, the task completion should still succeed. Use fire-and-forget `.catch(console.error)` (same pattern as engagement triggers in Phase 9).
- **Hardcoding cadence thresholds in business logic:** Put them in a `CadenceConfig` object passed as a parameter so the planner can adjust values without hunting through logic.
- **Creating OutreachLog records directly in the cadence engine for future steps:** The engine should create `OutreachStep` records (scheduled, future), and the cron converts due steps into `OutreachLog` touch tasks. This preserves the existing model semantics.
- **Email opens triggering cadence escalation:** Explicitly forbidden by prior decision (Apple MPP false positives). The cadence engine must NOT read `openedAt` for scheduling decisions.

---

## Don't Hand-Roll

| Problem                       | Don't Build                                   | Use Instead                                                                               | Why                                                                                 |
| ----------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Cron scheduling               | Custom interval timer or setTimeout in server | Railway cron + Next.js POST route                                                         | Already established pattern in project (research-refresh)                           |
| Date arithmetic               | Custom duration library                       | Native `Date` + `getTime()` arithmetic                                                    | Project uses no date library; +N days is trivial                                    |
| Dedup guard for cadence tasks | Custom lock table                             | Query existing `OutreachStep` by `(sequenceId, stepOrder)` unique constraint              | The `@@unique([sequenceId, stepOrder])` constraint already exists on `OutreachStep` |
| Engagement state detection    | Separate engagement model                     | Read `WizardSession.maxStepReached` and `WizardSession.pdfDownloaded` from existing model | All engagement data is already in `WizardSession`                                   |

**Key insight:** Everything needed exists in the schema. The engine is a pure function over existing data — the only new infrastructure is the three DB columns on `OutreachStep` and the cron route.

---

## Common Pitfalls

### Pitfall 1: Cadence Creates Touch Tasks That Are Already Open

**What goes wrong:** If the cron runs twice before a touch is completed, it creates two open tasks for the same cadence step.

**Why it happens:** The cron queries `nextStepReadyAt <= NOW()` but doesn't check if a task was already created for that step.

**How to avoid:** When the cadence engine converts an `OutreachStep` into an `OutreachLog` touch task, it should also update the `OutreachStep.status` to something like `'QUEUED'` (or store the `outreachLogId` back on the step via the existing `outreachLog` relation). The cron then filters on `status = 'DRAFTED'` only, which prevents double-processing.

**Warning signs:** Duplicate touch tasks in the task queue for the same contact/channel.

### Pitfall 2: outreachSequenceId Not Linked on Engagement-Trigger Tasks

**What goes wrong:** `completeTouchTask` fires `evaluateCadence(sequenceId)` but the engagement-triggered call tasks (from Phase 9) have no `outreachSequenceId` in their metadata — they were created outside the sequence context.

**Why it happens:** `createEngagementCallTask` (Phase 9) creates `OutreachLog` records without a sequence link. When admin completes such a task, there is no `sequenceId` to advance.

**How to avoid:** The cadence engine should handle the case where `outreachSequenceId` is absent gracefully (skip cadence evaluation). Alternatively, Phase 10 can choose to advance cadence only for tasks that are linked to a sequence, and leave engagement-triggered orphan tasks as standalone. The research-refresh sweep (cron) handles the sequence-linked steps regardless.

**Warning signs:** Cadence evaluation silently no-ops for most tasks completed through the touch task queue.

### Pitfall 3: Cadence Thresholds Hard-Coded Before Product Sign-Off

**What goes wrong:** Planner writes `baseDelayDays = 3` directly in engine logic. After implementation, the threshold needs to change, requiring a code deploy.

**Why it happens:** Thresholds feel like constants, not config.

**How to avoid:** Always pass thresholds as a `CadenceConfig` parameter. Provide a `DEFAULT_CADENCE_CONFIG` constant that is clearly marked as "pending product owner confirmation" in comments. The PLAN must include a step for the product owner to confirm values before tasks are created.

**Warning signs:** Magic numbers (3, 4, 1, 2) scattered through engine.ts without a config object.

### Pitfall 4: Channel Rotation Without Skipping Unavailable Channels

**What goes wrong:** The engine schedules a LinkedIn touch for a contact with no `linkedinUrl`. The task is created but cannot be actioned.

**Why it happens:** Simple `touchCount % channels.length` rotation doesn't check contact data.

**How to avoid:** In `buildCadenceState`, filter `channels` based on contact data availability before rotating. If `linkedinUrl` is null, skip LinkedIn. If `primaryPhone` is null, skip WhatsApp and call. Email is always available if `primaryEmail` exists.

**Warning signs:** Touch tasks created for channels the contact doesn't support.

### Pitfall 5: Cron Auth Token Confusion

**What goes wrong:** Cron uses `ADMIN_SECRET` when `INTERNAL_CRON_SECRET` is not set, but the Railway cron service is configured with `INTERNAL_CRON_SECRET`. If the env var is renamed or missing, all cron calls return 401 silently.

**Why it happens:** The existing `isAuthorized` function fallbacks to `ADMIN_SECRET` if `INTERNAL_CRON_SECRET` is absent. This is correct behavior but requires Railway to send the same secret.

**How to avoid:** Match the pattern exactly from `research-refresh/route.ts` — identical auth function. Document which env var Railway should send in the cron service headers. No code change needed.

---

## Code Examples

### Example 1: OutreachStep Schema Addition

Source: Direct inspection of `/home/klarifai/Documents/klarifai/projects/qualifai/prisma/schema.prisma`

```prisma
model OutreachStep {
  id         String         @id @default(cuid())
  createdAt  DateTime       @default(now())
  updatedAt  DateTime       @updatedAt
  stepOrder  Int
  subject    String?
  bodyText   String
  bodyHtml   String?
  plannedAt  DateTime?
  sentAt     DateTime?
  status     SequenceStatus @default(DRAFTED)
  metadata   Json?

  // Phase 10: Cadence Engine columns
  scheduledAt     DateTime?    // When this step was scheduled by cadence engine
  triggeredBy     String?      // 'manual' | 'cadence' | 'wizard_step3' | 'pdf_download' | 'interested_reply'
  nextStepReadyAt DateTime?    // When the next step should be created (cron-queryable)

  sequenceId String
  sequence   OutreachSequence @relation(fields: [sequenceId], references: [id], onDelete: Cascade)
  outreachLogId String?
  outreachLog   OutreachLog? @relation(fields: [outreachLogId], references: [id], onDelete: SetNull)

  @@unique([sequenceId, stepOrder])
  @@index([outreachLogId])
  @@index([nextStepReadyAt])   // Phase 10: enables efficient cron query
}
```

### Example 2: Cron Query Pattern

Source: Direct inspection of `lib/research-refresh.ts` and `prisma/schema.prisma`

```typescript
// lib/cadence/engine.ts
export async function processDueCadenceSteps(db: PrismaClient) {
  const now = new Date();
  const dueSteps = await db.outreachStep.findMany({
    where: {
      nextStepReadyAt: { lte: now },
      status: 'DRAFTED',
    },
    include: {
      sequence: {
        include: {
          contact: {
            select: {
              id: true,
              primaryEmail: true,
              primaryPhone: true,
              linkedinUrl: true,
            },
          },
          prospect: { select: { id: true } },
        },
      },
    },
    take: 50,
    orderBy: { nextStepReadyAt: 'asc' },
  });

  // For each due step, create an OutreachLog touch_task and mark step QUEUED
  let created = 0;
  for (const step of dueSteps) {
    // ...create OutreachLog, update step.status to QUEUED
    created++;
  }
  return { processed: dueSteps.length, created };
}
```

### Example 3: Engagement Level Detection

Source: Direct inspection of `WizardSession` model and `engagement-triggers.ts`

```typescript
// Inside buildCadenceState or evaluateCadence
// WizardSession has: maxStepReached: Int, pdfDownloaded: Boolean
async function getEngagementLevel(
  db: PrismaClient,
  prospectId: string,
): Promise<'high' | 'normal'> {
  const session = await db.wizardSession.findFirst({
    where: { prospectId },
    orderBy: { createdAt: 'desc' },
    select: { maxStepReached: true, pdfDownloaded: true },
  });
  if (!session) return 'normal';
  if (session.maxStepReached >= 3 || session.pdfDownloaded) return 'high';
  return 'normal';
}
```

### Example 4: completeTouchTask Cadence Hook

Source: Direct inspection of `server/routers/outreach.ts` completeTouchTask mutation

```typescript
// At the end of completeTouchTask, after updating contact.lastContactedAt:
// (only if task is linked to a sequence)
const taskMetadata = metadataAsObject(task.metadata);
const sequenceId = taskMetadata.outreachSequenceId;
if (typeof sequenceId === 'string' && sequenceId) {
  // Fire-and-forget: never block task completion on cadence evaluation
  evaluateCadence(ctx.db, sequenceId, DEFAULT_CADENCE_CONFIG).catch(
    console.error,
  );
}
```

### Example 5: Cron Route Authorization (existing pattern)

Source: `/home/klarifai/Documents/klarifai/projects/qualifai/app/api/internal/cron/research-refresh/route.ts`

```typescript
function isAuthorized(req: NextRequest): boolean {
  const provided = req.headers.get('x-cron-secret') ?? '';
  const expected = env.INTERNAL_CRON_SECRET ?? env.ADMIN_SECRET;
  return provided.length > 0 && provided === expected;
}
```

---

## State of the Art

| Old Approach                                    | Current Approach                                    | When Changed | Impact                                                          |
| ----------------------------------------------- | --------------------------------------------------- | ------------ | --------------------------------------------------------------- |
| JSON metadata for scheduling (`metadata.dueAt`) | DB columns (`nextStepReadyAt DateTime?`)            | Phase 10     | Enables efficient `WHERE nextStepReadyAt <= NOW()` cron queries |
| Manual touch task creation (queueTouchTask)     | Cadence engine auto-creates next step on completion | Phase 10     | Removes manual scheduling burden for multi-touch sequences      |

**Deprecated/outdated:**

- `metadata.dueAt` on OutreachLog: still used for manually-queued touch tasks (queueTouchTask) but cadence-created steps use the new `OutreachStep.nextStepReadyAt` column. These are different records — OutreachLog for manual/current tasks, OutreachStep for scheduled future tasks.

---

## Open Questions

1. **Cadence rule thresholds (LOCKED — needs product owner sign-off)**
   - What we know: `baseDelayDays`, `engagedDelayDays`, `maxTouches`, `channels` are needed
   - What's unclear: The actual values. Prior decision says these need product owner confirmation before implementation
   - Recommendation: PLAN 10-02 must include a task "Get product owner to confirm threshold values" before implementing the engine. Use placeholder defaults (e.g., `baseDelayDays: 3, engagedDelayDays: 1, maxTouches: 4, channels: ['email','call','linkedin']`) that are clearly labeled as TBD in code comments.

2. **outreachSequenceId linkage for completeTouchTask hook**
   - What we know: Engagement-triggered tasks (Phase 9) have no `outreachSequenceId` in metadata. Cadence-created tasks will have it because they are linked `OutreachStep` records.
   - What's unclear: Whether completeTouchTask should also look up the sequence by contactId as a fallback (same pattern as `resolveSequenceIdForReply` in reply-workflow.ts)
   - Recommendation: In PLAN 10-03, implement a `resolveSequenceIdForTask(db, contactId, metadata)` helper that: (1) checks `metadata.outreachSequenceId`, (2) falls back to `OutreachSequence.findFirst({ where: { contactId }, orderBy: { updatedAt: 'desc' } })`. This matches the existing reply-workflow fallback.

3. **CadenceConfig source: hardcoded constant vs. database**
   - What we know: There is no `CadenceConfig` model in the schema. The roadmap says thresholds need sign-off.
   - What's unclear: Whether config should eventually be editable in-app or if a hardcoded constant is sufficient for Phase 10.
   - Recommendation: For Phase 10, hardcode as a `DEFAULT_CADENCE_CONFIG` constant in `lib/cadence/engine.ts`. Make it clearly named and easy to find. Database-backed config is deferred to a future phase if needed.

4. **Channel availability check granularity**
   - What we know: Contacts have `primaryEmail`, `primaryPhone`, `linkedinUrl`. WhatsApp needs `primaryPhone`. Call needs `primaryPhone`. LinkedIn needs `linkedinUrl`.
   - What's unclear: Whether the cadence engine should skip unavailable channels (fewer touches) or substitute a fallback channel.
   - Recommendation: Skip unavailable channels silently in `buildCadenceState` and rotate through available ones. Do not substitute. This is simpler and avoids surprising the admin with unexpected channel choices.

5. **Cadence UI placement: outreach page tab vs. prospect detail tab**
   - What we know: Success criterion says "admin can see cadence history and current cadence state for any prospect in the outreach detail view." The outreach page (app/admin/outreach/page.tsx) is a global view. The prospect detail page (app/admin/prospects/[id]/page.tsx) is per-prospect.
   - What's unclear: Whether "outreach detail view" means the outreach page or the prospect page.
   - Recommendation: Add cadence state to the prospect detail page as a new tab (`'outreach'` or `'cadence'`). This is per-prospect and matches the success criterion's "for any prospect" language. The outreach page can link to the prospect detail for cadence history.

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection — `prisma/schema.prisma` — OutreachStep, OutreachSequence, OutreachLog, WizardSession models
- Direct codebase inspection — `server/routers/outreach.ts` — queueTouchTask, completeTouchTask, getTouchTaskQueue patterns
- Direct codebase inspection — `lib/outreach/engagement-triggers.ts` — TriggerSource type, dedup pattern, metadata schema
- Direct codebase inspection — `lib/outreach/reply-workflow.ts` — resolveSequenceIdForReply fallback pattern
- Direct codebase inspection — `app/api/internal/cron/research-refresh/route.ts` — isAuthorized, POST handler pattern
- Direct codebase inspection — `lib/research-refresh.ts` — sweep function structure, result type
- Direct codebase inspection — `env.mjs` — INTERNAL_CRON_SECRET env var already exists

### Secondary (MEDIUM confidence)

- Phase 9 plan docs (09-02-PLAN.md) — fire-and-forget catch pattern for engagement triggers
- Prior decisions in phase description — email opens excluded, DB columns required, thresholds need sign-off

### Tertiary (LOW confidence)

- None — all findings are from direct codebase inspection

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages; confirmed by package.json inspection
- Architecture: HIGH — patterns directly observed in existing crons, routers, and engagement-triggers
- Schema: HIGH — Prisma schema and migration patterns are established in project
- Pitfalls: HIGH — derived from direct code inspection of gap between completion and sequence linkage
- Thresholds: LOW — product owner values are unknown; flagged as open question

**Research date:** 2026-02-21
**Valid until:** Stable for 60 days (no external dependencies; pure internal architecture)

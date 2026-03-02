# Phase 30: Pain Confirmation Gate + Override Audit — Research

**Researched:** 2026-03-02
**Domain:** Prisma schema migration, tRPC mutation, admin UI (badge + send queue signal + override form), pure computation logic
**Confidence:** HIGH

---

## Summary

Phase 30 closes the v2.2 milestone by wiring cross-source pain confirmation into the admin send decision flow and creating a permanent, queryable override audit trail. The phase has four discrete sub-problems: (1) compute `confirmedPainTags` / `unconfirmedPainTags` per workflowTag from live evidence items, (2) surface that signal alongside the existing quality gate in the send queue, (3) gate form submission on mandatory override reason when unconfirmed tags are present, and (4) persist every bypass in a new `GateOverrideAudit` table with a point-in-time snapshot.

The computation logic partially exists. `evaluatePainConfirmation` in `lib/workflow-engine.ts` already counts observed evidence and distinct pain tags globally, but it does not compute per-tag confirmation status (GATE-01 requires cross-source confirmation per workflowTag — evidence from 2+ distinct sourceTypes per tag). That function must be extended or a new sibling added: `computePainTagConfirmation`. The output feeds into `runSummaryPayload` so it is persisted in `ResearchRun.summary.gate` at research completion and re-computable on demand from live evidence items. The existing `QualityGateResult` interface will need `confirmedPainTags` and `unconfirmedPainTags` string arrays added.

The override audit is a new Prisma model (`GateOverrideAudit`) with no delete route — the record is immutable once written. The `approveQuality` mutation already enforces a 12-character minimum reason for amber gate bypasses; Phase 30 extends this pattern to pain gate bypasses and writes the permanent audit record. The "Bypassed" badge in the prospect list is computed from whether any `GateOverrideAudit` rows exist for the prospect's latest run, exposed via a new field in `admin.listProspects`. The override history panel in the research run detail view is a simple tRPC query on `GateOverrideAudit` filtered by `researchRunId`.

**Primary recommendation:** Extend `evaluateQualityGate` with per-tag cross-source confirmation; add `GateOverrideAudit` model to schema; extend `approveQuality` to write audit rows; add pain gate signal to send queue UI; add override reason textarea to send queue approval path; add "Bypassed" badge to prospect list.

---

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                             | Research Support                                                                                                                             |
| ------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| GATE-01 | System computes cross-source pain confirmation per workflowTag (count of distinct sourceTypes per tag)  | New `computePainTagConfirmation` function: group evidence by workflowTag, count distinct sourceTypes; confirmed = 2+ sourceTypes             |
| GATE-02 | Quality gate output includes `confirmedPainTags` and `unconfirmedPainTags` arrays                       | Extend `QualityGateResult` interface; populate in `evaluateQualityGate`; persist via `runSummaryPayload` in `ResearchRun.summary`            |
| GATE-03 | Pain confirmation gate is advisory-only (warning, not blocking) to accommodate thin-presence Dutch SMBs | Separate `painGatePassed` boolean from main `gate.passed`; `gate.passed` remains the only hard block; unconfirmed tags → warning signal only |
| GATE-04 | Send queue shows pain confirmation status alongside existing quality gate indicator                     | Add `painConfirmationSignal` field to `getDecisionInbox` response per draft item; render chip in outreach queue UI                           |
| GATE-05 | Admin must provide a reason when proceeding with outreach that has unconfirmed pain tags                | Client-side form validation: `unconfirmedPainTags.length > 0` → require non-empty reason textarea before enabling send button                |
| AUDT-01 | `GateOverrideAudit` model records every gate bypass with actor, timestamp, reason, and gate type        | New Prisma model with `id`, `createdAt`, `researchRunId`, `prospectId`, `gateType`, `reason`, `actor`, `gateSnapshot` (Json)                 |
| AUDT-02 | Override reason is mandatory in the UI when bypassing any gate                                          | Extend `approveQuality` tRPC mutation to accept `gateType` and write `GateOverrideAudit` row when bypass condition met                       |
| AUDT-03 | "Bypassed" badge appears in admin prospect list for prospects with overridden gates                     | Add `_count: { gateOverrideAudits: true }` to `admin.listProspects` include; render badge in `AllCompanies` component                        |
| AUDT-04 | Override history is visible on research run detail view                                                 | New tRPC query `research.listOverrideAudits({ runId })`; render in prospect detail page research section                                     |

</phase_requirements>

---

## Standard Stack

### Core (all already installed — no new packages needed)

| Library      | Version    | Purpose                      | Why Standard                                                          |
| ------------ | ---------- | ---------------------------- | --------------------------------------------------------------------- |
| Prisma       | `^7.3.0`   | Schema migration + DB access | Adds `GateOverrideAudit` model and relation columns to `ResearchRun`  |
| tRPC         | `11.9.0`   | API layer                    | Extends `research.approveQuality`, adds `research.listOverrideAudits` |
| zod          | `^4.3.6`   | Input validation             | Standard procedure input schema                                       |
| lucide-react | `^0.563.0` | Icons                        | `ShieldAlert`, `ShieldCheck`, `AlertTriangle` already used in project |
| Tailwind CSS | `^4`       | Styling                      | amber/red/green chip colour tokens established in quality-chip.tsx    |

### Supporting

| Library | Version   | Purpose      | When to Use                                                   |
| ------- | --------- | ------------ | ------------------------------------------------------------- |
| vitest  | `^4.0.18` | Unit testing | `computePainTagConfirmation` is pure — should have unit tests |

### Alternatives Considered

| Instead of                        | Could Use                                                  | Tradeoff                                                                                                              |
| --------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| New `GateOverrideAudit` table     | Store bypasses in `ResearchRun.qualityNotes` JSON          | Relational model is queryable, joinable, cannot be accidentally overwritten — matches STATE.md architectural decision |
| Per-tag computation at query time | Persist `confirmedPainTags` in `ResearchRun` schema column | JSON in `summary` is already the persistence layer for gate data; new schema column is overkill for current volumes   |
| Modal for override reason         | Inline textarea in send queue row                          | Inline is compact, consistent with project UI preference; no new dependency                                           |

**Installation:** None required — no new packages.

---

## Architecture Patterns

### Recommended Project Structure

Changes are additive. No new top-level files except the migration:

```
prisma/
  schema.prisma                         ← +GateOverrideAudit model, +relation on ResearchRun
  migrations/
    20260302_add_pain_gate_audit/
      migration.sql                     ← CREATE TABLE GateOverrideAudit

lib/
  quality-config.ts                     ← +PAIN_CONFIRMATION_MIN_SOURCES constant (= 2)
  workflow-engine.ts                    ← +computePainTagConfirmation(), extend QualityGateResult

server/routers/
  research.ts                           ← extend approveQuality, +listOverrideAudits query
  admin.ts                              ← extend listProspects include to count override audits

app/admin/
  outreach/page.tsx                     ← +pain confirmation signal in DraftQueue
  prospects/page.tsx                    ← +Bypassed badge in AllCompanies
  prospects/[id]/page.tsx               ← +override history section (lazy-loaded)
```

### Pattern 1: Cross-Source Pain Tag Confirmation

**What:** For each distinct `workflowTag` in the evidence set, count the number of distinct `sourceType` values that contributed evidence. A tag is "confirmed" if `distinctSourceTypes >= 2`.

**When to use:** Called inside `evaluateQualityGate` after existing evidence filtering; output appended to `QualityGateResult`.

**Example:**

```typescript
// In lib/workflow-engine.ts — new pure function
export function computePainTagConfirmation(items: EvidenceInput[]): {
  confirmedPainTags: string[];
  unconfirmedPainTags: string[];
} {
  // Group evidence by workflowTag, count distinct sourceTypes per tag
  const tagSourceTypes = new Map<string, Set<EvidenceSourceType>>();
  for (const item of items) {
    if (!PAIN_WORKFLOW_TAGS.has(item.workflowTag)) continue;
    if (isPlaceholder(item)) continue;
    const existing = tagSourceTypes.get(item.workflowTag) ?? new Set();
    existing.add(item.sourceType);
    tagSourceTypes.set(item.workflowTag, existing);
  }

  const confirmedPainTags: string[] = [];
  const unconfirmedPainTags: string[] = [];

  for (const [tag, sourceTypes] of tagSourceTypes) {
    if (sourceTypes.size >= PAIN_CONFIRMATION_MIN_SOURCES) {
      confirmedPainTags.push(tag);
    } else {
      unconfirmedPainTags.push(tag);
    }
  }

  // Tags with zero evidence are also unconfirmed (only relevant if hypothesis exists)
  return { confirmedPainTags, unconfirmedPainTags };
}
```

### Pattern 2: GateOverrideAudit Write

**What:** Every time the admin approves quality despite a gate warning (amber quality gate OR unconfirmed pain tags), write an immutable audit record.

**When to use:** Inside `research.approveQuality` mutation, after the existing 12-char reason guard.

**Example:**

```typescript
// In server/routers/research.ts — inside approveQuality mutation
if (input.approved && overrideReason.length >= 12) {
  // Determine which gates are being bypassed
  const painGatePassed =
    confirmedPainTags.length > 0 || unconfirmedPainTags.length === 0;
  const qualityGateBypassed = !gatePassed;
  const painGateBypassed = unconfirmedPainTags.length > 0;

  if (qualityGateBypassed || painGateBypassed) {
    await ctx.db.gateOverrideAudit.create({
      data: {
        researchRunId: input.runId,
        prospectId: run.prospectId,
        gateType:
          qualityGateBypassed && painGateBypassed
            ? 'quality+pain'
            : qualityGateBypassed
              ? 'quality'
              : 'pain',
        reason: overrideReason,
        actor: 'admin', // single-actor system; no user model
        gateSnapshot: toJson({ gate, confirmedPainTags, unconfirmedPainTags }),
      },
    });
  }
}
```

### Pattern 3: Pain Confirmation Signal in Send Queue

**What:** The `getDecisionInbox` query joins to the latest `ResearchRun.summary` and extracts `gate.unconfirmedPainTags` per prospect. Each draft item gets a `painConfirmationStatus` enrichment.

**When to use:** Inside `getDecisionInbox`, after the existing `classifyDraftRisk` call.

**Example:**

```typescript
// Augment draft items with pain confirmation status
const prospectIds = [...new Set(drafts.map((d) => d.contact.prospectId))];
const runsByProspect = await ctx.db.researchRun.findMany({
  where: { prospectId: { in: prospectIds }, status: 'COMPLETED' },
  orderBy: { createdAt: 'desc' },
  distinct: ['prospectId'],
  select: { prospectId: true, summary: true },
});
const runMap = new Map(runsByProspect.map((r) => [r.prospectId, r]));

// Inside draft mapping:
const run = runMap.get(draft.contact.prospectId);
const gate = (run?.summary as any)?.gate;
const unconfirmedPainTags: string[] = gate?.unconfirmedPainTags ?? [];
const confirmedPainTags: string[] = gate?.confirmedPainTags ?? [];
```

### Pattern 4: Client-Side Override Reason Gate

**What:** The send queue approval button is disabled until the admin has entered a reason when `unconfirmedPainTags.length > 0`. This is pure React state, no server involvement until submission.

**When to use:** In the DraftQueue component for each draft card where `unconfirmedPainTags.length > 0`.

**Example:**

```typescript
// In app/admin/outreach/page.tsx — inside draft card render
const requiresOverrideReason = draft.unconfirmedPainTags?.length > 0;
const [overrideReason, setOverrideReason] = useState('');
const canApprove = !requiresOverrideReason || overrideReason.trim().length >= 12;

<button
  disabled={!canApprove || approve.isPending}
  onClick={() => approve.mutate({ id: draft.id, overrideReason })}
>
  Send
</button>
```

### Anti-Patterns to Avoid

- **Blocking on unconfirmed pain:** GATE-03 is explicit: pain gate is advisory-only. Do NOT throw `PRECONDITION_FAILED` from the server for unconfirmed pain tags — enforce only on the client form, with the override reason as the escape valve.
- **Deleting GateOverrideAudit rows:** No delete route, no cascade delete from ResearchRun. The audit is permanent. Schema must NOT have `onDelete: Cascade` on the ResearchRun relation.
- **Re-computing pain tags at send time:** Pain confirmation is computed at research completion and persisted in `summary`. The send queue reads from `summary`, not from live evidence items. This keeps the send queue fast.
- **New schema column for pain gate status:** The STATE.md decision (2026-03-02) explicitly defers `painGatePassed` as a ResearchRun column. Use `ResearchRun.summary.gate.confirmedPainTags` for storage. Do not add `painGatePassed` or `painGateDetails` columns — that contradicts the deferred decision.
- **Separate override endpoint:** Integrate the audit write into the existing `approveQuality` mutation. No new mutation needed.

---

## Don't Hand-Roll

| Problem                 | Don't Build                | Use Instead                                    | Why                                                                      |
| ----------------------- | -------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------ |
| Immutable audit records | `isDeleted` flag on rows   | No delete route in tRPC + no cascade in schema | Deletion prevention at the API layer is sufficient at current scale      |
| Actor identity          | Full user/session model    | Hard-code `actor: 'admin'`                     | Single-actor admin system — no user model exists or is planned           |
| Pain tag enum           | Prisma enum or string enum | String literal stored in DB                    | `workflowTag` is already a plain string in EvidenceItem; keep consistent |

---

## Common Pitfalls

### Pitfall 1: GateOverrideAudit `onDelete` on ResearchRun relation

**What goes wrong:** If `GateOverrideAudit.researchRun` is defined with `onDelete: Cascade`, deleting a research run (e.g., on retry) would silently wipe the audit trail.
**Why it happens:** Prisma default cascade behavior is attractive for relational cleanup.
**How to avoid:** Set `onDelete: Restrict` or `onDelete: SetNull` on the `researchRunId` FK. Use `Restrict` if a run must never be deleted once it has audits; use `SetNull` if you want to allow orphaned audits.
**Recommendation:** Use `onDelete: Restrict` — this prevents accidental deletion and forces explicit handling if a run with audits needs to be removed.

### Pitfall 2: `computePainTagConfirmation` includes placeholder evidence

**What goes wrong:** Placeholder items (notFound=true, fallback=true, aiRelevance < 0.5) inflate the sourceType count for a tag, making a tag appear confirmed when it is not.
**Why it happens:** The raw `items` array passed to `evaluateQualityGate` includes placeholders.
**How to avoid:** Filter with `isPlaceholder(item)` (already exported from workflow-engine.ts) before counting sourceTypes. Also consider filtering by `isObservedEvidence(item)` for consistency with the existing pain confirmation logic.

### Pitfall 3: `unconfirmedPainTags` in send queue is stale after research re-run

**What goes wrong:** The send queue reads `unconfirmedPainTags` from the cached `summary` JSON. If research is re-run after drafts are created, the summary updates but the draft card still shows old pain confirmation status.
**Why it happens:** `getDecisionInbox` joins to the latest ResearchRun by prospect, so it will actually get the fresh summary — but only if the query uses `orderBy: { createdAt: 'desc' }, take: 1` (distinct by prospect).
**How to avoid:** Use `distinct: ['prospectId']` with `orderBy: { createdAt: 'desc' }` when fetching runs for the send queue. Verify this returns the latest run, not oldest.

### Pitfall 4: Multiple override records for the same approval event

**What goes wrong:** If `approveQuality` is called multiple times (double-click, retry), multiple audit rows are created.
**Why it happens:** No idempotency guard on the audit write.
**How to avoid:** Check if a `GateOverrideAudit` with the same `researchRunId` and `gateType` already exists before inserting — or use `upsert` with a unique constraint on `(researchRunId, gateType)`. Since a run can only be approved once (subsequent calls update the same ResearchRun row via `qualityApproved`), gate the audit write on `qualityApproved === null` from the pre-read.

### Pitfall 5: `PAIN_CONFIRMATION_MIN_SOURCES` should live in `quality-config.ts`

**What goes wrong:** If the constant is defined inline in `workflow-engine.ts`, it cannot be imported by client-safe modules.
**Why it happens:** `workflow-engine.ts` is a server-only module (imports `env`). `quality-config.ts` is the established client-safe constants module.
**How to avoid:** Define `export const PAIN_CONFIRMATION_MIN_SOURCES = 2` in `quality-config.ts`, import it into `workflow-engine.ts`.

### Pitfall 6: "Bypassed" badge count in `admin.listProspects` is expensive

**What goes wrong:** Adding a `_count: { gateOverrideAudits: true }` through a nested relation (Prospect → ResearchRuns → GateOverrideAudit) is complex because `_count` does not traverse two hops in Prisma.
**Why it happens:** Prospect does not have a direct relation to GateOverrideAudit.
**How to avoid:** Add a direct `prospectId` foreign key on `GateOverrideAudit` (not just `researchRunId`). Then `_count: { gateOverrideAudits: true }` works directly on Prospect. This is consistent with how `EvidenceItem` has both `researchRunId` and `prospectId`.

---

## Code Examples

### Extending QualityGateResult interface

```typescript
// lib/workflow-engine.ts
export interface QualityGateResult {
  passed: boolean;
  averageConfidence: number;
  sourceTypeCount: number;
  evidenceCount: number;
  reasons: string[];
  painConfirmation: {
    observedEvidenceCount: number;
    reviewsCount: number;
    jobsCount: number;
    contextCount: number;
    distinctPainTags: number;
    reasons: string[];
  };
  // Phase 30 additions:
  confirmedPainTags: string[]; // tags confirmed by 2+ distinct sourceTypes
  unconfirmedPainTags: string[]; // tags with evidence from only 1 sourceType (or 0)
}
```

### GateOverrideAudit Prisma model

```prisma
model GateOverrideAudit {
  id            String   @id @default(cuid())
  createdAt     DateTime @default(now())

  // What was bypassed
  gateType      String   // 'quality' | 'pain' | 'quality+pain'
  reason        String   // admin-entered text, min 12 chars
  actor         String   @default("admin")  // single-actor system

  // Point-in-time snapshot of the gate state at bypass time
  gateSnapshot  Json

  // Relations — prospectId for direct _count query from Prospect
  researchRunId String
  researchRun   ResearchRun @relation(fields: [researchRunId], references: [id], onDelete: Restrict)
  prospectId    String
  prospect      Prospect @relation(fields: [prospectId], references: [id], onDelete: Cascade)

  @@index([researchRunId])
  @@index([prospectId])
  @@index([createdAt])
}
```

### Migration SQL pattern (manual migration, consistent with project convention)

```sql
-- Phase 30: Pain Confirmation Gate + Override Audit

CREATE TABLE "GateOverrideAudit" (
  "id"            TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "gateType"      TEXT NOT NULL,
  "reason"        TEXT NOT NULL,
  "actor"         TEXT NOT NULL DEFAULT 'admin',
  "gateSnapshot"  JSONB NOT NULL,
  "researchRunId" TEXT NOT NULL,
  "prospectId"    TEXT NOT NULL,

  CONSTRAINT "GateOverrideAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GateOverrideAudit_researchRunId_idx" ON "GateOverrideAudit"("researchRunId");
CREATE INDEX "GateOverrideAudit_prospectId_idx"    ON "GateOverrideAudit"("prospectId");
CREATE INDEX "GateOverrideAudit_createdAt_idx"     ON "GateOverrideAudit"("createdAt");

ALTER TABLE "GateOverrideAudit"
  ADD CONSTRAINT "GateOverrideAudit_researchRunId_fkey"
  FOREIGN KEY ("researchRunId") REFERENCES "ResearchRun"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GateOverrideAudit"
  ADD CONSTRAINT "GateOverrideAudit_prospectId_fkey"
  FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
```

### listOverrideAudits tRPC query

```typescript
// server/routers/research.ts
listOverrideAudits: adminProcedure
  .input(z.object({ runId: z.string() }))
  .query(async ({ ctx, input }) => {
    return ctx.db.gateOverrideAudit.findMany({
      where: { researchRunId: input.runId },
      orderBy: { createdAt: 'asc' },
    });
  }),
```

### "Bypassed" badge in AllCompanies

```tsx
// In the prospect card, after existing QualityChip
{
  (prospect.researchRuns?.[0]?._count.gateOverrideAudits ?? 0) > 0 && (
    <span className="text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border bg-amber-50 text-amber-600 border-amber-100">
      Bypassed
    </span>
  );
}
```

But this requires `_count.gateOverrideAudits` on the ResearchRun. The better approach (using the direct `prospectId` FK on `GateOverrideAudit`) is to add `_count: { gateOverrideAudits: true }` directly to the Prospect include in `admin.listProspects`:

```typescript
// admin.listProspects include:
include: {
  _count: { select: { sessions: true, contacts: true, gateOverrideAudits: true } },
  // ...
}

// In the card:
{(prospect._count.gateOverrideAudits ?? 0) > 0 && (
  <span className="...">Bypassed</span>
)}
```

---

## Key Architectural Decisions from STATE.md

From the existing codebase architectural decisions (established 2026-03-02):

1. **GateOverrideAudit is a proper relational model** — not JSON in inputSnapshot. Enables querying, joining to prospect/user tables.
2. **Pain gate thresholds must be calibrated against 7 real prospects before writing constants** — run calibration SQL first. The `scripts/calibration-table.mjs` pattern shows how. For Phase 30, run a similar calibration query that counts distinct sourceTypes per workflowTag across all prospects to validate that `PAIN_CONFIRMATION_MIN_SOURCES = 2` is the right threshold.
3. **Schema migration (painGatePassed, painGateDetails on ResearchRun; GateOverrideAudit model) is deferred to Phase 30** — This confirms we DO add the migration in Phase 30. However, the STATE.md decision is to NOT add `painGatePassed`/`painGateDetails` as schema columns on ResearchRun — use `summary.gate.confirmedPainTags` instead.
4. **Pain gate is advisory-only** — AMBER quality gate remains the single hard block. Confirmed/unconfirmed tags are a second informational signal.

---

## State of the Art

| Old Approach                                          | Current Approach                                                 | When Changed | Impact                                                       |
| ----------------------------------------------------- | ---------------------------------------------------------------- | ------------ | ------------------------------------------------------------ |
| `evaluatePainConfirmation` returns global counts only | `computePainTagConfirmation` returns per-tag confirmation arrays | Phase 30     | Admin sees exactly which pain tags have cross-source backing |
| Quality gate override stored in `qualityNotes` string | Override stored in `GateOverrideAudit` table with full snapshot  | Phase 30     | Queryable, permanent, cannot be overwritten                  |
| Send queue has no pain signal                         | Send queue shows confirmed/unconfirmed tags per draft            | Phase 30     | Admin makes informed outreach decisions                      |

---

## Open Questions

1. **Should `unconfirmedPainTags` include tags from hypotheses that have no evidence at all?**
   - What we know: `computePainTagConfirmation` groups from evidence items; hypotheses have `workflowTag` via their title/problemStatement but no direct `workflowTag` field in schema.
   - What's unclear: Whether to derive expected tags from hypotheses and flag absent ones as unconfirmed.
   - Recommendation: Only compute from evidence items. Tags with no evidence simply don't appear in either list. Keep it simple — the planner can revisit if needed.

2. **Should the send queue show pain confirmation per-draft or per-prospect?**
   - What we know: Multiple drafts can exist per prospect. Each draft links to a contact which links to a prospect. Pain confirmation is per-prospect (from ResearchRun).
   - What's unclear: If prospect A has 3 drafts and 2 unconfirmed tags, should all 3 cards show the warning?
   - Recommendation: Yes — show per draft card. The same warning on all cards for that prospect is correct and expected.

3. **What is the `actor` field value in a single-actor system?**
   - What we know: No user model exists. `context.ts` only exposes `adminToken`.
   - Recommendation: Hard-code `actor: 'admin'`. This is correct for a single-actor system. The field exists for future multi-user compatibility.

---

## Validation Architecture

Nyquist validation is enabled (`workflow.research: true` in config.json — research-only workflow, no explicit nyquist_validation key). Checking the config: `{"workflow":{"research": true}}`. The key `nyquist_validation` is not present, so the Validation Architecture section is included as a best-practice guide for this phase.

### Test Framework

| Property           | Value                                           |
| ------------------ | ----------------------------------------------- |
| Framework          | vitest 4.0.18                                   |
| Config file        | `vitest.config.ts` (root)                       |
| Quick run command  | `npm test -- --run lib/workflow-engine.test.ts` |
| Full suite command | `npm test -- --run`                             |
| Estimated runtime  | ~5 seconds                                      |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                                           | Test Type          | Automated Command                               | File Exists?                    |
| ------- | ---------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------- | ------------------------------- |
| GATE-01 | `computePainTagConfirmation` returns correct confirmed/unconfirmed arrays          | unit               | `npm test -- --run lib/workflow-engine.test.ts` | ✅ (add tests to existing file) |
| GATE-02 | `evaluateQualityGate` includes `confirmedPainTags`/`unconfirmedPainTags` in output | unit               | `npm test -- --run lib/workflow-engine.test.ts` | ✅ (add tests to existing file) |
| GATE-03 | Pain gate does not set `gate.passed = false` when tags are unconfirmed             | unit               | `npm test -- --run lib/workflow-engine.test.ts` | ✅ (add tests to existing file) |
| GATE-04 | Send queue displays pain signal (UI behavior)                                      | manual             | Visual inspection in browser at /admin/outreach | ❌ manual-only                  |
| GATE-05 | Send button disabled without reason when unconfirmed tags present                  | manual             | Visual inspection — form behavior               | ❌ manual-only                  |
| AUDT-01 | `GateOverrideAudit` table exists with correct schema                               | integration/manual | Run DB migration, verify table                  | ❌ Wave 0 gap                   |
| AUDT-02 | Override reason persisted in audit table                                           | integration/manual | Trigger `approveQuality`, query DB              | ❌ manual-only                  |
| AUDT-03 | "Bypassed" badge renders for bypassed prospects                                    | manual             | Visual inspection in browser                    | ❌ manual-only                  |
| AUDT-04 | Override history visible on research run detail                                    | manual             | Visual inspection in browser                    | ❌ manual-only                  |

### Wave 0 Gaps (must be created before implementation)

- [ ] Test cases in `lib/workflow-engine.test.ts` — covers GATE-01, GATE-02, GATE-03 with fixture evidence items of varying sourceType diversity

_(AUDT requirements are integration/manual-only at this phase's scope — no automated test infrastructure needed.)_

---

## Sources

### Primary (HIGH confidence)

- Direct codebase analysis — `lib/workflow-engine.ts` lines 381-484 (`evaluatePainConfirmation`, `evaluateQualityGate`, `QualityGateResult`)
- Direct codebase analysis — `lib/quality-config.ts` (`computeTrafficLight`, constants, client-safe module pattern)
- Direct codebase analysis — `server/routers/research.ts` (`approveQuality` mutation, existing 12-char guard)
- Direct codebase analysis — `server/routers/admin.ts` (`listProspects` query structure, include patterns)
- Direct codebase analysis — `server/routers/outreach.ts` (`getDecisionInbox` query, `approveDraft` mutation)
- Direct codebase analysis — `prisma/schema.prisma` (all existing models, relation patterns, FK conventions)
- Direct codebase analysis — `prisma/migrations/20260222165000_add_quality_gate_fields/migration.sql` (manual migration pattern)
- Direct codebase analysis — `.planning/STATE.md` architectural decisions for Phase 30

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — GATE-01 through AUDT-04 requirement descriptions (authoritative for phase scope)

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all dependencies are already in package.json; no new libraries
- Architecture: HIGH — per-tag confirmation pattern is a direct extension of existing `evaluatePainConfirmation`; GateOverrideAudit mirrors established EvidenceItem dual-FK pattern
- Pitfalls: HIGH — derived from direct codebase analysis of FK conventions, placeholder filtering logic, and existing idempotency patterns

**Research date:** 2026-03-02
**Valid until:** 2026-04-01 (stable Prisma/tRPC/Next.js stack; 30-day validity is conservative)

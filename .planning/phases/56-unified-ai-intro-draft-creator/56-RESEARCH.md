# Phase 56 Research: Unified AI Intro Draft Creator

**Phase:** 56
**Goal:** Prospect detail uses the same AI engine as the outreach page — one path to generate intro emails, one path to create drafts, template engine removed
**Depends on:** Phase 55 (complete)
**Requirements:** PIPE-01, PIPE-05, CNSL-03, CNSL-04, CNSL-05
**Researched:** 2026-03-16

---

## Summary

Phase 56 is plumbing and cleanup. The AI engine (`generateIntroEmail`) already works and is production-tested. The problem is two disconnected flows coexist: the old template path (`assets.generate` → `WorkflowLossMap` → `assets.queueOutreachDraft` → `OutreachLog`) and the new AI path (used on the outreach page via `previewEmail` and `regenerateDraft`). This phase collapses them into a single atomic operation and deletes the template path.

Phase 55 already delivered: `loadProjectSender` consolidated to `lib/outreach/sender.ts`, and `OutreachContext` extended with optional `evidence[]` + `hypotheses[]`. Those foundations are ready to use.

---

## Current State (Pre-Phase-56)

### Two-Step Template Flow (to be eliminated)

```
Admin: "Generate Email" on prospect detail (outreach-preview-section.tsx)
    ↓
api.assets.generate mutation (server/routers/assets.ts)
    ↓
createWorkflowLossMapDraft() — template, no AI (lib/workflow-engine.ts)
    ↓
WorkflowLossMap created (emailBodyHtml/Text stored here)
    ↓
[Admin sees preview in outreach-preview-section.tsx — lossMap.emailBodyText]
    ↓
Admin: "Queue Draft" button
    ↓
api.assets.queueOutreachDraft mutation
    ↓
OutreachSequence + OutreachStep + OutreachLog(status=draft) created
    ↓
[Draft appears in /admin/outreach getDecisionInbox]
```

**Problem:** Two clicks, two mutations, template email not AI-generated, preview and queue content may diverge.

### files currently holding template-path code

| File                                                         | Template-path code to remove                                                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `server/routers/assets.ts`                                   | `generate` mutation (lines 43–192) — calls `createWorkflowLossMapDraft`, stores to `WorkflowLossMap`                                 |
| `server/routers/assets.ts`                                   | `queueOutreachDraft` mutation (lines 259–407) — creates `OutreachSequence` + `OutreachStep` + `OutreachLog` from a `WorkflowLossMap` |
| `server/routers/campaigns.ts`                                | `runAutopilot` path (lines 727–764) — also calls `createWorkflowLossMapDraft`                                                        |
| `components/features/prospects/outreach-preview-section.tsx` | Entire component — queries `api.assets.getLatest` (WorkflowLossMap), renders `lossMap.emailBodyText`, two-button flow                |
| `app/admin/contacts/[id]/page.tsx`                           | `api.assets.queueOutreachDraft.useMutation` (line 60), button at line 146                                                            |
| `lib/workflow-engine.ts`                                     | `createWorkflowLossMapDraft()` (line 1298) + `createOutreachSequenceSteps()` (line 1403)                                             |
| `lib/analysis/master-analyzer.ts`                            | `generateMasterAnalysis()` (line 565) — marked `@deprecated`, no active callers                                                      |

---

## Target State (Post-Phase-56)

### Unified AI Flow

```
Admin: "Generate Draft" on prospect detail (outreach-preview-section.tsx)
    ↓
api.outreach.generateIntroDraft mutation (OR renamed assets.generate)
    ↓
lib/outreach/generate-intro.ts:
  - Load WorkflowHypothesis (top 3, ACCEPTED/PENDING)
  - Load EvidenceItem (top 5, isApproved=true, by confidenceScore)
  - Load Project sender via loadProjectSender()
  - Build OutreachContext{ evidence[], hypotheses[], sender, discoverUrl }
  - generateIntroEmail(ctx) — Gemini Flash
  - Atomic: OutreachSequence + OutreachStep + OutreachLog(INTRO_EMAIL, draft)
    ↓
[Draft immediately in /admin/outreach AND prospect detail shows pending draft]
```

---

## What Needs to Be Built

### 56-01: lib/outreach/generate-intro.ts + OutreachLog.prospectId + assets.generate rewire

**New file:** `lib/outreach/generate-intro.ts`

This replaces the two-step `assets.generate + assets.queueOutreachDraft` path.

```typescript
export interface GenerateIntroOptions {
  prospectId: string;
  contactId: string;
  runId: string;
  db: PrismaClient;
}

export async function generateIntroDraft(
  opts: GenerateIntroOptions,
): Promise<{ sequenceId: string; draftId: string }>;
```

Inside it:

1. Fetch `prospect` (id, companyName, domain, industry, employeeRange, technologies, description, slug, readableSlug, projectId)
2. Fetch `contact` (id, firstName, lastName, jobTitle, seniority, department, primaryEmail, outreachStatus)
3. Fetch top 3 `WorkflowHypothesis` (ACCEPTED/PENDING, by confidenceScore desc) for runId — fall back to prospect-level if none on run
4. Fetch top 5 `EvidenceItem` by confidenceScore for runId, cap snippet to 200 chars
5. `loadProjectSender(db, prospect.projectId)` — from `lib/outreach/sender.ts`
6. Build `OutreachContext` with evidence + hypotheses from Phase 55 fields
7. `generateIntroEmail(ctx)` — already production-tested
8. Atomic DB create: `OutreachSequence` + `OutreachStep` + `OutreachLog`
   - `OutreachLog.metadata` must include `{ kind: 'intro_draft', evidenceBacked: true }`
   - `OutreachLog.prospectId` — NEW denormalized field (PIPE-05)
9. Update `Contact.outreachStatus` to QUEUED if currently NONE
10. Return `{ sequenceId, draftId }`

**Schema change:** Add `prospectId String?` to `OutreachLog`. Non-nullable not appropriate (old records have none). Index it.

```prisma
model OutreachLog {
  ...
  prospectId String?
  prospect   Prospect? @relation(fields: [prospectId], references: [id], onDelete: SetNull)

  @@index([prospectId])
}
```

Migration: `ALTER TABLE "OutreachLog" ADD COLUMN "prospectId" TEXT REFERENCES "Prospect"("id") ON DELETE SET NULL;`

**Rewire `assets.generate` mutation:**

- Replace `createWorkflowLossMapDraft()` call with call to `generateIntroDraft()`
- Input remains `{ runId }` (contactId should be added or derived from prospect's primary contact)
- **Decision needed:** The old `generate` mutation took only `runId` and derived contact from the prospect. The new path needs a `contactId`. Options:
  - Add `contactId` to the input
  - Auto-select best contact from the prospect (same scoring as `queueOutreachDraft`)
  - **Recommended:** Auto-select best contact (preserves one-click UX for prospect detail button)

**Update `outreach-preview-section.tsx`:**

- Remove `api.assets.generate` and `api.assets.queueOutreachDraft` mutations
- Add `api.outreach.generateIntroDraft` mutation (single button)
- Remove WorkflowLossMap email preview section
- Add `OutreachLog` draft preview for this prospect (query `OutreachLog` where `prospectId = prospectId`)
- Single "Generate Draft" button — collapses two into one
- Show generated draft subject/body inline if draft exists

**Update `app/admin/contacts/[id]/page.tsx`:**

- Remove `api.assets.queueOutreachDraft.useMutation` (line 60)
- Remove `api.assets.getLatest.useQuery` (line 56) — WorkflowLossMap query
- Replace with `api.outreach.generateIntroDraft.useMutation` if retaining per-contact generate

### 56-02: classifyDraftRisk update + delete template engine + v1 dead code

**Update `classifyDraftRisk` in `server/routers/outreach.ts`:**

Current logic requires `workflowLossMapId` for `riskLevel: 'low'`. Must change:

```typescript
// Current (breaks AI drafts):
const hasLossMap = typeof metadata.workflowLossMapId === 'string';
const isEvidenceReady = evidenceBacked && hasLossMap && hasCta;

// Target (AI-native):
const isAiGenerated =
  metadata.kind === 'intro_draft' ||
  metadata.kind === 'cadence_draft' ||
  metadata.kind === 'signal_draft';
const isEvidenceReady =
  evidenceBacked && (hasLossMap || isAiGenerated) && hasCta;
```

The `low` tier must be achievable for AI-generated drafts without a WorkflowLossMap.

**Delete `createWorkflowLossMapDraft()` from `lib/workflow-engine.ts`:**

- First: full grep for remaining references beyond `assets.ts` and `campaigns.ts`
- `campaigns.ts` `runAutopilot` also calls it — must be replaced or the autopilot path left as-is if campaigns are not in scope for this phase
- **Decision needed:** Is `campaigns.ts runAutopilot` in scope for Phase 56? The success criteria says "WorkflowLossMap template creation code (createWorkflowLossMapDraft, assets.generate template path) is deleted." This implies campaigns.ts must also be updated. However, `runAutopilot` is a batch operation — replacing it with the AI path may require more thought.
  - **Recommended:** Replace `createWorkflowLossMapDraft` in `campaigns.ts` with a call to `generateIntroDraft` per contact. Same pattern.
- Also delete `createOutreachSequenceSteps()` — only used by `assets.queueOutreachDraft`

**Delete `generateMasterAnalysis` v1 from `lib/analysis/master-analyzer.ts`:**

- Confirmed: no active callers (grep found only the function definition at line 565)
- Safe to delete the entire function (lines 555–636)
- The `MasterAnalysis`, `MasterAnalysisInput`, `AnalysisContext`, `AnalysisTrigger`, `AnalysisTrack`, `AnalysisKPI`, `TriggerCategory` types in `lib/analysis/types.ts` may also become dead — check callers after deletion
- Keep `validateMasterAnalysis()` check — determine if referenced anywhere after function deletion

**Delete `assets.queueOutreachDraft` mutation from `server/routers/assets.ts`:**

- All callers: `outreach-preview-section.tsx` (line 80) and `contacts/[id]/page.tsx` (line 60)
- Both will be removed in 56-02 UI cleanup

---

## Key Decisions Required Before Planning

### Decision 1: Where does `generateIntroDraft` live as a tRPC route?

**Option A:** Rename/replace `assets.generate` mutation in `server/routers/assets.ts`

- Keeps existing client call site pattern (`api.assets.generate`)
- Least disruptive to other components that may call `api.assets.generate`

**Option B:** New `outreach.generateIntroDraft` mutation in `server/routers/outreach.ts`

- Cleaner separation — `assets.ts` becomes PDF/metadata only
- Requires updating all UI call sites

**Recommended:** Option B (new mutation in `outreach.ts`). The `assets` router has always been about PDF/loss-map assets. Email generation belongs in `outreach.ts`. This matches the architecture: `outreach.previewEmail`, `outreach.regenerateDraft`, `outreach.generateIntroDraft` — all email generation in one router.

### Decision 2: How to select contact in `generateIntroDraft`?

`generate` currently takes only `runId`. The new path needs a `contactId`.

**Option A:** Require `contactId` in input (caller selects)

- More explicit, supports multi-contact prospects
- `outreach-preview-section.tsx` already has `firstContact` — just pass it

**Option B:** Auto-select best contact server-side from prospect

- One-click convenience for simple cases
- Requires re-implementing `scoreContactForOutreach` scoring in the mutation

**Recommended:** Option A. `outreach-preview-section.tsx` already has `prospect.contacts[0]`. Pass `contactId` explicitly. Simpler, more testable, consistent with `queueOutreachDraft` signature.

### Decision 3: What happens to `campaigns.ts runAutopilot`?

`runAutopilot` calls `createWorkflowLossMapDraft`. Three options:

1. Replace with `generateIntroDraft` — makes autopilot AI-native too (aligned with v8.0 goal)
2. Leave as-is, mark as deprecated — defer cleanup to a later phase
3. Remove the email-generation part from autopilot entirely

**Recommended:** Replace with `generateIntroDraft`. The autopilot path also violates PIPE-01. Keeping it creates a third parallel email system. Use the same `lib/outreach/generate-intro.ts` function — that's why it's extracted to a shared lib.

---

## classifyDraftRisk: Exact Change Required

Current code (outreach.ts lines 85–150):

```typescript
function classifyDraftRisk(draft: ...) {
  const metadata = metadataAsObject(draft.metadata);
  const evidenceBacked = metadata.evidenceBacked === true;
  const hasLossMap = typeof metadata.workflowLossMapId === 'string';  // ← problem line
  const body = `${draft.bodyText ?? ''}\n${draft.bodyHtml ?? ''}`;
  const hasCta = body.includes(CTA_STEP_1) && body.includes(CTA_STEP_2);
  const isEvidenceReady = evidenceBacked && hasLossMap && hasCta;     // ← requires lossMap
  ...
  if (priority.status === 'ready' && isEvidenceReady) {
    return {
      riskLevel: 'low' as const,
      riskReason: 'Evidence-backed draft with valid CTA and loss map',  // ← stale message
```

Required change: `isEvidenceReady` must be achievable without `workflowLossMapId`. The `kind` field in metadata (set by `generate-intro.ts`) distinguishes AI drafts from template drafts. A CTA-containing AI-generated draft should be `low` risk.

**Note:** The CTA check (`hasCta`) still uses `CTA_STEP_1` and `CTA_STEP_2`. These constants come from `workflow-engine.ts`. They must be preserved or the `classifyDraftRisk` CTA check must be updated to use a different signal for AI drafts. Check if AI-generated emails currently include `CTA_STEP_1`/`CTA_STEP_2` literal strings — they likely do NOT (the AI generates its own CTA). This means `hasCta` will be `false` for all AI drafts, making `isEvidenceReady` always false regardless of the `hasLossMap` fix.

**Resolution:** For AI-generated drafts (`kind: 'intro_draft'`), bypass the CTA text check entirely. Risk classification for AI drafts should be: `low` if `evidenceBacked === true`, contact is `ready`, and body is non-empty. The CTA check was a template-era guardrail that has no meaning for AI-generated prose.

---

## OutreachLog.prospectId: Schema + Migration

PIPE-05 requires direct prospect-to-draft queries. Current schema has no `prospectId` on `OutreachLog`.

**Schema addition:**

```prisma
model OutreachLog {
  ...
  prospectId String?
  prospect   Prospect? @relation(fields: [prospectId], references: [id], onDelete: SetNull)
  ...
  @@index([prospectId])
}
```

**Migration SQL:**

```sql
ALTER TABLE "OutreachLog" ADD COLUMN "prospectId" TEXT;
ALTER TABLE "OutreachLog" ADD CONSTRAINT "OutreachLog_prospectId_fkey"
  FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "OutreachLog_prospectId_idx" ON "OutreachLog"("prospectId");
```

**Backfill:** Existing OutreachLogs can optionally be backfilled via `contact.prospectId`. Not required for Phase 56 to work — new drafts will have `prospectId` set. Historical drafts will show `null` which is handled correctly by optional chaining in queries.

**Prisma model:** Add `Prospect.outreachLogs OutreachLog[]` relation in schema. This requires adding it to the Prospect model's relations section.

---

## `outreach-preview-section.tsx` Rewrite Plan

**Remove entirely:**

- `api.assets.getLatest.useQuery` (WorkflowLossMap query)
- `api.assets.generate.useMutation` (template generation)
- `api.assets.queueOutreachDraft.useMutation`
- WorkflowLossMap email preview section (the `lossMap.emailBodyText` display)
- PDF download link (optional — can keep if WorkflowLossMap PDF still accessible via separate route)

**Add:**

- `api.outreach.generateIntroDraft.useMutation` — single button
- Query for `OutreachLog` drafts for this prospect (by `prospectId`) — shows existing draft if present
- Display: show draft subject + body preview if draft exists, "Generate Draft" button if not

**New UI flow:**

1. If no draft exists: show "Generate Draft" button (disabled if no `latestRunId` or no contacts)
2. If draft exists: show draft subject/body preview + "View in Queue" link to `/admin/outreach`
3. On generate: mutate, show pending spinner, on success invalidate draft query
4. Keep Call Brief section (unaffected — still uses `api.callPrep`)
5. Keep Prospect Dashboard section (unaffected)

---

## Dead Code Deletion Checklist

Before deleting, run full reference audit:

```bash
# Template email fields on WorkflowLossMap
grep -r 'emailBodyHtml\|emailBodyText\|emailSubject' --include='*.ts' --include='*.tsx'

# createWorkflowLossMapDraft callers
grep -r 'createWorkflowLossMapDraft' --include='*.ts'
# Expected: assets.ts, campaigns.ts, workflow-engine.ts, workflow-engine.test.ts

# createOutreachSequenceSteps callers
grep -r 'createOutreachSequenceSteps' --include='*.ts'
# Expected: assets.ts (queueOutreachDraft), workflow-engine.ts

# queueOutreachDraft callers
grep -r 'queueOutreachDraft' --include='*.ts' --include='*.tsx'
# Expected: outreach-preview-section.tsx, contacts/[id]/page.tsx

# generateMasterAnalysis callers
grep -r 'generateMasterAnalysis' --include='*.ts'
# Expected: only master-analyzer.ts definition — no callers
```

**Delete order** (avoids breaking intermediate states):

1. Update `outreach-preview-section.tsx` first — removes UI callers of `queueOutreachDraft` + `assets.generate`
2. Update `contacts/[id]/page.tsx` — removes remaining `queueOutreachDraft` caller
3. Delete `assets.queueOutreachDraft` mutation — no callers remain
4. Replace `assets.generate` with `outreach.generateIntroDraft` in `assets.ts` — or delete and add new mutation
5. Replace `campaigns.ts runAutopilot` template path — no `createWorkflowLossMapDraft` callers remain
6. Delete `createWorkflowLossMapDraft()` + `createOutreachSequenceSteps()` from `workflow-engine.ts`
7. Delete `generateMasterAnalysis()` from `master-analyzer.ts`
8. Update `classifyDraftRisk` to remove `hasLossMap` requirement

**Types cleanup after deletion:**

- After deleting `generateMasterAnalysis`, check if these types in `lib/analysis/types.ts` become dead: `MasterAnalysis`, `MasterAnalysisInput`, `AnalysisTrigger`, `AnalysisTrack`, `AnalysisKPI`, `TriggerCategory`. Remove if no remaining callers.
- `workflow-engine.test.ts` imports `createWorkflowLossMapDraft` — delete the test cases for it.

---

## Files Touched in Plan 56-01

| File                             | Change Type | Description                                                                                        |
| -------------------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| `lib/outreach/generate-intro.ts` | CREATE      | Evidence-backed intro creator function                                                             |
| `prisma/schema.prisma`           | MODIFY      | Add `prospectId` to `OutreachLog`                                                                  |
| `prisma/migrations/...`          | CREATE      | Migration SQL for `prospectId` column                                                              |
| `server/routers/outreach.ts`     | MODIFY      | Add `generateIntroDraft` mutation                                                                  |
| `server/routers/assets.ts`       | MODIFY      | Replace `generate` mutation body with call to new path (or keep for backward compat and deprecate) |

## Files Touched in Plan 56-02

| File                                                         | Change Type        | Description                                                             |
| ------------------------------------------------------------ | ------------------ | ----------------------------------------------------------------------- |
| `components/features/prospects/outreach-preview-section.tsx` | REWRITE            | Remove WorkflowLossMap flow, add AI draft flow                          |
| `app/admin/contacts/[id]/page.tsx`                           | MODIFY             | Remove `queueOutreachDraft` mutation usage                              |
| `server/routers/outreach.ts`                                 | MODIFY             | Update `classifyDraftRisk`                                              |
| `server/routers/assets.ts`                                   | MODIFY             | Delete `queueOutreachDraft` mutation; update/deprecate `generate`       |
| `server/routers/campaigns.ts`                                | MODIFY             | Replace `createWorkflowLossMapDraft` in `runAutopilot`                  |
| `lib/workflow-engine.ts`                                     | PARTIAL DELETE     | Remove `createWorkflowLossMapDraft()` + `createOutreachSequenceSteps()` |
| `lib/analysis/master-analyzer.ts`                            | PARTIAL DELETE     | Remove `generateMasterAnalysis()` v1 function                           |
| `lib/analysis/types.ts`                                      | MODIFY (if needed) | Remove dead types after v1 function deletion                            |
| `lib/workflow-engine.test.ts`                                | MODIFY             | Remove `createWorkflowLossMapDraft` test cases                          |

---

## Pitfalls Specific to Phase 56

### Pitfall A: CTA check breaks all AI draft risk classification

`classifyDraftRisk` checks `body.includes(CTA_STEP_1)` — these are template-era literal strings that AI-generated emails do not contain. This makes `isEvidenceReady` permanently false for AI drafts regardless of fixing `hasLossMap`. Fix: for `kind: 'intro_draft'`, skip the CTA string check entirely.

### Pitfall B: `campaigns.ts runAutopilot` is a long function with multiple code paths

The `createWorkflowLossMapDraft` call is inside a large per-prospect loop in `runAutopilot`. Replacing it with `generateIntroDraft` makes the autopilot async per-AI-call (each prospect makes a Gemini API call). This was already true for hypothesis generation, so it is acceptable. Ensure error handling per-prospect is preserved.

### Pitfall C: `generate-intro.ts` must handle the hypothesis gate

`queueOutreachDraft` had an explicit hypothesis approval gate (throws `PRECONDITION_FAILED` if no ACCEPTED hypothesis). The new `generateIntroDraft` must replicate this gate or the Phase 7 invariant is broken. Add the same check.

### Pitfall D: Old WorkflowLossMap data in DB remains

Existing `WorkflowLossMap` records with `emailBodyHtml/Text` remain in the DB. The `assets.list`, `assets.getLatest`, `assets.getById`, `assets.exportPdf` queries still function. These are read-only queries for PDF access — they should be left intact. Only the email generation + queueing path is removed.

### Pitfall E: `outreach-preview-section.tsx` prop shape

The component currently takes `{ prospectId, prospect, latestRunId }` where `prospect` is typed as `any`. The rewrite needs to ensure `prospect.contacts[0]` is available (used for `firstContact.id` in the new `generateIntroDraft` call). Check what the parent page passes.

---

## Verification Criteria

1. Click "Generate Draft" on any prospect detail with a completed research run → `OutreachLog` with `status: 'draft'` created, `prospectId` set, `metadata.kind === 'intro_draft'`
2. That draft appears in `/admin/outreach` decision inbox
3. `classifyDraftRisk` returns `riskLevel: 'low'` for the new AI draft (not `'review'`)
4. `generateMasterAnalysis` is absent from `lib/analysis/master-analyzer.ts` (grep confirms)
5. `createWorkflowLossMapDraft` is absent from `lib/workflow-engine.ts` (grep confirms)
6. `assets.queueOutreachDraft` mutation is absent from `server/routers/assets.ts`
7. `npm run check` passes with zero type errors

---

## Implementation Notes

- Phase 55 already did: `loadProjectSender` in `lib/outreach/sender.ts`, `OutreachContext.evidence[]` + `OutreachContext.hypotheses[]`
- `generateIntroEmail()` is production-tested — do not modify it
- `OutreachContext` already handles the evidence/hypothesis enrichment in `buildIntroEmailPrompt()` from Phase 55
- The `OutreachSequence + OutreachStep + OutreachLog` atomic creation pattern already exists in `assets.queueOutreachDraft` (lines 319–406) — copy and adapt it into `generate-intro.ts`, adding `prospectId` to `OutreachLog.create`
- The `calBookingUrl` construction pattern is identical across `assets.ts` and `outreach.ts` — preserve it

---

_Research completed: 2026-03-16_
_Ready for planning: yes_

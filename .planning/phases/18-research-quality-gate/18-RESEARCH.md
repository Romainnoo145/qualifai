# Phase 18: Research Quality Gate — Research

**Researched:** 2026-02-22
**Domain:** Admin UI + Prisma schema + tRPC — quality scoring, traffic-light chips, hypothesis status re-modeling
**Confidence:** HIGH

---

## Summary

Phase 18 adds a traffic-light quality indicator (red/amber/green) to the admin prospect list and detail header, a drilldown breakdown, a "proceed with limited research" soft override, and read-only hypothesis status badges replacing the current admin approve/reject buttons.

The phase is primarily UI-and-schema work: the scoring logic itself (`evaluateQualityGate` in `lib/workflow-engine.ts`) already exists and already captures the three signals needed for traffic-light scoring — evidence count, average confidence, and source type diversity. What is missing is: (1) persisting the admin's quality review decision on `ResearchRun`, (2) adding two new `HypothesisStatus` enum values (`PENDING` and `DECLINED`) so hypotheses can represent client-side validation states, and (3) surfacing both in the admin UI.

The largest risk is the schema migration: adding two new values to the `HypothesisStatus` PostgreSQL enum requires a Prisma migration and a generation step. This is low-friction because both new values are purely additive — existing rows keep `DRAFT` / `ACCEPTED` / `REJECTED` defaults, and no existing query breaks.

**Primary recommendation:** Wire the existing `evaluateQualityGate` function output to a new computed helper (`computeTrafficLight`) that maps the gate result to `red | amber | green`, persist the admin review decision on `ResearchRun` via three nullable fields, and convert the `AnalysisSection` accept/reject buttons to read-only `HypothesisStatus` badges. No new libraries needed.

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library      | Version    | Purpose                     | Relevance                                                                      |
| ------------ | ---------- | --------------------------- | ------------------------------------------------------------------------------ |
| Prisma       | `^7.3.0`   | Schema migration, DB access | Adds 3 nullable columns to `ResearchRun`, 2 enum values to `HypothesisStatus`  |
| tRPC         | `11.9.0`   | API layer                   | New procedures: `research.approveQuality`, `research.listProspectsWithQuality` |
| zod          | `^4.3.6`   | Input validation            | Standard procedure input schema                                                |
| lucide-react | `^0.563.0` | Icon library                | `CircleDot`, `Circle`, or `CheckCircle2` for traffic-light chip                |
| Tailwind CSS | `^4`       | Styling                     | amber/red/green chip colour tokens already in use across codebase              |

### Supporting

| Library         | Version    | Purpose   | When to Use                                                                                   |
| --------------- | ---------- | --------- | --------------------------------------------------------------------------------------------- |
| `framer-motion` | `^12.29.2` | Animation | Optional: popover expand animation for quality breakdown — existing pattern in voor dashboard |

### Alternatives Considered

| Instead of                             | Could Use                       | Tradeoff                                                                       |
| -------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------ |
| Prisma migration for nullable cols     | Store quality in `summary` JSON | JSON is harder to query/index; nullable columns are queryable and typed        |
| Computed traffic-light on every render | Cache in DB column              | At 20-50 prospects, recomputing on every list render is fine — no cache needed |
| Dialog/Modal for quality breakdown     | Inline expand (accordion)       | Accordion fits compact UI preference better, no new dependency                 |

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure

No new files required beyond the standard pattern. Changes are additive edits to existing files:

```
prisma/
  schema.prisma          ← +3 nullable cols on ResearchRun, +2 HypothesisStatus values
server/routers/
  research.ts            ← +approveQuality procedure
  admin.ts               ← +listProspectsWithQuality or extend listProspects
components/features/prospects/
  analysis-section.tsx   ← Remove accept/reject buttons, add read-only status badge
  quality-chip.tsx       ← NEW: traffic-light chip + breakdown inline accordion
app/admin/prospects/
  page.tsx               ← Add quality chip to each prospect row
  [id]/page.tsx          ← Add quality chip to detail header
```

### Pattern 1: Traffic-Light Score Computation

**What:** A pure function that takes evidence items and returns a traffic-light level.
**When to use:** Called at render time in both list and detail views from the evidence data already loaded in `ResearchRun._count` (list) or full evidence items (detail).

```typescript
// Source: derived from existing evaluateQualityGate in lib/workflow-engine.ts
type TrafficLight = 'red' | 'amber' | 'green';

interface QualityBreakdown {
  trafficLight: TrafficLight;
  evidenceCount: number;
  averageConfidence: number;
  sourceTypeCount: number;
  reasons: string[];
  hypothesisCount: number;
}

function computeTrafficLight(
  evidenceCount: number,
  sourceTypeCount: number,
  averageConfidence: number,
): TrafficLight {
  // Mirrors evaluateQualityGate thresholds — green = all pass, amber = some fail, red = severely thin
  if (evidenceCount < 3 || sourceTypeCount < 2 || averageConfidence < 0.65) {
    // How badly? Red if evidence count < 3 (nearly nothing), amber if minor shortfall
    if (evidenceCount < 3) return 'red';
    return 'amber';
  }
  return 'green';
}
```

**Key insight from existing code:** `evaluateQualityGate` already returns `{ passed, averageConfidence, sourceTypeCount, evidenceCount, reasons }`. The traffic-light is a projection of that result — green = passed, amber = failed but not severely, red = critically thin.

### Pattern 2: ResearchRun Quality Review Fields (Prisma Schema)

**What:** Three nullable fields on `ResearchRun` to record the admin's quality decision.

```prisma
// Source: prisma/schema.prisma — additive-only change
model ResearchRun {
  // ... existing fields ...
  qualityApproved    Boolean?   // null = not reviewed, true = approved, false = rejected
  qualityReviewedAt  DateTime?
  qualityNotes       String?    // free-text override reason (e.g. "proceeding, thin market")
}
```

**Migration:** Simple `prisma migrate dev` — nullable fields require no backfill. All existing rows read as `null` (not reviewed).

### Pattern 3: HypothesisStatus Enum Expansion

**What:** Two new enum values enabling client-side validation tracking.

```prisma
// Source: prisma/schema.prisma
enum HypothesisStatus {
  DRAFT      // admin has not reviewed research quality yet (existing)
  ACCEPTED   // preserved — was used for admin accept; HYPO-05 removes admin use, but value stays for compatibility
  REJECTED   // preserved — same compatibility note
  PENDING    // NEW: admin has quality-approved, hypothesis awaits client validation on /voor/
  DECLINED   // NEW: client declined the hypothesis on /voor/ (Phase 19 will set this)
}
```

**Migration risk:** PostgreSQL enum extension is supported by Prisma. Adding enum values is non-destructive. The `@default(DRAFT)` on both `WorkflowHypothesis` and `AutomationOpportunity` does not change.

**Current admin flow (ACCEPTED/REJECTED) to be retired:** The `setStatus` mutation in `server/routers/hypotheses.ts` sets ACCEPTED/REJECTED. Per HYPO-05 this admin action is removed. The mutation can be retired or repurposed — research quality approval replaces it.

**Remaining usage of ACCEPTED in /voor/page.tsx:** The server-side page query at `/voor/[slug]/page.tsx` filters `workflowHypotheses: { where: { status: 'ACCEPTED' } }`. After HYPO-05, this filter must change to `{ status: { in: ['ACCEPTED', 'PENDING'] } }` or just `PENDING` — the voor dashboard should show PENDING hypotheses (quality-approved, awaiting client validation). This is a critical code touchpoint.

### Pattern 4: tRPC Quality Approval Procedure

**What:** New procedure `research.approveQuality` that records the admin's quality gate decision.

```typescript
// Source: server/routers/research.ts — additive procedure
approveQuality: adminProcedure
  .input(
    z.object({
      runId: z.string(),
      approved: z.boolean(),       // true = green-light, false = rejected (rare)
      notes: z.string().optional(), // "proceed with limited research" explanation
    }),
  )
  .mutation(async ({ ctx, input }) => {
    return ctx.db.researchRun.update({
      where: { id: input.runId },
      data: {
        qualityApproved: input.approved,
        qualityReviewedAt: new Date(),
        qualityNotes: input.notes ?? null,
      },
    });
  }),
```

### Pattern 5: Inline Quality Breakdown (No Dialog)

**What:** A chip that expands inline to show breakdown — consistent with compact UI preference and existing pattern of accordion-style expand in evidence cards (see `EvidenceCard` in `evidence-section.tsx`).

```typescript
// Pattern: chip shows traffic-light dot, click toggles breakdown expansion
// Matches existing EvidenceCard expand/collapse pattern
function QualityChip({ breakdown, runId, reviewed }: QualityChipProps) {
  const [open, setOpen] = useState(false);
  // ...amber chip + inline breakdown when open
}
```

### Pattern 6: listProspects with Quality Data

**What:** Extend `listProspects` to include the latest research run's evidence count and quality review state — enabling traffic-light computation on the list view without a second query per row.

The existing `listProspects` already does `_count: { select: { sessions: true, contacts: true } }`. It needs to include the latest `researchRuns` with evidence count and quality fields:

```typescript
// Extend existing listProspects include
researchRuns: {
  orderBy: { createdAt: 'desc' },
  take: 1,
  select: {
    id: true,
    qualityApproved: true,
    qualityReviewedAt: true,
    _count: { select: { evidenceItems: true, workflowHypotheses: true } },
    // For source diversity: evidenceItems sourceType distinct would require aggregation
    // Alternative: use evidenceCount only on list view, show full breakdown on detail
  },
},
```

**Note:** Source type diversity (`sourceTypeCount`) requires fetching actual evidence items to count distinct source types. On the list view, use `evidenceCount` alone as a proxy for traffic-light color — full breakdown is on the detail/chip popover where evidence items are fully loaded. This avoids N+1 queries on the list.

### Anti-Patterns to Avoid

- **Hard-blocking on red:** The amber/proceed-anyway flow must be soft. Never make red a hard block on outreach — Dutch SMBs structurally have thin web presence.
- **Storing computed traffic-light in DB:** Thresholds will need empirical calibration. Store raw inputs (evidence count, confidence, source count) in the DB — compute traffic-light at render time.
- **Adding complexity to the voor dashboard:** Phase 18 only adds read-only status badges to the admin Analysis section. The voor dashboard changes (client hypothesis validation) are Phase 19.
- **Reusing ACCEPTED for "quality approved":** The new quality approval is on `ResearchRun`, not on individual hypotheses. Do not conflate.

---

## Don't Hand-Roll

| Problem                    | Don't Build              | Use Instead                                                                         | Why                                                                        |
| -------------------------- | ------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Traffic-light scoring      | Custom scoring algorithm | `evaluateQualityGate` in `workflow-engine.ts`                                       | Already correct, already tested (2 tests in `workflow-engine.test.ts`)     |
| Quality chip color tokens  | Custom CSS               | Tailwind amber/red/green utility classes already used in research page gate display | Already established pattern in `app/admin/research/page.tsx` lines 249-257 |
| Modal/dialog for breakdown | Build dialog component   | Inline accordion (expand on click, same pattern as `EvidenceCard`)                  | No new dependency, fits compact UI preference                              |

**Key insight:** The existing `evaluateQualityGate` function is the scoring engine. `computeTrafficLight` is just a trivial projection of its result into three buckets. Do not replicate the scoring logic.

---

## Common Pitfalls

### Pitfall 1: listProspects Over-Fetching for Source Diversity

**What goes wrong:** Fetching all evidence items per prospect in the list view to compute `sourceTypeCount` — this creates N+1 DB queries for 50 prospects.
**Why it happens:** Traffic-light needs source type count, but the list query only has `_count`.
**How to avoid:** Use `evidenceCount` only as a list-view proxy. Show full breakdown (with source type count) in the chip's inline accordion, loaded from `research.getRun` when the chip is expanded. The list view traffic-light is indicative — the detail view is definitive.
**Warning signs:** Slow list page load, many DB queries logged.

### Pitfall 2: /voor/ Dashboard Shows No Hypotheses After HYPO-05

**What goes wrong:** After removing admin ACCEPTED status as the gate for /voor/ display, no hypotheses appear on the client dashboard.
**Why it happens:** `/voor/[slug]/page.tsx` queries `{ where: { status: 'ACCEPTED' } }`. When ACCEPTED is no longer set by admin, no rows match.
**How to avoid:** Change the /voor/ filter from `status: 'ACCEPTED'` to `status: { in: ['ACCEPTED', 'PENDING'] }` (transition) or `status: 'PENDING'` (clean). Decide: does the filter change in Phase 18 or Phase 19?
**Recommendation:** In Phase 18, change the filter to `{ in: ['ACCEPTED', 'PENDING'] }` for backward compatibility with existing prospects that already have ACCEPTED hypotheses. Phase 19 can tighten to `PENDING` only.

### Pitfall 3: HypothesisStatus Enum Migration Ordering

**What goes wrong:** Prisma migration fails or generates broken SQL when adding enum values.
**Why it happens:** PostgreSQL `ALTER TYPE ... ADD VALUE` cannot be run inside a transaction in some versions.
**How to avoid:** Prisma handles this automatically — it generates the correct `ALTER TYPE` statement outside a transaction. Verify with `prisma migrate dev` in dev environment before pushing. The pattern `20260222154800_add_registry_source_type` (Phase 17) already demonstrates a successful enum extension for this project.

### Pitfall 4: setStatus Mutation Still Called from command-center.tsx

**What goes wrong:** After removing ACCEPTED/REJECTED buttons from `analysis-section.tsx`, calls to `setHypothesisStatus` remain in the parent `page.tsx` and `command-center.tsx`.
**Why it happens:** `setHypothesisStatus` is passed as a prop from `[id]/page.tsx` to `AnalysisSection`, and a similar pattern appears in `command-center.tsx` (lines 225-238).
**How to avoid:** Remove `setHypothesisStatus` prop from `AnalysisSection` entirely. Also update `command-center.tsx` which has its own inline accept/reject buttons for hypotheses (line 225-240). Both locations need the same treatment.
**Warning signs:** TypeScript error "prop onSetStatus is required" after removing from AnalysisSection.

### Pitfall 5: Amber Confirmation UX

**What goes wrong:** Admin accidentally proceeds without understanding the limitation, or the confirmation step is skipped.
**Why it happens:** Amber flow needs explicit "proceed with limited research" click that records `qualityNotes`.
**How to avoid:** The confirmation should not be a modal — use an inline confirmation step within the chip breakdown (two-step: show warning → confirm → save override). Record `qualityNotes: "Proceed with limited research — amber override"` automatically if no custom note.

---

## Code Examples

Verified patterns from codebase:

### Existing Quality Gate (lib/workflow-engine.ts lines 370-391)

```typescript
// Source: lib/workflow-engine.ts — existing function, already tested
export function evaluateQualityGate(items: EvidenceInput[]): QualityGateResult {
  const reasons: string[] = [];
  const evidenceCount = items.length;
  const sourceTypeCount = new Set(items.map((item) => item.sourceType)).size;
  const averageConfidence = round2(
    average(items.map((item) => item.confidenceScore)),
  );

  if (evidenceCount < 3) reasons.push('Minimum 3 evidence items required');
  if (sourceTypeCount < 2)
    reasons.push('At least 2 evidence source types required');
  if (averageConfidence < 0.65)
    reasons.push('Average confidence must be >= 0.65');

  return {
    passed: reasons.length === 0,
    averageConfidence,
    sourceTypeCount,
    evidenceCount,
    reasons,
  };
}
```

### Existing Quality Gate Display in research/page.tsx (lines 244-265)

```typescript
// Source: app/admin/research/page.tsx — existing amber/green chip pattern
<span className={cn(
  'text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest border',
  gate.passed
    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
    : 'bg-amber-50 text-amber-600 border-amber-100',
)}>
  Contextual Gate: {gate.passed ? 'PASSED' : 'REJECTED'}
</span>
```

**Note:** This existing chip is binary (passed/rejected). Phase 18 replaces this with a three-state (red/amber/green) chip visible on the prospect list and detail, not just on the research admin page.

### Existing Hypothesis Status Badge in analysis-section.tsx (lines 67-108)

```typescript
// Source: components/features/prospects/analysis-section.tsx
// These are the Accept/Reject/Reset buttons to be REMOVED in Phase 18
<div className="flex items-center gap-1.5 shrink-0">
  {finding.status !== 'ACCEPTED' && (
    <button onClick={() => set('ACCEPTED')} className={`${BTN} bg-emerald-50...`}>Accept</button>
  )}
  {finding.status !== 'REJECTED' && (
    <button onClick={() => set('REJECTED')} className={`${BTN} bg-red-50...`}>Reject</button>
  )}
  {finding.status !== 'DRAFT' && (
    <button onClick={() => set('DRAFT')} className={`${BTN} bg-slate-50...`}>Reset</button>
  )}
</div>
```

**Replace with:** A read-only status badge showing `DRAFT → "Pending prospect validation"`, `PENDING → "Pending prospect validation"`, `ACCEPTED → "Pending prospect validation"`, `DECLINED → "Declined by prospect"`.

### EvidenceCard Expand/Collapse Pattern (evidence-section.tsx lines 59-106)

```typescript
// Source: components/features/prospects/evidence-section.tsx — reuse this pattern
function EvidenceCard({ item }: { item: EvidenceItem }) {
  const [expanded, setExpanded] = useState(false);
  // ...
  <button onClick={() => setExpanded(!expanded)} className="text-[10px] text-slate-400">
    {expanded ? 'Less' : 'More'}
  </button>
}
```

**Use for:** QualityChip breakdown expansion — same inline expand/collapse pattern.

### Prospect List Row Status Chip (prospects/page.tsx lines 181-189)

```typescript
// Source: app/admin/prospects/page.tsx — existing chip pattern to match
<span className={cn(
  'text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border',
  statusColors[prospect.status] || 'bg-slate-50 text-slate-400 border-slate-100',
)}>
  {prospect.status}
</span>
```

**Quality chip should match this exact styling pattern.**

---

## State of the Art

| Old Approach                                           | Current Approach                                                                 | Impact                                                             |
| ------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Admin approves/rejects hypotheses (Phase 7-11)         | Admin reviews RESEARCH QUALITY only; prospect validates hypotheses (Phase 18-19) | HYPO-05: Remove approve/reject buttons from admin Analysis section |
| Binary quality gate (passed/rejected) on research page | Traffic-light (red/amber/green) on prospect list + detail                        | RQUAL-01                                                           |
| No per-run quality review decision                     | `qualityApproved`, `qualityReviewedAt`, `qualityNotes` on ResearchRun            | RQUAL-03, RQUAL-04                                                 |
| HypothesisStatus: DRAFT/ACCEPTED/REJECTED              | + PENDING (quality-approved, awaiting client) + DECLINED (client declined)       | HYPO-05                                                            |

**Deprecated/outdated:**

- `setHypothesisStatus` tRPC mutation: still in schema as `hypotheses.setStatus`, but its admin UI callers in `analysis-section.tsx` and `command-center.tsx` are removed in Phase 18. The mutation itself can stay for potential future use.
- `/voor/[slug]/page.tsx` filter `{ status: 'ACCEPTED' }`: must become `{ status: { in: ['ACCEPTED', 'PENDING'] } }` in Phase 18 to maintain backward compatibility.

---

## Open Questions

1. **What traffic-light threshold separates red from amber?**
   - What we know: Current `evaluateQualityGate` treats any failure as binary (passed/not-passed). The threshold proposal: red = `evidenceCount < 3` (critically thin), amber = any other failure (e.g., only one source type, low confidence), green = all pass.
   - What's unclear: Whether `evidenceCount < 5` is a better red threshold after Phase 17 enrichment.
   - Recommendation: Use `evidenceCount < 3` for red, any other failure for amber. Document this in code comments. Note: prior decisions state thresholds need empirical calibration after ship — this is fine as long as thresholds are not hard-coded in DB (compute at render time from raw counts).

2. **Should the quality chip on the list view trigger a second query for full evidence details?**
   - What we know: `listProspects` does not currently include evidence counts. Adding `researchRuns: { take: 1, select: { id, qualityApproved, _count: { evidenceItems } } }` to the list query is affordable at 20-50 prospects.
   - What's unclear: Whether source type count (needed for full traffic-light accuracy) should be computed client-side from a separate `research.listEvidence` call or fetched in the list query.
   - Recommendation: Extend `listProspects` include with latest run's `_count.evidenceItems` and `qualityApproved`. Use evidence count alone for list traffic-light. Source type detail only on chip expand (fetches `research.getRun`).

3. **Does ACCEPTED hypothesis status remain valid after HYPO-05, or does the flow require transitioning existing ACCEPTED rows to PENDING?**
   - What we know: Existing prospects have hypotheses in ACCEPTED status (set by admin before Phase 18). The /voor/ page currently shows only ACCEPTED hypotheses.
   - What's unclear: Whether to auto-migrate ACCEPTED → PENDING via a migration, or keep both as valid "show on /voor/" states.
   - Recommendation: Keep both ACCEPTED and PENDING as valid for /voor/ display (backward compatible). New research runs produce DRAFT hypotheses; admin quality-approval transitions them to PENDING. Existing ACCEPTED rows continue to display on /voor/ without change. Do NOT run a data migration.

4. **Where does "request another research run" live?**
   - What we know: Phase description says admin can "request another research run." The existing research admin page (`/admin/research`) already has Start Run + Re-Analyze buttons. The `retryRun` mutation exists.
   - What's unclear: Whether "request another research run" in the quality gate context means a new button on the quality chip, or just a link to the research page.
   - Recommendation: On the quality breakdown inline accordion, add a "Re-run Research" button that calls the existing `research.retryRun` mutation (or links to `/admin/research`). Keep it minimal — full research management is on the research page.

---

## Sources

### Primary (HIGH confidence)

- Codebase inspection: `prisma/schema.prisma` — confirmed current `HypothesisStatus` (DRAFT/ACCEPTED/REJECTED), `ResearchRun` model (no quality fields), `EvidenceSourceType` enum
- Codebase inspection: `lib/workflow-engine.ts` lines 370-391 — confirmed `evaluateQualityGate` function signature and thresholds
- Codebase inspection: `lib/workflow-engine.test.ts` lines 80-130 — confirmed evaluateQualityGate has 2 test cases (passes/fails)
- Codebase inspection: `server/routers/research.ts` — confirmed `listRuns`, `getRun`, `approveEvidence` procedures, no quality review procedures
- Codebase inspection: `server/routers/hypotheses.ts` — confirmed `setStatus` mutation, DRAFT/ACCEPTED/REJECTED enum usage
- Codebase inspection: `components/features/prospects/analysis-section.tsx` — confirmed exact accept/reject button code to remove (lines 84-107)
- Codebase inspection: `components/features/prospects/evidence-section.tsx` — confirmed expand/collapse pattern for reuse
- Codebase inspection: `app/admin/prospects/page.tsx` — confirmed list row structure and existing chip styling
- Codebase inspection: `app/admin/prospects/[id]/page.tsx` — confirmed detail page structure, `setHypothesisStatus` prop wiring
- Codebase inspection: `app/voor/[slug]/page.tsx` — confirmed `{ where: { status: 'ACCEPTED' } }` filter on hypotheses (line 47)
- Codebase inspection: `components/features/prospects/command-center.tsx` lines 225-240 — confirmed second location of hypothesis accept/reject buttons
- Codebase inspection: `app/admin/research/page.tsx` lines 244-265 — confirmed existing binary gate chip styling (amber/green)
- Phase 17 SUMMARY.md — confirmed REGISTRY source type added, evidence cap raised to 36, Phase 18 readiness

### Secondary (MEDIUM confidence)

- MEMORY.md — prior decisions: `qualityApproved Boolean?`, `qualityReviewedAt DateTime?`, `qualityNotes String?` on ResearchRun; `PENDING` and `DECLINED` on HypothesisStatus; soft gate (never hard-block); thresholds need empirical calibration
- Prisma docs pattern: PostgreSQL `ALTER TYPE ... ADD VALUE` outside transaction — Prisma handles automatically (same approach used in `20260222154800_add_registry_source_type`)

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages, all existing
- Architecture: HIGH — based on direct codebase inspection of all affected files
- Schema changes: HIGH — additive-only, confirmed migration pattern from Phase 17
- Pitfalls: HIGH — based on direct code path tracing (voor filter, command-center.tsx second location)
- Open questions: MEDIUM — threshold values need empirical calibration post-ship (by design)

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable stack, 30-day window)

---

## Task Map for Planner

| Task                                                                                                                      | Files Affected                                                                                                                       | Est. Complexity |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| 18-01: Schema migration — add quality fields to ResearchRun + PENDING/DECLINED to HypothesisStatus                        | `prisma/schema.prisma`, migration                                                                                                    | Low             |
| 18-02: tRPC procedure `research.approveQuality` + extend `listProspects` with latest run quality data                     | `server/routers/research.ts`, `server/routers/admin.ts`                                                                              | Low             |
| 18-03: `QualityChip` component + traffic-light chip on prospect list and detail                                           | `components/features/prospects/quality-chip.tsx` (new), `app/admin/prospects/page.tsx`, `app/admin/prospects/[id]/page.tsx`          | Medium          |
| 18-04: Remove accept/reject buttons from AnalysisSection + command-center; add read-only status badges; fix /voor/ filter | `components/features/prospects/analysis-section.tsx`, `components/features/prospects/command-center.tsx`, `app/voor/[slug]/page.tsx` | Low             |

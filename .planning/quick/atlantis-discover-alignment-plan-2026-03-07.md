# Atlantis Discover Alignment Plan (2026-03-07)

## Goal

Make `/discover` unmistakably Atlantis-first: partnership-triggered, SPV-relevant, and useful for real outreach follow-up without adding admin clutter.

## Constraints

1. Keep shared core flow intact (75% shared app).
2. Shift only Atlantis-specific 25% (copy, cards, CTA logic, evidence emphasis).
3. No new SPV selector/filter UI in admin for now.

## Phase A — Narrative Fit (highest priority)

### Objective

Align card content and section order with Atlantis partnership intent.

### Scope

1. Reorder discover sections for Atlantis:
   - Partnership readiness
   - Why now
   - SPV fit
   - Evidence links
2. Replace generic automation wording with partnership language.
3. Ensure CTA labels match readiness tier and meeting intent.

### Acceptance

1. A first-time viewer can tell this is partnership outreach within 10 seconds.
2. No Klarifai-specific wording appears on Atlantis discover pages.
3. CTA hierarchy matches readiness tier consistently.

## Phase B — Evidence Relevance Controls

### Objective

Show fewer but better pages and make evidence traceability explicit.

### Scope

1. Add Atlantis-focused relevance weighting in display layer:
   - deprioritize stale financial/news-only pages
   - keep evergreen strategic pages visible
2. Add “why selected” evidence badges (source, recency, relevance match).
3. Keep current retrieval engine; improve ranking/display transparency first.

### Acceptance

1. Heijmans-like prospects no longer surface low-signal old-results pages in top view.
2. Each top evidence item has clear provenance metadata in UI.
3. Coverage numbers in UI are internally consistent (selected vs evidence vs unique URLs).

## Phase C — SPV Bridge in Discover

### Objective

Connect Atlantis triggers directly to SPV-oriented outreach next steps.

### Scope

1. Add compact SPV bridge block:
   - likely SPV
   - reason (trigger + evidence)
   - next action hint (campaign seed / outreach angle)
2. Keep this block Atlantis-only behind `projectType`.
3. Preserve Klarifai discover behavior unchanged.

### Acceptance

1. For each Atlantis prospect, discover shows at least one explicit SPV bridge.
2. Suggested next action is human-readable and campaign-ready.
3. No regression in Klarifai discover route output.

## Execution Order

1. Phase A
2. Phase B
3. Phase C

## Validation Runbook

1. Manual QA on 3 Atlantis prospects (including Heijmans).
2. Compare before/after discover snapshots.
3. Confirm no wording/UX regression on a Klarifai prospect.

## Definition of Done

1. Atlantis discover reads as partnership workflow, not generic research dashboard.
2. Evidence quality feels intentional and transparent.
3. Output can be used directly for campaign/outreach handoff.

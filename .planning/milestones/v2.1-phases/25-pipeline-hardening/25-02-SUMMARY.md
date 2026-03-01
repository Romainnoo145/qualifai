---
phase: 25-pipeline-hardening
plan: 02
subsystem: research-pipeline
tags: [diagnostics, error-visibility, ui, reliability]
completed: 2026-02-25
---

# Phase 25 Plan 02 Summary

Implemented user-visible research source diagnostics so missing APIs and source failures are no longer silent.

## What Changed

### Backend diagnostics capture

- Updated `lib/research-executor.ts` to collect per-source diagnostics during run execution.
- Added status events for:
  - `sitemap`
  - `website`
  - `reviews`
  - `serp`
  - `crawl4ai`
  - `google_mentions`
  - `kvk`
  - `linkedin`
- Status types: `ok`, `warning`, `error`, `skipped`.
- Diagnostics include clear human-readable messages (e.g., missing `SERP_API_KEY`, no sitemap URLs, KVK skipped).

### Run summary payload

- Extended `lib/workflow-engine.ts` `runSummaryPayload(...)` to include `diagnostics` in `ResearchRun.summary`.

### Frontend visibility

- Updated `components/features/prospects/evidence-section.tsx` to render a `Source Diagnostics` panel above evidence groups.
- The panel shows:
  - run-level error (if present)
  - warning/error diagnostics from the latest run summary
- Updated `app/admin/prospects/[id]/page.tsx` to pass latest run summary/error into `EvidenceSection`.

## Verification

- `npx tsc --noEmit` passed.
- `npx eslint` on modified files passed (existing app-wide warning patterns unchanged).
- New run verification on `motiondesignawards.com` produced diagnostics in summary:
  - example warnings: missing `SERP_API_KEY`, no sitemap URLs
  - run completed successfully with diagnostics persisted and available in UI.

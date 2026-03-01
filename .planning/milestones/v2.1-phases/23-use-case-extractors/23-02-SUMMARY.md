---
phase: 23-use-case-extractors
plan: 02
subsystem: use-cases
tags: [codebase, gemini, trpc, admin-ui]
completed: 2026-02-24
---

# Phase 23 Plan 02 Summary

Implemented codebase-based use case extraction and wired it to the admin Use Cases page.

## What Was Built

- Added `lib/codebase-analyzer.ts` with:
  - recursive project scan (skip: `node_modules`, `.git`, `.next`, `dist`, `build`, `__pycache__`)
  - high-signal discovery (manifest, README, business context, API routes, `.env.example`)
  - Gemini extraction (`gemini-2.0-flash`) for client-facing service capabilities
  - normalization, category guardrails, title dedup, and `sourceRef` format `codebase:<project>:<slug>`
- Added `useCases.importFromCodebase` in `server/routers/use-cases.ts`
  - input: `{ projectPath }`
  - sourceRef dedup to prevent duplicate use cases on re-runs
  - returns `{ created, skipped, filesAnalyzed, projectName, errors }`
- Updated `app/admin/use-cases/page.tsx` with:
  - collapsible section: `Analyze a project codebase...`
  - path input
  - `Analyze Codebase` button + loading state
  - result alert with analyzed file count, created/skipped totals, and errors

## Verification

- `npx tsc --noEmit` passed
- `npx eslint lib/codebase-analyzer.ts server/routers/use-cases.ts app/admin/use-cases/page.tsx` passed

## Notes

- `analyzeCodebase` reads `process.env.GOOGLE_AI_API_KEY` directly for runtime/test isolation.
- Re-running the same project path is safe due to `sourceRef`-based dedup.

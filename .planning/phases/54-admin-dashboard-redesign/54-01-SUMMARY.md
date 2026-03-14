---
phase: 54-admin-dashboard-redesign
plan: '01'
subsystem: backend/api
tags: [dashboard, trpc, activity-feed, action-queue]
dependency_graph:
  requires: []
  provides: [getDashboardFeed, getDashboardActions]
  affects: [server/routers/admin.ts]
tech_stack:
  added: []
  patterns:
    [parallel-prisma-queries, unified-feed-merge, project-scoped-queries]
key_files:
  created: []
  modified:
    - server/routers/admin.ts
decisions:
  - getDashboardFeed uses 14-day lookback window with 20-item cap per stream merged to 30-item unified feed
  - getDashboardActions readyProspects filter uses contacts.none outreachLogs guard (first-contact only)
  - Existing getActionQueue and getDashboardStats preserved for backward compatibility
  - Hypotheses category removed from getDashboardActions — obsolete in narrative pipeline world
metrics:
  duration: 2m
  completed: 2026-03-14
  tasks_completed: 2
  files_modified: 1
---

# Phase 54 Plan 01: Admin Dashboard Backend Endpoints Summary

Two new tRPC endpoints wired into adminRouter — getDashboardFeed (activity feed) and getDashboardActions (action block) — providing clean separation between passive awareness and active decision-making for the redesigned dashboard.

## What Was Built

### Task 1: getDashboardFeed

Activity feed endpoint fetching 4 parallel streams over a 14-day lookback window:

1. **research_complete** — ResearchRun with status COMPLETED, includes evidence item count
2. **analysis_generated** — ProspectAnalysis with version analysis-v2, includes model used
3. **discover_visit** — WizardSession, includes max step reached and conversion events (PDF/call/quote)
4. **outreach_sent** — OutreachLog with status sent, includes channel and subject

All streams are merged, sorted by recency, and capped at 30 items. Each stream is capped at 20 items before merging. All queries scope to `ctx.projectId` via prospect relation.

### Task 2: getDashboardActions

Action block endpoint returning three actionable categories in parallel:

1. **drafts** — OutreachLog with status draft, oldest first, includes 160-char preview
2. **replies** — OutreachLog with type FOLLOW_UP and status received, oldest first
3. **readyProspects** — Prospects with status READY/ENRICHED that have completed research but zero outreach logs (never contacted), newest first

Returns structured data: `{ drafts[], replies[], readyProspects[], counts: { drafts, replies, readyProspects, total } }`.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check

### Files Exist

- [x] server/routers/admin.ts — modified (contains getDashboardFeed and getDashboardActions)

### Commits Exist

- [x] c92a205 — feat(54-01): add getDashboardFeed endpoint for activity feed
- [x] 426d274 — feat(54-01): add getDashboardActions endpoint for action block

## Self-Check: PASSED

---
phase: 54-admin-dashboard-redesign
plan: '02'
subsystem: frontend/dashboard
tags: [dashboard, activity-feed, action-block, trpc, react]
dependency_graph:
  requires: [getDashboardFeed, getDashboardActions]
  provides: [admin-dashboard-ui]
  affects: [app/admin/page.tsx]
tech_stack:
  added: []
  patterns:
    [compound-section-components, slim-feed-rows, glass-card-action-rows]
key_files:
  created: []
  modified:
    - app/admin/page.tsx
decisions:
  - Feed rows use slim border-b dividers inside a single glass-card wrapper (not individual cards per item) — keeps feed visually distinct from action block
  - Dutch NL copy throughout (section headings, error messages, empty states) matching project primary language
  - feedConfig lookup table maps event type to icon + dotColor — avoids switch/if chains in FeedRow
  - counts?.total nullable guard with ?? 0 handles undefined during loading transition
metrics:
  duration: 2m
  completed: 2026-03-14
  tasks_completed: 1
  files_modified: 1
---

# Phase 54 Plan 02: Admin Dashboard Frontend Redesign Summary

Admin dashboard page rewritten with Activity Feed + Action Block replacing the obsolete hypothesis queue — queue-first layout showing what needs decisions (top) and what happened recently (bottom).

## What Was Built

### Task 1: Rewrite admin dashboard with Activity Feed + Action Block

Rewrote `app/admin/page.tsx` from scratch to consume the two new backend endpoints:

**Action Block (above fold):**

- **Drafts to Approve** (`getDashboardActions.drafts`) — glass-card rows with Mail icon, prospect name + contact name, subject, preview text, inline Send button calling `approveDraft.mutate({ id })`. Button has isPending guard.
- **Replies to Handle** (`getDashboardActions.replies`) — glass-card rows with MessageSquare icon, link to `/admin/outreach`.
- **Ready for Outreach** (`getDashboardActions.readyProspects`) — glass-card rows with Building2 icon, company name, industry pill badge, contact count. Links to `/admin/prospects/{id}`.
- Empty state: CheckCircle2 card with "All caught up" when `counts.total === 0`.

**Activity Feed (below actions):**

- Slim border-b rows (NOT glass-cards) inside a single glass-card wrapper.
- Four event types mapped to icon + color dot via `feedConfig` lookup table:
  - `research_complete` → Search icon, green dot
  - `analysis_generated` → Sparkles icon, purple dot
  - `discover_visit` → Eye icon, blue dot
  - `outreach_sent` → Send icon, amber dot
- Each row links to `/admin/prospects/{prospectId}`.
- Relative timestamps with existing `timeAgo()` helper.
- Empty state: "Geen recente activiteit." (Dutch).

**Component architecture:**

- `FeedRow` — compact feed item, uses feedConfig lookup
- `DraftRow` — action row with inline Send button
- `ReplyRow` — action row linking to outreach page
- `ReadyProspectRow` — action row linking to prospect detail
- `SectionHeading` — reusable heading with count badge

**Removed from old dashboard:**

- CountCard grid (hypothesis/drafts/tasks/replies count cards)
- ActionRow / ActionSection generic components
- ChannelIcon helper
- Hypothesis review section
- Task section
- Lightbulb, Phone, MessageCircle, Linkedin imports

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check

### Files Exist

- [x] app/admin/page.tsx — rewritten (contains getDashboardFeed and getDashboardActions consumers)

### Commits Exist

- [x] dac44c2 — feat(54-02): rebuild admin dashboard with Activity Feed + Action Block

## Self-Check: PASSED

---
created: 2026-04-18T21:58:32.990Z
title: Wire prospect detail action buttons to tRPC mutations
area: ui
files:
  - app/admin/prospects/[id]/page.tsx:769-778
---

## Problem

The prospect detail page (`/admin/prospects/[id]`) has 4 action buttons in the right column that are purely visual placeholders with no onClick handlers:

- **Re-enrich** — should call a re-enrichment mutation
- **Nieuwe run** — should call `research.startRun` with the prospect ID
- **Genereer analyse** — should trigger master analysis generation
- **Start outreach** — should initiate the outreach flow for this prospect

The `ActionRow` component accepts an `onClick` prop but none of the instances pass one. The backend tRPC endpoints already exist (`research.startRun`, `research.retryRun`, outreach mutations). This is purely a frontend wiring gap.

## Solution

For each button, wire the onClick to the corresponding tRPC mutation:

1. Re-enrich → call the enrichment re-run (check if `admin.reenrich` or similar exists)
2. Nieuwe run → `research.startRun({ prospectId, deepCrawl: false })`
3. Genereer analyse → trigger `analysis.generate` or the master analyzer
4. Start outreach → navigate to outreach or trigger draft generation

Add loading states (Loader2 spinner) and success feedback (invalidate queries). Follow the pattern already used in the prospects list page for Start Research buttons.

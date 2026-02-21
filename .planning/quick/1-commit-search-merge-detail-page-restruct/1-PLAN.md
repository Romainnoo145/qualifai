---
phase: quick-commit-search-merge-detail-page-restruct
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/admin/prospects/page.tsx
  - app/admin/prospects/[id]/page.tsx
  - app/admin/prospects/new/page.tsx
  - app/admin/page.tsx
  - app/discover/[slug]/page.tsx
  - app/discover/[slug]/wizard-client.tsx
  - app/voor/[slug]/dashboard-client.tsx
  - app/globals.css
  - app/layout.tsx
  - components/features/prospects/command-center.tsx
  - components/features/prospects/company-vitals.tsx
  - components/ui/button.tsx
  - components/ui/glass-card.tsx
  - components/ui/status-badge.tsx
  - server/routers/search.ts
  - server/routers/contacts.ts
  - server/routers/signals.ts
  - lib/enrichment/index.ts
  - lib/enrichment/service.ts
  - lib/enrichment/types.ts
  - lib/enrichment/provider-id.ts
  - lib/enrichment/providers/
  - env.mjs
  - package.json
  - package-lock.json
  - prisma.config.ts
  - lib/ai/generate-wizard.ts
  - lib/workflow-engine.ts
autonomous: true

must_haves:
  truths:
    - 'npm run check passes with no type errors or lint violations'
    - 'All changed files are committed to git'
  artifacts:
    - path: 'components/ui/button.tsx'
      provides: 'Reusable Button component with variants'
    - path: 'components/features/prospects/command-center.tsx'
      provides: 'Pipeline status + action shortcuts for prospect detail'
    - path: 'server/routers/search.ts'
      provides: 'search.companies and search.contacts tRPC procedures'
  key_links:
    - from: 'app/admin/prospects/page.tsx'
      to: 'server/routers/search.ts'
      via: 'api.search.companies / api.search.contacts tRPC mutations'
      pattern: "api\\.search\\.(companies|contacts)"
    - from: 'app/admin/prospects/[id]/page.tsx'
      to: 'components/features/prospects/command-center.tsx'
      via: 'CommandCenter import'
      pattern: 'CommandCenter'
---

<objective>
Run type checks, lint, and commit all accumulated working-tree changes covering: search router extraction, prospect detail page restructure with CommandCenter, and UI improvements.

Purpose: All implementation is already complete in the working tree. This plan validates correctness and commits the work in two logical groups.
Output: Clean git history with two commits covering backend + UI changes.
</objective>

<execution_context>
@/home/klarifai/.claude/get-shit-done/workflows/execute-plan.md
@/home/klarifai/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Validate — run npm run check</name>
  <files>
    (no files written — validation only)
  </files>
  <action>
    Run the project's full quality check from the project root:

    ```
    cd /home/klarifai/Documents/klarifai/projects/qualifai && npm run check
    ```

    This runs type-check + lint + format. If errors appear, fix them before proceeding to Task 2. Common issues to watch for:
    - Missing imports in new component files (components/ui/, components/features/prospects/)
    - tRPC router not wired into the root router (server/routers/search.ts, contacts.ts, signals.ts must be registered in server/root.ts or equivalent)
    - Unused import lint warnings in restructured pages

    Check that the root tRPC router registers search, contacts, and signals routers. If not, add them.

  </action>
  <verify>npm run check exits with code 0 and no errors printed</verify>
  <done>Zero type errors, zero lint errors. All new files compile cleanly.</done>
</task>

<task type="auto">
  <name>Task 2: Commit all changes in two logical groups</name>
  <files>
    (git commits — no source files written)
  </files>
  <action>
    Stage and commit in two groups from /home/klarifai/Documents/klarifai/projects/qualifai:

    **Commit 1 — Backend: search, contacts, signals routers + enrichment layer**
    Stage these files (add only files that exist):
    - server/routers/search.ts
    - server/routers/contacts.ts
    - server/routers/signals.ts
    - server/routers/call-prep.ts (if modified)
    - lib/enrichment/ (entire directory)
    - lib/ai/generate-outreach.ts lib/ai/outreach-prompts.ts lib/ai/outreach-schemas.ts (if present)
    - lib/outreach/ (entire directory, if present)
    - lib/automation/ (if present)
    - lib/research-refresh.ts lib/pdf-render.ts lib/pdf-render.test.ts lib/pdf-storage.ts (if present)
    - lib/review-adapters.ts lib/review-adapters.test.ts (if present)
    - lib/web-evidence-adapter.ts lib/web-evidence-adapter.test.ts (if present)
    - app/api/ (new directories: internal/, outreach/, webhooks/, export/)
    - prisma/migrations/20260207183000_workflow_sprint_engine/ (if present)
    - scripts/ (if present)
    - docs/ (if present)
    - env.mjs
    - package.json package-lock.json
    - prisma.config.ts
    - lib/workflow-engine.ts
    - lib/ai/generate-wizard.ts

    Commit message:
    ```
    feat: add search/contacts/signals routers, enrichment layer, outreach pipeline

    Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
    ```

    **Commit 2 — Frontend: prospect list search merge, detail page restructure, UI components**
    Stage these files:
    - app/admin/page.tsx
    - app/admin/prospects/page.tsx
    - app/admin/prospects/[id]/page.tsx
    - app/admin/prospects/new/page.tsx
    - app/admin/briefs/ app/admin/campaigns/ app/admin/contacts/ app/admin/outreach/ app/admin/research/ app/admin/settings/ app/admin/signals/ (if present)
    - app/discover/[slug]/page.tsx
    - app/discover/[slug]/wizard-client.tsx
    - app/voor/[slug]/dashboard-client.tsx
    - app/globals.css
    - app/layout.tsx
    - components/features/prospects/ (entire directory)
    - components/ui/ (entire directory)
    - lib/lusha.ts (deleted file — git add will handle removal)
    - server/routers/admin.ts

    Commit message:
    ```
    feat: restructure prospect detail page, merge search into list, extract UI components

    - Extract CommandCenter, StatusBadge, Button, GlassCard as reusable components
    - Merge CompanySearch and ContactSearch views into prospects list page
    - Restructure detail page header with StatusBadge and inline vitals
    - Update admin nav and CTA cards across admin pages
    - Remove lusha.ts (replaced by enrichment layer)

    Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
    ```

    Use `git add` with explicit paths. Verify with `git status` after each commit that the staging area is clean.

  </action>
  <verify>
    Run `git log --oneline -5` — should show 2 new commits at top.
    Run `git status` — should show clean working tree (no modified or untracked files from this work).
  </verify>
  <done>
    Two commits in git log. Working tree is clean. All previously untracked and modified files are committed.
  </done>
</task>

</tasks>

<verification>
- `npm run check` passes (zero errors)
- `git log --oneline -5` shows two new commits
- `git status` shows clean working tree
</verification>

<success_criteria>
All working-tree changes committed to git with clean type-check and lint. No orphaned untracked files.
</success_criteria>

<output>
After completion, create `.planning/quick/1-commit-search-merge-detail-page-restruct/1-SUMMARY.md` with what was committed.
</output>

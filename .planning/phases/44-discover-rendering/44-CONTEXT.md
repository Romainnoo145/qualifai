# Phase 44: Discover Rendering - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Render the three AI-generated content sections (Context, Triggers, Partnership) on the Atlantis discover page from persisted ProspectAnalysis data — no further AI calls. The existing 4-tab wizard structure stays. Tabs 0-2 get AI content, tab 3 (Intake) stays as-is.

</domain>

<decisions>
## Implementation Decisions

### Section layout & visual hierarchy

- Context tab (Step 0): hook subtitle at top → 3 KPI blocks in horizontal row → executive hook paragraph below
- KPI blocks: big bold number + short label underneath. Minimal, boardroom-slide style. No context line.
- Tab labels renamed to match AI sections: Context / Waarom Nu / Samenwerking / Intake (Dutch equivalents)

### Template replacement strategy

- New dedicated AtlantisDiscoverClient component for AI-rendered content — clean separation from DashboardClient
- partnership-discover-client.tsx can be retired once AtlantisDiscoverClient is live
- Routing in page.tsx: ATLANTIS + analysis → AtlantisDiscoverClient, ATLANTIS + no analysis → pending state ("Uw analyse wordt voorbereid"), KLARIFAI → DashboardClient (unchanged)
- Same wizard navigation pattern (step indicators, prev/next, swipe animations) — extract shared WizardShell component used by both DashboardClient and AtlantisDiscoverClient
- Analysis data fetched server-side in page.tsx, passed as props — no client-side tRPC loading
- No template fallback: prospects without AI analysis see a pending state, not old template content

### Trigger card design

- Card structure: title header with category → prominent key number/stat → 2-3 sentence narrative
- Urgency: subtle colored left border accent per card (boardroom-appropriate, not flashy)
- Layout: 3 columns on desktop, stacked vertically on mobile
- Evidence attribution: Claude's discretion based on boardroom tone guidelines

### Interactive behavior

- Partnership tab: SPV tracks always fully visible (title + scope + relevance), no expand/collapse — content is short enough
- Intake tab (Step 3): unchanged — keep existing contact/booking functionality
- Analytics: carry over session tracking and step time recording from DashboardClient
- Brand feel: Claude's discretion based on existing project-type UI patterns (getProjectUiProfile)

### Claude's Discretion

- Evidence attribution style on trigger cards (subtle source hint vs clean cards)
- Brand differentiation between Atlantis and Klarifai discover pages (same feel vs subtle accent differences)
- Exact spacing, typography, and card border colors for urgency indicators
- WizardShell extraction approach (how much to abstract vs keep simple)

</decisions>

<specifics>
## Specific Ideas

- KPI blocks should feel like McKinsey board presentation stats — one big number that tells a story
- Trigger urgency borders should be noticeable but not alarm-like — think strategic briefing, not dashboard alert
- The pending state for prospects without analysis should be minimal and professional, not apologetic

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 44-discover-rendering_
_Context gathered: 2026-03-08_

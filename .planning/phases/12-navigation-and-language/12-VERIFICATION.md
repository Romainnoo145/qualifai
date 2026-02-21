---
phase: 12-navigation-and-language
verified: 2026-02-21T16:59:01Z
status: gaps_found
score: 5/8 must-haves verified
gaps:
  - truth: "The terms 'Loss Map', 'Call Prep', 'Nodes', and 'Sprint Intelligence' do not appear in any sidebar item, page heading, button label, or tab label"
    status: failed
    reason: 'Three user-facing jargon strings remain in campaigns and contacts pages — they were not in the files targeted by the TERM-01 scan, so they survived'
    artifacts:
      - path: 'app/admin/campaigns/page.tsx'
        issue: "Line 87: section heading 'Initialize Tactical Sprint' (jargon — combine of 'Tactical' + 'Sprint')"
      - path: 'app/admin/campaigns/page.tsx'
        issue: "Line 178: button label 'Link Node' (Node = banned jargon)"
      - path: 'app/admin/campaigns/page.tsx'
        issue: "Line 261: empty state 'No node intelligence linked for this tactical sprint.' (both 'node intelligence' and 'tactical sprint' are jargon)"
      - path: 'app/admin/contacts/[id]/page.tsx'
        issue: "Line 95: badge 'Personnel Intelligence' (jargon — was listed in the plan to remove 'Personnel Nodes', but this variant was missed)"
    missing:
      - "campaigns/page.tsx line 87: change 'Initialize Tactical Sprint' to 'Create Campaign'"
      - "campaigns/page.tsx line 178: change 'Link Node' to 'Link Company'"
      - "campaigns/page.tsx line 261: change 'No node intelligence linked for this tactical sprint.' to 'No companies linked to this campaign.'"
      - "contacts/[id]/page.tsx line 95: change 'Personnel Intelligence' to 'Contact Profile' or remove the badge entirely"
  - truth: 'Settings page section headings use plain language instead of military/spy jargon'
    status: failed
    reason: "Minor residual: 'Select Target Domain' placeholder remains in campaigns page select element (not settings, but the truth broadly covers jargon in admin pages)"
    artifacts:
      - path: 'app/admin/campaigns/page.tsx'
        issue: "Line 152: select placeholder 'Select Target Domain' — 'Target Domain' is jargon (should be 'Select Company')"
    missing:
      - "campaigns/page.tsx line 152: change 'Select Target Domain' to 'Select Company'"
---

# Phase 12: Navigation and Language Verification Report

**Phase Goal:** Admin navigates a clean 6-item sidebar with no jargon — the structure alone communicates what the app does.
**Verified:** 2026-02-21T16:59:01Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                             | Status   | Evidence                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Sidebar shows exactly 6 items: Dashboard, Companies, Campaigns, Draft Queue, Use Cases, Signals — in that order                                   | VERIFIED | `navItems: NavItem[]` array in `app/admin/layout.tsx` lines 125-132 contains exactly 6 items in the specified order                                                                                                                                                                                                                          |
| 2   | No nav group labels remain — items are a flat list without section headings                                                                       | VERIFIED | `navItems` is typed `NavItem[]` (flat), both desktop and mobile `<nav>` iterate directly over `navItems.map(...)` — no group `<p>` labels exist                                                                                                                                                                                              |
| 3   | Removed pages (Hypotheses, Research runs, Product Briefs, Contacts) are still accessible via URL but not in the sidebar                           | VERIFIED | No hrefs to `/admin/hypotheses`, `/admin/research`, `/admin/briefs`, `/admin/contacts` in the navItems array; pages directory still exists                                                                                                                                                                                                   |
| 4   | Mobile sidebar matches desktop sidebar — same 6 items, same order                                                                                 | VERIFIED | Mobile `<nav>` at line 246 iterates `{navItems.map((item) => (<NavLink key={item.href} item={item} />))}` — same array, same NavLink component                                                                                                                                                                                               |
| 5   | The terms 'Loss Map', 'Call Prep', 'Nodes', and 'Sprint Intelligence' do not appear in any sidebar item, page heading, button label, or tab label | FAILED   | 4 user-facing jargon strings remain in campaigns page (lines 87, 178, 261) and contacts detail page (line 95) — see Gaps section                                                                                                                                                                                                             |
| 6   | All replaced labels use plain Dutch/English equivalents that a non-technical admin understands                                                    | PARTIAL  | Most replacements are clean. Settings, briefs, and layout are fully clean. Campaigns and contacts still have jargon (see truth 5)                                                                                                                                                                                                            |
| 7   | Settings page section headings use plain language instead of military/spy jargon                                                                  | VERIFIED | Settings page: "Usage Overview", "Credits Used", "Companies", "Contacts", "Signals", "Data Export", "System Info" — all plain language, all verified                                                                                                                                                                                         |
| 8   | Campaigns page uses 'Companies' instead of 'Nodes' and 'Campaign Processing' instead of 'Sprint Intelligence'                                     | PARTIAL  | The stat count label correctly shows "X Companies" (line 209) and the processing section correctly says "Campaign Processing" (line 223). BUT the section heading "Initialize Tactical Sprint" (line 87), button label "Link Node" (line 178), and empty state "No node intelligence linked for this tactical sprint." (line 261) all remain |

**Score:** 5/8 truths verified

---

### Required Artifacts

| Artifact                                           | Expected                                                         | Status   | Details                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------- | ---------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/admin/layout.tsx`                             | Restructured sidebar with 6 nav items                            | VERIFIED | navItems flat array, 6 items, correct order, both navs use same array                                                                                                                                                                                                                                                            |
| `components/features/prospects/command-center.tsx` | Plain-language status and button labels replacing Loss Map       | VERIFIED | Lines 157, 160, 185: "Workflow Report ready", "No Workflow Report", "Regenerate Report"/"Generate Report" — all correct                                                                                                                                                                                                          |
| `app/admin/prospects/[id]/page.tsx`                | Renamed tabs and buttons (no Loss Map, no Call Prep)             | VERIFIED | Line 216: `label: 'Workflow Report'`, line 221: `label: 'Call Brief'`, line 1024: "Generate Report", line 1051: "Run research first to generate the workflow report.", line 1092: "No workflow report generated yet."                                                                                                            |
| `app/admin/campaigns/page.tsx`                     | Renamed labels (no Nodes, no Sprint Intelligence)                | STUB     | Partial — "Add Companies to Campaign" (line 132) and "Campaign Processing" (line 223) and "{N} Companies" (line 209) are correct, but "Initialize Tactical Sprint" (line 87), "Link Node" (line 178), "No node intelligence linked for this tactical sprint." (line 261), and "Select Target Domain" (line 152) remain as jargon |
| `app/admin/briefs/page.tsx`                        | Renamed heading and labels (no Loss Map, no intelligence jargon) | VERIFIED | "Workflow Reports" heading, "Generated Reports" badge, "Select a report", "Choose a report from the list to preview.", "Loading report...", "Export PDF", "Research Run:" — all clean                                                                                                                                            |
| `app/admin/settings/page.tsx`                      | Plain-language section headings and stat labels                  | VERIFIED | All 4 section headings and all stat labels are plain language                                                                                                                                                                                                                                                                    |
| `app/admin/layout.tsx`                             | Login subtitle without jargon                                    | VERIFIED | Line 80: "Sales Intelligence"                                                                                                                                                                                                                                                                                                    |
| `app/admin/contacts/[id]/page.tsx`                 | Button label without Loss Map                                    | PARTIAL  | Line 149: "No Report Yet" is correct. BUT line 95 shows badge "Personnel Intelligence" — a different jargon string that was not targeted by the plan but is user-visible                                                                                                                                                         |

---

### Key Link Verification

| From                                | To                                                                                              | Via                                              | Status   | Details                                                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------- |
| `app/admin/layout.tsx`              | `/admin, /admin/prospects, /admin/campaigns, /admin/outreach, /admin/use-cases, /admin/signals` | navItems array href values                       | VERIFIED | All 6 hrefs present at lines 126-131, desktop nav at line 179 and mobile nav at line 247 both map over navItems |
| `app/admin/prospects/[id]/page.tsx` | `command-center.tsx`                                                                            | props (latestLossMap prop name stays — internal) | VERIFIED | `latestLossMap` prop passed through; user-facing strings in CommandCenter changed to "Workflow Report" language |

---

### Requirements Coverage

Not explicitly mapped in REQUIREMENTS.md for phase 12 — phase is a UX cleanup task.

---

### Anti-Patterns Found

| File                               | Line | Pattern                                                             | Severity | Impact                                                        |
| ---------------------------------- | ---- | ------------------------------------------------------------------- | -------- | ------------------------------------------------------------- |
| `app/admin/campaigns/page.tsx`     | 87   | "Initialize Tactical Sprint" section heading rendered to user       | Blocker  | Directly contradicts phase goal — jargon visible in UI        |
| `app/admin/campaigns/page.tsx`     | 178  | "Link Node" button label                                            | Blocker  | "Node" is one of the explicitly banned terms                  |
| `app/admin/campaigns/page.tsx`     | 261  | "No node intelligence linked for this tactical sprint." empty state | Blocker  | Both "node intelligence" and "tactical sprint" are jargon     |
| `app/admin/contacts/[id]/page.tsx` | 95   | "Personnel Intelligence" badge                                      | Warning  | Jargon badge on contact detail page — missed in TERM-01 scope |
| `app/admin/campaigns/page.tsx`     | 152  | "Select Target Domain" select placeholder                           | Warning  | "Target Domain" jargon — should be "Select Company"           |

---

### Human Verification Required

None needed — all gaps are programmatically verified as user-facing string literals in JSX.

---

### Gaps Summary

The sidebar restructure (plan 01) is fully correct: 6 flat items, no groups, same mobile/desktop nav. This is clean.

The terminology pass (plan 02) was mostly successful — 7 files were touched and most jargon was removed cleanly. However, 4-5 user-facing jargon strings remain in `app/admin/campaigns/page.tsx` and `app/admin/contacts/[id]/page.tsx`.

Root cause: The campaigns page had jargon in sections that the plan DID target (the plan listed "Propagate Nodes to Sprint" → "Add Companies to Campaign" which was correctly changed at line 132), but missed three other jargon strings in the same file that were not listed in the plan specification. Similarly, the contacts page had "Personnel Intelligence" as a badge label that was adjacent to the targeted "No Loss Map" → "No Report Yet" change but was not in scope.

These are not stubs or incomplete implementations — the logic works fine. They are missed string replacements that leave the phase goal partially unmet.

**4 strings to fix across 2 files to close the gaps.**

---

_Verified: 2026-02-21T16:59:01Z_
_Verifier: Claude (gsd-verifier)_

# Admin Prospect Detail Redesign — Editorial

**Status:** Approved design, ready for implementation plan
**Created:** 2026-04-16
**Owner:** Romano Kanters
**Mockup:** `~/.gstack/projects/Romainnoo145-qualifai/designs/admin-prospect-detail-mockup/v2-editorial.html`

---

## 1. Problem

`app/admin/prospects/[id]/page.tsx` is 587 lines and "te onoverzichtelijk" per Romano. It mixes PipelineChip + QualityChip + a gradient-text hero + meta pills with colored icons + technology chips + a ProspectLastRunStatus mid-page block + ActionsPanel + ContactsSection + 5 tabs (Evidence, Intent Signals, Analysis, Outreach Preview, Results) — all vertically stacked on a cold white canvas. Running state appears three times (PipelineChip, ProspectLastRunStatus, EvidenceSection). Firmographics render twice. Tabs contain "data nobody looks at" but dominate vertical space.

Underlying admin globals (`app/globals.css` + `app/admin/layout.tsx`) use `font-weight: 900` everywhere, `.glass-card` with shadows, SF Pro system-ui stack, gradient-text hero names, colored-icon meta pills. Functional but visually busy for an operator tool used by multiple people.

## 2. Goal

Redesign `/admin/prospects/[id]` against a distinct admin aesthetic that:

1. Surfaces status answers in ≤2 seconds (stage, quality, errors, last event)
2. Hides deep data behind clicks instead of vertical scrolling
3. Uses typography + whitespace + one brand accent (gold) for hierarchy — not shadows, gradients, or decorative icon chips. The activity feed adds six subtle category tints for 1-second scanning, but those are scoped to event tags only.
4. Reads as a premium operator tool, not a playful SaaS dashboard
5. Works for multiple users (not just Romano's solo taste)

The new aesthetic must be consistent across all admin surfaces, so it also touches `app/admin/layout.tsx`, `app/globals.css`, and patterns used by sibling pages (Companies list, Campaigns, Offertes, Draft Queue, Use Cases, Signals).

## 3. Decisions locked during design

### 3.1 Information hierarchy (Q from HANDOFF §6.1)

The page opens to a **status-first dashboard**, with deep data hidden behind the activity feed's filter tabs and (for long-form content) separate sub-route pages.

Vertical order on the main page:

1. **Back line** — `← Companies / Marfa · 01 of 42`
2. **Hero** — name display + folio eyebrow + lede paragraph + 2 hero actions
3. **Mega-stat bar** — 4 headline metrics (Stage · Kwaliteit · Offertes · Outreach)
4. **3-column main grid:**
   - Left (280px) — Feiten list (8 key facts)
   - Center (flex) — Activity feed with filter tabs
   - Right (260px) — Actions stack + Contacts list

**Removed from current page:**

- `PipelineChip` (folded into mega-stat bar + pill in header)
- `QualityChip` (folded into mega-stat bar)
- `ProspectEnrichmentBadge` (redundant after Phase 61.2 parity)
- Technologies chip row (low signal)
- `ProspectLastRunStatus` component (folded into activity feed)
- Meta pills row with colored icons (replaced by Feiten key-value list)
- Tab navigation for Evidence / Intent / Analysis / Outreach / Results (replaced by activity feed filter tabs + sub-route pages)

### 3.2 Aesthetic — V2 Editorial

Name: **Editorial**. Ink-on-paper admin language, distinct from the client brochure but sharing Klarifai brand DNA (Sora, navy, gold).

**Canvas:** warm paper `#f5f2ea`. Warmer than admin's current `#FCFCFD`, cooler than the brochure container gradient. Signals boutique without being informal.

**Ink (primary text & borders):** navy `#0a0a2e`. Bolder than the muted slate-500 typical of SaaS. 1px ink dividers between sections read like page rules in a magazine.

**Surfaces:** two paper tones — `#f5f2ea` canvas and `#ece8da` paper-2 for card fills and the sidebar rail. No white, no shadows.

**Accent:** gold `#c79a1f` (ink-leaning) for primary CTAs and one highlight per page. `#e4c33c` reserved for the gold period on the hero name and the active indicator on the sidebar rail.

**Typography:**

- **Sora** 300 / 500 / 700 — display, body, headings (same as brochure, unifies the brand)
- **IBM Plex Mono** 400 / 500 / 600 — all data labels, timestamps, KvK numbers, IDs, run metadata, eyebrows. Pairs with Sora because both are contemporary; Plex Mono's humanist curves match the paper canvas better than JetBrains Mono's coder sharpness.
- Hero name: `clamp(72px, 9vw, 128px)` Sora 700, gold period
- Mega-stat values: 56px Sora 700
- Lede: 17px Sora 300
- Body: 14px Sora 300
- Mono labels: 10-11px Plex Mono 500 uppercase letter-spacing 0.14em

**Rejected explicitly:**

- Sora on current cool-slate canvas (`#fbfcfd` felt sterile)
- Full semantic palette (sage + blue + amber + coral) on status cells (felt "speels")
- Colored icon chips in buttons (emoji-level childishness)
- Pill-rounded buttons (too candy, too SaaS)
- JetBrains Mono alongside Sora (mismatch between paper warmth and coder sharpness)
- V1 Command Center dark mode (too dramatic for multi-user admin)
- V3 Console Dense 4-pane (too terminal, lost the editorial character)

### 3.3 Layout

**Left rail sidebar — 58px, icon-only**

- Background: `#ece8da` paper-2
- Border-right: 1px ink
- K logo top (30×30 navy square, gold K)
- 6 nav icons (Dashboard / Companies / Campaigns / Offertes / Draft Queue / Signals) — 16px lucide SVGs, 1.75px stroke
- Active state: ink color on hover-backgrounded item with a 2px gold bar on the left edge
- Romano RK avatar bottom (30×30 navy circle, gold initials)
- Title tooltips on hover for discoverability

**No topbar on desktop.** Content starts with the back-line.

**Hero**

- 56px top padding, 40px horizontal
- 1fr auto 2-column grid: content left, hero actions right
- Folio eyebrow — Plex Mono 10px with gold first chunk (`COMPANY 01` · industry · location · KvK)
- Name — `clamp(72px, 9vw, 128px)` Sora 700, gold period
- Lede — 17px Sora 300, max-width 620px
- Hero actions — stacked square buttons (no radius, ink borders, hover inverts)

**Mega-stat bar**

- 4-column grid with 1px ink bottom border
- Each cell: Plex Mono eyebrow, 56px Sora 700 value with optional gold dot, 12px muted sub
- Values: Stage (word) · Kwaliteit (number) · Offertes (€) · Outreach (fraction)

**3-column main grid**

- 280px / 1fr / 260px
- Internal padding 48px vertical, 32-40px horizontal per column
- 1px soft-rule dividers between columns
- Left column: Feiten key-value list (Plex Mono keys, Sora values)
- Center column: Activity feed article
- Right column: Actions pill list + Contacts list

### 3.4 Activity feed

The feed replaces both the Phase 61.1 "Laatste run" mid-page block AND the tab navigation to Evidence / Analysis / Outreach / Results. Events are pulled reverse-chronologically from:

- `EvidenceItem` batches (created during crawl)
- `ResearchRun` status transitions (start / complete / fail, with runId + model + duration)
- `ProspectAnalysis` generation events
- `OutreachLog` sends and engagement events (opens, clicks, replies)
- `Quote` create / update events (with amount + status)
- `NotificationLog` entries

**Event row shape:**

- 64px time gutter (Plex Mono, gold date + muted time)
- Title (17px Sora 600)
- Description (14px Sora 300 muted-dark, max-width 620px, supports `<b>` bold hits and `.mono` gold spans for run_ids / templates)
- Type tag — Plex Mono 9px uppercase 0.16em tracking, with subtle semantic tint

**Event type tags (only color beyond gold + ink):**

- `ENRICH` — sage green `#4a7a52` on `#ebf1e5` / border `#c5d4b9`
- `QUALITY` — gold-ink `#8c6f13` on `#fdf6d7` / border `#eddda4`
- `RUN` — ink blue `#3d5f82` on `#e8edf2` / border `#c1d0de`
- `QUOTE` — ink on paper-2 (neutral)
- `OUTREACH` — muted plum `#6e4780` on `#eee6f0` / border `#d9c5dd`
- `EVIDENCE` — olive `#5e6a3a` on `#f0efe0` / border `#cfd0a8`

All six tints are warm-paper-compatible, low saturation, no jarring contrast. They speed 1-second category scanning without breaking the monochrome+gold discipline.

**Filter tabs** — `All / Evidence / Runs / Outreach / Offertes`. Active tab gets a 2px gold bottom border. Default = All.

### 3.5 Sub-route pages (long-form views)

Per earlier decision, deep evidence / analysis / outreach / results get their own routes instead of collapsing tabs on the detail page.

- `/admin/prospects/[id]/evidence` — full 83+ evidence item list, source filters, scoring detail
- `/admin/prospects/[id]/analyse` — full master narrative + hypotheses + proof matches
- `/admin/prospects/[id]/outreach` — full cadence timeline, template editor, send scheduling
- `/admin/prospects/[id]/resultaten` — metrics + quote table + booking status

Each sub-route:

- Same 58px icon rail + same back-line style, but back-line reads `← Marfa · Dossier / Evidence`
- Compact identity header (40px logo, 24px name, 11px meta)
- Sub-nav (evidence · analyse · outreach · resultaten) as horizontal segmented control with gold active underline
- Content-specific layout below

Sub-routes are NOT in scope for this spec's first implementation — they become a follow-up phase after the main detail page ships. Sub-route links on the main page render as normal anchors; the target pages show the activity feed filtered to that type plus a "Volledige weergave volgt" note until a dedicated phase builds them out.

### 3.6 Component primitives to update or create

Updates to `app/globals.css`:

- Add Sora (300/400/500/700) + IBM Plex Mono (400/500/600) via `<link>` in `app/layout.tsx`
- Replace `--color-background #FFFFFF` with paper `#f5f2ea`
- Replace `--color-surface #FCFCFD` with paper-2 `#ece8da`
- Replace `--color-border` slate tokens with paper-rule `#c9c3b0`
- Replace `--color-brand-yellow #EBCB4B` with `--color-gold #c79a1f` + `--color-gold-hi #e4c33c`
- Add `--color-ink #0a0a2e` (replaces the ad-hoc `#040026` navy references across admin components)
- Add muted scale `#6e6958` / `#4a4536` for secondary text

Deprecate in `globals.css`:

- `.glass-card` — replace with flat paper-2 surface + 1px ink border
- `.admin-btn-primary` / `.admin-btn-secondary` / `.admin-btn-danger` — rewrite to `.btn` + `.btn--ink` / `.btn--paper` / `.btn--gold` with square corners
- `.admin-toggle-group` / `.admin-toggle-btn` — replace with horizontal tabs (gold bottom border on active)
- `.admin-state-pill` variants — keep the shape but re-palette against paper context
- `.admin-eyebrow` — swap from SF Pro font-weight 900 to Plex Mono 500

New components:

- `<IconRailSidebar>` — replaces the current 288px labeled sidebar
- `<EditorialHero>` — folio + name + lede + hero actions block
- `<MegaStatBar>` — 4-column stat display
- `<ActivityFeed>` — filterable reverse-chronological feed
- `<EventTypeTag>` — colored category tag
- `<FeitenList>` — key-value fact list
- `<ActionStack>` — vertical action buttons (right column)
- `<ContactsList>` — compact contact rows

## 4. Non-goals

- Mobile optimization (deferred; admin is desktop-first)
- Dark mode
- Redesigning the brochure (§3.1 untouched)
- Sub-route page implementations (separate phase)
- Changing any tRPC API, Prisma schema, or backend logic
- Redesigning sibling admin pages in the same phase (Campaigns, Offertes, Draft Queue, Signals, Use Cases, Dashboard) — those inherit the new tokens automatically but their page-specific layouts are out of scope; follow-up phases

## 5. Migration strategy

Three-step rollout inside a single phase:

1. **Foundation** (shared): update `app/globals.css` tokens, load fonts in `app/layout.tsx`, add new primitive components to `components/ui/admin/`. Existing pages keep working because old class names are aliased or deprecated gradually.
2. **Shell** (admin-wide): rewrite `app/admin/layout.tsx` to use the 58px icon rail. This visually changes every admin page immediately but preserves all nav targets.
3. **Detail page**: rewrite `app/admin/prospects/[id]/page.tsx` to the new editorial layout. Sub-route links are placeholders.

Each step is independently shippable and reviewable.

## 6. Open questions for implementation planning

1. Which existing admin primitive classes can we delete outright versus alias for the transition? (Likely answer: alias `.admin-btn-primary` → new `.btn--gold`, delete `.glass-card` entirely since it's incompatible.)
2. Do we keep `EvidenceSection`, `AnalysisSection`, `OutreachPreviewSection`, `ResultsSection` components mounted as tabs for the current detail page during transition, or replace in one PR? (Recommend: replace in one PR since the new page doesn't use tabs at all — the activity feed is the primary surface.)
3. Activity feed data: is there a single `prospectEvents` query we need to build (merging EvidenceItem + ResearchRun + Outreach + Quote into a unified timeline), or do we fetch each and merge client-side? (Recommend: unified server-side query with a discriminated union.)
4. Sub-route placeholder copy — what should `/admin/prospects/[id]/evidence` etc. show while the full page isn't built? (Recommend: activity feed filtered to that type + a "Volledige weergave volgt" note.)

## 7. Acceptance criteria

- All existing `api.admin.getProspect` and `api.research.listRuns` queries still work unchanged
- New `/admin/prospects/[id]` renders at 1440×900 with the V2 Editorial aesthetic
- Side rail navigation present on every admin page
- All admin buttons, pills, cards match the new tokens (no `.glass-card`, no `font-weight: 900` body text, no gradient-text hero)
- No purple, no coral, no orange, no serif display (DESIGN.md §2.1 hard rules still apply)
- Activity feed shows at least the last 10 events mixed from evidence + runs + outreach + quotes, with colored type tags and working filter tabs
- Keyboard shortcuts (⌘R new run, ⌘↵ start outreach) wired if trivial
- `npm run check` passes clean
- Mockup reference `v2-editorial.html` and production admin prospect detail page are visually within ±5% (typography scale, spacing, colors identical)

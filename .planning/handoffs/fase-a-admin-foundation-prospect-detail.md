# Fase A · Admin foundation + Prospect detail

**Status:** IN PROGRESS · being executed 2026-04-16
**Spec:** `docs/superpowers/specs/2026-04-16-admin-prospect-detail-redesign.md`
**Design reference:** `~/.gstack/projects/Romainnoo145-qualifai/designs/admin-prospect-detail-mockup/v2-editorial.html` on `http://127.0.0.1:9201/v2-editorial.html`
**Doelgroep:** intern (Romano + team)
**Aesthetic:** Editorial (paper `#f5f2ea`, Sora + IBM Plex Mono, 58px icon rail, square buttons, geen .glass-card, geen shadows)

---

## 1. Goal

Implement the V2 Editorial aesthetic for the admin surface, starting with the prospect detail page. This phase establishes the foundation that every other admin page will inherit.

Acceptance criteria recap (from spec §7):

- Paper canvas + ink text + gold accent + Plex Mono data labels live across admin
- 58px icon rail replaces the current 288px labeled sidebar
- `/admin/prospects/[id]` renders the new Editorial layout at 1440×900
- All existing tRPC queries (`api.admin.getProspect`, `api.research.listRuns`) keep working
- `npm run check` passes clean
- No mentions of `.glass-card`, `font-weight: 900` on body, or gradient-text hero remain

---

## 2. Execution order (3 atomic commits)

### Step 1 — Foundation: tokens + fonts

**Files:**

- `app/globals.css`
- `app/layout.tsx`

**Changes in `app/globals.css` @theme block:**

- Replace `--color-background: #FFFFFF` with `--color-background: #f5f2ea` (paper)
- Replace `--color-surface: #FCFCFD` with `--color-surface: #ece8da` (paper-2)
- Replace `--color-surface-hover: #F8F9FA` with `--color-surface-hover: #f0ebd9`
- Replace `--color-border: #F1F3F5` with `--color-border: #e2dcc6` (rule-soft)
- Replace `--color-border-strong: #E9ECEF` with `--color-border-strong: #c9c3b0` (rule)
- Rename `--color-brand-yellow: #EBCB4B` to `--color-gold: #c79a1f` (add `--color-gold-hi: #e4c33c`)
- Keep `--color-brand-yellow-dark: #D4B43B` as alias to `--color-gold` for backward compat during transition
- Add `--color-ink: #0a0a2e` (primary text + borders)
- Add `--color-muted: #6e6958` and `--color-muted-dark: #4a4536`
- Update `--color-foreground: #040026` to `--color-foreground: #0a0a2e`

**Replace the `--font-sans` / `--font-heading` tokens:**

```css
--font-sans: 'Sora', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
--font-heading:
  'Sora', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
--font-mono: 'IBM Plex Mono', 'SF Mono', ui-monospace, monospace;
```

**Remove these classes from @layer components (they conflict with Editorial):**

- `.glass-card`
- `.glass-panel`
- `.admin-toggle-group` / `.admin-toggle-btn` / `.admin-toggle-count` (replaced by simple horizontal tabs)

**Rewrite these classes:**

- `.admin-btn-primary` → gold bg `#c79a1f`, ink text, **square corners** `border-radius: 6px` (not `--radius-full`), Sora 500 13px, `font-weight: 500` (not 900), padding `10px 18px`
- `.admin-btn-secondary` → paper bg `#ffffff` or transparent, 1px ink border, ink text, square corners, Sora 500 13px
- `.admin-btn-danger` → keep variant but restyle to `#b45a3b` rust (warmer, paper-compatible)
- `.admin-eyebrow` → change `font-family` to mono (use `var(--font-mono)`), `font-weight: 500` not 900, keep size and spacing
- `.admin-state-pill` → keep shape, re-palette to ink-on-paper tones (drop the blue/purple variants)

**Changes in `app/layout.tsx`:**

Replace the current Inter + Space Grotesk loads with Sora + IBM Plex Mono via `next/font/google`:

```ts
import { Sora, IBM_Plex_Mono } from 'next/font/google';

const sora = Sora({
  variable: '--font-sora',
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
});
```

Update `<body>` className to `${sora.variable} ${ibmPlexMono.variable} font-sans antialiased`. Update body `bg-[#FCFCFD]` → `bg-[var(--color-background)]`.

**Commit message:** `feat(admin): swap globals to Editorial tokens + Sora/Plex Mono fonts`

---

### Step 2 — Shell: admin layout rail

**File:** `app/admin/layout.tsx`

Rewrite the `AdminShell` component. The current shell has:

- 288px labeled sidebar (`w-72`) with SVG + label
- 64px hidden topbar on desktop
- Mobile slide-out nav

Replace with:

- 58px icon-only rail (`w-[58px]`), paper-2 bg, 1px ink right border
- No topbar at all on desktop
- K logo top (30×30 navy rounded-sm, gold K Sora 700 13px)
- 6 nav items: Dashboard / Companies / Campaigns / Offertes / Draft Queue / Signals (remove Use Cases for now if it's unused — confirm first)
- Nav items: 36×36 hit target, ink color on hover with 2px gold left bar on active state
- Icon: 16px lucide SVG with 1.75 stroke
- Each `<Link>` gets a `title="..."` attribute for hover tooltip
- Bottom: RK avatar 30×30 navy circle with gold initials (Sora 700 10px)
- Logout wired to existing `onLogout` handler

For mobile: keep a slide-out overlay but trigger via a hamburger icon at the top of the rail (above nav items). Out of scope for first pass if it complicates — can remain desktop-focused.

Also update:

- The login screen (`AdminAuth` component, line 88-218) — replace `bg-[#F9F9FB]` page bg with `bg-[var(--color-background)]`, replace gradient decorations with flat paper surfaces, replace `font-black` usages with `font-medium`, replace `font-bold` with `font-semibold` on non-heading text. Keep the 2 account-button pattern but square the corners.

**Remove from AdminShell:**

- `mobileNavOpen` state handling on desktop (keep mobile overlay if trivially adaptable, else punt to follow-up)
- Top header `<header className="flex h-20 ...">` — was already hidden on desktop (`lg:h-0`), now delete entirely
- The padding wrapper `<div className="mx-auto max-w-7xl px-8 py-16 lg:px-20 lg:py-24">` — move padding responsibility into individual pages. Let the admin shell just be sidebar + main content with 0 padding on the shell.

**Commit message:** `feat(admin): rewrite shell to 58px icon rail + remove desktop topbar`

---

### Step 3 — Prospect detail page

**File:** `app/admin/prospects/[id]/page.tsx`

Current file is 587 lines. Rewrite to the V2 Editorial layout. Reference: `v2-editorial.html` mockup on :9201.

**Keep these queries unchanged** (they already work):

- `api.admin.getProspect.useQuery({ id })`
- `api.research.listRuns.useQuery({ prospectId: id })`
- `api.research.listOverrideAudits.useQuery({ runId }, { enabled: !!runId })`

**Keep these imports / utilities:**

- `useParams`, `useState`, `useSyncExternalStore`
- `Link` from next/navigation
- `ResearchRunRow` type helper (already defined in current file for tRPC v11 inference)
- `useDebugMode` hook
- `buildDiscoverPath`, `deepAnalysisStatus`

**Remove these imports:**

- All lucide icons that were used for meta pills (`Globe`, `MapPin`, `Users`, `DollarSign`, `Phone`, `Calendar`, `Linkedin`, etc) — new page uses different icon set
- `PipelineChip`, `QualityChip`, `ProspectEnrichmentBadge` — folded into new components
- `ProspectLastRunStatus`, `ProspectActionsPanel` — folded into activity feed + actions stack
- Tab components (`EvidenceSection`, `IntentSignalsSection`, `AnalysisSection`, `OutreachPreviewSection`, `ResultsSection`) — moved to sub-route pages (placeholders for now)
- `SourceSetSection` — debug only, keep but move to subroute debug view

**Net new structure:**

```tsx
<div className="prospect-page">
  <div className="back-line">
    <Link href="/admin/prospects">← Companies</Link>
    <span> / </span>
    <strong>{p.companyName}</strong>
    <span>
      {' '}
      · {runPosition} of {totalCount}
    </span>
  </div>

  <header className="hero">
    <div className="folio">
      <span className="gold">COMPANY 0{position}</span>
      <span>{p.industry?.toUpperCase()}</span>
      <span>{p.city?.toUpperCase()}</span>
    </div>
    <h1 className="hero-name">
      {p.companyName}
      <span className="dot">.</span>
    </h1>
    <p className="lede">{generatedLedeFromAnalysis}</p>
    <div className="hero-actions">
      <button className="btn btn-paper">Kopieer voorstel-link</button>
      <button className="btn btn-gold">Start voorstel</button>
    </div>
  </header>

  <MegaStatBar prospect={p} latestRun={latestRun} />

  <div className="main-grid">
    <aside className="col-left">
      <FeitenList prospect={p} />
    </aside>
    <section className="col-center">
      <ActivityFeed prospectId={id} />
    </section>
    <aside className="col-right">
      <ActionStack prospectId={id} />
      <ContactsList contacts={p.contacts} />
    </aside>
  </div>
</div>
```

**New components to create in `components/features/prospects/editorial/`:**

- `BackLine.tsx`
- `Hero.tsx` (folio + name + lede + actions)
- `MegaStatBar.tsx` (4 stat cells, derives from `computePipelineStage` + latestRun data)
- `FeitenList.tsx` (key-value rows from prospect fields)
- `ActivityFeed.tsx` (fetches from new tRPC query — see below)
- `EventTypeTag.tsx` (6 semantic variants)
- `ActionStack.tsx` (vertical action buttons incl. keyboard shortcut chips)
- `ContactsList.tsx` (avatar + name + role compact rows)

**New tRPC query needed:** `api.admin.getProspectActivity.useQuery({ id })`

This merges EvidenceItem batches + ResearchRun transitions + ProspectAnalysis generations + OutreachLog entries + Quote create events + NotificationLog into a unified reverse-chronological feed. Shape:

```ts
type ActivityEvent = {
  id: string;
  type: 'ENRICH' | 'QUALITY' | 'RUN' | 'QUOTE' | 'OUTREACH' | 'EVIDENCE';
  occurredAt: Date;
  title: string;
  description: string;
  metadata: Record<string, string>;
};
```

Add to `server/routers/admin.ts`. Query each source table filtered by `prospectId`, map to the union type, sort desc, limit 50.

**Sub-route placeholders** (create but minimal):

- `app/admin/prospects/[id]/evidence/page.tsx` — renders `<ActivityFeed prospectId={id} filter="EVIDENCE" />` + "Volledige weergave volgt" note
- `app/admin/prospects/[id]/analyse/page.tsx` — same pattern, filter analyse
- `app/admin/prospects/[id]/outreach/page.tsx` — same
- `app/admin/prospects/[id]/resultaten/page.tsx` — same

Each placeholder has a compact sub-hero (40px logo, 24px name) and a segmented tab nav (gold underline active state). The full long-form content for each sub-route is deferred to a separate phase.

**Commit message:** `feat(admin): rewrite prospect detail to Editorial + activity feed`

---

## 3. Critical gotchas

- **Do not break `app/offerte/[slug]/`**: the brochure lives in its own scoped layout (`app/offerte/[slug]/layout.tsx` loads Sora directly). Make sure the new root layout doesn't override that by adding a body-wide font class that clashes. Check by visiting `/offerte/marfa` after Step 1.
- **Do not break `app/discover/[slug]/`**: that page is client-facing and uses its own styling. Fase D will redesign it to brochure language; until then leave it alone. Confirm it still renders after Step 1.
- **Tailwind class dependency**: admin pages use `bg-slate-50`, `border-slate-100`, `text-slate-500` etc. directly in TSX. These still work (Tailwind defaults) but the Editorial palette wants paper tones. Don't do a global find-replace — only touch the classes used by the prospect detail page + admin shell. Sibling pages (Companies list, Offertes, Draft Queue etc.) keep working with their existing slate classes until their own redesign phase.
- **`getProspect` returns a deep type that triggers TS2589**. Current file uses `as any` casts with `// TODO: tRPC v11 inference` comments. Keep the pattern in the new file. Use `Prisma.ProspectGetPayload<{ include: { ... } }>` where it works.
- **Quality chip override audits**: the current page renders override history when `overrideAudits.data?.length > 0`. Fold this into the activity feed as its own event type (`QUALITY_OVERRIDE`) rather than a separate block.
- **`SourceSetSection` is debug-only** (rendered when `debugMode` is true via localStorage flag). Keep the hook but render the section as a collapsed disclosure at the bottom of the activity feed when debug is on.

---

## 4. Validation

After Step 3:

```bash
cd /home/klarifai/Documents/klarifai/projects/qualifai
npm run check
# If errors, fix until clean. Do NOT commit with errors.

# Dev server on :9200 should be running (background task from earlier)
# Visit http://localhost:9200/admin/prospects/<marfa-id> in a browser
# Compare to http://127.0.0.1:9201/v2-editorial.html — should be visually ~identical
```

Golden path smoke test:

1. Load `/admin/prospects` list — sibling page still renders (with old styling, that's fine)
2. Click Marfa — detail page renders in Editorial layout
3. Hero shows `Marfa.` with gold period
4. Mega-stat bar shows 4 values (Ready, 0.68, €32k, 1/3 or similar)
5. Feiten list shows marfa.nl + Bouwbeheer + Amsterdam + KvK 67892345
6. Activity feed shows at least 5 events with colored type tags
7. Actions stack has 4 buttons, last one gold
8. Contacts list shows 3 contacts with avatars
9. Click a sub-route card (e.g. Evidence) — placeholder page renders without 500
10. Visit `/offerte/marfa` — brochure still renders untouched

---

## 5. Commits checklist

- [ ] Step 1: `feat(admin): swap globals to Editorial tokens + Sora/Plex Mono fonts`
- [ ] Step 2: `feat(admin): rewrite shell to 58px icon rail + remove desktop topbar`
- [ ] Step 3: `feat(admin): rewrite prospect detail to Editorial + activity feed`
- [ ] Push to main only after validation passes and Romano signs off

---

## 6. What comes after Fase A

Updating sibling admin pages (Companies list, Campaigns, Offertes list, Draft Queue, Signals, Use Cases, Dashboard) to the Editorial aesthetic. Each is its own small phase, not bundled here.

Fase B (`/admin/quotes/*` editorial + brochure wired to real Quote data) starts once Fase A is shipped.

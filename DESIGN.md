# Design System — Qualifai × Klarifai

**Created:** 2026-04-14
**Owner:** Romano Kanters / Klarifai
**Status:** Approved (Phase 1 design consultation)
**Source:** `/design-consultation` session with real brand grounding

---

## 1. Product Context

**What this is:** Qualifai is Klarifai's internal outbound + discovery engine. Two distinct surfaces, two distinct audiences, one brand.

| Surface                                  | Audience                      | Role                                                                             |
| ---------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------- |
| **Admin** (`/admin/*`)                   | Romano (internal)             | Manages prospects, drafts quotes, monitors pipeline, reviews outreach            |
| **Client brochure** (`/voorstel/[slug]`) | Dutch SMB prospect (external) | Receives a bespoke, click-through proposal from Klarifai — the sales deliverable |

**What this is NOT:**

- A marketing site for Qualifai (Qualifai is internal tooling)
- A pitch deck (the client brochure is an essay + offerte, structured)
- Self-serve SaaS (Klarifai is a Dutch software development agency building A-to-Z custom portals; Qualifai is Romano's private sales engine for this consulting)

**Why a design system now:** Phases 60–61.3 shipped functional admin UI without a formal design contract. Romano's v9.0 smoke test surfaced the cost: inconsistent components, ad-hoc spacing, no shared token vocabulary. The client `/voorstel` surface is being designed **fresh** here, and the admin is being **re-grounded** against this same system over time.

---

## 2. Brand Tokens

**Source of truth:** `klarifai-core/src/brand/theme.ts` + `klarifai-core/docs/design/proposal-template.html`. This design system **reuses** the Klarifai brand. It does NOT invent new colors, fonts, or logo.

### 2.1 Color

```css
:root {
  /* Klarifai Primary */
  --color-navy: #0a0a2e; /* primary text, dark surfaces, brochure cover */
  --color-navy-light: #4a5568; /* secondary text, muted body */
  --color-gold: #e4c33c; /* accent, highlights, primary CTA, logo */
  --color-gold-light: #f4d95a; /* gold gradient end */

  /* Neutrals */
  --color-white: #ffffff; /* content backgrounds (brochure, admin light mode) */
  --color-grey-light: #f1f5f9; /* subtle hover/active backgrounds */
  --color-grey-border: #e2e8f0; /* 1px borders */
  --color-muted: #94a3b8; /* tertiary text, disabled */

  /* Semantic */
  --color-success: #3fb37f;
  --color-warning: #e8a13c;
  --color-error: #e54b4b;
  --color-info: #007aff; /* focus ring only — Apple Blue legacy, keep */
}
```

**Usage rules (HARD):**

- **Gold `#E4C33C`** appears at most **once or twice per screen** — only on the primary CTA pill and the one highlight moment (section number prefix, logo mark, active arrow). NEVER as background fill. NEVER as gradient background. NEVER as decorative flourish.
- **Navy `#0a0a2e`** is the only dark color. Never pure black `#000000`. Never a different deep blue.
- **No purple. No violet. No teal. No coral. No orange.** The brand palette is navy + gold + white + grey. Period.
- Semantic colors are only for state feedback (success toast, error border), never as brand.

### 2.2 Typography

**Primary font:** **Sora** (weights 300 / 500 / 700) — loaded from Google Fonts. Geometric sans with slight character. Source: `klarifai-core/docs/design/proposal-template.html`.

```html
<link
  href="https://fonts.googleapis.com/css2?family=Sora:wght@300;500;700&display=swap"
  rel="stylesheet"
/>
```

**NOT Inter. NOT SF Pro. NOT Instrument Serif. NOT Helvetica.** The earlier Qualifai admin used SF Pro / Inter as a placeholder — over time, migrate admin surfaces to Sora to unify with the brochure.

#### Scale

| Role                    | Weight | Size (desktop)            | Line-height | Letter-spacing | Usage                                              |
| ----------------------- | ------ | ------------------------- | ----------- | -------------- | -------------------------------------------------- |
| Display XL              | 700    | 72px / 4.5rem             | 1.05        | -0.025em       | Cover hero, post-accept hero                       |
| Display L               | 700    | 56–64px / 3.5–4rem        | 1.1         | -0.02em        | Section main heading ("Plancraft loopt vast…")     |
| Display M               | 700    | 40px / 2.5rem             | 1.15        | -0.015em       | Sub-headings, admin page titles                    |
| Heading                 | 500    | 22–28px / 1.375–1.75rem   | 1.3         | -0.01em        | List item titles, card headings                    |
| Intro lead              | 500    | 24–26px / 1.5–1.625rem    | 1.3         | -0.005em       | Single punchy statement under main heading         |
| Body                    | 300    | 17–18px / 1.0625–1.125rem | 1.6         | 0              | Paragraphs, descriptions                           |
| Body small              | 300    | 15–16px / 0.9375–1rem     | 1.5         | 0              | Admin metadata, form labels                        |
| Section label (eyebrow) | 500    | 11–12px / 0.6875–0.75rem  | 1           | 0.15em         | Uppercase section tags like `[ 01 ]  DE UITDAGING` |
| Caption                 | 300    | 13–14px / 0.8125–0.875rem | 1.5         | 0              | Legal text, timestamps                             |
| Mono label              | 500    | 11px / 0.6875rem          | 1           | 0.1em          | Progress indicators `01 / 07`, nav breadcrumbs     |

**Weight rules:**

- **700** is reserved for main headings and big display moments. Never for body.
- **500** is the workhorse for sub-headings, labels, navigation, form labels, CTAs.
- **300** is the body weight. Surprising choice — it's light — but it's what the proposal template uses and it reads well at 17–18px with generous line-height.

**Section label pattern (HARD):**
Every brochure section starts with an eyebrow label in this exact format:

```
[ 01 ]  DE UITDAGING
```

— Where `[ 01 ]` is rendered in **gold #E4C33C**, Sora 500, uppercase, letter-spacing 0.15em
— And the label text (e.g. `DE UITDAGING`) is in **navy #0a0a2e**, Sora 500, same uppercase treatment
— Two spaces between `]` and the label
— This is the single strongest brand signal after the logo itself. Every section uses it.

**Heading period pattern:**
Main headings end in a period, and the period is rendered in **gold**:

```
Plancraft loopt vast op zijn eigen succes█
                                         ↑
                                      gold
```

Tiny detail, high-impact brand signature.

### 2.3 Spacing

**Base unit:** 4px / 0.25rem.

```css
:root {
  --space-2xs: 0.125rem; /*  2px */
  --space-xs: 0.25rem; /*  4px */
  --space-sm: 0.5rem; /*  8px */
  --space-md: 1rem; /* 16px */
  --space-lg: 1.5rem; /* 24px */
  --space-xl: 2rem; /* 32px */
  --space-2xl: 3rem; /* 48px */
  --space-3xl: 4rem; /* 64px */
  --space-4xl: 6rem; /* 96px */
  --space-5xl: 8rem; /* 128px */
}
```

**Density:**

- **Brochure surface:** spacious. Section padding top/bottom: `--space-4xl` (96px) or `--space-5xl` (128px). Reading measure max-width: **720–760px** for body text (not wider — reading comfort).
- **Admin surface:** comfortable. Section padding: `--space-2xl` (48px). Card padding: `--space-xl` (32px). Table row padding: `--space-md` (16px) vertical.

### 2.4 Border radius

```css
:root {
  --radius-xs: 0.375rem; /*  6px — tiny pills, badges */
  --radius-sm: 0.75rem; /* 12px — form inputs, small cards */
  --radius-md: 1rem; /* 16px — cards, panels */
  --radius-lg: 1.25rem; /* 20px — large cards */
  --radius-xl: 1.5rem; /* 24px — hero cards */
  --radius-full: 9999px; /* pill buttons — the Klarifai signature */
}
```

**Pill buttons** (`--radius-full`) are the Klarifai signature CTA shape. Primary CTA is always a gold pill. Secondary is always a white pill with 1px navy border.

### 2.5 Borders

- **Subtle:** `1px solid #f1f5f9` — container divisions, card borders when on white
- **Standard:** `1px solid #e2e8f0` — form inputs, list item separators, table rows
- **Strong:** `1px solid #0a0a2e` — navy outline buttons, active state borders

Never use more than 1px. No thick borders. No dashed. No dotted.

### 2.6 Shadows

Almost never. Klarifai aesthetic is flat, borders-over-shadows.

Exception: subtle lift on hover for interactive cards:

```css
box-shadow: 0 1px 2px rgba(10, 10, 46, 0.04); /* resting */
box-shadow: 0 4px 12px rgba(10, 10, 46, 0.08); /* hover only */
```

No drop shadows on text. No ambient shadows on sections. No glow effects.

---

## 3. Two Surfaces — Layout Patterns

### 3.1 Client Brochure (`/voorstel/[slug]`) — Click-through pages

**Interaction model:** full-viewport click-through brochure. Each section is a separate page the client navigates with arrows or keyboard.

**Viewport:** desktop-first, 1440×900 reference. Responsive down to tablet (1024); below tablet, collapses to a single-column scroll with same content ordering.

**Chrome (persistent across all pages):**

```
┌─────────────────────────────────────────────────────────┐
│ Klarifai         01 / 07         KLARIFAI ✕ MARFA       │  ← 64px top bar, 1px bottom border
├─────────────────────────────────────────────────────────┤
│                                                         │
│                                                         │
│              [page content area — max 1100px wide,     │
│               centered, generous padding]              │
│                                                         │
│                                                         │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ ←                                                    →  │  ← 56px circular arrow buttons
└─────────────────────────────────────────────────────────┘
     grey outline                              gold fill
```

**Top bar (64px, sticky):**

- Left: `Klarifai` wordmark (Sora 500, 16px, navy). No icon — the "K" icon only appears on the cover page as hero element.
- Center: progress indicator `01 / 07` (Sora 500, 11px, uppercase, navy-light #4a5568, letter-spacing 0.1em)
- Right: `KLARIFAI ✕ MARFA` collab label (Sora 500, 11px, uppercase, navy, letter-spacing 0.15em, with a real `×` multiplication symbol)
- Bottom border: 1px solid #f1f5f9

**Arrow navigation (bottom, 56px height):**

- Left button: 56×56 circular, 1px #e2e8f0 border, white bg, navy chevron-left icon. Disabled (grey) on first page. Hover: fills with #f1f5f9.
- Right button: 56×56 circular, solid gold `#E4C33C` → `#F4D95A` gradient fill, navy chevron-right icon. On the final page (post-accept), disabled state.
- Keyboard: `←` and `→` arrows navigate. `Escape` closes any modal. `M` toggles the menu overlay.

**Menu overlay (toggle top-right via small "MENU" label):**

- Full-screen semi-transparent navy #0a0a2e overlay at 94% opacity, content centered
- Vertical list of all 7 sections, each clickable, with number prefix in gold and title in white Sora 500 24px
- Current section highlighted with a gold left-edge bar
- Allows jumping to any section without click-through

**Motion:**

- Page transitions: 250ms ease-in-out cross-fade between pages. No sliding. No parallax. No scroll-driven choreography.
- Arrow button hover: 150ms ease-out scale 1.02 + shadow lift
- Keyboard nav: same 250ms transition

### 3.2 Admin (`/admin/*`) — Command center

**Interaction model:** Linear-style sidebar + main content. Keyboard-first, data-dense, information hierarchy over decoration.

**Chrome:**

```
┌─────────┬───────────────────────────────────────────────┐
│ Klarifai│  Prospects                            [filter]│  ← 64px top bar
│         ├───────────────────────────────────────────────┤
│ Prospects│                                               │
│ Offertes │  ┌───────────────────────────────────────┐   │
│ Drafts   │  │  content card                         │   │
│ Signals  │  │                                       │   │
│          │  └───────────────────────────────────────┘   │
│ Romano   │                                               │
└─────────┴───────────────────────────────────────────────┘
  240px            main content, max 1440px
```

**Sidebar (240px fixed, left):**

- Klarifai wordmark top
- Vertical nav: Prospects · Offertes · Drafts · Signals · (future: Use Cases, Dashboard)
- Active item: `#f1f5f9` background, 2px navy left-edge bar
- Each item: Sora 500 14px navy, 12px vertical padding, icon prefix optional (keep minimal)
- Bottom: Romano profile (circle avatar + name)

**Top bar (64px):**

- Left: page title (Sora 500, 20px)
- Right: filters, search, actions (icon buttons only, no labels)

**Content:**

- White bg
- Generous padding: 48px sides, 48px top
- Cards with 1px #e2e8f0 border, 16px radius, 24–32px internal padding
- Tables with 1px row borders, Sora 300 body, Sora 500 headers, mono numbers

**No sidebar decoration. No illustrations. No avatars for system items. Typography + whitespace + 1px lines + occasional gold accent.**

### 3.3 Shared — what both surfaces have in common

- Sora font family
- Navy/gold/grey palette
- 4px base spacing scale
- Pill button shape for CTAs (gold primary, white/navy-border secondary)
- 1px borders, never thicker
- No decoration, no illustration, no gradient backgrounds
- No purple, no teal, no coral

---

## 4. Client Brochure — 7-Page Architecture

The client-facing `/voorstel/[slug]` is structured as **7 pages** navigated click-through. Each page has a specific content model and role.

### Page 1 — Cover

**Background:** full-viewport dark navy `#0a0a2e`.
**Video:** `<video autoplay muted playsinline>` with the Klarifai intro MP4 playing once. **NO `loop` attribute.** When the video ends, it freezes on its last frame. The video is `object-fit: cover` and fills the entire viewport.

**Poster:** a still frame from t=12s is the `poster` attribute so the cover is visually complete even before the video loads.

**Fallback:** if `prefers-reduced-motion: reduce` OR video fails to load, show the poster image as a static background. No animation.

**Content layered on top of the video:**

- Top bar chrome (as above)
- Centered hero content:
  - Klarifai gold K mark (80px, SVG) centered above the headline
  - Main heading: `Voorstel voor {client.companyName}` — Sora 700 72px white, centered
  - Subtitle: `Klarifai ✕ {client.companyName} — {project.name}` — Sora 500 24px gold `#E4C33C`, centered
  - Metadata line: `{month} {year} · {duration} · {project.type}` — Sora 300 18px `#94a3b8`, centered
  - Bottom CTA: gold pill button `Begin met lezen →` — Sora 500 16px navy text on gold fill, centered, ~200px above the bottom arrow chrome

**Arrow chrome:** left arrow disabled (first page), right arrow is the gold "next" — labeled above it with `Begin met lezen →` in small uppercase gold.

**Progress:** `01 / 07`.

### Page 2 — De Uitdaging

**Background:** white `#FFFFFF`.

**Content (720px reading measure, centered):**

- Section label: `[ 01 ]  DE UITDAGING` (gold `[ 01 ]`, navy label)
- Main heading: 2-line Sora 700 56–64px navy with final period in gold
- Intro lead: Sora 500 26px navy, 1 punchy statement, 1 line max
- Body paragraph(s): Sora 300 18px navy-light #4a5568, 1.6 line-height, 2–3 paragraphs max
- Numbered list (2–4 items): each item is
  - Big gold Sora 700 48px number (01/02/03/…)
  - Title: Sora 500 22px navy
  - Description: Sora 300 17px navy-light, 2 lines
  - 1px #e2e8f0 separator below each item

**Render guidance:** the AI mockup rendered a navy top bar filling the width, which is optional styling. Prefer white bg + 1px border top bar (chrome consistency with other pages).

### Page 3 — Onze Aanpak

**Background:** white.

**Content:**

- Section label: `[ 02 ]  ONZE AANPAK`
- Main heading: same pattern
- Intro lead: same pattern
- Body paragraph(s)
- **Horizontal 4-phase grid** (preferred — the mockup rendered this spontaneously and it's stronger than a vertical list):
  - 4 columns side by side
  - Each column: gold Sora 700 48px number, Sora 500 20px navy title, Sora 300 15px navy-light description (3 lines), small `OPLEVERING` label in Sora 500 11px uppercase + Sora 300 14px deliverable description
  - Columns separated by 1px #e2e8f0 vertical dividers
  - On tablet/mobile, collapses to vertical stack

### Page 4 — Investering

**Background:** white.

**Content:**

- Section label: `[ 03 ]  INVESTERING`
- Main heading: Sora 700 56px navy (e.g. "Het prijsvoorstel.")
- Intro lead: optional
- **Line items table** (component: `QuoteTable`):
  - Headers: `FASE` / `OMSCHRIJVING` / `UREN` / `TARIEF` / `BEDRAG` — Sora 500 11px uppercase navy, letter-spacing 0.1em
  - Rows: Sora 500 phase name + Sora 300 description in first column, Sora mono-style tabular-nums for numbers (right-aligned), 1px #e2e8f0 row separators
  - Totals block (right-aligned below table): Subtotaal, BTW 21%, **Totaal** — the Totaal row is rendered at Sora 700 32px navy with a thin gold underline `#E4C33C` below it
- **Payment schedule card** below totals:
  - 1px #e2e8f0 border, 16px radius, 32px padding
  - 3 rows: `25% bij start · €X` / `50% bij oplevering · €X` / `25% na acceptatie · €X`
  - Each row: Sora 500 15px navy left, Sora mono 15px navy right

### Page 5 — Scope & Afsluiting

**Background:** white.
**Order:** after Investering (explicit preference — Romano 2026-04-14).

**Content:**

- Section label: `[ 04 ]  SCOPE & AFSLUITING`
- Main heading: `Wat zit erin. Wat niet.` (with gold period)
- **Two columns side by side**, separated by 1px vertical divider:
  - **IN SCOPE** (left): Sora 500 14px uppercase navy header + 6–8 items, each Sora 300 16px navy-light with a small navy checkmark `✓` prefix (14px, Sora 500)
  - **BUITEN SCOPE** (right): same header pattern + 4–6 items with muted `×` prefix in #94a3b8
- **Change request note** (full-width below columns): Sora 300 14px italic navy-light `Change requests buiten scope worden per wijziging begroot.`

### Page 6 — Akkoord & Ondertekening

**Background:** white.
**Role:** integrated sign page (replaces old "confirm modal" — per Romano 2026-04-14: "we willen signing enzo erin verwerken").

**Content:**

- Section label: `[ 05 ]  AKKOORD`
- Main heading: `Teken het voorstel.`
- **Two-column layout:**
  - **LEFT — Summary card** (max 420px, 1px border, 16px radius, 32px padding):
    - `VOORSTEL` label (Sora 500 10px uppercase)
    - Project name (Sora 500 20px navy)
    - `Klarifai ✕ {client}` (Sora 300 15px navy-light)
    - 1px divider
    - `Totaal (incl. BTW)` label
    - `€X.XXX,XX` (Sora 700 32px navy with gold underline)
  - **RIGHT — Signing form:**
    - Three stacked labeled fields: `NAAM` / `FUNCTIE` / `DATUM` (today's date prefilled)
    - Each label: Sora 500 11px uppercase navy, letter-spacing 0.1em
    - Each input: 1px bottom border only (no boxes), Sora 500 18px navy text, 12px vertical padding
    - Below fields: legal disclaimer paragraph — Sora 300 13px italic navy-light — 3 lines max
    - Below disclaimer: **full-width gold pill CTA** — `✓  Bevestig en teken` — Sora 700 16px navy text on gold gradient

**Interaction:**

- Real e-signature integration is future scope (Phase 63). For now, the button captures name/function/date and writes to `Quote.acceptedAt` / `Quote.acceptedBy`.
- Arrow nav: left active, right disabled (signing is terminal action for the click-through).

### Page 7 — Bevestigd (Post-accept)

**Background:** white.
**Role:** thank you + next steps.

**Content:**

- NO section eyebrow (terminal page, no section number)
- Top centered: small gold label `VOORSTEL GETEKEND · {date}` (Sora 500 12px uppercase)
- Centered hero: Sora 700 72px navy on 2 lines — `Bedankt, {client}.` / `We starten {date}.` (period in gold)
- Intro lead: Sora 500 24px navy centered, max 680px, describes what happens next
- **Next steps list** (3 items centered max 680px):
  - Gold Sora 700 40px number
  - Sora 500 18px navy title
  - Sora 300 15px navy-light 1-line description
- **Two buttons centered:**
  - LEFT: outline pill `Download voorstel (PDF)` (white bg, 1px navy border, Sora 500 14px navy)
  - RIGHT: gold pill `Agenda uitnodiging toevoegen` (Sora 500 14px navy)
- Bottom arrow chrome: both disabled (terminal page).

---

## 5. Component Inventory

Shared primitives to build. Name them and reuse them everywhere — this is how the system stays coherent.

### Brochure components

- `<BrochureLayout>` — persistent chrome (top bar + arrow nav + progress + menu toggle + keyboard handlers)
- `<CoverPage>` — video bg + hero overlay with K mark + title + subtitle + CTA
- `<SectionPage>` — white bg + section eyebrow + heading + lead + body slot
- `<SectionLabel>` — `[ 01 ]  DE UITDAGING` eyebrow with gold/navy colors
- `<Heading>` — big display heading with optional gold period
- `<IntroLead>` — single punchy statement
- `<NumberedList>` — vertical or horizontal grid of numbered items
- `<NumberedItem>` — gold number + title + desc + optional deliverable label
- `<QuoteTable>` — line items with tabular nums + totals row + gold underline
- `<PaymentSchedule>` — 3-row card
- `<ScopeColumns>` — in/out two-column scope list
- `<SigningForm>` — summary card + 3-field form + legal + gold CTA
- `<NextStepsList>` — 3-item centered terminal list
- `<ArrowNav>` — left grey + right gold circular buttons
- `<ProgressIndicator>` — `01 / 07` mono label
- `<MenuToggle>` + `<MenuOverlay>` — sections overlay
- `<PillButton>` — primary (gold) + secondary (white/navy border) + disabled variants
- `<KlarifaiLogoMark>` — gold K icon (80px hero variant + 24px inline variant)
- `<KlarifaiWordmark>` — `Klarifai` text

### Admin components (carry over from Phase 61.x, re-spec against this system)

- `<AdminLayout>` — 240px sidebar + topbar + main content
- `<Sidebar>` — vertical nav with gold active indicator
- `<Topbar>` — page title + filters + actions
- `<Card>` — 1px border + 16px radius + padding variants
- `<DataTable>` — tabular data with mono numbers
- `<StatePill>` — status badges (neutral/info/success/warning/danger — from existing globals.css)
- `<ProspectLogo>` — already simplified in Phase 61.3 (2-stage: DB URL → initial letter)

**Rule:** every new page mounts existing components. No inline Tailwind soup per page. If you need a new primitive, add it here first, then use it.

---

## 6. Motion

**Brochure:** 250ms ease-in-out cross-fade on page transitions. That's the main motion. Everything else is micro:

- Button hover: 150ms ease-out (subtle lift + shadow)
- Keyboard focus: 100ms ring appear
- Menu overlay: 200ms fade-in

**Admin:** minimal. 200ms ease-out for card hover lift. No route transitions. No page-enter animations.

**NEVER:**

- Scroll-driven parallax
- Decorative loading spinners (use skeleton states, minimal 1px bars)
- Auto-playing animation on content (hero videos excluded — cover is the exception)
- Gratuitous bouncing, shaking, scaling
- Animations over 400ms

**`prefers-reduced-motion`:** disable all non-essential motion. Cross-fades become instant. Video covers show poster only.

---

## 7. Assets

- **Video cover:** `/public/video/klarifai-intro.mp4` (source: `~/Downloads/Blue and Gold Modern Innovation Intro Video.mp4`, 12MB, 15s, 1920×1080 navy + gold branded intro). Copied into `public/video/` during Phase 62 implementation.
- **Video poster:** `/public/video/klarifai-intro-poster.jpg` (extracted last frame, fallback for reduced-motion and mobile)
- **Klarifai logos:** source at `klarifai-core/assets/logo/` — `icon-transparent.svg`, `logo-full-dark.svg`, `logo-full-white.svg`. Copy into `public/brand/` or load as inline SVG in a `<KlarifaiLogoMark>` component.

---

## 8. What NOT to do (anti-patterns)

These come from the design consultation missteps — document them so we never relapse.

- ❌ **No editorial magazine framing.** A4 sheets floating on a gray desk background. Pull quotes as the whole page. Monocle references. The brochure is a **web page**, not a printed document.
- ❌ **No inventing new colors.** Navy + gold + grey is the palette. Never propose coral, teal, purple, orange, or any other brand accent.
- ❌ **No Instrument Serif, Fraunces, PP Editorial New, or any other serif display.** Sora is the only display font. Editorial warmth comes from scale and hierarchy, not from swapping fonts.
- ❌ **No gradient meshes, orbs, blobs, 3D, illustrations, stock photos, icons in colored circles.** The aesthetic is typography + whitespace + 1px lines + one gold accent per screen. That's it.
- ❌ **No SaaS marketing page clichés on the brochure.** No "Home / About / Contact" nav. No feature grid with icons. No testimonial carousel. No pricing comparison. The brochure is a sales document, not a product site.
- ❌ **No side nav on the brochure.** Side nav = admin software. The brochure is click-through page by page.
- ❌ **No admin sidebar decoration.** No gradients in the sidebar. No colored icons. No user avatar illustrations.
- ❌ **No hardcoded colors in components.** Always use CSS variables from Section 2.1. This lets us retheme centrally.
- ❌ **No new fonts.** Sora only. Never add Inter, SF Pro, Helvetica, or system-ui beside it.
- ❌ **No dark mode for the brochure.** The cover is dark navy (page 1), but pages 2–7 are all white. Dark admin mode is optional future scope.

---

## 9. Mockup References

Three approved mockup images from the design consultation session (2026-04-14). These are **reference renders**, not pixel-perfect targets — the AI rendering had minor quirks (beige backgrounds instead of white, serif fallback font, wrong date "2024") that should all be corrected to the specs in this document at implementation time.

| Page         | Path                                                                                       | Notes                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| 01 Cover     | `~/.gstack/projects/Romainnoo145-qualifai/designs/klarifai-brochure-2351/01-cover.png`     | Serif font render is incorrect — should be Sora 700 (geometric sans). Date should be 2026.                          |
| 02 Uitdaging | `~/.gstack/projects/Romainnoo145-qualifai/designs/klarifai-brochure-2351/02-uitdaging.png` | Light blue-grey bg is wrong — should be white. Top bar navy fill is optional styling.                               |
| 03 Aanpak    | `~/.gstack/projects/Romainnoo145-qualifai/designs/klarifai-brochure-2351/03-aanpak.png`    | Cream/beige bg is wrong — should be white. Horizontal 4-phase grid layout is APPROVED as the preferred composition. |

**Pages 4–7 (Investering / Scope / Signing / Post-accept) were not rendered** due to OpenAI quota exhaustion mid-session. Specifications in Section 4 are the contract. Generate on a future run if visual validation is needed.

---

## 10. Decisions Log

| Date       | Decision                                                         | Rationale                                                                                                                                                        |
| ---------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-14 | Design system = Klarifai brand reuse, not rebrand                | Klarifai has a working brand (navy + gold + Sora) in klarifai-core. The consultation is a structure/layout upgrade, not a color/type rebrand.                    |
| 2026-04-14 | Sora font everywhere                                             | Matches proposal-template.html. Replaces the placeholder Inter/SF Pro in globals.css over time.                                                                  |
| 2026-04-14 | Click-through brochure UX over scroll-per-page                   | Romano's intuition: brochure metaphor matches a sales proposal. Click-through forces sequential reading, controlled tempo, matches "quiet, premium, structured". |
| 2026-04-14 | Video cover plays once, freezes on last frame                    | Premium feel > loop restart. The animation earns its place by revealing the brand, then steps out of the way while the client reads.                             |
| 2026-04-14 | 7 pages, not 5                                                   | Add Signing (integrated akkoord + e-sig) and Post-accept — both web-only, not in PDF template.                                                                   |
| 2026-04-14 | Scope page after Investering                                     | Explicit ordering preference. Investering answers "how much", Scope answers "what for that money".                                                               |
| 2026-04-14 | Drop Team page                                                   | Klarifai is Romano-led boutique — no team page needed. Team can be implied via the main heading or a subtle "Door Romano Kanters" line.                          |
| 2026-04-14 | No editorial serif (reversed from initial consultation proposal) | Instrument Serif / magazine direction didn't land. Sora carries the editorial weight through scale and section label discipline.                                 |
| 2026-04-14 | No new accent color                                              | The electric coral #FF4F2E was a misstep. Klarifai gold #E4C33C is the accent.                                                                                   |
| 2026-04-14 | Client brochure is KLARIFAI branded, not Qualifai                | Qualifai = admin tool (internal). Client sees Klarifai branding. Collab label `KLARIFAI ✕ {client}`.                                                             |

---

## 11. Implementation Guardrails

When building against this system:

1. **Read DESIGN.md first.** Always. Before touching any component or page.
2. **Use CSS variables for every color, space, radius, font-size.** Never hardcode `#0a0a2e` inline.
3. **Reuse components from Section 5 inventory.** If a new primitive is needed, add it to the inventory first.
4. **Test at 1440×900 desktop reference.** The brochure is desktop-first. Responsive comes after.
5. **Match the mockup composition but fix the quirks.** White backgrounds, Sora font, correct dates.
6. **Load Sora from Google Fonts in the root layout.** One place, every page inherits.
7. **Use `prefers-reduced-motion` guards** on the video cover and any cross-fade transitions.
8. **Accept the user's final taste decisions.** If Romano wants to tweak a heading size, change the CSS variable in one place and it propagates — this is why we have tokens.

---

## 12. Follow-up scope (explicitly deferred)

- Dark admin mode
- Mobile brochure optimization (below tablet)
- Real e-signature integration (Phase 63)
- PDF export of the web brochure via Railway worker (Phase 62 plan 62-05)
- Multi-language support (currently NL-only)
- Brandfetch / Logo.dev paid API for hi-res client logos (stays deferred per Phase 61.2 / 61.3 decisions)

---

_Source authority: `klarifai-core/docs/design/klarifai-core-design.md` + `klarifai-core/docs/design/proposal-template.html` + this document._
_Session log: `~/.gstack/projects/Romainnoo145-qualifai/designs/klarifai-brochure-2351/`_

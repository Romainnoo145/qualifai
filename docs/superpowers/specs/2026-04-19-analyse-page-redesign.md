# Analyse Page Redesign — Design Spec

**Date:** 2026-04-19
**Route:** `/analyse/[slug]` (renamed from `/discover/[slug]`)
**Surface:** Client-facing, cold outreach prospects
**Design direction:** Offerte brochure style (dark navy, gold accents, viewport-fit click-through)

---

## 1. Context & Goals

### What it is

The `/analyse/[slug]` page is where cold outreach prospects land after receiving an email with a link. It presents an AI-generated analysis of their company based on publicly scraped sources (website, LinkedIn, reviews, news, KvK, careers, job postings).

### Design principles

- **Every page earns its place.** No summary pages, no filler, no "welcome" screens.
- **Respect the prospect's time.** Cold outreach = skepticism. Prove value fast.
- **Viewport-fit, no scrolling.** Each page fills the screen. Arrow navigation between pages.
- **Layout follows content.** Section page layout is chosen based on what the analysis found, not a fixed template.
- **Professional AI bureau tone.** Zakelijk, kennisgedreven, modern. No AI fluff, no corporate stiffness.

### Target audience

Dutch SMB decision-makers receiving cold outreach email. They don't know Klarifai. Trust is zero. They need to see that real research was done about THEIR company within seconds.

---

## 2. Video Cover

### Video

- Canva-produced MP4, 15 seconds, same style as offerte video
- Baked-in text: **"OUTSMART YOUR INDUSTRY"** — OUTSMART/YOUR in white bold, INDUSTRY in gold
- Keywords area (right side) removed from video — replaced by dynamic HTML overlay
- Video plays once (`autoPlay muted playsInline`, no `loop`), freezes on last frame
- Poster image for `prefers-reduced-motion` fallback
- File: `/video/klarifai-analyse.mp4` (to be created in Canva)

### Dynamic overlay

Fades in after ~12 seconds (or when video ends) in the same letter-spacing typography as the offerte keywords. Positioned where the keywords were (right side of the video).

Content (personalized per prospect):

```
8 3   B R O N N E N
1 2   S I G N A L E N
 4    I N Z I C H T E N
─────────────────────
N E D R I   S P A N S T A A L
```

- Numbers in gold gradient, labels in white
- Company name below the separator
- Letter-spacing: 0.15-0.2em, uppercase, Sora 500

Data source:

- Bronnen = `evidenceItems.length` from latest completed research run
- Signalen = count of evidence items with `aiRelevance >= 0.50`
- Inzichten = `sections.length` from the narrative analysis

### Chrome

- Top-left: Klarifai icon (`/brand/klarifai-icon.svg`), 36x36px, at `top: 32px, left: 48px`
- Top-right: progress indicator `01 / {total}`, gold, Sora 500 11px
- Bottom-left: back arrow (disabled on cover)
- Bottom-right: gold next arrow
- Keyboard: ← → navigation

---

## 3. Page Structure

Dynamic page count based on analysis data:

```
1.  Cover        — video + overlay (no section label)
2.  [ 02 ] Section 1  — first narrative section
3.  [ 03 ] Section 2  — second narrative section
... (as many sections as the AI generates, typically 3-5)
N.  [ N ]  Kansen      — recommendations
N+1.       Contact     — CTA's (no section label, terminal page)
```

- Section number = page number (cover is page 1 but has no section label)
- Progress indicator adapts: `01 / 07` or `01 / 09` depending on content
- Terminal page has no next arrow

---

## 4. Section Page Layouts

Three layout variants, chosen based on content:

### 4.1 Split Layout (default)

**Use when:** Standard narrative section, always works.

```
┌─────────────────────────────────────────────────────────┐
│ [K]                                          02 / 07    │
│                                                         │
│ [ 02 ]  STRATEGISCHE POSITIE                            │
│                                                         │
│ Onmiskenbare positie in                                 │
│ Europese infrastructuur.       Kerninzichten             │
│                                ┌─────────────────┐      │
│ Narrative text left,           │ 01  Insight one  │      │
│ 17px Sora 300, muted,          ├─────────────────┤      │
│ max-width ~60%                 │ 02  Insight two  │      │
│                                ├─────────────────┤      │
│                                │ 03  Insight three│      │
│                                └─────────────────┘      │
│ ─── Bronnen: source · source · source ───────────────── │
│ [←]                                              [→]    │
└─────────────────────────────────────────────────────────┘
```

- Left column (1.4fr): narrative paragraphs, Sora 300 17px, color `#898999`
- Right column (1fr): "Kerninzichten" label + stacked container-gradient cards
- Each insight card: gold number + title (Sora 500 15px white) + description (Sora 300 13px muted)
- Citations: full-width bar at bottom, subtle, `font-size: 11px`, very muted

### 4.2 Hero + Pillar Cards

**Use when:** Section has a clear 3-part structure (problem/cause/solution, or 3 key points).

```
┌─────────────────────────────────────────────────────────┐
│ [K]                                          03 / 07    │
│                                                         │
│ [ 03 ]  OPERATIONELE REALITEIT                          │
│                                                         │
│ Efficiëntie versus                                      │
│ volatiliteit.                  ← mega hero, fills space │
│                                                         │
│ ━━━━━━━━━━━ gold line ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                  │
│ │ 01       │ │ 02       │ │ 03       │                  │
│ │ Title    │ │ Title    │ │ Title    │                  │
│ │ Desc     │ │ Desc     │ │ Desc     │                  │
│ └──────────┘ └──────────┘ └──────────┘                  │
│ [←]                                              [→]    │
└─────────────────────────────────────────────────────────┘
```

- Hero headline: `clamp(48px, 6vw, 88px)`, vertically centered, fills available space
- Gold connecting line separator
- 3 pillar cards in horizontal grid, container-gradient with gold numbers

### 4.3 Pull Quote + Evidence Cards

**Use when:** Section cites a NEWS source (newspaper article, press release). The quote layout only activates if `citations[]` contains a source with type `NEWS`.

```
┌─────────────────────────────────────────────────────────┐
│ [K]                                          04 / 07    │
│                                                         │
│ [ 04 ]  TOEKOMSTBESTENDIGHEID                           │
│                                                         │
│ Risico mitigeren,                                       │
│ duurzaamheid verankeren.                                │
│                                                         │
│ ┃ "Quote from news        │  ┌─────────────────┐       │
│ ┃  source here."           │  │ 🛡 Evidence one  │       │
│ ┃  — Source                │  ├─────────────────┤       │
│                            │  │ 📈 Evidence two  │       │
│ Supporting narrative       │  └─────────────────┘       │
│                                                         │
│ ─── Bronnen: source · source ────────────────────────── │
│ [←]                                              [→]    │
└─────────────────────────────────────────────────────────┘
```

- Left: gold-bordered pull quote (3px left border, gold gradient) + narrative below
- Right: stacked evidence cards with gold-tinted icon badges + title + description
- Citations bar at bottom

### Layout selection logic

```typescript
function selectLayout(
  section: NarrativeSection,
): 'split' | 'pillars' | 'quote' {
  const hasNewsCitation = section.citations.some((c) => c.includes('NEWS'));
  if (hasNewsCitation) return 'quote';

  const insights = section.keyInsights ?? [];
  if (insights.length === 3) return 'pillars'; // clean 3-part structure

  return 'split'; // default
}
```

Layouts cycle if multiple sections have the same selected layout, to maintain visual variety.

---

## 5. Kansen Page

```
┌─────────────────────────────────────────────────────────┐
│ [K]                                          06 / 07    │
│                                                         │
│ [ 06 ]  KANSEN                                          │
│                                                         │
│ Concrete mogelijkheden                                  │
│ voor {company}.                                         │
│                                                         │
│ ┌─────────────────────┐ ┌─────────────────────┐         │
│ │ 01                  │ │ 02                  │         │
│ │ Partner/Use Case    │ │ Partner/Use Case    │         │
│ │ Title               │ │ Title               │         │
│ │                     │ │                     │         │
│ │ Narrative           │ │ Narrative           │         │
│ │                     │ │                     │         │
│ │ [tag] [tag] [tag]   │ │ [tag] [tag]         │         │
│ └─────────────────────┘ └─────────────────────┘         │
│ [←]                                              [→]    │
└─────────────────────────────────────────────────────────┘
```

- Section label + hero headline with company name
- 2-column grid of recommendation cards
- Each card: gold number (44px) + partner/use-case label (10px uppercase muted) + title (20px Sora 500) + narrative (15px Sora 300 muted) + strategic tags as pill badges (10px uppercase, border)
- Data source: `spvRecommendations` (Atlantis) or `useCaseRecommendations` (Klarifai)
- If more than 2 recommendations: 2-column grid wraps to additional rows
- Future milestone: add click-through to klarifai.nl projects, pop-ups with automation detail, custom solutions beyond existing use cases

---

## 6. Contact Page (Terminal)

```
┌─────────────────────────────────────────────────────────┐
│ [K]                                          07 / 07    │
│                                                         │
│           ANALYSE COMPLEET · {COMPANY}                  │
│                                                         │
│              Laten we                                   │
│           in gesprek gaan.                              │
│                                                         │
│    Wij hebben de analyse gedaan. Nu is het              │
│    aan u om te beslissen. Geen druk.                    │
│                                                         │
│   [★ Plan een gesprek]                                  │
│   [✉ info@klarifai.nl] [☎ +31 6 ...]                   │
│                                                         │
│                 klarifai.nl                              │
│ [←]                                                     │
└─────────────────────────────────────────────────────────┘
```

- Centered layout, no section label (terminal page)
- Gold eyebrow: "ANALYSE COMPLEET · {company name}"
- Hero: "Laten we in gesprek gaan." (gold period)
- Lead: honest, no pressure tone
- Primary CTA: gold gradient pill "Plan een gesprek" (calendar icon) — triggers Cal.com embed
- Secondary CTAs: ghost pills showing actual contact info — "info@klarifai.nl" (mail icon) + "+31 6 ..." (phone icon)
- Subtle link: klarifai.nl with gold underline
- No next arrow (terminal page)
- Back arrow active

---

## 7. Shared Chrome & Tokens

### Chrome (persistent across all pages)

- **Logo:** Klarifai icon SVG, 36x36px, fixed `top: 32px, left: 48px`, every page
- **Progress:** `01 / {total}`, fixed `top: 36px, right: 36px`, Sora 500 11px, gold `#fdf97b`
- **Back arrow:** 56x56px circle, 1px white-18% border, ghost bg, left: 48px, bottom: 48px
- **Next arrow:** 56x56px circle, gold gradient fill, navy arrow, right: 48px, bottom: 48px
- **Keyboard:** ← → arrow keys navigate

### Design tokens (identical to offerte)

| Token                 | Value                                       |
| --------------------- | ------------------------------------------- |
| Navy (bg)             | `#040026`                                   |
| Navy deep (geometric) | `#000319`                                   |
| Container gradient    | `linear-gradient(180deg, #040026, #080054)` |
| Container border      | `rgba(53, 59, 102, 0.55)`                   |
| Gold gradient         | `linear-gradient(180deg, #e1c33c, #fdf97b)` |
| Gold light            | `#fdf97b`                                   |
| Gold mid              | `#e1c33c`                                   |
| Text on navy          | `#fefefe`                                   |
| Text muted            | `#898999`                                   |
| Font                  | Sora 300 / 500 / 700                        |
| Border radius (cards) | 16px                                        |
| Border radius (pills) | 9999px                                      |

### Geometric backdrop

Same rotated rounded rectangles as offerte (`GeometricBackdrop` component), every page.

---

## 8. Responsive Behavior

| Breakpoint          | Behavior                                                   |
| ------------------- | ---------------------------------------------------------- |
| Desktop (1440+)     | Reference design, full 2-column layouts                    |
| Desktop (1024-1440) | Slightly reduced padding, same layouts                     |
| Tablet (768-1024)   | Split layouts become 1fr/1fr, reduced gaps                 |
| Mobile (<768)       | Single column, pages become scrollable, reduced font sizes |

Chrome scales: logo/arrows/progress get smaller at each breakpoint. See section-c-refined.html mockup for exact breakpoint values.

---

## 9. Data Requirements

### From ProspectAnalysis (analysis-v2)

- `openingHook` — used in email, NOT on the page
- `executiveSummary` — used in email, NOT on the page
- `sections[]` — each section becomes a page
  - `title` → hero heading + section label
  - `body` → narrative text
  - `citations[]` → citations bar + layout selection (NEWS check)
  - `keyInsights[]` (if available) → insight cards
- `spvRecommendations[]` or `useCaseRecommendations[]` → kansen page

### From ResearchRun

- `evidenceItems.length` → "bronnen" count on cover overlay
- Evidence items with `aiRelevance >= 0.50` → "signalen" count
- `sections.length` from analysis → "inzichten" count

### From Prospect

- `companyName` / `domain` → display name throughout
- `logoUrl` — NOT used (most are hero/banner, not real logos)

### From Environment

- `NEXT_PUBLIC_CALCOM_BOOKING_URL` → Cal.com embed on contact page
- `NEXT_PUBLIC_CONTACT_EMAIL` → email CTA
- `NEXT_PUBLIC_PHONE_NUMBER` → phone CTA

---

## 10. Session Tracking (carry over)

Existing tracking from the current implementation carries over:

- `startSession()` on mount
- `trackProgress()` per page navigation (with time spent per page)
- `trackPdfDownload()` if PDF download is added
- `trackCallBooked()` when Cal.com booking completes

---

## 11. Route Migration

Already completed:

- `app/discover/[slug]/` → `app/analyse/[slug]/`
- `lib/prospect-url.ts`: `buildDiscoverPath()` returns `/analyse/`
- `next.config.ts`: 301 redirects from `/discover/:slug*` and `/voor/:slug*` to `/analyse/:slug*`
- All tests updated
- Notification emails updated

---

## 12. Mockups

All approved mockups are in:

```
.superpowers/brainstorm/806393-1776618955/content/
├── section-variations.html     — 3 section layouts (approved)
├── kansen-refined.html         — kansen page (approved)
├── contact-3options.html       — contact page option A (approved)
└── section-c-refined.html      — responsive reference
```

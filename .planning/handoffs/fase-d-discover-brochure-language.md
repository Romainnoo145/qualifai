# Fase D · /discover/[slug] client dashboard redesign

**Status:** SCHEDULED · low priority (works today, just old aesthetic)
**Doelgroep:** klant extern (Dutch SMB prospect)
**Aesthetic:** brochure donker · Klarifai (§3.1). NOT Editorial paper.

---

## 1. Goal

The `/discover/[slug]` route is the client-facing prospect discovery dashboard. It was built during earlier phases using the old admin aesthetic (glass-card + SF Pro + slate borders). Because it's client-facing, it should speak the same design language as the `/offerte/[slug]` brochure — not the internal Editorial admin language.

Adopting brochure §3.1 tokens for this surface gives clients a coherent experience: the discover page is where they validate the analysis; the offerte page is where they see the proposal. Same visual language bridges the two.

---

## 2. What exists

- `/discover/[slug]` is actively used (per memory)
- 4-step wizard structure (discover flow from v7.0 Atlantis Discover Pipeline Rebuild era)
- Renders master analysis narrative, intent signals, CTA toward /offerte link
- Uses `.glass-card` heavily + current globals.css tokens
- Client-facing but currently looks like internal admin

---

## 3. Scope

### 3.1 Visual language swap

Apply brochure §3.1 tokens:

- Canvas navy `#040026`
- Container gradient `linear-gradient(180deg, #040026 0%, #080054 100%)` on cards
- Container border `rgba(53, 59, 102, 0.55)`
- Gold gradient `linear-gradient(180deg, #e1c33c 0%, #fdf97b 100%)` on CTA + highlights
- Text on navy: `#fefefe`, muted `#898999`
- Sora font (same as brochure + admin)
- Section label pattern `[ 01 ]  DE UITDAGING` from brochure §2.2 — this is the strongest brand signal

### 3.2 Chrome

- Persistent top bar matching brochure (Klarifai wordmark left, progress indicator center, client collab label right)
- No admin sidebar on this surface — it's client-facing, no internal nav
- Arrow nav at bottom for wizard step transitions (if the 4-step wizard is kept)

### 3.3 Component updates

Any component living under `components/features/discover/` that uses `.glass-card` or the old admin tokens gets rebuilt against brochure tokens. Specific candidates:

- Discover hero
- Intent signals cards
- Analysis narrative renderer
- CTA section leading to /offerte

---

## 4. Dependencies

- **Not blocked by Fase A / B / C** — this is a pure client-surface redesign
- **Should not block anything** — independent
- Can be picked up opportunistically, but until then `/discover/[slug]` works and renders

---

## 5. Acceptance

- `/discover/<slug>` renders in brochure language (navy bg, gold accents, Sora, section labels)
- CTA button at end of discover flow links to `/offerte/[slug]` and feels continuous visually
- No visual regression on content (all wizard steps still present)
- `npm run check` passes
- Tested with at least 2 prospects (Marfa + 1 other)

---

## 6. Out of scope

- Changing the 4-step wizard structure (keep content as-is)
- Adding new content blocks
- Mobile optimization (desktop-first like brochure)

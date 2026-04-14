# Qualifai — Project Instructions

## Design System

**Always read `DESIGN.md` before making any visual or UI decisions.**

All font choices, colors, spacing, border radii, layout patterns, component inventory, and aesthetic direction are defined there. Do not deviate without explicit user approval. In QA mode, flag any code that doesn't match DESIGN.md.

Canonical brand source: `klarifai-core/src/brand/theme.ts` + `klarifai-core/docs/design/proposal-template.html` (the Klarifai PDF template that drives the same brand values as the web brochure).

**Hard rules from DESIGN.md:**

- **Colors:** navy `#0a0a2e` + gold `#E4C33C` / `#F4D95A` + white + greys. No purple, coral, teal, orange, or invented accent colors.
- **Font:** Sora (300 / 500 / 700) — loaded from Google Fonts. Not Inter, not SF Pro, not Instrument Serif.
- **CSS variables for every token.** Never hardcode `#0a0a2e` or `#E4C33C` inline.
- **Section label pattern** `[ 01 ]  DE UITDAGING` (gold number, navy label) is the strongest brand signal after the logo.
- **Heading period in gold.** Main headings end with a gold period.
- **No decoration.** No gradients (except the gold CTA gradient), no illustrations, no 3D, no stock photos, no icons in colored circles, no decorative blobs.
- **Pill buttons with `--radius-full`** are the Klarifai signature CTA shape.

## Surfaces

Qualifai has two surfaces with different audiences and interaction models:

1. **Admin (`/admin/*`)** — Romano's internal command center. Linear-style sidebar + main content. Keyboard-first, data-dense.
2. **Client brochure (`/voorstel/[slug]`)** — bespoke 7-page click-through brochure delivered to Dutch SMB prospects. Video cover, arrow navigation, Klarifai branded.

See DESIGN.md §3 for layout patterns and §4 for the 7-page brochure architecture.

## Multi-tenant Security

Every DB model needs `organization_id` (or `projectId`). Every tRPC mutation filters by `ctx.projectId`. Never expose cross-project data.

## Validation

Run `npm run check` after changes (typecheck + lint). Fix all errors before continuing.

## Git

Use `/commit` for commits. Present tense imperative ("Add feature", not "Added feature"). Run tests before committing.

## Services

Dev server runs on port 9200. Never kill port 3001 (reserved). Check ports before starting: `lsof -i :<port>`.

## References

- `DESIGN.md` — full design system contract (this is the law)
- `.planning/STATE.md` — current phase, milestone progress
- `.planning/ROADMAP.md` — phase history and what's next
- `klarifai-core/docs/design/` — upstream brand source (proposal-template.html, klarifai-core-design.md, writing-style.md)
- `klarifai-core/src/brand/theme.ts` — canonical color + font tokens

## Skill Routing

When the user's request matches an available skill, invoke it via the Skill tool as your FIRST action:

- Design system questions → `design-consultation`
- Visual audit → `design-review`
- Bugs → `investigate`
- Ship → `ship`
- QA → `qa`
- Architecture review → `plan-eng-review`

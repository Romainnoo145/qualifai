# Skeleton Coverage — Design Spec

**Date:** 2026-04-28
**Status:** Approved (verbal)
**Owner:** Romano

## Goal

Vervang alle resterende `Laden…` / `<PageLoader />` placeholders in de admin door **page-shaped skeletons** met de bestaande `useDelayedLoading` (200ms) guard. Brand-consistent, premium feel overal.

## Why

- Vandaag heeft alleen post-sale (3 pages) een page-shaped skeleton.
- 14 admin pages tonen nog generieke `Laden…` of `<PageLoader />`.
- User wil overal dezelfde premium UX — geen mengelmoes.

## In scope

| Categorie | Pages                                                                                                             |
| --------- | ----------------------------------------------------------------------------------------------------------------- |
| Lijst     | `/admin/prospects`, `/admin/contacts`, `/admin/campaigns`, `/admin/use-cases`, `/admin/quotes`, `/admin/outreach` |
| Detail    | `/admin/prospects/[id]`, `/admin/contacts/[id]`, `/admin/campaigns/[id]`, `/admin/quotes/[slug]`                  |
| Sub-route | `/admin/prospects/[id]/evidence`, `/admin/prospects/[id]/analyse`                                                 |
| Dashboard | `/admin`                                                                                                          |
| Form      | `/admin/campaigns/new`                                                                                            |
| Systemic  | `app/admin/loading.tsx` (admin-shell skeleton)                                                                    |

**14 nieuwe page-shaped skeletons + 1 admin-shell rewrite (`loading.tsx`).** Lijst (6) + detail (4) + sub-route (2) + dashboard (1) + form (1) = 14.
(`/admin/facturen`, `/admin/facturen/[id]`, project-tab — al gedaan, niet aanraken.)

## Out of scope

- `/voorstel/[slug]` (statisch)
- `/discover/[slug]` (later beslissen)
- `/auth/*` (geen data-loads)
- Storybook / unit tests voor skeletons (visual rendering, niet veel te testen)

## Anatomy per type

**Lijst (6 pages):** SkelHeading + filter SkelPills + table border + 8 SkelTableRows. Per page: kolom-count + optionele search/stat-strip boven.

**Detail (4 pages):** Logo placeholder (Skeleton 56x56) + SkelHeading + SkelLine subtitle + tab strip (3-5 SkelPills) + two-column split (2/3 main + 1/3 sidebar).

**Sub-route (2 pages):** Section header SkelLine + 6 SkelCards met inhoud-lines. Compacter (zit binnen detail shell).

**Dashboard (1 page):** Greeting SkelHeading + 3 SkelStatCards + 4 draft-row-cards (logo+lines) + 6 timeline items.

**Form (1 page):** SkelHeading + 5-7 form rows (label SkelLine + input Skeleton h-10) + bottom button row (2 SkelPills).

**Admin shell (`loading.tsx`):** Sidebar nav (8 SkelLines) + main area (SkelHeading + 4 SkelLines). Generic, triggert alleen bij route transitions.

## File layout

```
components/features/
  prospects/{prospects-list,prospect-detail,prospect-evidence,prospect-analyse}-skeleton.tsx
  contacts/{contacts-list,contact-detail}-skeleton.tsx
  campaigns/{campaigns-list,campaign-detail,campaign-form}-skeleton.tsx
  use-cases/use-cases-skeleton.tsx
  quotes/{quotes-list,quote-detail}-skeleton.tsx
  outreach/outreach-skeleton.tsx
  dashboard/dashboard-skeleton.tsx
app/admin/loading.tsx                ← rewrite
```

## Page integration pattern

```tsx
const { data, isLoading } = api.x.useQuery(...);
const showSkeleton = useDelayedLoading(isLoading);
if (isLoading) return showSkeleton ? <XSkeleton /> : null;
if (!data) return <EmptyState />;
return <RealContent />;
```

Ook: `<PageLoader />` import + usage **verwijderen** in elke page die nu skeleton krijgt (geen dode code).

## Constraints

- Hergebruik primitives uit `components/ui/skeleton.tsx` (Skeleton, SkelLine, SkelHeading, SkelPill, SkelStatCard, SkelTableRow). Geen nieuwe primitives uitvinden.
- Geen iconen, kleuren of decoratie. Alleen shimmer op `--color-surface-2`.
- 200ms threshold via `useDelayedLoading`. Niet customizen per page.
- Alle nieuwe skeleton-files <80 LOC (CLAUDE.md hard rule: <300, target <80).

## Validation

Per skeleton:

1. `npx tsc --noEmit` schoon
2. Visual check in browser (refresh page, observeer skeleton-shape matcht het echte layout)

Bulk:

- Grep `Laden…` en `<PageLoader />` in `app/admin/` → 0 matches na voltooiing (behalve evt. `<PageLoader />` import in shared components dat elders gebruikt wordt).

## Cleanup mee (apart al gedaan)

- ✅ `[ 01 ]` weg uit `app/admin/layout.tsx` (login)
- ✅ `[ 01 ]` `[ 02 ]` weg uit `app/admin/facturen/page.tsx`

## Risks

- **PageLoader gebruikt elders.** Check of `<PageLoader />` ook buiten /admin gebruikt wordt voor we 'm volledig wegminderen.
- **Tab-content skeletons.** Sommige detail pages hebben tab-switching (bv. prospect/[id] heeft Project/Evidence/Analyse tabs); we vervangen alleen het top-level `isLoading` gedrag, niet per-tab.

## Sequencing

Eén branch, één PR (`feat/skeleton-coverage` na deze post-sale werk merge). Implementatie binnen sessie volgt waves voor mentale orde, maar niet strict noodzakelijk:

1. Foundations: `app/admin/loading.tsx` rewrite
2. Lijst-pages (6) — patroon repeats
3. Detail-pages (4)
4. Rest (4): sub-routes + dashboard + form

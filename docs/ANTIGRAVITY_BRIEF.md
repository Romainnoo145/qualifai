# Antigravity Handoff: Qualifai

## Context

Qualifai is the sales engine in the Klarifai ecosystem:

- `Klarifai` = holding
- `Copifai` = marketing
- `Qualifai` = sales

Current app stack:

- Next.js App Router
- tRPC
- Prisma
- Tailwind CSS (with custom tokenized glassmorphism design system)

## Product Objective

Sell a **Workflow Optimization Sprint** through evidence-backed outbound.

Primary outcomes promised:

- Hours saved per week
- Faster handoff speed
- Error reduction
- Revenue leakage reduction

Mandatory CTA sequence in first-touch:

1. "I made a 1-page Workflow Loss Map for your team."
2. "Want a 15-min teardown + live mini-demo?"

## Core Workflow (must stay intact)

1. Create/assign campaign
2. Add prospect/contact
3. Run research
4. Generate hypotheses/opportunities
5. Match proof from Obsidian exports
6. Generate Workflow Loss Map + PDF
7. Generate outreach sequence drafts
8. Manual approve/send
9. Reply triage + call prep generation

## UX Priorities

1. Prospect detail should be the command center
2. Outreach queue should optimize operator speed (approve/reject/triage)
3. Research -> proof -> asset generation should feel linear and obvious
4. Keep admin actions high-clarity for non-technical operators

## Current Frontend Locations

### App routes (pages)

- `app/layout.tsx` (global metadata/layout)
- `app/page.tsx` (redirect root to admin)
- `app/admin/layout.tsx` (auth shell + top nav)
- `app/admin/page.tsx` (dashboard)
- `app/admin/campaigns/page.tsx`
- `app/admin/prospects/page.tsx`
- `app/admin/prospects/new/page.tsx`
- `app/admin/prospects/[id]/page.tsx` (core command center)
- `app/admin/contacts/page.tsx`
- `app/admin/contacts/[id]/page.tsx`
- `app/admin/research/page.tsx`
- `app/admin/briefs/page.tsx`
- `app/admin/outreach/page.tsx`
- `app/admin/signals/page.tsx`
- `app/admin/search/page.tsx`
- `app/admin/settings/page.tsx`
- `app/discover/[slug]/page.tsx` (public/lead-facing wrapper)
- `app/discover/[slug]/wizard-client.tsx` (public wizard UI)

### Styling/design system

- `app/globals.css`
  - Klarifai token palette
  - glass utilities (`glass-card`, `glass-panel`)
  - interaction utilities (`btn-pill-*`, `ui-focus`, `ui-tap`, `card-interactive`)

### Frontend provider

- `components/providers.tsx` (tRPC + React Query provider)

### API/data contracts used by UI

- `server/routers/_app.ts` (router registry)
- `server/routers/admin.ts`
- `server/routers/campaigns.ts`
- `server/routers/research.ts`
- `server/routers/hypotheses.ts`
- `server/routers/proof.ts`
- `server/routers/assets.ts`
- `server/routers/outreach.ts`
- `server/routers/sequences.ts`
- `server/routers/call-prep.ts`
- `server/routers/contacts.ts`
- `server/routers/signals.ts`
- `server/routers/search.ts`
- `server/routers/wizard.ts`

## Important Constraint

Do not break existing business logic and route contracts.
UI upgrades should be mostly a presentation/component architecture refactor with clear migration steps.

## Expected Antigravity Output

1. Refined information architecture for admin + public wizard
2. Reusable component map (instead of large inline page components)
3. Screen-level UI proposals for:
   - `/admin/prospects/[id]`
   - `/admin/outreach`
   - `/admin/research`
   - `/discover/[slug]`
4. Phased implementation plan (low-risk first)

# Phase 36-02 Summary — Seed + Scoped Plumbing

Date: 2026-03-05
Status: Completed

## Delivered

- Seeded project foundation in `prisma/seed.ts`:
  - Projects: `klarifai`, `europes-gate`
  - 8 Atlantis SPVs: InfraCo, EnergyCo, SteelCo, RealEstateCo, DataCo, MobilityCo, BlueCo, DefenceCo
- Added project auth/scope plumbing:
  - `x-project-slug` added to tRPC context
  - `projectAdminProcedure` middleware added for scoped project context
  - Optional Atlantis-only token support via `ATLANTIS_ADMIN_SECRET`
- Added project APIs:
  - `server/routers/projects.ts` (`projects.list`, `projects.listSpvsForActiveProject`)
- Added admin project selector UX:
  - selector persisted in localStorage (`admin-project-slug`)
  - request header wiring in `components/providers.tsx`
- Scoped use-case operations per active project:
  - CRUD + imports in `server/routers/use-cases.ts`
- Added Atlantis volume import path:
  - scanner: `lib/atlantis-volume-reader.ts`
  - mutation: `useCases.importFromAtlantisVolumes`
  - imported 35 Atlantis use cases from:
    `/home/klarifai/Documents/obsidian/Nexus-Point/10_The_Forge/atlantis/RAG-Volumes`

## Validation

- `npm run db:seed`
- `npm run lint`
- `npm run build`
- tRPC import check:
  - first run: `created: 35, skipped: 0`
  - rerun (idempotent): `created: 0, skipped: 35`

## Notes

- Proof matching now accepts project scope (`matchProofs(..., { projectId })`) and is wired for research/hypothesis/proof/campaign matching paths.

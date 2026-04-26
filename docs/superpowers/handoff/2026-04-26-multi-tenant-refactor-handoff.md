# Multi-Tenant Refactor — Session Handoff (2026-04-26)

## Beginprompt voor volgende sessie

> Lees `docs/superpowers/handoff/2026-04-26-multi-tenant-refactor-handoff.md` om de multi-tenant refactor op te pakken. Productie draait Klarifai-only op `qualifai.klarifai.nl` met de Maintix warm-track flow live (Quote OFF001, Ron Hoeijmakers viewed). Doel van deze sessie: per-klant config uit de code halen en in het Project model stoppen, zodat onboarden van een nieuwe klant = INSERT Project row + (optioneel) per-client renderer dir. **Begin met brainstormen** via de `superpowers:brainstorming` skill om de exacte scope te locken vóór je een plan schrijft. Daarna `superpowers:writing-plans` → `superpowers:executing-plans`. Atlantis blijft als referentie-implementatie (niet weghalen). Productie mag niet kapot — Maintix flow moet blijven werken na elke deploy.

## Current state

Branch: `feat/warm-track-launch` (deze branch bevat álle warm-track + deploy + signature werk; merge to main vóór multi-tenant begint)
Most recent commit: zie `git log --oneline -1`
Production: live op https://qualifai.klarifai.nl, Maintix flow getest (view + accept + admin notifications + Romano's Gmail signature)
PR: niet geopend.

## Belangrijk om te weten bij start

- Productie heeft alleen Klarifai (1 Project row, slug `klarifai`, projectType `KLARIFAI`)
- Atlantis Project + SPVs zijn lokaal aanwezig maar uit prod verwijderd
- `prisma/seed.ts` skipt Atlantis tenzij `SEED_ATLANTIS=true` env var
- Maintix flow getest end-to-end: voorstel proxy → offerte → signing → ACCEPTED → admin notif
- Quote OFF001 (Maintix) zit op status VIEWED in prod, wachtend op signing door Ron
- ALLE wijzigingen moeten Maintix' UX intact houden (anders breekt Ron's signing als hij gaat tekenen)

## Doel van deze sessie

**"Onboarden nieuwe klant = data, geen code"**

Vandaag: Atlantis weghalen vereiste env var (ATLANTIS_ADMIN_SECRET) wijzigen + DB delete. Toevoegen vereist code wijzigingen (constants in `admin-auth.ts`, hardcoded slugs, etc.). Dat is niet schaalbaar.

Morgen (na deze refactor): nieuwe klant Z erbij = `INSERT Project { slug: 'z', adminSecretHash: '...', metadata: { renderers: {...} } }` + (indien custom UI nodig) `mkdir components/clients/z/` met renderers. Geen wijzigingen in shared code.

## Wat per klant kan verschillen

| Laag                  | Voorbeeld                                                             | Storage today                                       | Storage target                                                      |
| --------------------- | --------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| **Admin secret**      | `ADMIN_SECRET`, `ATLANTIS_ADMIN_SECRET`                               | env vars + hardcoded constants                      | `Project.adminSecretHash` (bcrypt)                                  |
| **Voorstel renderer** | Maintix bespoke proxy / Atlantis SPV brief / cold-track 7-page        | hardcoded route handler branches                    | `Project.metadata.renderers.voorstel` → dynamic import              |
| **Offerte renderer**  | Klarifai BrochureCover / SaaS subscription contract / partnership LOI | shared BrochureCover component                      | `Project.metadata.renderers.offerte`                                |
| **Email signature**   | Romano's Gmail sig (Klarifai brands)                                  | `lib/email/signatures.ts` switch op project         | reads from `Project.metadata.signatureTemplate` OR component lookup |
| **Branding tokens**   | navy/gold for Klarifai, andere colors voor Atlantis                   | hardcoded in DESIGN.md                              | `Project.metadata.brandTokens` JSON                                 |
| **Use cases**         | Klarifai sector catalog (97) / Atlantis RAG corpus                    | `UseCase` table + RAG via projectId scoping         | already per-project via FK ✓                                        |
| **Discover template** | `klarifai-default` / `atlantis-partnership`                           | `Project.metadata.discoverTemplate` (string lookup) | already per-project ✓                                               |
| **SPV concept**       | Atlantis-specific (8 SPVs)                                            | `SPV` model with projectId FK                       | already per-project ✓ — blijft leeg voor klanten zonder SPV concept |

## Hardcoded plekken die opgeruimd moeten worden

```
server/admin-auth.ts:4   KLARIFAI_PROJECT_SLUG = 'klarifai'
server/admin-auth.ts:5   ATLANTIS_PROJECT_SLUG = 'europes-gate'
server/admin-auth.ts:18  klarifaiSecret = normalizeAdminToken(env.ADMIN_SECRET)
server/admin-auth.ts:26  atlantisSecret = normalizeAdminToken(env.ATLANTIS_ADMIN_SECRET)

env.mjs:                 ADMIN_SECRET (required)
env.mjs:                 ATLANTIS_ADMIN_SECRET (optional)

lib/email/signatures.ts: SignatureProject = 'klarifai' (hardcoded union)

prisma/seed.ts:          atlantisSpvs (8), atlantisCampaignBlueprints (8)
                         — gated achter SEED_ATLANTIS env, dat is OK voor nu

server/routers/wizard.ts:54  resolveAdminProjectScope(ctx.adminToken) — fine,
                              just needs new resolveAdminProjectScope impl

components/features/offerte/brochure-cover.tsx:  hardcoded Klarifai branding
                              throughout — needs brand-token injection or
                              per-client renderer split
```

## Architectureel target

```
/components/clients/
  klarifai/
    voorstel-renderer.tsx     # huidige Maintix bespoke proxy logic
    offerte-renderer.tsx      # huidige BrochureCover wrapper (mode=offerte)
    email-signature.tsx       # huidige Romano Klarifai sig
    brand-tokens.ts           # navy/gold + Sora
  atlantis/
    voorstel-renderer.tsx     # SPV partnership brief renderer
    offerte-renderer.tsx      # partnership LOI
    email-signature.tsx       # Atlantis sig template
    brand-tokens.ts           # Atlantis colors

/lib/email/signatures.ts      # legacy - verplaats logic naar /components/clients/[X]/email-signature.tsx
```

Route handlers (`/voorstel/[slug]/route.ts`, `/offerte/[slug]/page.tsx`):

- Look up Project via prospect.projectId
- Read `Project.metadata.renderers` to pick which client component to render
- Pass prospect + quote data through

`Project.adminSecretHash` migration:

1. Schema: add `adminSecretHash String?` to Project (NOT NULL after backfill)
2. Backfill: hash current `env.ADMIN_SECRET` → write to klarifai Project row
3. Refactor `resolveAdminProjectScope()` to query `Project.findFirst({ where: { adminSecretHash: bcrypt.compareSync match } })`
4. Remove `ADMIN_SECRET` + `ATLANTIS_ADMIN_SECRET` from env.mjs (keep one BOOTSTRAP_ADMIN_SECRET only for initial seed)

## Constraints

- **Productie mag niet breken** — Maintix flow moet blijven werken na elke deploy
- **Schema wijzigingen reversibel** — voeg kolommen TOE, drop niets in deze sessie
- **Maintix is BESPOKE voorstel mode** — die HTML proxy logic is straks de Klarifai client renderer
- **Atlantis blijft als reference** — al zijn er geen Atlantis prospects in prod, de code paths zijn waardevol als template voor de derde klant
- **Geen Ron-impact** — als Ron tijdens deze sessie probeert te tekenen, mag de signing flow niet breken

## Voorgestelde aanpak

1. **Brainstorm (skill: `superpowers:brainstorming`)**
   Lock de exacte refactor scope. Vragen om uit te diepen:
   - Renderer dispatch via dynamic import vs registry pattern?
   - Signature template: in DB metadata vs in client component file?
   - Brand tokens: CSS variables runtime swap vs build-time per-client bundles?
   - Welke shared lib's blijven in `/lib/` (state machine, tracking, signing API)?
   - Hoe valideer je dat Maintix' UX exact hetzelfde is na refactor?

2. **Plan (skill: `superpowers:writing-plans`)**
   Schrijf het uit met file-by-file changes. Gate op user akkoord vóór execute.

3. **Execute (skill: `superpowers:executing-plans`)**
   TDD waar mogelijk. Test Maintix flow na elke logische unit.

4. **Verify**
   - Snapshot test: Maintix' /voorstel/maintix + /offerte/maintix output exact gelijk
   - Test seed van fictieve "client-z" project → verificatie dat onboarding 100% data-driven is

## Definition of done

- ☐ `Project.adminSecretHash` kolom + bcrypt-based auth lookup
- ☐ `ADMIN_SECRET` + `ATLANTIS_ADMIN_SECRET` weg uit env.mjs (alleen `BOOTSTRAP_ADMIN_SECRET` blijft)
- ☐ `KLARIFAI_PROJECT_SLUG` + `ATLANTIS_PROJECT_SLUG` constants weg
- ☐ `/components/clients/klarifai/` directory met renderers — verhuist alle Klarifai-specifieke UI uit shared paths
- ☐ `/components/clients/atlantis/` directory met renderers — als reference impl, kan leeg-stub zijn voor nu maar de structuur is er
- ☐ `Project.metadata.renderers` schema convention vastgelegd
- ☐ Maintix flow getest end-to-end na refactor — exact dezelfde UX
- ☐ Synthetic test: nieuwe Project "client-z" toevoegen via SQL + admin login werkt
- ☐ Updated runbook: `docs/operations/qualifai-deploy.md` reflecteert nieuwe onboarding flow

## Architecture cheat sheet (current state — read before refactor)

- Auth: `server/admin-auth.ts:resolveAdminProjectScope()` — token vs env var compare
- tRPC scoping: `server/trpc.ts:projectAdminProcedure` — uses `ctx.allowedProjectSlug`
- Voorstel route: `app/voorstel/[slug]/route.ts` — bespoke vs STANDARD branch via `Project.voorstelMode`
- Offerte route: `app/offerte/[slug]/page.tsx` → `BrochureCover mode="offerte"`
- Brochure component: `components/features/offerte/brochure-cover.tsx` (~2700 regels — heavy refactor candidate)
- Email send: `lib/outreach/send-email.ts` → `getEmailSignature('klarifai')` (newly added)
- Project seed: `prisma/seed.ts` — gated Atlantis section, klarifai always seeds
- DESIGN.md: laatst bijgewerkt 2026-04-26 met scope tabel (gold gradient = brochure only)

## Open vragen / decisions to make in brainstorm

- Bcrypt rounds = 10 (default) of hoger?
- Renderer registry vs dynamic import — wat scaalt beter naarmate er 5+ klanten zijn?
- Brand tokens als JSON in `Project.metadata` of als CSS file per client (`/styles/clients/[slug].css`)?
- Eén bootstrap secret in env (om Klarifai initial admin te creeren) → daarna alle nieuwe klanten via admin UI met password setup?
- Email signature: per-project OR per-user (als je later meerdere Klarifai mensen hebt)?

## Don't re-litigate (already decided)

- Atlantis blijft in code als reference impl (geen full removal)
- Schema wijzigingen TOEvoegen, niet dropping (reversible)
- Productie blijft Klarifai-only data (geen Atlantis seed in prod)
- Multi-tenant op Project laag, niet via subdomeinen of separate deploys
- BrochureCover component blijft de offerte-renderer voor Klarifai — niet herschrijven, alleen wrappen in `components/clients/klarifai/offerte-renderer.tsx`

# Multi-Tenant Auth & Client Directory — Design Spec

**Status:** Design approved, ready for plan
**Date:** 2026-04-26
**Branch context:** `feat/warm-track-launch` (productie draait Klarifai-only met Maintix flow live)
**Origin:** `docs/superpowers/handoff/2026-04-26-multi-tenant-refactor-handoff.md`

---

## Doel

Onboarden van een nieuwe klant moet _data_ zijn, geen code. Vandaag: nieuwe klant = wijzigen van `server/admin-auth.ts`, toevoegen van een `*_ADMIN_SECRET` env var in Vercel, hardcoded slug-constants. Niet schaalbaar.

Na deze refactor: nieuwe klant = `INSERT INTO Project { slug, adminSecretHash } + login werkt`.

## Scope (deze sessie)

Gefocust en bewust kleingehouden — de auth-laag heeft nu concrete pijn met twee echte voorbeelden (Klarifai env-secret + Atlantis env-secret), de UI-laag (renderers, brand tokens, signatures-multi-project) heeft maar één concreet voorbeeld dus is YAGNI tot Atlantis terugkomt of een derde klant binnenkomt.

**In scope:**

1. **Auth refactor.** `Project.adminSecretHash` (bcrypt) + dual-mode resolver (DB lookup eerst, env-fallback voor migratie-veiligheid). Slug-constants verwijderen.
2. **Directory conventie vastleggen.** `/components/clients/klarifai/` aanmaken en `lib/email/signatures.ts` daarheen verhuizen. `/components/clients/atlantis/` met README placeholder. Top-level `/components/clients/README.md` documenteert de conventie.

**Buiten scope (gedocumenteerd in §10):** voorstel/offerte renderer dispatch, brand-tokens schema, multi-project signature schema, BrochureCover splitsing, per-klant URL/domain mapping, env-fallback verwijderen, test-migratie.

## Constraints

- **Productie blijft werken.** Maintix flow is live; Romano signt mogelijk vandaag — nul lockout-risico tolerabel.
- **Schema additions only.** Geen drops, geen renames. Reversibel.
- **Atlantis blijft als reference impl.** Lokaal aanwezig, prod heeft 'm niet — code paths blijven waardevol.
- **Multi-tenant op Project laag, niet via subdomains.** (Handoff-besluit, niet re-litigated.)

---

## §1 Architecture overview

Twee parallelle veranderingen, één PR.

**(a) Auth refactor.** `Project` model krijgt `adminSecretHash String?` kolom (bcrypt). `resolveAdminProjectScope()` wordt async — DB-lookup eerst (bcrypt compare token tegen elke project-hash), valt terug op huidige env-compare als geen hash matcht. Dual-mode is bewust: ADMIN_SECRET in env blijft als noodingang gedurende deze sessie en de eerstvolgende dagen prod-observatie. Migratie-script hasht `env.ADMIN_SECRET` → `klarifai.adminSecretHash` en (indien gezet) `env.ATLANTIS_ADMIN_SECRET` → `europes-gate.adminSecretHash`. Slug constants `KLARIFAI_PROJECT_SLUG` / `ATLANTIS_PROJECT_SLUG` worden verwijderd, evenals de defensieve `?? KLARIFAI_PROJECT_SLUG` fallback in `server/trpc.ts:30` (na de refactor is `allowedProjectSlug` altijd gezet vanuit de hash-resolve).

**(b) Directory conventie vastleggen.** `lib/email/signatures.ts` → `components/clients/klarifai/email-signature.ts`. Update imports (alleen `lib/outreach/send-email.ts` is caller). Maak `/components/clients/atlantis/README.md` als placeholder met uitleg wat hier hoort als Atlantis activeert (voorstel-renderer, sig template, brand tokens). Top-level `/components/clients/README.md` documenteert de conventie. Geen abstractie toegevoegd — pure relocation + placeholders die volgende refactor sturen.

## §2 Schema change

```prisma
model Project {
  // ... existing fields
  adminSecretHash String?  @db.VarChar(72)
  // ... existing fields
}
```

`VarChar(72)` past bcrypt's `$2b$10$...` (60 chars) ruim met headroom. Nullable omdat:

- Tijdens dual-mode: projects zonder hash vallen door op env-fallback (geen lockout).
- Atlantis-row in environments waar `ATLANTIS_ADMIN_SECRET` niet gezet is blijft `null` (geen werkende admin login voor die scope, exact zoals nu).
- Follow-up PR maakt het effectief required wanneer env-fallback wegvalt.

Geen index — bcrypt-hashes zijn niet zoekbaar (elke compare is O(N) tegen alle rijen met hash), N = 2 nu, voorzienbaar < 10. Full scan is goedkoper dan index-onderhoud.

Prisma migratie: `pnpm prisma migrate dev --name add_admin_secret_hash` (genereert SQL automatisch).

## §3 Auth function

```ts
// server/admin-auth.ts (full rewrite)
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { env } from '@/env.mjs';
import { normalizeAdminToken } from '@/lib/admin-token';

type AdminScope = {
  adminScope: 'project';
  allowedProjectSlug: string;
};

export async function resolveAdminProjectScope(
  rawToken: string | null | undefined,
): Promise<AdminScope | null> {
  const token = normalizeAdminToken(rawToken);
  if (!token) return null;

  // 1. DB lookup — primary path
  const projects = await prisma.project.findMany({
    where: { adminSecretHash: { not: null } },
    select: { slug: true, adminSecretHash: true },
  });
  for (const p of projects) {
    if (p.adminSecretHash && bcrypt.compareSync(token, p.adminSecretHash)) {
      return { adminScope: 'project', allowedProjectSlug: p.slug };
    }
  }

  // 2. Env-var fallback — dual-mode safety net (verwijderd in follow-up PR
  // zodra prod 1-2 dagen schoon op DB-pad draait)
  const klarifaiSecret = normalizeAdminToken(env.ADMIN_SECRET);
  if (klarifaiSecret && token === klarifaiSecret) {
    return { adminScope: 'project', allowedProjectSlug: 'klarifai' };
  }
  const atlantisSecret = normalizeAdminToken(env.ATLANTIS_ADMIN_SECRET);
  if (atlantisSecret && token === atlantisSecret) {
    return { adminScope: 'project', allowedProjectSlug: 'europes-gate' };
  }

  return null;
}
```

**Caller-impact:** `server/trpc.ts:12` roept dit binnen async middleware aan — alleen `await` toevoegen. `server/trpc.ts:30` (`?? KLARIFAI_PROJECT_SLUG`) wordt: gewoon `ctx.allowedProjectSlug` (altijd gezet na resolve).

**Bcrypt rounds:** 10 (default). Op moderne CPU ~50ms/compare; bij N=2 projecten = ~100ms overhead per admin-request. Acceptabel.

**`bcryptjs` ipv native `bcrypt`** zodat geen native binary builds nodig op Vercel — pure JS, marginaal langzamer maar irrelevant bij N=2.

## §4 Migration script

```ts
// scripts/migrations/2026-04-26-backfill-admin-hashes.ts
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

async function main() {
  const klarifaiSecret = process.env.ADMIN_SECRET;
  if (klarifaiSecret) {
    const hash = bcrypt.hashSync(klarifaiSecret, 10);
    const result = await prisma.project.updateMany({
      where: { slug: 'klarifai' },
      data: { adminSecretHash: hash },
    });
    console.log(`✓ klarifai: ${result.count} row updated`);
  } else {
    console.warn('⚠ ADMIN_SECRET not set — klarifai hash not written');
  }

  const atlantisSecret = process.env.ATLANTIS_ADMIN_SECRET;
  if (atlantisSecret) {
    const hash = bcrypt.hashSync(atlantisSecret, 10);
    const result = await prisma.project.updateMany({
      where: { slug: 'europes-gate' },
      data: { adminSecretHash: hash },
    });
    console.log(`✓ europes-gate: ${result.count} row updated`);
  } else {
    console.log('ℹ ATLANTIS_ADMIN_SECRET not set — skipping europes-gate');
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
```

Idempotent: re-run = nieuwe salt, zelfde plain compare blijft werken. `updateMany` ipv `update` zodat het script niet faalt als de row toevallig niet bestaat (Atlantis-row is uit prod verwijderd → log toont `count=0`, geen error).

**Lokaal runnen:** `pnpm tsx scripts/migrations/2026-04-26-backfill-admin-hashes.ts`

**Prod runnen:** `vercel env pull .env.production.local` → `pnpm dotenv -e .env.production.local -- tsx scripts/migrations/2026-04-26-backfill-admin-hashes.ts`. Daarna `.env.production.local` weer wegruimen (staat al in `.gitignore`).

**Volgorde van deploy:**

1. Merge schema-migratie + nieuwe code. Dual-mode actief, hashes nog leeg → env-fallback honoreert alle login-pogingen (huidige gedrag, zero risico).
2. Vercel deploy succesvol. Maintix golden path getest in prod.
3. Run backfill-script tegen prod.
4. Verifieer via login + Vercel logs dat DB-pad nu actief is voor Klarifai-token.
5. Follow-up PR (later, niet deze sessie): fallback weg.

## §5 Directory verhuizing

**Move:** `lib/email/signatures.ts` → `components/clients/klarifai/email-signature.ts`. Inhoud ongewijzigd. `SignatureProject = 'klarifai'` blijft (single-project nu, wordt project-slug-aware lookup wanneer Atlantis een eigen sig krijgt).

**Update imports:** `lib/outreach/send-email.ts` (regel 7 + regel 42). Geen andere callers.

**Nieuwe placeholders:**

- `components/clients/atlantis/README.md` — uitleg wat hier hoort wanneer Atlantis activeert (voorstel-renderer, email-signature.ts, brand-tokens.ts). Verwijst naar Klarifai conventie.
- `components/clients/README.md` — top-level conventie: "elke klant met klant-specifieke UI of templates krijgt een eigen subdirectory. Bestanden hier zijn klant-specifiek; gedeelde logic blijft in `/lib/` of `/components/features/`." Vermelden dat niet alles een React component hoeft te zijn (signature-helper hoort hier ook thuis).

## §6 Validation

**Pre-merge (lokaal):**

- `npx tsc --noEmit` clean
- Bestaande tests groen (admin-auth tests gebruiken env.ADMIN_SECRET — fallback dekt dat)
- Manueel: lokale Klarifai login werkt via env-fallback pad. Backfill-script lokaal draaien → login werkt nu via DB-pad. Atlantis-login lokaal werkt na backfill (mits ATLANTIS_ADMIN_SECRET lokaal gezet).

**Post-deploy (prod):**

1. Maintix golden path: `/voorstel/maintix` → `/offerte/maintix` → admin login met huidige `ADMIN_SECRET` → `/admin/quotes` toegankelijk → quotes/prospects zichtbaar.
2. Backfill script tegen prod runnen.
3. Maintix golden path opnieuw — verifieer DB-pad (Vercel logs zouden de fallback branch niet meer moeten raken voor Klarifai-token).

**Synthetische verificatie van het hoofd-doel ("onboarden = data, geen code"):**

```sql
INSERT INTO "Project" (id, slug, name, "projectType", "adminSecretHash", "createdAt", "updatedAt")
VALUES (
  'cl-test-z', 'client-z', 'Client Z', 'KLARIFAI',
  '$2b$10$<hash van "z-secret-123">',
  NOW(), NOW()
);
```

Daarna: `curl -H "Authorization: Bearer z-secret-123" /api/trpc/...` → response heeft `allowedProjectSlug: 'client-z'`. Geen code wijziging gedaan, scope werkt. Verwijder de testrij na verificatie.

**Geen Ron-impact:** Ron's signing flow gebruikt `/offerte/[slug]` public route, geen admin auth. Niet geraakt.

## §7 Files touched

```
prisma/schema.prisma                                      # add adminSecretHash kolom
prisma/migrations/<ts>_add_admin_secret_hash/migration.sql # auto-generated
scripts/migrations/2026-04-26-backfill-admin-hashes.ts    # nieuw
server/admin-auth.ts                                      # full rewrite (async + DB lookup + fallback)
server/trpc.ts                                            # await + drop ?? fallback + drop slug-constant import
lib/outreach/send-email.ts                                # update import path naar @/components/clients/klarifai/email-signature
lib/email/signatures.ts                                   # DELETE (moved)
components/clients/klarifai/email-signature.ts            # nieuw (verhuisd)
components/clients/atlantis/README.md                     # nieuw (placeholder)
components/clients/README.md                              # nieuw (conventie doc)
package.json                                              # bcryptjs + @types/bcryptjs
```

Tests: geen wijzigingen. Tests gebruiken `env.ADMIN_SECRET` — fallback honoreert dat.

## §8 Failure modes & mitigation

| Scenario                                                                     | Mitigatie                                                                                                             |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Backfill-script faalt halverwege (klarifai gehasht, atlantis-stap crasht)    | Idempotent — opnieuw runnen volstaat. Klarifai-hash wordt overschreven met nieuwe salt, plain compare blijft kloppen. |
| Hash mismatch na deploy (bv. encoding-bug in normalizeAdminToken vs migrate) | Env-fallback redt het. Login blijft werken via env-pad. Diagnose in logs.                                             |
| Iemand commit een test die `KLARIFAI_PROJECT_SLUG` import — ts-error         | Tests al gegrep'd; geen externe callers buiten admin-auth.ts/trpc.ts.                                                 |
| Vercel build faalt op bcryptjs install                                       | Pure JS package, geen native deps — zou niet moeten. Indien wel: pin versie + verify lockfile.                        |
| Iemand draait backfill in prod terwijl deploy nog rolling is                 | Idempotent. Geen issue.                                                                                               |

## §9 Follow-up PR (niet deze sessie, gedocumenteerd)

Na 1-2 dagen schone prod-observatie:

- Verwijder env-fallback uit `resolveAdminProjectScope` (sectie 2 van de functie).
- Drop `ADMIN_SECRET`, `ATLANTIS_ADMIN_SECRET`, `NEXT_PUBLIC_ADMIN_SECRET`, `NEXT_PUBLIC_ATLANTIS_ADMIN_SECRET` uit `env.mjs`.
- Voeg `scripts/set-admin-secret.ts` CLI toe voor klant-onboarding (`pnpm tsx scripts/set-admin-secret.ts <slug> <secret>`).
- Migreer tests die `env.ADMIN_SECRET` gebruiken naar bcrypt-hashed test projects in setup/teardown.
- Maak `adminSecretHash` NOT NULL met default `''` (of laat nullable; effectief required).

## §10 Out of scope (later, anders)

- **Voorstel/offerte renderer dispatch** (`Project.metadata.renderers`) — wacht tot Atlantis voorstel-renderer écht gebouwd wordt. Twee concrete renderers (Klarifai bespoke proxy + Atlantis RAG brief) maken dat dán een echte abstractie ipv een gokconstructie.
- **Brand tokens schema** — Atlantis kleuren/typografie nog niet vastgelegd.
- **Email signature schema (multi-project)** — Atlantis sig hypothetisch. Huidige `getEmailSignature(project)` blijft single-project tot er een tweede is.
- **BrochureCover splitsing (2700 regels)** — orthogonaal aan multi-tenant.
- **Per-klant URL/domain (qualifai.atlantis.nl etc.)** — auth-refactor is domain-agnostic dus geen blocker. Implementatie later via Next.js middleware (`request.headers.host` → `Project.slug` mapping) + Vercel domain config + cookie scoping. Geen rework van auth nodig.
- **Env-fallback verwijderen + test migration** — follow-up PR (§9).

## §11 Definition of done

- [ ] `Project.adminSecretHash String?` kolom + Prisma migratie
- [ ] `bcryptjs` + `@types/bcryptjs` in package.json
- [ ] `server/admin-auth.ts` rewritten (async, DB-first, env-fallback)
- [ ] `KLARIFAI_PROJECT_SLUG` + `ATLANTIS_PROJECT_SLUG` constants verwijderd
- [ ] `server/trpc.ts` await + drop fallback
- [ ] `scripts/migrations/2026-04-26-backfill-admin-hashes.ts` werkt lokaal en in prod
- [ ] `lib/email/signatures.ts` → `components/clients/klarifai/email-signature.ts` verhuisd; `lib/outreach/send-email.ts` import bijgewerkt
- [ ] `components/clients/atlantis/README.md` + `components/clients/README.md` aangemaakt
- [ ] `npx tsc --noEmit` clean
- [ ] Maintix flow getest in prod na deploy + na backfill (DB-pad bevestigd in logs)
- [ ] Synthetische "client-z" verificatie uitgevoerd en weer opgeruimd

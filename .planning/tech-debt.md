# Qualifai Tech Debt Backlog

> **Doel:** Bekende tech debt items die opgedoken zijn tijdens codebase mapping (2026-04-13). Dit zijn issues die **niet** Phase 1 (Klant Lifecycle Convergence) blokkeren maar wel aandacht nodig hebben in latere phases of als losse cleanup-werk.
>
> **Bron:** `.planning/codebase/CONCERNS.md` (2026-04-13 audit).
> **Werkwijze:** Verplaats items hierheen wanneer ze gespot worden. Verwijder wanneer opgelost. Link altijd naar de file waar het probleem zit.

---

## Categorisering

- 🔧 **Code hygiene** — werkt, maar fragile of moeilijk te onderhouden
- ⚠️ **Risk** — kan in de toekomst breken, niet acuut
- 📈 **Scaling** — werkt nu, maar limiet komt eraan bij groei
- 🧪 **Test gap** — feature werkt, maar geen coverage

---

## Open items

### 🔧 tRPC v11 inference gaps — `as any` casts

Deep query includes triggeren TS2589 ("type is too deep"). Workaround: `as any` casts in meerdere components.

**Files:**

- `app/admin/prospects/[id]/page.tsx:126,157,416`
- `components/features/prospects/outreach-preview-section.tsx:95-98`
- `components/features/prospects/intent-signals-section.tsx:138-140`
- `components/features/prospects/quality-chip.tsx:130`

**Fix approach:** Pas `Prisma.XGetPayload<{include:{...}}>` patroon toe (zoals `ResearchRunRow` in `admin.ts`) of simplificeer de includes om nesting depth te verlagen.

**Wanneer:** Phase 2 (Admin UI) — die phase raakt deze components sowieso aan voor de Quote UI uitbreiding. Fix tegelijk.

---

### 🔧 Cadence engine config hardcoded

`DEFAULT_CADENCE_CONFIG` in `lib/cadence/engine.ts:76` heeft hardcoded thresholds (3-day base delay, 1-day engaged delay, 4 max touches). TODO comments wijzen op pending product owner sign-off.

**Files:**

- `lib/cadence/engine.ts:12,73,76`

**Fix approach:** Extract naar `Campaign.cadenceConfig` Json field (optional, fallback naar defaults), of een aparte `CadenceConfig` table. Document waarom elke threshold is gekozen.

**Wanneer:** Wanneer business besluit om cadence te tweaken zonder code-change. Geen relatie met Quote model. Lage urgentie tot dat moment komt.

---

### ⚠️ Inconsistente snapshot versioning in bestaande models

Drie models gebruiken verschillende versioning patterns:

- `WorkflowLossMap.version: Int default 1`
- `ProspectAnalysis.version: String "analysis-v1"`
- `ResearchRun.inputSnapshot: Json` (geen versioning)

Phase 1 introduceert de nieuwe standaard (`snapshotAt: DateTime` + `templateVersion: String`, zie `klarifai-core/docs/strategy/decisions.md` Q12). Bestaande models worden **niet** in Phase 1 gemigreerd.

**Files:**

- `prisma/schema.prisma:372,899-900,943`

**Fix approach:** Aparte cleanup migratie. Voor elk bestaand model:

1. Voeg `snapshotAt: DateTime?` toe (nullable initially).
2. Backfill via script: `snapshotAt = createdAt`.
3. Maak `snapshotAt` non-nullable in volgende migratie.
4. Deprecate de oude `version` velden (markeer in code, verwijder in latere phase).

**Wanneer:** Na Phase 1, als losse cleanup phase. Pas wanneer er een tweede plek is die de nieuwe standaard kan valideren.

---

### ⚠️ Untyped Json snapshots — `ResearchRun.inputSnapshot`

`inputSnapshot` is `Json` zonder Zod schema. Code in `admin.ts:500` en elders accessed velden als `inputSnapshot.deepCrawl` zonder type guards. Als de structuur verandert, falen queries silent.

**Files:**

- `prisma/schema.prisma:372`
- `server/routers/admin.ts:500,567`

**Fix approach:**

1. Definieer `ResearchRunInputSnapshot` Zod schema in `lib/schemas/`.
2. Validate on save: `ResearchRunInputSnapshot.parse(snapshot)`.
3. Type-safe accessor helper: `getInputSnapshotField(snapshot, 'deepCrawl', false)`.

**Wanneer:** Phase 1 maakt dezelfde fix voor `Quote.snapshotData`. Pak `ResearchRun.inputSnapshot` mee als bonus task in Phase 1 als tijd het toelaat, anders als follow-up.

---

### ⚠️ Admin token rotation strategy ontbreekt

`x-admin-token` header is single point of validation, geen rotation/refresh mechanisme zichtbaar.

**Files:**

- `server/admin-auth.ts` (resolveAdminProjectScope)
- `server/context.ts:6`
- `server/trpc.ts:10-25`

**Fix approach:** Document token strategy (length, entropy, rotation schedule). Audit log entry op token change/revoke. Zorg dat token nooit in error logs verschijnt.

**Wanneer:** Voor productie launch van klant-facing features. Niet Phase 1 blocker.

---

### 📈 listProspects performance — multiple aggregations

`admin.listProspects` (admin.ts:460+) doet 3 separate DB queries voor research run aggregaties per pagination. Voor 50 prospects: 3 extra queries.

**Files:**

- `server/routers/admin.ts:460-611`

**Fix approach:**

- Optie A: denormaliseer research run stats in een column op Prospect (async update).
- Optie B: raw SQL met JOINs voor de aggregaties.
- Optie C: split in twee queries (core + stats), client merget.

**Wanneer:** Wanneer pagina meetbaar traag wordt. Phase 1 maakt het niet erger.

---

### 📈 getProspect deep includes

`admin.getProspect` (admin.ts:613+) include 7 relations met nested selects. Op prospects met 1000+ session records wordt het traag, ondanks `take: 20/10` limits (full deep fetch laadt alles voor filtering).

**Files:**

- `server/routers/admin.ts:613-650`

**Fix approach:** Cursor-based pagination voor sessions/notificationLogs. Of split in `getProspect` (core) + `getProspectSessions` (apart endpoint). Indexes op `(prospectId, createdAt)` bestaan al (schema:238,883).

**Wanneer:** Bij eerste prospect met >500 sessions in productie. Niet acuut.

---

### 📈 Synchronous AI generation in research pipeline

Hypothesis generation + proof matching + analysis creation gebeurt synchroon binnen één mutation. LLM call kan prospect lang in `HYPOTHESIS/BRIEFING` state vergrendelen.

**Files:**

- `server/routers/admin.ts:284+` (createResearch mutation)

**Fix approach:** Verplaats async generation naar background job (Bull queue, pg_boss). Return prospect naar `READY` direct na hypothesis draft. Queue analyse als fire-and-forget.

**Wanneer:** Wanneer cold-start latency een probleem wordt voor admins. Geen relatie met Quote.

---

### 📈 Prospect data explosion

Schema ondersteunt unlimited Prospects, maar `listProspects` met full includes wordt traag boven 100k records. Geen archive workflow ondanks `ARCHIVED` status.

**Files:**

- `prisma/schema.prisma` (Prospect model)
- `server/routers/admin.ts` (listProspects)

**Fix approach:** Implement prospect archive workflow. Soft-delete patroon (`isArchived bool` + index). Eventueel sharding op `projectId` bij grote groei.

**Wanneer:** Bij eerste klant met >10k prospects. Lange termijn.

---

### 📈 WizardSession data retention

Sessions accumuleren forever, geen retention policy.

**Files:**

- `prisma/schema.prisma` (WizardSession)

**Fix approach:** Retention policy (delete >180 days old, keep summary in NotificationLog). Of soft-delete + archival job.

**Wanneer:** Na 1-2 jaar productie of bij eerste meetbare slowdown.

---

### 🧪 Multi-project data isolation tests ontbreken

Geen integration test verifieert dat Admin van Project A geen Prospect van Project B kan zien. `projectAdminProcedure` enforced het, maar geen test bewijst het.

**Files:**

- `server/routers/admin.ts` (alle procedures via projectAdminProcedure)

**Fix approach:** Test suite met 2 projecten:

- Admin scoped to Project A → empty `listProspects` voor Project B
- Admin kan geen `getProspect` op prospect uit ander project
- Cascade deletes alleen in correct project

**Wanneer:** Phase 1 voegt eigen Quote isolation tests toe (verplicht, multi-tenant rule). Bredere `Prospect` isolation tests kunnen los of als bonus task in Phase 1.

---

### 🧪 Prospect state transition tests ontbreken

`updateProspect` mutation accepteert alle status changes zonder validation. Geen test verifieert dat invalid transitions (bv. `CONVERTED → DRAFT`) falen.

**Files:**

- `server/routers/admin.ts:652+` (updateProspect)

**Fix approach:** Test suite voor `admin.updateProspect`:

- Valid transitions slagen (DRAFT→ENRICHED→READY etc.)
- Invalid transitions falen met duidelijke error
- Downstream effects (status change → wizard visibility update)

**Wanneer:** **Phase 1** — wordt onderdeel van de state machine refactor (zie HANDOFF §5 Phase 1 herziene scope).

---

### 🧪 Cadence engine threshold tests ontbreken

`buildCadenceState` (engine.ts:93-180) thresholds niet getest. Als logic verandert, kan engagement cadence onverwacht versnellen.

**Files:**

- `lib/cadence/engine.ts:93-180`

**Fix approach:** Unit tests voor:

- `touchCount=4` → `isExhausted=true`, `nextChannel=null`
- `engagementLevel='high'` → gebruikt `engagedDelayDays`
- Channel rotation: email→call→linkedin→whatsapp

**Wanneer:** Voor productie launch, of bij eerste cadence config wijziging.

---

## Critical missing features (uit CONCERNS)

Deze zijn geen "tech debt" maar ontbrekende features. Track ze hier zodat ze niet vergeten worden in roadmap planning.

### Admin audit trail

Admin mutations (status changes, deletes) hebben geen log. Alleen `GateOverrideAudit` bestaat (phase 30). Voor compliance + debugging niet toereikend.

### Undo/rollback mechanisme

Geen recovery van admin errors behalve manual DB restore.

### Snapshot diff/comparison tool

Bij quote vs research run snapshot mismatch geen visualisatie. Alleen handmatige JSON inspectie.

### Prospect versioning

Updates aan prospect data overschrijven vorige waarden. Geen version history.

---

## Dependency risks (monitor only, geen actie)

- **tRPC version lock:** `@trpc/* 11.9.0` exact gepind. Major upgrade vereist ~1 week werk om alle inference casts te valideren.
- **Prisma adapter pg ^7.3.0:** Third-party adapter, geen automatische fallback bij breakage.
- **Anthropic SDK ^0.73.0:** Pin major version, allow minor patches. Monitor AI generation endpoints op breakage.

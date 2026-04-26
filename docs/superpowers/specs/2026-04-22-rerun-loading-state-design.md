# Rerun Loading State — Design

**Datum:** 2026-04-22
**Status:** Spec — wachten op review
**Auteur:** Romano + Claude

## Probleem

Bij een "Nieuwe run" voor een prospect wist `executeResearchRun` direct alle oude `ResearchRun`-records van die prospect (cascadet `EvidenceItem`, `WorkflowHypothesis`, `AutomationOpportunity`, `ProofMatch`, `ProspectAnalysis`). Daarna draait de pipeline 5–10 minuten voor er een nieuwe `ProspectAnalysis` staat.

In dat tussenliggende venster:

- **Client** opent `/analyse/[slug]` vanuit de eerder verstuurde mail → `prospectAnalysis = null` → lege/fallback pagina.
- **Admin** opent prospect-detail tijdens een rerun → analyse-card toont niets.
- **Admin** kijkt naar prospect-overzicht → geen indicatie dat er een job loopt; bij wegnavigeren naar andere pagina geen idee meer dat er iets bezig is.

De prospect-link zelf blijft werken (`Prospect.slug` en `readableSlug` worden niet aangeraakt), dus dat is geen risico. Het probleem is puur visuele leegte.

## Oplossing

Geen atomic swap, geen schema change. We tonen op alle drie de plekken een **loading render state** wanneer de meest recente `ResearchRun` van de prospect een actieve status heeft. Zodra de run `COMPLETED` is, refresht de UI automatisch naar de nieuwe analyse.

**`ResearchStatus` enum** (uit `prisma/schema.prisma`):

```
PENDING | CRAWLING | EXTRACTING | HYPOTHESIS | BRIEFING | COMPLETED | FAILED
```

- **Actieve states** (loading tonen): `PENDING`, `CRAWLING`, `EXTRACTING`, `HYPOTHESIS`, `BRIEFING`
- **Eind-states** (loading stoppen): `COMPLETED`, `FAILED`

De fase-naam zit dus al in de status zelf — geen aparte `summary`-parser nodig.

## Drie surfaces

### 1. Client `/analyse/[slug]`

- Server component fetch blijft hetzelfde, maar voegt een check toe: laatste `ResearchRun` van deze prospect — is `status` ∈ actieve states?
- Zo ja → render `<RerunLoadingScreen variant="full" />` centered op een full-bleed brand-canvas (navy bg, Klarifai-gold spinner, tekst).
- Client component pollt elke 5 seconden via tRPC `prospect.getActiveRunStatus({ slug })`. Zodra status ∈ {`COMPLETED`, `FAILED`} → `router.refresh()` zodat de nieuwe (of teruggekeerde oude) content geladen wordt.
- Bij `FAILED`: pagina valt terug op meest recente `ProspectAnalysis` als die er is, anders "nog geen analyse"-fallback. Geen aparte error-UI in deze ronde.

### 2. Admin `app/admin/prospects/[id]/page.tsx`

- De analyse-sectie van de detail-card wisselt tussen drie states:
  - actieve status (PENDING/CRAWLING/EXTRACTING/HYPOTHESIS/BRIEFING): `<RerunLoadingScreen variant="inline" />` centered binnen de card-bounds (geen full-bleed; respecteert de kaartbreedte/hoogte).
  - `COMPLETED` met data: huidige content.
  - geen run, geen analyse: bestaande "nog geen analyse"-CTA.
- De rest van de detail page (header, contacts, evidence-tab, etc.) blijft normaal interactief — alleen de analyse-card laadt.
- Polling: tRPC query met `refetchInterval: 5000` zolang status actief is.

### 3. Admin `app/admin/prospects/page.tsx` (overzicht)

- Per prospect-row/-card: kleine gouden puls-badge of pill rechts naast de prospect-naam met tekst "onderzoek loopt".
- Rest van de card (logo, naam, domein, industrie, status-chip) blijft volledig zichtbaar — geen full-card overlay.
- Lijst-query laadt voor elke prospect ook de laatste `ResearchRun.status` mee (bestaat al via `researchRuns: { take: 1, orderBy: { createdAt: 'desc' } }` of toegevoegd indien nog niet aanwezig).
- Polling op de hele lijst-query elke 10 seconden (langere interval dan detail/client; goedkoper).

## Component-design

### `<RerunLoadingScreen variant="full" | "inline" />`

Locatie: `components/features/research/rerun-loading-screen.tsx` (nieuwe file).

- **`full`**: navy achtergrond (`var(--color-navy)`), centered verticaal + horizontaal, viewport-vullend.
- **`inline`**: transparante achtergrond, centered binnen parent, padding `--space-12`.

Inhoud beide varianten:

- Klarifai-gold spinner (custom CSS animatie; geen lib).
- Heading (Sora 500, `--text-2xl`): "Analyse wordt bijgewerkt"
- Subtekst (Sora 300, `--text-base`, muted): "Dit duurt een paar minuten."
- **Optionele stap-indicator**: maps `ResearchRun.status` naar Nederlands fase-label:
  - `PENDING` → "Run wordt opgestart"
  - `CRAWLING` → "Bronnen verzamelen"
  - `EXTRACTING` → "Evidence extracten"
  - `HYPOTHESIS` → "Hypothesen opstellen"
  - `BRIEFING` → "Narrative schrijven"
    Geen "Stap X van Y" — alleen het label want we hebben geen harde stap-volgorde-garantie.
- Geen "annuleer"-knop, geen estimated time remaining.

Brand-rules (zie `DESIGN.md`):

- Geen gradients (op de gouden CTA na — niet hier).
- Spinner = gouden ring, niet decoratieve icoontjes.
- Sora 300/500/700 only.
- Padding/spacing via CSS variables.

### `<ResearchRunBadge />`

Locatie: `components/features/research/research-run-badge.tsx` (nieuwe file).

- Pill-shape (`var(--radius-full)`), `--space-1` y / `--space-3` x padding.
- Achtergrond `var(--color-gold)` op `oklch` lichte tint, tekst navy.
- Subtiele puls-animatie (CSS `@keyframes`).
- Tekst: "onderzoek loopt".
- Renders alleen als `latestRun.status` ∈ actieve states.

## Data flow

### Nieuwe tRPC procedure

`server/routers/prospects.ts` (of bestaande router):

```
getActiveRunStatus({ slug?: string, prospectId?: string })
  → { status: ResearchStatus | null,
      currentStep: string | null,
      startedAt: Date | null,
      isActive: boolean }
```

Public procedure (slug-based) voor client `/analyse`. Protected (prospectId) voor admin paginas. `currentStep` is een mapping van `status` naar Nederlands fase-label (zie component-design hierboven). `isActive` is `true` als status ∈ {`PENDING`, `CRAWLING`, `EXTRACTING`, `HYPOTHESIS`, `BRIEFING`}.

### Polling

- **Client** (`/analyse/[slug]`): React Query / tRPC `useQuery` met `refetchInterval: (data) => data?.isActive ? 5000 : false`. Stopt zelf met pollen zodra status `COMPLETED` of `FAILED` is.
- **Admin detail**: idem, 5s.
- **Admin overzicht**: bestaande lijst-query met `refetchInterval: 10000` zolang minstens één row een actieve run heeft, anders `false`.

### Auto-refresh bij completion

Bij overgang van `RUNNING → COMPLETED`:

- **Client**: `router.refresh()` (Next.js App Router) — server component re-fetcht alle data, nieuwe `ProspectAnalysis` verschijnt automatisch.
- **Admin detail**: tRPC query invalidation op `prospect.getDetail` triggert re-render met nieuwe data.
- **Admin overzicht**: badge verdwijnt, geen verdere actie nodig (rest van de row-data verandert niet relevant).

## Edge cases

- **Pipeline faalt halverwege**: `ResearchRun.status = FAILED`. Polling stopt. Loading screen verdwijnt. Pagina valt terug op de meest recente `ProspectAnalysis` van een eventuele eerdere succesvolle run — als die er niet is, zie je "nog geen analyse" (acceptabel; de oude analyse was al gewist op het moment van de rerun-start).
- **Twee reruns vlak na elkaar**: tweede rerun verwijdert eerst alle oude ResearchRuns (incl. de net gestarte) via `deleteMany`, maakt dan een nieuwe. Polling pakt altijd `latest` (`orderBy createdAt desc, take 1`), dus consistent één signaal.
- **Tab wegklikken en terug**: polling pauzeert in achtergrond-tab (React Query default), pakt op bij focus. Status komt automatisch overeen.
- **Network error tijdens polling**: React Query retry default. UI blijft loading state tonen — beter dan flickeren naar leegte.

## Wat we niet doen (YAGNI)

- Geen "Cancel run"-knop.
- Geen aparte gestileerde FAILED-state (komt later als nodig).
- Geen estimated-time-remaining.
- Geen websocket / SSE — polling is goed genoeg op deze frequentie en volume.
- Geen schema change.
- Geen atomic-swap rewrite van `executeResearchRun`.

## Bestanden die geraakt worden

**Nieuw:**

- `components/features/research/rerun-loading-screen.tsx`
- `components/features/research/research-run-badge.tsx`
- `lib/research/status-labels.ts` (mapping `ResearchStatus` → Nederlands fase-label, gedeeld tussen UI en tRPC)

**Aangepast:**

- `server/routers/prospects.ts` (of admin-router) — nieuwe procedure `getActiveRunStatus`
- `app/analyse/[slug]/page.tsx` — check op active run, render loading variant
- `app/admin/prospects/[id]/page.tsx` — analyse-card switcht naar loading variant
- `app/admin/prospects/page.tsx` — overzicht laadt run-status per row + badge

## Testen

- Unit: `status-labels.ts` — elke `ResearchStatus` enum-waarde mapt naar het juiste Nederlandse label; `null` voor onbekende waardes.
- E2E (handmatig of Playwright):
  1. Trigger rerun voor Marfa via admin.
  2. Open `/analyse/_JHTy2L6` in tweede tab → loading screen verschijnt.
  3. Open `/admin/prospects` → badge "onderzoek loopt" zichtbaar bij Marfa.
  4. Open `/admin/prospects/[marfa-id]` → analyse-card toont inline loading.
  5. Wacht op completion → alle drie surfaces refreshen automatisch naar nieuwe content.

## Open punten (besluiten in implementation-plan)

- Hergebruiken we een bestaande spinner-component of bouwen we hem fresh?
- Komt `getActiveRunStatus` in de bestaande prospects-router of als losse research-router?

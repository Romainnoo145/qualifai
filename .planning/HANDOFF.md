# HANDOFF: Qualifai v9.0 Klant Lifecycle Convergence

> **Doel van dit document:** Open dit bestand in een verse sessie en je kunt direct verder zonder context te verliezen. Geen strategie-discussie meer. Geen "hoe zat het ook alweer".
>
> **Laatste update:** 2026-04-14 (sessie eindigt vlak voor execute van Phase 61.1)
> **Volgende sessie begint bij:** §2 "Quick-start"
> **Strategy decisions (locked):** [`/home/klarifai/Documents/klarifai/klarifai-core/docs/strategy/decisions.md`](../../klarifai-core/docs/strategy/decisions.md)
> **Vorige strategy handoff:** [`/home/klarifai/Documents/klarifai/klarifai-core/docs/strategy/HANDOFF.md`](../../klarifai-core/docs/strategy/HANDOFF.md) — was de start van deze sessie, blijft als historische referentie.

---

## 1. TL;DR — Waar staan we

### Wat is af

- ✅ **Phase 60: Quote Schema Foundation** (shipped 2026-04-13) — 5 plans, 13 tasks, 23 requirements, 48/48 tests green. Quote/QuoteLine/QuoteStatus/SnapshotStatus + ProspectStatus.QUOTE_SENT in Prisma. transitionQuote helper met full Q13 sync mapping. quotes tRPC router met multi-tenant isolation. YAML import script imports 3 Marfa quotes (€7.816,60 / €11.495,00 / €13.285,80). Foundation fixes: typed status constants, prospect state machine validator, Zod snapshot schema.
- ✅ **Phase 61: Admin UI for Quotes** (shipped 2026-04-14) — 4 plans, 13 tasks, 8 ADMIN requirements, 92/92 tests green. Romano kan offertes maken, previewen, versturen, en nieuwe versies aanmaken vanuit Qualifai admin. Klarifai-core proposal-template.html verbatim hergebruikt voor preview iframe. Sidebar "Offertes" item. Smoke test door Romano: alle 5 ROADMAP success criteria approved.
- ✅ **Smoke test geseede**: 3 Marfa quotes (DRAFT) zitten in dev DB. Romano voegde Marfa prospect handmatig toe vóór de import zodat readableSlug match werkte.

### Wat is gepland maar nog niet geëxecuteerd

- 🟡 **Phase 61.1: Manual prospect flow polish** (INSERTED 2026-04-14) — 4 plans verified, ready to execute. Ontstaan tijdens Phase 61 smoke test toen drie roughness items naar boven kwamen (zie §4). Plans in `.planning/phases/61.1-manual-prospect-flow-polish/`. Commit `e8c87ce`.

### Wat nog komt in v9.0

- ⏳ **Phase 62: Client-Facing Voorstel + PDF Worker** — design discovery via `/design-consultation` → `DESIGN.md` → `/design-shotgun` (3-5 varianten) → `/gsd:ui-phase` → `UI-SPEC.md`, daarna implementatie van `/discover/[slug]/voorstel` + Railway PDF worker. Romano heeft expliciet aangegeven dit later deze sessie te willen starten. Q6 (design tokens) en Q7 (auth model) moeten beantwoord worden tijdens design-consultation.
- ⏳ **Phase 63: Contract Workflow** — click-to-sign contract na quote acceptance. Q3 (SignWell vs zelfbouw) staat nog open, default = zelfbouw MVP.

### Belangrijkste discoveries deze sessie

1. **Apollo dekt geen kleine Nederlandse SMBs** — Marfa heeft geen logo via Apollo. Conclusie: Apollo is geen complete oplossing voor logo's, we hebben een non-Apollo favicon fallback nodig (Google s2/favicons + DuckDuckGo). Dit is POLISH-04..06 in Phase 61.1.
2. **Master analyzer heeft geen retry layer** — `lib/analysis/master-analyzer.ts` faalt direct op Gemini 2.5 Pro 503 errors. De rest van de pipeline (5 stages) loopt prima door, alleen de narratief drops silently. Dit is POLISH-01..03 in Phase 61.1.
3. **Geen UI om pipeline opnieuw te triggeren** — Romano moest een tsx script vragen voor een rerun. Geen "Verrijk opnieuw" / "Run research" / "Run analyse" knoppen op `/admin/prospects/[id]`. Dit is POLISH-07..09 in Phase 61.1.
4. **Logo's worden nergens gerenderd** — zelfs waar `Prospect.logoUrl` bestaat (Apollo path) wordt er geen `<img>` gemount in cards of detail headers. Dit is POLISH-10..11 in Phase 61.1.
5. **"Voorstellen" lands niet** — Romano vond het geen prettig woord. Hernoemd naar "Offertes" in commit `584319d`. Sidebar, list page header, create page header, alle error toasts. Section labels (Concept/Verstuurd/Gearchiveerd) blijven want dat zijn statussen, geen entiteit.

---

## 2. QUICK-START VOLGENDE SESSIE

### Eerste 5 minuten — context loaden

```bash
# 1. Ga naar de Qualifai repo
cd /home/klarifai/Documents/klarifai/projects/qualifai

# 2. Check de git state
git status
git log --oneline -10

# 3. Verify de planning artifacts bestaan
ls .planning/phases/61.1-manual-prospect-flow-polish/
cat .planning/STATE.md  # zou v9.0 / Phase 61.1 / status: planned moeten zeggen
```

### Eerste gesproken zin in de nieuwe sessie

Letterlijk overnemen:

> "Lees in deze volgorde:
>
> 1. `qualifai/.planning/HANDOFF.md` (deze handoff, vooral §2 + §4 + §5)
> 2. `qualifai/.planning/phases/61.1-manual-prospect-flow-polish/61.1-01-PLAN.md` t/m `61.1-04-PLAN.md` (de 4 plans)
> 3. `klarifai-core/docs/strategy/decisions.md` (Q5/Q9/Q12/Q13/Q14 — alle 6 nog locked)
>
> Daarna: run `/gsd:execute-phase 61.1`. Wave 1 = 61.1-01 + 61.1-02 parallel. Wave 2 = 61.1-03. Wave 3 = 61.1-04 (heeft een human-verify checkpoint aan het eind)."

### Volgorde van skills voor de hele 61.1

```
1. /clear                          (verse context — sterk aanbevolen)
2. /gsd:execute-phase 61.1         (4 plans, ~2-3 uur, eindigt met human-verify)
3. (Romano doet manuele smoke test op /admin/prospects/[id] Acties panel)
4. /gsd:verify-work 61.1           (afronding)
5. /ship                           (commit + push)
6. /design-consultation            (begint Phase 62 — DESIGN.md aanmaken)
```

### Als je nog twijfelt of de context klopt

```bash
# Check de commits van 13 + 14 april (Phase 60 + 61 + 61.1 planning)
git log --oneline --since="2026-04-13" --until="2026-04-15"

# Of: vraag de assistant: "Show me what's been shipped vs what's planned for v9.0"
```

---

## 3. STATE VAN v9.0

### Phase progress

| Phase                                  | Status                       | Plans | Tests       | Commits                                  |
| -------------------------------------- | ---------------------------- | ----- | ----------- | ---------------------------------------- |
| 60 Quote Schema Foundation             | ✅ Complete (2026-04-13)     | 5/5   | 48/48 green | `12dfd54`..`a1c84de`                     |
| 61 Admin UI for Quotes                 | ✅ Complete (2026-04-14)     | 4/4   | 92/92 green | `ffab018`..`8cba0ed` + `584319d` rename  |
| **61.1 Manual prospect flow polish**   | 🟡 Planned (verified iter 2) | 0/4   | TBD         | `2842c99` (initial), `e8c87ce` (revised) |
| 62 Client-Facing Voorstel + PDF Worker | ⏳ Not started               | 0/TBD | -           | -                                        |
| 63 Contract Workflow                   | ⏳ Not started               | 0/TBD | -           | -                                        |

### Locked decisions (uit klarifai-core/docs/strategy/decisions.md)

| ID  | Beslissing                                                                           | Status                               |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------ |
| Q5  | PDF rendering = separate Railway worker (geen Puppeteer in Qualifai)                 | Locked, gehonoreerd in Phase 60 + 61 |
| Q8  | Bestaande YAMLs gemigreerd via idempotent import script                              | Locked, geshipped in Phase 60        |
| Q9  | Snapshot bij QUOTE_SENT (immutable)                                                  | Locked, gehonoreerd in Phase 60 + 61 |
| Q12 | Snapshot versioning = `snapshotAt` + `templateVersion` (geen counter)                | Locked, geshipped in Phase 60        |
| Q13 | Twee enums (QuoteStatus + ProspectStatus.QUOTE_SENT) met auto-sync via state machine | Locked, geshipped in Phase 60        |
| Q14 | Web is primair, PDF secundair, geen 1-op-1 visuele kopieën                           | Locked, raakt Phase 62               |

### Romano's locked design defaults voor Phase 61 (en doorlopend)

| ID  | Beslissing                                                                        |
| --- | --------------------------------------------------------------------------------- |
| O1  | `nummer` auto-suggest via `suggestNextQuoteNumber()` server helper                |
| O2  | `DEFAULT_BTW_PERCENTAGE = 21` als hardcoded constant                              |
| O3  | `/admin/quotes` lijst = stacked sections (DRAFT → SENT → ARCHIVED-collapsed)      |
| O4  | URL hybrid: nested create, flat detail, root list                                 |
| O5  | "Nieuwe versie" knop alleen op `status in ['SENT', 'VIEWED']` met confirm modal   |
| O6  | Verstuur confirm modal verplicht, exact Dutch copy met totaal                     |
| O7  | Explicit "Opslaan" + dirty indicator + `beforeunload` warning                     |
| O8  | Sidebar "Offertes" tussen Campaigns en Draft Queue, `FileText` icon               |
| O9  | Prospect state machine widening voor QUOTE_SENT cascade (gedaan in Phase 61.1-01) |
| O10 | `tarief` opslaan als euros integer (niet cents)                                   |

---

## 4. PHASE 61.1 — DETAILS VOOR DE EXECUTOR

### Goal

Manual prospect creation produces a viable working prospect: every prospect has a visible logo (Apollo or favicon fallback), the master analyzer survives Gemini API blips via retry+backoff, Romano can retrigger any pipeline stage from the prospect detail page, and AI failures render as friendly messages instead of stack traces.

### Plans

| Plan                                                                                                                | Wave | Tasks            | Files | Requirements              |
| ------------------------------------------------------------------------------------------------------------------- | ---- | ---------------- | ----- | ------------------------- |
| 61.1-01 Master analyzer retry + backoff + Prisma migration                                                          | 1    | 2                | 5     | POLISH-01, 02, 03, 12     |
| 61.1-02 Favicon helper + tests                                                                                      | 1    | 2                | 2     | POLISH-04, 13             |
| 61.1-03 createProspect favicon + tRPC retrigger mutations + ProspectLogo + research-executor wiring + error-mapping | 2    | 3                | 7     | POLISH-05, 06, 08, 10, 11 |
| 61.1-04 Acties panel + Laatste run indicator + admin pages mount + human-verify checkpoint                          | 3    | 3 (1 checkpoint) | 6     | POLISH-07, 09, 14         |

Wave structure: 1 (01 + 02 parallel) → 2 (03) → 3 (04, autonomous=false).

### Critical implementation details

1. **`callGeminiWithRetry` returns an envelope, NOT a plain GenerateContentResult:**

   ```typescript
   type GeminiCallResult = {
     result: GenerateContentResult;
     fallbackUsed: boolean;
     modelUsed: 'gemini-2.5-pro' | 'gemini-2.5-flash';
     attempts: number;
   };
   ```

   Reason: ROADMAP success criterion #2 requires the UI to surface "AI tijdelijk niet beschikbaar — fallback model gebruikt". Plan checker found this gap in iter 1 and Plan 01 + 03 + 04 were revised to thread `fallbackUsed` end-to-end.

2. **3 nieuwe Prisma columns op `Prospect`:**
   - `lastAnalysisError String?`
   - `lastAnalysisAttemptedAt DateTime?`
   - `lastAnalysisModelUsed String?` ← discriminator voor de fallback amber state
     Migration moet additive only zijn (Phase 60 dev DB drift memo: gebruik shadow DB of `prisma migrate diff` + manual psql apply als `prisma migrate dev` om destructive reset vraagt).

3. **`recordAnalysisSuccess(db, prospectId, modelUsed)` vervangt `clearAnalysisFailure`:**
   - Op success met `gemini-2.5-pro` → clears error, sets attemptedAt, sets `lastAnalysisModelUsed = 'gemini-2.5-pro'`
   - Op success met `gemini-2.5-flash` → clears error, sets attemptedAt, sets `lastAnalysisModelUsed = 'gemini-2.5-flash'` ← dit is de fallback signal
   - `recordAnalysisFailure` blijft voor de hard-failure path

4. **`lib/research-executor.ts` MOET ook gewrapt worden** met `recordAnalysisSuccess` / `recordAnalysisFailure` (Plan 03 Task 3). Plan 01 wire't alleen `callGeminiWithRetry` zelf; Plan 03 wire't de top-level analysis functies in research-executor.ts. Zonder dit blijft de normale pipeline failures silently droppen — exact het Marfa probleem.

5. **`runMasterAnalysis` tRPC mutation throws PRECONDITION_FAILED in Phase 61.1:**
   - `ProspectAnalysis.inputSnapshot` is een counts-summary, NIET een reconstructable input voor master-analyzer
   - Daarom: in Phase 61.1 throws de mutation een Dutch error "Analyse herhalen niet ondersteund — draai eerst onderzoek opnieuw."
   - De UI mapt dit naar een friendly toast via `mapMutationError`
   - In Phase 62+ kan dit verder uitgewerkt worden als de input shape stabiliseert
   - Ondertussen: "Run research" knop werkt WEL volledig en cascade'd naar de master analyzer via `lib/research-executor.ts`

6. **ProspectLogo render priority:**
   - `prospect.logoUrl` (Apollo) → `<img src={logoUrl}>`
   - else `<img src={'https://www.google.com/s2/favicons?domain=' + domain + '&sz=' + size*2}>`
   - else initial-letter circle
   - `<img onError>` swap chain
   - `loading="lazy"`
   - `shape?: 'circle' | 'rounded'` prop (default circle voor detail header, rounded voor list cards)

7. **Error mapping helper** (`components/features/prospects/error-mapping.ts`) exporteert 4 verbatim Dutch strings:
   - `FRIENDLY_ERROR_GEMINI_503` = "AI tijdelijk niet beschikbaar — Gemini API spike, probeer over een paar minuten opnieuw."
   - `FRIENDLY_ERROR_GEMINI_QUOTA` = "AI quota uitgeput voor vandaag — Gemini free-tier limiet bereikt."
   - `FRIENDLY_ERROR_GEMINI_RATE_LIMIT` = "AI rate limit — even wachten en opnieuw proberen."
   - `FRIENDLY_ERROR_GEMINI_FALLBACK` = "AI tijdelijk niet beschikbaar — fallback model gebruikt"
   - Default fallback = first 120 chars van `error.message`

8. **Plan 04 human-verify checkpoint** stap 6: forces fallback state via `psql UPDATE Prospect SET lastAnalysisModelUsed = 'gemini-2.5-flash' WHERE readableSlug = 'marfa'` en vraagt Romano om de amber branch in `ProspectLastRunStatus` visueel te bevestigen op `/admin/prospects/[marfa-id]`.

### Pitfalls om te vermijden

- Plan 01 master-analyzer.ts gaat ~700 LOC worden post-edit (300-LOC cap overshoot, geaccepteerd als tech debt — extractie in latere refactor)
- `vi.useFakeTimers()` in master-analyzer test — DON'T mock `node:timers/promises` (was dead code in iter 1)
- Multi-tenant: elke nieuwe mutation MOET `findFirst({ where: { id, projectId: ctx.projectId } })` doen vóór side effects
- Geen nieuwe deps (geen react-hook-form, shadcn/ui, radix, sonner, cmdk, puppeteer, chromium)

---

## 5. PHASE 62 — DETAILS VOOR LATER

### Goal

Romano klikt een prospect's offerte URL en ziet een **modern web-native voorstel** (geen statische A4 in een browser). Web is leading, PDF is secundair archief format. Phase 62 begint met design discovery, niet met code.

### Plan structuur (uit ROADMAP)

- **62-01 Design discovery** — `/design-consultation` met awesome-design-md inspiration → `DESIGN.md`
- **62-02 Visual exploration** — `/design-shotgun` 3-5 variants → committed direction
- **62-03 UI-SPEC contract** — `/gsd:ui-phase` → `UI-SPEC.md`
- **62-04 Web voorstel implementation** — React/Next.js `/discover/[slug]/voorstel` page tegen UI-SPEC
- **62-05 PDF Worker service** — Separate Railway worker met print-optimised template

### Open vragen voor Phase 62

| ID  | Vraag                                                                         | Wanneer beantwoorden           |
| --- | ----------------------------------------------------------------------------- | ------------------------------ |
| Q6  | Design tokens harmoniseren (klarifai brand kleuren naar Qualifai globals)     | Tijdens `/design-consultation` |
| Q7  | Auth model voor `/discover/[slug]/voorstel` (token? IP logging? alleen slug?) | Vóór 62-04 plan-phase          |

### Romano's design intent (deze sessie genoemd)

- Hij wil Phase 62 starten met een **design brief** via `/design-consultation` zoals letterlijk in z'n quote: _"Ik denk dat we daar een skill voor moeten gebruiken in superpowers of gstack die allereerst een design brief aanmaakt voor deze app."_
- Phase 61 was bewust een functional admin shell zonder nieuw design system — dat is correct gebeurd
- De DESIGN.md die uit Phase 62-01 komt drijft **beide** surfaces: client `/discover/[slug]/voorstel` én admin `/admin/quotes/[id]` (compact rendition, zelfde tokens)
- Per Q14: klarifai-core proposal-template.html is **referentie material only**, niet de design source. Phase 62 begint met een schone lei.

---

## 6. KNOWN STATE & GOTCHAS

### Live system

| Service            | Status                    | Port | Container                   |
| ------------------ | ------------------------- | ---- | --------------------------- |
| Postgres + PostGIS | Up                        | 5433 | qualifai-db                 |
| Redis              | Started 2026-04-14 12:38  | 6381 | qualifai-redis              |
| Next.js dev server | Up sinds 2026-04-14 12:38 | 9200 | bg shell `b932urig7`        |
| Scrapling          | Down                      | 3010 | qualifai-scrapling (exited) |

**Marfa state in dev DB:**

- 1 Prospect (`readableSlug=marfa`, `id=cmnyhtzyj0000f2xgfegb1ic7`, `status=READY`, `logoUrl=NULL`, `companyName='Marfa'`)
- 3 Quotes (OFF001/OFF002/OFF003, all DRAFT, totals match klarifai-core)
- 1 ResearchRun completed met master_analysis warning (Gemini 503)
- Pipeline rerun via `scripts/tmp-rerun-marfa.ts` (kan opnieuw als Gemini 5xx persistent is)

### Tech debt logged deze sessie

1. **Master analyzer is geen Gemini-only meer waardig** — Gemini 2.5 Pro free tier 503's zijn te vaak om zonder retry te leven. Phase 61.1 lost dit op. Optioneel later: switch naar paid tier of fallback chain via Anthropic.
2. **`master-analyzer.ts` overshoots 300 LOC** post-Phase 61.1 (~700 LOC). Tech debt: extract het Gemini-specifieke retry stuk naar `lib/ai/gemini-client.ts` zodat master-analyzer puur analyse-logic blijft.
3. **Dev DB drift sinds Phase 60** — `IntentExtraction` table zit zonder migration file in dev DB, `ProjectDocumentChunk_embedding_hnsw_idx` is een phantom in migration history. `prisma migrate dev` wil destructive reset. Workaround: `prisma migrate diff --from-migrations --to-schema --script` + manual psql apply (Phase 60 deviation memo, herhaald in Phase 61.1-01).
4. **`scripts/tmp-*.ts` debug scripts** hebben pre-existing TS errors die in elke Phase als "10 baseline errors" terugkomen. Niet kritisch maar ooit opruimen.
5. **`lib/enrichment/sitemap.test.ts`** Buffer typing error (TS2345) — pre-existing, niet in scope van Phase 60-62.
6. **Apollo dekt geen kleine Nederlandse SMBs** — voor breder dekking moet je copifai's HTML scraper porten (tier 1-5: selectors + SVG + PNG + Apple touch + meta tags). Phase 61.1 doet alleen favicons; branded-logo extraction blijft tech debt tot Romano het nodig heeft.
7. **Background job queue** — pipeline runs gebeuren synchroon in tRPC mutations. Phase 60 CONCERNS noemde dit al; voor v9.0 acceptabel maar voor scale niet.

### Open questions die NIET deze sessie zijn beantwoord

- **Q3** Contracts zelf bouwen vs SignWell — vóór Phase 63 plan-phase
- **Q6** Design tokens — wordt beantwoord tijdens `/design-consultation` (Phase 62-01)
- **Q7** Auth model voor `/voorstel` — vóór Phase 62-04 plan-phase
- **Branded logo extraction** — pas als Romano zegt "deze 128px favicons zien er rommelig uit"

---

## 7. CHANGELOG VAN DEZE SESSIE (2026-04-13 → 2026-04-14)

### 2026-04-13

- Phase 60 Quote Schema Foundation: planned, executed, verified, shipped
  - 5 plans, 13 tasks, 23 requirements, 48/48 tests
  - Marfa import success criterion confirmed by Romano
  - 1 deviation logged: Phase 60-02 migration was hand-authored via `prisma migrate diff` due to dev DB drift

### 2026-04-14

- Phase 61 Admin UI for Quotes: planned, executed, verified, shipped
  - 4 plans, 13 tasks, 8 ADMIN requirements, 92/92 tests
  - Plan checker iter 1 found 1 wave-numbering blocker + 4 warnings, all fixed
  - 1 rate-limit interruption mid-execute (60-04 had to resume from Task 2)
  - 1 timeout mid-execute (60-05 had to resume from Task 2)
  - Both successfully resumed via continuation agents
- Phase 61 smoke testing → Romano discovered 4 issues:
  - "Voorstellen" is the wrong word → renamed to "Offertes" (commit `584319d`)
  - Marfa quotes were missing → import had never run with `--apply` (now fixed)
  - Master analyzer Gemini 503 → no retry → POLISH-01..03
  - No favicon for Marfa → Apollo doesn't have it → POLISH-04..06
  - No UI to retrigger pipeline → POLISH-07..09
  - No logos in cards → POLISH-10..11
- Phase 61.1 Manual prospect flow polish: inserted, planned, verified
  - 14 POLISH requirements added to REQUIREMENTS.md
  - 4 plans written (commit `2842c99`)
  - Plan checker iter 1 found 1 fallback-UI blocker + 2 warnings + 3 info, all addressed in iter 2 (commit `e8c87ce`)
  - **NOT YET EXECUTED** — that's the next session's first task
- Decided to start Phase 62 design discovery LATER (not immediately) — Romano's instinct was to use `/design-consultation` first, agreed but parked until Phase 61.1 ships first

### Belangrijke commit hashes

| Commit               | Wat                                         |
| -------------------- | ------------------------------------------- |
| `2537c8d`..`a1c84de` | Phase 60 plans + execution + completion     |
| `34baded`..`8cba0ed` | Phase 61 plans + execution + completion     |
| `584319d`            | Voorstellen → Offertes rename               |
| `e5e730a`            | Phase 60 plan revision per checker          |
| `4109054`            | Phase 60-04 metadata commit                 |
| `2842c99`            | Phase 61 initial plans                      |
| `e8c87ce`            | Phase 61.1 plan revision per checker iter 1 |

---

## 8. DEFINITION OF DONE VOOR v9.0

v9.0 (Klant Lifecycle Convergence) is "klaar" wanneer:

- [x] Phase 60 Quote Schema Foundation shipped + verified
- [x] Phase 61 Admin UI for Quotes shipped + smoke tested
- [ ] Phase 61.1 Manual prospect flow polish shipped + verified (volgende sessie)
- [ ] Phase 62 Client-Facing Voorstel + PDF Worker shipped + smoke tested
- [ ] Phase 63 Contract Workflow shipped + smoke tested
- [ ] All v9.0 requirements (73 totaal: 23 v60 + 8 v61 + 14 v61.1 + ~28 v62/63) marked Complete in REQUIREMENTS.md
- [ ] `/gsd:complete-milestone` archives v9.0 en bereidt v10.0 voor (invoice + klarifai-core CLI deprecation)

Geschat: nog 2-3 sessies werk om v9.0 af te ronden. Phase 61.1 = 1 sessie. Phase 62 = 1-2 sessies (design + 4-5 plans implementation + PDF worker). Phase 63 = 1 sessie.

---

_Handoff geschreven: 2026-04-14_
_Volgende sessie: open dit bestand, lees §2 + §4 + §5, run `/clear`, run `/gsd:execute-phase 61.1`._

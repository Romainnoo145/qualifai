# HANDOFF — Qualifai v9.0 design system execution

> **Laatste update:** 2026-04-16
> **Doel:** open dit bestand in een verse sessie en je kunt direct verder. Geen context reconstructie nodig.
> **Status:** brochure shipped, admin Editorial gespec'd en Fase A in uitvoering.

---

## 1. TL;DR

De 3 pijlers uit de v9.0 roadmap zijn nu in 4 werkfasen herverdeeld omdat de admin-taal een eigen systeem werd dat los van de brochure loopt.

| Fase                                            | Scope                                                                               | Aesthetic                                                 | Status                    |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------- |
| **Pijler 1** — `/offerte/[slug]` brochure       | 7-page click-through brochure, video cover, Klarifai brand                          | Brochure dark (§3.1)                                      | ✅ SHIPPED 2026-04-15     |
| **Fase A** — admin foundation + prospect detail | globals.css tokens + fonts + 58px rail + `/admin/prospects/[id]` rewrite            | Editorial paper (§3.2)                                    | 🟡 IN PROGRESS 2026-04-16 |
| **Fase B** — quotes Editorial + brochure wire   | `/admin/quotes/*` redesign + wire brochure Page 4 Investering naar echte Quote data | Editorial paper + brochure data contract                  | ⏳ QUEUED                 |
| **Fase C** — invoices + contract workflow       | Accept → generate invoices, `/admin/invoices/*`, e-signature                        | Editorial paper (admin) + brochure dark (signing surface) | ⏳ QUEUED                 |
| **Fase D** — `/discover/[slug]` redesign        | Port client-facing discover page naar brochure-taal                                 | Brochure dark (§3.1)                                      | ⏳ QUEUED (lage prio)     |

Per-fase details in `.planning/handoffs/fase-{a|b|c|d}-*.md`. Lees die voor executie-context.

---

## 2. Twee design-talen (gelockt)

| Surface                      | Aesthetic                                                                                                    | Wie ziet het         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------- |
| `/offerte/[slug]` brochure   | **Donker · Klarifai** (navy `#040026`, goud gradient, Sora, hero + 7 pages)                                  | Klant extern         |
| `/discover/[slug]` dashboard | **Donker · Klarifai** (zelfde taal na Fase D)                                                                | Klant extern         |
| `/admin/*` alles             | **Editorial · paper** (paper `#f5f2ea`, ink `#0a0a2e`, Sora + IBM Plex Mono, 58px icon rail, square buttons) | Romano + team intern |

DESIGN.md §3.1 = client dark. §3.2 = admin editorial. Beide concreet met tokens, component patterns, en decision log.

---

## 3. Deze sessie (2026-04-16)

**Ontwerp afgerond:**

- `/design-consultation` gedraaid voor admin direction — Editorial gekozen na round-trips (zag V1 dark command center, V2 editorial mega, V3 dense console; Romano koos V2, daarna iteraties op canvas temperatuur, mono font choice, icon treatment, type tags)
- Mockup op `http://127.0.0.1:9201/v2-editorial.html` (python http.server op :9201 in background)
- DESIGN.md §3.2 herschreven van vage "migrate over time" naar concrete Editorial spec
- Design spec geschreven naar `docs/superpowers/specs/2026-04-16-admin-prospect-detail-redesign.md`
- Decisions log in DESIGN.md §10 aangevuld met 3 entries van 2026-04-16

**Fase A gestart:**

- 3 atomaire commits gepland (globals → layout → detail page)
- 4 placeholder sub-route pages voor `/admin/prospects/[id]/{evidence|analyse|outreach|resultaten}`
- 8 nieuwe editorial componenten (`components/features/prospects/editorial/*`)
- 1 nieuwe tRPC query `admin.getProspectActivity` voor unified feed

---

## 4. Volgende sessie — literal opening

Copy-paste deze zin in een nieuwe sessie:

> Lees in deze volgorde:
>
> 1. `qualifai/.planning/HANDOFF.md` (deze, voor de 4-fasen map)
> 2. `qualifai/.planning/handoffs/fase-{huidige}-*.md` (detailed execution instructies)
> 3. `qualifai/DESIGN.md` (design system contract)
> 4. `qualifai/docs/superpowers/specs/2026-04-16-admin-prospect-detail-redesign.md` (Fase A spec)
>
> Als Fase A nog niet compleet is: rond af via de stappen in de fase-A handoff, pas de drie commits toe, valideer met `npm run check`, smoke test `/admin/prospects/<marfa>` tegen de mockup op :9201. Als Fase A shipped is: start Fase B via `.planning/handoffs/fase-b-quotes-editorial-brochure-wire.md`.

---

## 5. Kern state na deze sessie

### Fase A plan (executing)

Stappen in detail in `.planning/handoffs/fase-a-admin-foundation-prospect-detail.md`. Samengevat:

1. **Foundation commit** — `app/globals.css` token swap + `app/layout.tsx` Sora/Plex Mono fonts via `next/font/google`
2. **Shell commit** — `app/admin/layout.tsx` 58px icon rail, verwijder desktop topbar
3. **Detail page commit** — `app/admin/prospects/[id]/page.tsx` rewrite naar Editorial, 8 nieuwe componenten, 1 nieuwe tRPC query

Sub-route placeholders (evidence/analyse/outreach/resultaten) worden gebouwd als thin pagina's die de activity feed gefilterd tonen + "Volledige weergave volgt" notitie.

### Locked design tokens (uit DESIGN.md §3.2)

```
--color-background: #f5f2ea  (paper)
--color-surface:    #ece8da  (paper-2)
--color-ink:        #0a0a2e  (text + borders)
--color-gold:       #c79a1f  (primary CTA, ink-leaning)
--color-gold-hi:    #e4c33c  (hero period, active sidebar bar)
--color-muted:      #6e6958
--color-muted-dark: #4a4536

--font-sora: 'Sora', sans-serif  (300/500/700)
--font-plex: 'IBM Plex Mono', monospace  (400/500/600)
```

Event type tags (alleen in activity feed):

- ENRICH sage `#4a7a52` on `#ebf1e5`
- QUALITY gold-ink `#8c6f13` on `#fdf6d7`
- RUN ink blue `#3d5f82` on `#e8edf2`
- QUOTE ink on paper-2
- OUTREACH plum `#6e4780` on `#eee6f0`
- EVIDENCE olive `#5e6a3a` on `#f0efe0`

### Critical gotchas voor Fase A

- **Niet breken `/offerte/[slug]`**: brochure laadt eigen Sora via `app/offerte/[slug]/layout.tsx`. Verify na Step 1 door de brochure te bezoeken.
- **Niet breken `/discover/[slug]`**: Fase D redesignt dit, tot die tijd onaangetast. Verify na Step 1.
- **Tailwind slate classes**: admin pagina's gebruiken `bg-slate-50`, `border-slate-100` etc direct in TSX. Die blijven werken, maar alleen de prospect detail page + admin shell krijgen paper classes. Sibling pagina's (Companies list, Draft Queue etc) houden huidige styling tot hun eigen redesign fase.
- **TS2589 tRPC v11 inference**: `getProspect` returnt te diepe types. Houd `as any` patroon met `// TODO: tRPC v11 inference` comment aan.
- **Override audits**: fold in activity feed als `QUALITY_OVERRIDE` event in plaats van apart blok.
- **SourceSetSection**: alleen in debug mode (localStorage `qualifai-debug`). Render als collapsed disclosure onderin feed.

### Dev servers

- Qualifai dev server: `localhost:9200` (running background task)
- Design mockup server: `127.0.0.1:9201` (python http.server in `~/.gstack/projects/Romainnoo145-qualifai/designs/admin-prospect-detail-mockup/`)

---

## 6. Open questions uit de spec (§6 daar)

Moeten beantwoord tijdens Fase A executie of planning:

1. **Oude admin classes aliasen of direct deleten?** Recommendation: alias `.admin-btn-primary` → nieuwe `.btn--gold` voor backcompat, delete `.glass-card` direct (incompatibel).
2. **Tabs-componenten verwijderen in één PR?** Recommendation: ja — `EvidenceSection` / `AnalysisSection` / `OutreachPreviewSection` / `ResultsSection` uit de detail page knippen. Blijven bestaan als library-componenten voor sub-route pages later.
3. **Activity feed data: server-side union query of client-side merge?** Recommendation: nieuwe `admin.getProspectActivity` tRPC procedure met discriminated union type, server-side gemerged.
4. **Sub-route placeholder copy?** Recommendation: `<ActivityFeed filter="EVIDENCE" />` + "Volledige weergave volgt" Plex Mono 11px muted.

Neem beslissingen tijdens de step-3 commit.

---

## 7. Decisions van deze sessie

| Datum      | Beslissing                                | Waarom                                                                                                                                                                                                                            |
| ---------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-16 | Admin taal is Editorial (ink on paper)    | V2 gekozen uit vergelijking met V1 dark command center en V3 dense console. Warm paper canvas + Sora + Plex Mono + bright gold + square buttons. Distinct van brochure maar zelfde brand DNA.                                     |
| 2026-04-16 | 58px icon-only rail, geen topbar          | Test 240/272/288 labeled sidebars + top nav — rail houdt typografie + activity feed dominant. Tooltips op icons handelen discoverability.                                                                                         |
| 2026-04-16 | Activity feed vervangt 5-tab navigation   | Oude 5-tab structuur (Evidence / Intent / Analysis / Outreach / Results) = scroll friction, niemand gebruikt. Reverse-chrono feed met gekleurde type tags surfaces state in 1 seconde. Sub-route pagina's voor long-form content. |
| 2026-04-16 | IBM Plex Mono ipv JetBrains Mono          | JB Mono te coder-sharp voor paper canvas. Plex Mono humanistischer, past bij document-gevoel. Bij zelfde font-size identiek leesbaar voor data labels.                                                                            |
| 2026-04-16 | Alleen gold + 6 event type tags als kleur | Volledige semantic palette (sage/blue/amber/coral in status cells) voelde "speels" bij multi-user admin. Kleur scoped tot activity feed event tags voor 1-seconde scanbaarheid.                                                   |
| 2026-04-16 | Sub-routes → separate pages, niet tabs    | Per earlier sessie al besloten, bevestigd. Evidence/Analyse/Outreach/Resultaten krijgen eigen URLs `/admin/prospects/[id]/<naam>`. Placeholder gevuld met gefilterde activity feed + "Volledige weergave volgt".                  |

---

## 8. Parked (niet in scope voor Fase A)

- **Content pass op de brochure** — Marfa placeholder copy vervangen door echte Marfa context (Plancraft start + custom tool roadmap)
- **Phase 62 PDF worker** — snapshot brochure als PDF
- **Phase 63 contract workflow** — verplaatst naar Fase C
- **Mobile optimalisatie** — admin + brochure beide desktop-first
- **Dark admin mode toggle** — optioneel, uit scope
- **Sibling admin page redesigns** (Companies list, Campaigns, Offertes list etc) — elke krijgt eigen klein plan na Fase A
- **`/discover/[slug]` redesign** — Fase D, lage prio

---

_Volgende sessie: lees deze HANDOFF + de relevante fase-handoff + DESIGN.md + spec. Pak op waar Fase A stopt._

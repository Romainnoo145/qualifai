# HANDOFF — Qualifai v9.0 design system execution

> **Laatste update:** 2026-04-15
> **Doel:** open dit bestand in een verse sessie en je kunt direct verder. Geen context reconstructie nodig.
> **Status:** client brochure design shipped, 2 admin pijlers nog te doen, daarna data wiring.

---

## 1. TL;DR

**Wat is af deze sessie:**

- ✅ Phase 61.1 / 61.2 / 61.3 geshipped (manual prospect polish + parity + logo pipeline unification) — v9.0 Wave 1 compleet
- ✅ `/design-consultation` draaide, produceerde `DESIGN.md` — volledige brand spec (Klarifai navy/gold/Sora), click-through brochure UX, 7-page architectuur
- ✅ Klant-facing `/offerte/[slug]` brochure volledig geïmplementeerd in code — alle 7 pages live, video cover, gold signature canvas, Klarifai chrome
- ✅ 3 Marfa offertes bevestigd in Quote tabel (geïmporteerd tijdens Phase 60, bedragen €7.816,60 / €11.495,00 / €13.285,80)
- ✅ Mail template voor Romano om Marfa de 3 offertes toe te lichten (zonder bedragen, met Marcore-vermelding bij OFF003, buiten-scope sectie)

**Wat is af deze sessie qua design richting:**

- 1 van 3 design pijlers compleet (de client brochure)

**Wat nog moet:**

- 2 design pijlers: admin prospect detail + admin quotes UI
- Daarna content, data wiring, backend glue

---

## 2. De 3 design pijlers

Uit de design consultation kwam een systeem met 3 anker surfaces die allemaal tegen hetzelfde DESIGN.md worden gebouwd.

| #   | Surface                                     | Status               | Scope                                                                                  |
| --- | ------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------- |
| 1   | `app/offerte/[slug]` — client brochure      | ✅ DONE (2026-04-15) | 7 pages, video cover, signature canvas, click-through UX, Klarifai brand               |
| 2   | `app/admin/prospects/[id]` — detail page    | ⏳ TODO              | "Te onoverzichtelijk" per Romano. Herdesign tegen DESIGN.md §3.2 admin command center. |
| 3   | `app/admin/quotes/*` — quotes management UI | ⏳ TODO              | "Nog een ramp" per Romano. List + edit pages herdesign.                                |

Pas ná alle 3 de pijlers volgt de niet-design inhoud (content, data wiring, backend).

---

## 3. Geparkeerd tot na de pijlers

- **Content pass op de client brochure** — huidige tekst is placeholder (Plancraft rebuild scenario). Marfa's echte context: ze starten _nog_ met Plancraft, willen eigenlijk een custom tool. Echte copy komt uit klarifai-core writing-style docs + per-klant handwerk.
- **Brochure wired to real Quote data** — Page 4 Investering gebruikt nu een hardcoded stub (200u × €95 = €22.990). Moet Prisma `Quote` + `QuoteLine` query worden. Data staat al in DB.
- **PDF worker voor snapshot** — was originele Phase 62 scope. Q14 locked: PDF is secundair archief, web is primair. Nog niet gebouwd.
- **Phase 63 Contract Workflow** — click-to-sign na quote acceptance. Originele v9.0 scope, nog niet gestart.
- **Pop-ups voor extra uitleg** op brochure pages — Romano suggereerde, ik adviseerde tegen (breekt click-through ritme). Geparkeerd tot een concreet gat zich meldt.

---

## 4. Volgende sessie — literal opening

Copy-paste deze zin in een nieuwe sessie:

> Lees in deze volgorde:
>
> 1. `qualifai/.planning/HANDOFF.md` (deze, vooral §2, §5, §6)
> 2. `qualifai/DESIGN.md` (design contract, leidend voor alle UI)
> 3. `qualifai/components/features/offerte/brochure-cover.tsx` (referentie-implementatie van het systeem — 7 pages in code)
> 4. `qualifai/app/admin/prospects/[id]/page.tsx` (surface #2, de huidige "te onoverzichtelijke" admin prospect detail)
>
> Daarna: ontwerp EN implementeer de admin prospect detail page tegen DESIGN.md §3.2 (admin command center pattern: 240px sidebar + top bar + main content, Linear-adjacent). Pas alle primitives uit de brochure toe waar relevant (Sora font, navy `#040026` bg, container gradient `linear-gradient(180deg, #040026 0%, #080054 100%)`, gold accents `#e1c33c → #fdf97b`, pill buttons, `[ 0X ] SECTION` label pattern, gold heading period). Wire niet naar nieuwe data — gebruik de bestaande tRPC queries die al draaien, fix alleen de presentatie.
>
> Als Romano de richting van surface #2 goedkeurt, door naar surface #3 (`/admin/quotes`).

---

## 5. Kern state na deze sessie

### Files die shipped zijn deze sessie (brochure)

| Pad                                              | Inhoud                                                                                                                                                                                                            |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/offerte/[slug]/page.tsx`                    | Server component, Prisma lookup by readableSlug, prettifyDomainToName fallback voor companyName                                                                                                                   |
| `app/offerte/[slug]/layout.tsx`                  | Scoped Sora font load (Google Fonts, weights 300/500/700)                                                                                                                                                         |
| `components/features/offerte/brochure-cover.tsx` | Volledige 7-page brochure component (~1200 LOC). Cover (video) / Uitdaging / Aanpak / Investering / Scope / Akkoord / Bevestigd. Fixed chrome, gold signature canvas, keyboard nav, all viewport-fit geen scroll. |
| `public/video/klarifai-intro.mp4`                | 12MB, 15s, 1920×1080 Klarifai intro video (navy + gold branded)                                                                                                                                                   |
| `public/video/klarifai-intro-poster.jpg`         | Last frame fallback voor `prefers-reduced-motion` en mobile                                                                                                                                                       |
| `public/brand/klarifai-icon.svg`                 | Gold K mark (uit klarifai-core/assets/logo)                                                                                                                                                                       |
| `public/brand/klarifai-logo-white.svg`           | Full wordmark, reserved                                                                                                                                                                                           |
| `lib/enrichment/company-name.ts` + `.test.ts`    | `prettifyDomainToName()` util. 9 tests green.                                                                                                                                                                     |
| `lib/enrichment/logo-pipeline.ts` + `.test.ts`   | Phase 61.3 unified `resolveLogoUrl()`. 9 tests green.                                                                                                                                                             |
| `server/routers/admin.ts`                        | `createProspect` auto-derives companyName from domain via prettifyDomainToName                                                                                                                                    |
| `DESIGN.md`                                      | Design system contract (640+ lines). De wet voor alle UI werk.                                                                                                                                                    |
| `CLAUDE.md`                                      | Project instructions die DESIGN.md als leidend markeren.                                                                                                                                                          |

### Brand tokens (uit DESIGN.md, extracted from klarifai.nl live CSS)

```
--color-navy: #040026           (Klarifai Indigo, primary bg)
--color-navy-deep: #000319      (deepest accent for backdrops)
--color-container-gradient: linear-gradient(180deg, #040026 0%, #080054 100%)
--color-container-border: rgba(53, 59, 102, 0.55)
--color-gold-gradient: linear-gradient(180deg, #e1c33c 0%, #fdf97b 100%)
--color-gold-mid: #e1c33c
--color-gold-light: #fdf97b
--color-text-on-navy: #fefefe
--color-text-muted-on-navy: #898999

Font family: Sora 300 / 500 / 700 (Google Fonts)
Pill radius: 9999px
Card radius: 16px (pillars), 20px (summary cards)
```

### Brochure interaction patterns (re-use on admin pages)

- **Top-left chrome**: Klarifai gold icon (36px, `public/brand/klarifai-icon.svg`), `position: fixed`
- **Top-right progress**: `01 / 07` in Sora 500 11px gold `#fdf97b`, `position: fixed`
- **Section label pattern**: `[ 0X ]  LABEL NAME` — gold gradient bracket number + white navy label, Sora 500 12px uppercase letter-spacing 0.18em
- **Hero heading pattern**: Sora 700 clamp(40px, 4.5vw, 96px), gold period via `WebkitBackgroundClip: text` + `WebkitTextFillColor: transparent` on a `<span>`
- **Numbered items pattern**: gold gradient Sora 700 big number + Sora 500 title + Sora 300 muted desc
- **Arrow nav**: circular 64px buttons, grey outline for back (`rgba(255,255,255,0.18)` border + transparent bg), gold gradient fill for next
- **Keyboard nav**: `←` `→` arrows wired via `useEffect` + window keydown listener

### Pages bouwmethode (uit brochure-cover.tsx)

Elke page is een functie die `main` returnt met `pageBase` style (fixed + inset 0 + overflow hidden), `<GeometricBackdrop />` SVG, `<BrandChrome />`, `<ProgressIndicator />`, een content grid met `gridTemplateRows` en eigen inhoud, en `<BackArrow />` + `<NextArrow />` onderin. Dit patroon is direct herbruikbaar voor admin layout.

### Marfa DB state

- `readableSlug = marfa`, `companyName = "Marfa"` (backfilled deze sessie), `domain = marfa.nl`
- `logoUrl` = Wix banner photo (gezet via psql in een vorige sessie)
- 3 offertes in `Quote` tabel met line items:
  - `2026-OFF001` Rebuild Plancraft in Marfa-vorm — 68u, €6.460 excl / €7.816,60 incl
  - `2026-OFF002` Custom build Marfa — 100u, €9.500 excl / €11.495,00 incl
  - `2026-OFF003` Custom build + website redesign — 124u, €10.980 excl / €13.285,80 incl (inclusief −€800 pakketkorting)
- Alle 3 status `DRAFT`

### Critical gotchas

- **Brochure Investering page** gebruikt een hardcoded stub `200u × €95 = €22.990`, NIET de echte Marfa Quote data. Wordt in een latere phase aangesloten op `prisma.quote.findFirst()`.
- **Cover video** speelt één keer af (GEEN `loop` attribute), freezes op laatste frame. Dit is intentioneel.
- **Signature canvas** gebruikt native `addEventListener` (niet React pointer events) omdat die laatste quirks hebben met `setPointerCapture` op canvas elementen. De stroke is een canvas gradient van `#e1c33c → #fdf97b`.
- **Section nummers matchen page nummers**: page `02 / 07` = sectie `[ 02 ]  DE UITDAGING`. Aangepast deze sessie zodat er geen dubbele count verwarring is.
- **Logos in chrome**: alleen Klarifai icon, GEEN client logo naast. Reden: de meeste prospects hebben een Wix banner photo als `logoUrl`, niet een echt square logo. Zodra we real logo sourcing hebben kan het clientlogo + `×` terug.
- **`createProspect` mutation** derivet nu automatisch een companyName uit het domain als die niet is meegegeven — `marfa.nl` → `Marfa`, `stb-kozijnen.nl` → `STB Kozijnen`. Wordt gebruikt als fallback overal waar companyName null kan zijn.

---

## 6. Open questions voor volgende sessie

1. **Admin prospect detail** — welk van de bestaande content moet blijven? Welk moet weg? Phase 61 heeft er veel ingestopt (enrichment panel, Acties panel, last-run status, research runs list, etc.). De herdesign moet een beslissing maken over informatie hiërarchie, niet alleen cosmetic.
2. **Admin quotes UI** — hoe manage je een quote die al DRAFT is in Qualifai? Nieuwe knop? Line items editor? Preview naar de brochure? De bestaande Phase 61 "quotes" tab is een functional shell; nu moet het echt uit te leggen zijn.
3. **Content phase scope** — wat hoort bij content herschrijven: alleen brochure copy, of ook admin labels, tooltips, success messages, email templates? Groot verschil in werk.

---

## 7. Definition of done voor v9.0 (bijgewerkt)

- [x] Phase 60 Quote Schema Foundation
- [x] Phase 61 Admin UI for Quotes (functional shell, design komt nog)
- [x] Phase 61.1 Manual prospect flow polish
- [x] Phase 61.2 Manual prospect parity
- [x] Phase 61.3 Logo pipeline unification
- [x] Design consultation + DESIGN.md
- [x] Design pijler 1: client brochure (`/offerte/[slug]`)
- [ ] Design pijler 2: admin prospect detail (`/admin/prospects/[id]`)
- [ ] Design pijler 3: admin quotes UI (`/admin/quotes`)
- [ ] Content pass op brochure (echte Marfa copy uit klarifai-core writing style)
- [ ] Brochure wired to real Quote data
- [ ] Phase 62 PDF worker (web snapshot generation)
- [ ] Phase 63 Contract workflow (click-to-sign)

---

## 8. Commits van deze sessie

```
(chronologisch — zie git log voor hashes)
Phase 61.1 complete → Phase 61.2 plans → verification → execution → Phase 61.3 lean exec
→ DESIGN.md + CLAUDE.md via /design-consultation
→ /offerte/[slug] route structure + video assets
→ brochure-cover.tsx (all 7 pages built incrementally)
→ prettifyDomainToName util + createProspect auto-derive
→ Marfa backfill (psql direct)
→ (pending) Deze HANDOFF + final commit
```

---

_Volgende sessie: open dit bestand, copy-paste §4 opening in de chat, en start met design pijler #2 (admin prospect detail)._

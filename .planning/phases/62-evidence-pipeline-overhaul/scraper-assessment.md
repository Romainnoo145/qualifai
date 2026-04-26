# Qualifai Evidence Scrapers — Assessment & Future Direction

## Wat de scrapers vandaag doen

### Source Discovery (welke URL's scrapen we?)

De pipeline gebruikt een 4-priority fallback keten om URL's te vinden:

1. **Sitemap** (`sitemap.ts`) — parse `robots.txt` → `sitemap.xml`, filter non-content (PDF/CSS/JS), cap op 25 URL's
2. **Katana active crawl** (`katana.ts`) — CLI binary, 1-8 depth, scoort URL's op content-intentie (+4 voor /project, /service; -2 voor /privacy, /cookie)
3. **SERP search** (`serp.ts`) — `site:domain` queries via SerpAPI, alleen bij deepCrawl=true, max 50 URL's
4. **Fallback seeds** — hardcoded paden: `/`, `/about`, `/contact`, `/services`, `/team`, `/blog`, `/news`, etc. (17 URL's, max 6 gebruikt)

Daarnaast 8 gespecialiseerde bronnen (alleen bij deepCrawl):

| Bron             | API/Methode                     | Max items | sourceType |
| ---------------- | ------------------------------- | --------- | ---------- |
| Google Reviews   | SerpAPI Maps                    | 5         | REVIEWS    |
| Google News      | RSS feed                        | 10 (5+5)  | NEWS       |
| Employee Reviews | SerpAPI → Glassdoor/Indeed      | 8         | REVIEWS    |
| LinkedIn Jobs    | SerpAPI google_jobs             | 5         | CAREERS    |
| LinkedIn Posts   | Scrapling + cookies             | 8         | LINKEDIN   |
| Customer Reviews | Scrapling (Trustpilot/Werkspot) | variabel  | REVIEWS    |
| KvK Registry     | KvK API                         | 1         | REGISTRY   |
| LinkedIn Profile | Apollo-derived (geen netwerk)   | 1         | LINKEDIN   |

### Scraping Infrastructure (hoe halen we content op?)

**Two-tier routing:**

- **Tier 1 (browser-direct):** Review platforms + JS-heavy sites → direct naar Crawl4AI
- **Tier 2 (stealth-first):** Alle andere URL's → Scrapling eerst, escaleer naar Crawl4AI als <500 chars

**Budget caps:**

- Interactive: 12 browser slots, 40 max drafts, 30 target URL's
- Deep crawl: 24 browser slots, 120 max drafts, 60 target URL's
- Na budget exhaustion: fallback draft met `budgetExhausted: true`

### Draft Creation (hoe wordt content evidence?)

Per URL wordt 1-2 `EvidenceDraft` objecten gemaakt:

- **Primary draft:** titel + snippet (max 240 chars) + workflowTag + confidence score
- **Secondary draft:** tech clues als gedetecteerd (Next.js, WordPress, HubSpot, etc.)

Review-bronnen extraheren individuele signalen (zinnen van 40-240 chars die matchen op SIGNAL_PATTERNS voor planning/handoff/billing keywords).

### Post-Scraping Pipeline

1. **Dedup:** key = `sourceUrl | workflowTag | snippet.slice(0,140)` — alleen exacte duplicaten
2. **Filter:** fallback/notFound stubs verwijderd (phase 65 fix)
3. **AI scoring:** Gemini Flash scoort `aiRelevance` + `aiDepth` per item
4. **Cap:** max 60 items (interactive) of 140 (deep crawl)
5. **Persist:** alles naar `EvidenceItem` in DB

---

## Waar het misgaat

### Probleem 1: Te brede URL discovery

De sitemap parser pakt tot 25 URL's zonder inhoudelijke filtering. Katana crawlt tot depth 8. Fallback seeds bevatten `/blog` en `/news` die bij grote sites tientallen irrelevante artikelen opleveren.

**Resultaat:** STB-kozijnen krijgt 233 items waarvan ~60% ruis. De scraper haalt alles op en hoopt dat AI scoring het later wel uitfiltert.

**Voorbeeld:** Een blog post "Onze teamuitje naar de Ardennen" wordt gescraped, krijgt sourceType=WEBSITE, en belandt in de evidence pool. De AI scorer moet dan besluiten dat dit irrelevant is — maar waarom scrapen we het überhaupt?

### Probleem 2: Boilerplate als evidence

`extractWebsiteEvidenceFromHtml()` pakt de eerste leesbare snippet van een pagina. Op veel sites is dat navigatie-tekst, footer-content, of cookie-banners. De `remove_overlay_elements` flag in Crawl4AI helpt, maar is niet waterdicht.

**Extra ruis:** Tech clue drafts ("stack clues detected: Next.js, HubSpot") krijgen confidence 0.70-0.86 en passeren quality gates. Dit zijn geen workflow pijnpunten.

### Probleem 3: Snippet te kort voor context

Snippets worden gecapped op 240 chars. Voor een review of nieuwsartikel is dat genoeg. Maar voor een servicepagina verlies je de context die de AI nodig heeft om relevantie te beoordelen.

**Downstream effect:** De masterprompt krijgt 20 items van 240 chars — dat is 4800 chars aan evidence voor een heel bedrijfsprofiel. Een mens die 5 minuten op de website rondkijkt weet meer.

### Probleem 4: Dedup te naief

Dedup key is `sourceUrl | workflowTag | snippet.slice(0,140)`. Dit vangt alleen exacte duplicaten. Dezelfde review op Trustpilot en Google Maps → twee items. Dezelfde servicebeschrijving op `/diensten` en `/services` → twee items.

**Phase 66 (SHA-256 hash) lost dit deels op, maar alleen binnen sourceType.** Cross-source duplicaten blijven.

### Probleem 5: Geen pre-scrape relevance check

De pipeline scrapet eerst alles, dan scoort AI achteraf. Er is geen moment waarop de pipeline beslist: "deze URL is waarschijnlijk niet relevant, skip".

**Wat zou kunnen:** Na URL discovery, voordat je gaat scrapen, een snelle check op basis van URL-pad + pagina-titel (zonder full content fetch). `/blog/teamuitje-ardennen` is duidelijk niet relevant.

---

## Wat de scrapers zouden moeten kunnen

### Must-haves (v10.0 dekt dit deels)

- [x] HTTP 404/5xx gate — geen evidence van dode pagina's _(phase 65, shipped)_
- [x] Fallback/notFound suppression — geen URL-only stubs _(phase 65, shipped)_
- [ ] Content dedup via hash — zelfde tekst niet 2x opslaan _(phase 66, planned)_
- [ ] AI relevance gate — irrelevante items droppen voor DB _(phase 67, planned)_
- [ ] Evidence selectie — top-20 naar masterprompt i.p.v. willekeurige slice _(phase 68, planned)_

### Should-haves (v11.0 kandidaten)

- **URL-level relevance pre-filter** — na discovery, voor scraping, URL-pad + titel scannen op relevantie. Skip `/blog/teamuitje`, `/privacy`, `/vacatures` (tenzij sourceType=CAREERS). Scheelt API calls en ruis.

- **Langere snippets voor servicepagina's** — WEBSITE items naar 600-800 chars i.p.v. 240. Reviews en news kunnen kort blijven. Meer context = betere AI scoring en betere masterprompt input.

- **Tech clue drafts elimineren** — "Next.js detected" is geen workflow pijnpunt. Stop met het aanmaken van aparte evidence items voor stack detection. Als het relevant is, zit het in de pagina-content zelf.

- **Cross-source semantic dedup** — Jaccard similarity op shingles of embedding-based dedup. Vangt parafrase-duplicaten die SHA-256 mist. Maar: complexer en mogelijk overkill bij <400 items/prospect.

- **Adaptive scrape depth** — kleine SMB sites (10 pagina's) verdienen exhaustive scraping. Enterprise sites (500+ pagina's) verdienen selectieve scraping. De huidige caps (25 sitemap, 60 deep) zijn statisch.

### Could-haves (v12.0+)

- **Structured data extraction** — Schema.org / JSON-LD van pagina's parsen. Veel bedrijfssites hebben gestructureerde data over diensten, medewerkers, locaties die rijker is dan HTML scraping.

- **Multi-page content merging** — als `/diensten/automatisering` en `/diensten/automatisering/cases` samen één verhaal vertellen, merge de snippets tot één evidence item i.p.v. twee halve.

- **Scraper health monitoring** — dashboard met success rates per sourceType, gemiddelde snippet lengte, fallback percentages. Nu is het een black box tot je de evidence items handmatig bekijkt.

- **Cookie consent automation** — sommige NL sites tonen pas content na cookie-accept. Crawl4AI's `remove_overlay_elements` verbergt de banner maar klikt niet op "accepteer". Scrapling heeft geen cookie handling.

- **Competitor evidence** — naast het scrapen van de prospect zelf, ook hun concurrenten scrapen om sector-specifieke pijnpunten te identificeren. "Jullie concurrent X adverteert met Y — jullie niet."

---

## Huidige cijfers (referentie)

| Prospect     | Evidence items | Geschatte ruis | Bronnen                       |
| ------------ | -------------- | -------------- | ----------------------------- |
| STB-kozijnen | 233            | ~60%           | 4+ types                      |
| Mujjo        | 427            | onbekend       | 4+ types                      |
| Nedri        | 90             | ~20%           | 4+ types                      |
| Marfa        | laag           | minimaal       | beperkte bronnen (kleine SMB) |

---

## Conclusie

De scrapers "werken" in de zin dat ze betrouwbaar content ophalen uit 8+ bronnen. Het probleem is niet de infra (Scrapling + Crawl4AI + SerpAPI zijn solide), maar de **selectie-intelligentie**:

1. **Te veel URL's gescraped** — geen pre-scrape relevance filter
2. **Te korte snippets** — verlies van context voor AI scoring
3. **Te naieve dedup** — alleen exacte matches, geen semantic overlap
4. **Ruis-generatoren** — tech clues, boilerplate, fallbacks

v10.0 pakt de post-scraping kant aan (dedup, relevance gate, selectie). Als dat niet genoeg is, is v11.0 de plek voor slimmere source discovery en langere content extraction.

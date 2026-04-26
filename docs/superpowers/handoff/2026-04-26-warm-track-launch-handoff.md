# Warm-track Launch — Session Handoff (2026-04-26)

## Beginprompt voor volgende sessie

> Lees `docs/superpowers/handoff/2026-04-26-warm-track-launch-handoff.md` om de warm-track launch op te pakken. Ik werk op branch `feat/warm-track-launch`. De volgende prioriteit is **Fase 0 — productie deploy** (Vercel + Railway + Cloudflare DNS) zodat we de échte send naar Ron Hoeijmakers (Maintix) kunnen doen vanuit `qualifai.klarifai.nl`. Begeleid me stap voor stap door de CLI-acties — ik wil ze zelf uitvoeren maar met jouw exacte commando's en gebruikersnaam-prompts. Lokaal werkt alles end-to-end (incl. signing → ACCEPTED → admin notificatie).

## Current state

Branch: `feat/warm-track-launch`
Most recent commit: zie `git log --oneline -1`
Pushed to GitHub: ja (origin/feat/warm-track-launch)
PR niet geopend.

## Belangrijk om te weten bij start

- Dev server draait standaard op poort 9200, Docker Postgres op 5433, Redis op 6381
- Na elke schema-wijziging: `npx prisma generate` + restart dev server (anders kent client de nieuwe velden niet en faalt mutation stilletjes)
- Maintix prospect bestaat lokaal in DB: `readableSlug=maintix`, `voorstelMode=BESPOKE`, `bespokeUrl=https://maintix-design.vercel.app`. Contact: Romano Kanters smoke test, primaryEmail `rtlkanters@gmail.com`
- Eén actieve quote: `2026-OFF005` met line items + 30/40/30 schedule
- Branch heeft veel commits — `git log --oneline -50` toont volledige historie

## What's done

**Fase 1 — Responsive offerte brochure** ✓
**Fase 1.5 — Warm-track architecture + Maintix bespoke** ✓
**Fase 2 — Quote → email bridge (backend)** ✓ (TDD-cycle, 4/4 tests green)
**Tactical UX/print refinements** — many iterations, see git log

The first real warm send to Maintix (rtlkanters@gmail.com) succeeded:

- Email landed in Gmail Promotions tab
- /voorstel/maintix proxies the Vercel showcase + view-tracking pixel fires
- Brochure download works
- Cal.com kick-off link works
- Signing flow now transitions Quote → ACCEPTED + admin notification email (commit fe0bedc)

## Remaining work

### Fase 0 — Production deployment (BLOCKING for real client send)

Tasks 1-7 in `docs/superpowers/plans/2026-04-25-qualifai-warm-track-launch.md`:

- Set up Vercel project for qualifai.klarifai.nl
- Set up Railway Postgres + Redis
- DNS: CNAME qualifai.klarifai.nl → cname.vercel-dns.com on Cloudflare (proxy off — DNS only)
- Production env vars in Vercel (DATABASE_URL, REDIS_URL, RESEND_API_KEY, etc.)
- Run Prisma migrations against prod DB
- Smoke test base routes + webhook endpoint

User wants to do these manually with assistance — the orchestrator should walk through CLI steps when next session resumes.

### Task 32 — Production first send to Maintix

After Fase 0 deploys: re-create Maintix prospect + Contact in prod, send the real offerte email to Ron Hoeijmakers (info@maintix.nl).

### Pending features (deferred)

- **Task 47** — Gmail OAuth integration so user can send from personal Gmail with their actual signature. ~1-2 day work. Defer until after first real send proves the flow.
- Email reputation polish: dedicated transactional subdomain (e.g. quotes.klarifai.nl) + DMARC verify on klarifai.nl.

## Key decisions made (don't re-litigate)

1. **Dual-track architecture** — warm prospects get bespoke voorstel HTML proxied from their own Vercel deploy; cold prospects (deferred) will get standard 7-page brochure. `/offerte/[slug]` is the shared formal commercial layer (3 pages: Investering / Akkoord / Bevestigd).

2. **bespokeUrl proxy + `<base>` injection** — Qualifai server-side fetches the showcase HTML, injects a `<base href={bespokeUrl}/>` tag for asset resolution + a tracking pixel script. URL stays `qualifai.klarifai.nl/voorstel/[slug]` for brand cohesion.

3. **Snapshot freeze on DRAFT→SENT** — bespoke HTML captured into `Quote.bespokeHtmlSnapshot` at SENT. Post-akkoord drift in source URL doesn't affect the document trail.

4. **Geadresseerde as 4 separate fields** — recipientCompany / recipientContact / recipientStreet / recipientCity on Quote. Edited via popup from quote detail.

5. **Default uurtarief = €80**. **Default payment schedule = 30/40/30**. **Garantie 60 dagen**. **Klarifai bedrijfsgegevens** stored in print page footer (memory at `reference_klarifai_company_data.md`).

6. **Email send flow**: hand-typed body for warm-track (no AI generation). EmailCompose modal as Popup overlay (size="lg" = 720px wide). Contact selector dropdown (no free-form email).

## Architecture cheat sheet

- Quote model: `lib/state-machines/quote.ts` (transitionQuote, snapshot freeze, bespoke HTML capture)
- Send-email: `lib/outreach/send-email.ts` (Resend client, OutreachLog write)
- Admin quote detail: `app/admin/quotes/[slug]/page.tsx`
- Brochure: `components/features/offerte/brochure-cover.tsx` (Investering / Signing / Bevestigd render via mode prop + visiblePages dispatch)
- Print page: `app/offerte/[slug]/print/page.tsx` (formal A4 doc)
- Bespoke proxy: `app/voorstel/[slug]/route.ts` (Route Handler, fetch + inject)
- Accept endpoint: `app/api/offerte/accept/route.ts` (signature capture + ACCEPTED transition + admin notif)

## Open known-issues / nice-to-haves

- Email lands in Gmail Promotions tab — Ron should mark "not spam" once. Long-term: dedicated subdomain.
- Unsubscribe link (footer in outreach mail) is broken — endpoint exists at `/api/outreach/unsubscribe` but token verification might be failing. Investigate when actual outreach campaigns start.
- Page 2 of print PDF still feels light per user — could add "Volgende stappen" + sign-off. Deferred — not blocking the send.
- Cold-track responsive (Fase 3 in original plan) — deferred until first cold prospect goes live.

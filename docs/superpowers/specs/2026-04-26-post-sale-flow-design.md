# Post-Sale Flow — Design Spec

**Status:** Design approved, ready for plan
**Date:** 2026-04-26
**Author session:** Brainstorm following multi-tenant auth ship

---

## Doel

Op dit moment stopt Qualifai bij `Quote.status = ACCEPTED`. Klant tekent → bevestigingspagina → systeem-stilte. Geen project-record, geen factuur-flow, Cal.com kickoff-link is alleen direct na acceptatie zichtbaar (verdwijnt als klant niet meteen boekt).

Doel van deze fase: alles tussen "klant tekent" en "klant heeft betaald" in de app surfacen, zonder over te automatiseren waar menselijk oordeel beter is.

**Filosofie:** "autopilot with oversight" — het systeem creëert structuur (Project record, milestone-checklist, factuur-drafts via knop), Romano triggert verzending. Geen factuur-PDF gaat de deur uit zonder Romano's klik. Geen overdue-reminder gaat naar de klant zonder Romano's klik.

## Scope (deze fase)

**In scope:**

1. `Project`-record auto-aanmaken op ACCEPTED, met milestones uit offerte's betaalschema.
2. Persistent Cal.com kickoff-link + reminder cron (max 2x, week tussenruimte).
3. Factuur klaarzetten via knop, factuur-detail bewerkbaar (DRAFT), versturen via knop (PDF + email + status update).
4. Markeer-betaald + automatische OVERDUE-flag (UI-only, geen klantmail).
5. Project tab op prospect-detail page (kickoff + milestones + invoice queue).

**Buiten scope (zie §10):** Finom auto-detect, automatische overdue-mails, creditfactuur, klant-portaal, multi-currency, BTW-shifting, boekhoud-export.

## Constraints

- **Multi-tenant.** Project + Invoice + Milestone moeten `projectId_fk` (Project model uit Project-row) hebben en filteren via `projectAdminProcedure`.
- **NL B2B-conventie.** Bank transfer, geen Stripe. Trust-signals tegen phishing-feel zijn essentieel — Resend `info@klarifai.nl` (verified), Klarifai branding, expliciete offerte-referentie, Romano signature.
- **Niets onomkeerbaar firen op ACCEPTED.** Project-record + (gedaan) eerste milestone + Cal.com email — dat is alles. Geen factuur, geen bedrag, geen geld-vraag voordat Romano er één klikt klaarzet.
- **Hergebruik bestaande infra.** PDF-generatie via offerte-print pattern. Email via Resend + Romano-signature. State updates via dezelfde patronen als Quote.

---

## §1 Architecture overview

Op `Quote.status = ACCEPTED` wordt automatisch een `Project` record aangemaakt (1:1 met Quote) plus een `ProjectMilestone` per termijn in `Quote.paymentSchedule`. Eerste milestone (`Bij ondertekening`) krijgt direct `completedAt = NOW()`. Geen UI-noise, geen factuur, geen email naar klant.

Op de prospect-detail page verschijnt vanaf dat moment een **Project tab** met:

- Klant-info denormalized uit Quote (naam, totaalbedrag, betaalschema)
- Cal.com kickoff status + handmatige reminder-knop
- Milestone-checklist (manueel afvinkbaar — vinken doet niets met invoices)
- Invoice queue (initieel leeg, vult zich naarmate jij invoices klaarzet)

**Cal.com fix.** De huidige acceptatie-bevestigingspagina toont een Cal.com embed maar die is timing-gevoelig — als klant niet direct boekt is de link weg. We:

- Genereren een persistent kickoff-URL die in de acceptance-email wordt opgenomen.
- Cron `cal-kickoff-reminder` runt dagelijks: ACCEPTED projects met `kickoffBookedAt = null` en `acceptedAt > 5 days ago` en `kickoffReminderCount < 2` krijgen een herinneringsmail (week tussenruimte tussen reminders).
- Cal.com webhook update `Project.kickoffBookedAt` zodra klant boekt.

**Invoice flow.** Per ongebrekende termijn in `Quote.paymentSchedule` toont de Project tab een knop "Maak factuur klaar — termijn N (X% / €Y)". Klik:

1. Systeem leest termijn (`label`, `percentage`) + `Quote.totalAmountCents`, berekent `amountCents`, genereert `Invoice` record met `status = DRAFT` en next-in-line `invoiceNumber` (F-2026-NNN).
2. Romano reviewt op invoice-detail-page (regels, bedrag, omschrijving, factuurnummer — alles bewerkbaar in DRAFT).
3. Klik "Versturen" → PDF gegenereerd (Klarifai branding, "Conform offerte X, termijn N"), email via Resend met PDF-bijlage en Romano-signature, status `SENT`, `sentAt = NOW()`, `dueAt = sentAt + 30d`.
4. "Markeer betaald" → status `PAID`, `paidAt = NOW()`. Geen Finom-koppeling — Romano kijkt op Finom, klikt in admin.
5. Cron `invoice-overdue-check` flagt `SENT` invoices met `dueAt <= NOW()` als `OVERDUE`. UI-only, geen klantmail.

**State scheidingen.**

- Quote = wat we beloofden te leveren (immutable na ACCEPTED).
- Project = wat we daadwerkelijk leveren (active state).
- Invoice = momentane snapshot van een termijn op het moment van klaarzetten — niet gekoppeld aan latere Quote-bewerkingen.

## §2 Schema additions

```prisma
model Project {
  id            String   @id @default(cuid())
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  quoteId       String   @unique
  quote         Quote    @relation(fields: [quoteId], references: [id])
  prospectId    String   // denormalized for fast queries
  prospect      Prospect @relation(fields: [prospectId], references: [id])
  projectId_fk  String   // FK naar Project model uit Project-row (multi-tenant)
  acceptedAt    DateTime
  kickoffBookedAt        DateTime?
  kickoffReminderCount   Int       @default(0)
  kickoffReminderLastAt  DateTime?
  status        ProjectStatus @default(ACTIVE)
  invoices      Invoice[]
  milestones    ProjectMilestone[]
  @@index([prospectId])
  @@index([projectId_fk])
}

model Invoice {
  id            String   @id @default(cuid())
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  projectId     String
  project       Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  invoiceNumber String   @unique  // F-2026-NNN, opvolgend per kalenderjaar
  termijnIndex  Int      // 0, 1, 2 — overeenkomend met paymentSchedule volgorde
  termijnLabel  String   // bv. "50% bij ondertekening"
  amountCents   Int
  vatPercentage Int      @default(21)
  status        InvoiceStatus @default(DRAFT)
  sentAt        DateTime?
  dueAt         DateTime?  // sentAt + 30d
  paidAt        DateTime?
  pdfUrl        String?    // S3-link na generatie
  notes         String?    @db.Text
  @@unique([projectId, termijnIndex])  // race-guard tegen dubbele invoice voor zelfde termijn
  @@index([projectId])
  @@index([status])
}

model ProjectMilestone {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  ordering    Int
  label       String   // "MVP opgeleverd"
  completedAt DateTime?
  @@index([projectId])
  @@index([projectId, ordering])
}

enum ProjectStatus { ACTIVE DELIVERED ARCHIVED }
enum InvoiceStatus { DRAFT SENT PAID OVERDUE CANCELLED }
```

**Belangrijke keuzes:**

- `Invoice.invoiceNumber @unique` — opvolgend (`F-2026-001`, `F-2026-002`) gegenereerd per kalenderjaar via een lichtgewicht counter-tabel of `MAX(...) + 1` in transactie.
- `amountCents Int` om floating-point te vermijden.
- `Invoice` heeft géén directe FK naar Quote — alleen via Project. Quote blijft de bron van betaalschema; Invoice is een derived snapshot bij klaarzet-moment, zodat latere Quote-bewerkingen oude invoices niet stiekem aanpassen.
- `ProjectMilestone` apart van Invoice — milestones bereiken zonder direct factuur te willen klaarzetten en omgekeerd zijn beide legitiem.

## §3 Auto-trigger op ACCEPTED + Cal.com fix

**Project + milestones aanmaken** in `lib/quote-state-machine.ts` (waar Quote → ACCEPTED transition wordt afgehandeld). Binnen dezelfde transactie:

```ts
async function onQuoteAccepted(quote: Quote, tx: PrismaTransaction) {
  const project = await tx.project.create({
    data: {
      quoteId: quote.id,
      prospectId: quote.prospectId,
      projectId_fk: quote.projectId,
      acceptedAt: new Date(),
      milestones: {
        create: (quote.paymentSchedule as PaymentTerm[]).map((term, idx) => ({
          ordering: idx,
          label: term.label,
        })),
      },
    },
    include: { milestones: { orderBy: { ordering: 'asc' }, take: 1 } },
  });

  // Eerste milestone meteen completed (= ondertekening = ACCEPTED moment)
  await tx.projectMilestone.update({
    where: { id: project.milestones[0].id },
    data: { completedAt: new Date() },
  });
}
```

**Cal.com persistent link.** Acceptance-email aan klant bevat expliciet de kickoff-link. URL-pattern: hergebruiken van bestaande Cal.com embed-page op `/offerte/[slug]/...` (conditional rendering om de booking-CTA persistent te maken na ACCEPTED ipv enkel direct erna). Cal.com webhook update `Project.kickoffBookedAt = NOW()`.

**Reminder cron `cal-kickoff-reminder`** — Vercel cron, dagelijks:

```ts
const overdue = await prisma.project.findMany({
  where: {
    kickoffBookedAt: null,
    acceptedAt: { lte: subDays(new Date(), 5) },
    kickoffReminderCount: { lt: 2 },
    OR: [
      { kickoffReminderLastAt: null },
      { kickoffReminderLastAt: { lte: subDays(new Date(), 7) } },
    ],
  },
  include: { prospect: true, quote: true },
});

for (const project of overdue) {
  await sendKickoffReminderEmail(project);
  await prisma.project.update({
    where: { id: project.id },
    data: {
      kickoffReminderCount: { increment: 1 },
      kickoffReminderLastAt: new Date(),
    },
  });
}
```

Maximaal 2 reminders, 7 dagen tussenruimte. Daarna stopt het systeem — als ze nog niet boeken, is dat een persoonlijk gesprek voor Romano, niet voor de robot.

## §4 Invoice klaarzetten + verzenden

**`invoice.prepare` mutation.** Per niet-bestaande termijn (Quote.paymentSchedule entry zonder bijbehorende Invoice) verschijnt een knop "Factuur klaarzetten — termijn N (X% / €Y)" op Project tab. Klik:

```ts
async function prepareInvoice(projectId: string, termijnIndex: number) {
  const project = await ctx.db.project.findUnique({
    where: { id: projectId },
    include: { quote: true, invoices: true },
  });

  if (project.invoices.find((i) => i.termijnIndex === termijnIndex)) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'Factuur voor deze termijn bestaat al',
    });
  }

  const term = (project.quote.paymentSchedule as PaymentTerm[])[termijnIndex];
  const totalAmountCents = project.quote.totalAmountCents;
  const amountCents = Math.round((totalAmountCents * term.percentage) / 100);
  const invoiceNumber = await nextInvoiceNumber(ctx.db);

  return ctx.db.invoice.create({
    data: {
      projectId,
      invoiceNumber,
      termijnIndex,
      termijnLabel: term.label,
      amountCents,
      vatPercentage: 21,
      status: 'DRAFT',
    },
  });
}
```

**Invoice detail-page** (`/admin/invoices/[id]`). Re-uses inline-edit-pattern uit `/admin/quotes/[id]`. In DRAFT-status alle velden bewerkbaar (factuurnummer, regels, bedrag, omschrijving, notities). In SENT/PAID/OVERDUE: read-only.

**`invoice.send` mutation.** Alleen vanuit DRAFT:

```ts
async function sendInvoice(invoiceId: string) {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { project: { include: { prospect: true, quote: true } } },
  });

  if (invoice.status !== 'DRAFT') throw CONFLICT;

  const pdfBuffer = await renderInvoicePdf(invoice);
  const pdfUrl = await uploadToStorage(
    pdfBuffer,
    `invoices/${invoice.invoiceNumber}.pdf`,
  );

  await sendInvoiceEmail({
    to: invoice.project.prospect.contactEmail,
    invoice,
    pdfBuffer,
  });

  return db.invoice.update({
    where: { id: invoiceId, status: 'DRAFT' }, // optimistic concurrency
    data: {
      status: 'SENT',
      sentAt: new Date(),
      dueAt: addDays(new Date(), 30),
      pdfUrl,
    },
  });
}
```

**PDF-template** (`components/clients/klarifai/invoice-renderer.tsx`):

- Klarifai logo + bedrijfsgegevens (KVK, BTW, adres, website) in header
- Klant-NAW (uit Prospect/Quote denormalized), factuurnummer, factuurdatum, vervaldatum
- Verwijzing: "Conform offerte [nummer], termijn N: [label]"
- Regelitem tabel: omschrijving, aantal/uren, tarief, bedrag — minimum één regel met termijn-bedrag
- Subtotaal, 21% BTW, totaal in groot navy bedrag
- Onderaan in subtle box: "Gelieve binnen 30 dagen over te maken naar IBAN: NLxx FNOM xxxx xxxx xx t.n.v. Klarifai o.v.v. factuurnummer [F-2026-NNN]"
- Footer: "Vragen? info@klarifai.nl | Klarifai | KVK xxxxx | BTW NLxxxx"

**Email template** (`components/clients/klarifai/invoice-email.tsx`) — anti-phishing trust-signals zijn kritiek:

- From: `Romano Kanters <info@klarifai.nl>` (Resend verified domain, DKIM/SPF green)
- Subject: `Factuur [F-2026-001] — [Termijnlabel] — [Klantnaam]`
- HTML body opent met expliciete referentie aan eerdere context: "Naar aanleiding van onze offerte voor [project naam], zoals besproken in onze kickoff op [datum] — bij deze de eerste termijnfactuur."
- Klarifai-branded header (zelfde stijl als acceptance-email)
- KVK + IBAN herhaald in body (consistency met PDF + redundancy als phishing-counter-signal)
- PDF als attachment **én** als secondary download-link (sommige klanten openen geen attachments)
- Romano's volledige email-handtekening (geshipped 2026-04-26 in `def543c`)

## §5 Markeer-betaald + overdue-detectie

**`invoice.markPaid` mutation:**

```ts
async function markPaid(invoiceId: string) {
  return db.invoice.update({
    where: { id: invoiceId, status: { in: ['SENT', 'OVERDUE'] } },
    data: { status: 'PAID', paidAt: new Date() },
  });
}
```

Knop "Markeer betaald" zichtbaar op SENT en OVERDUE invoices. Geen Finom-koppeling — Romano ziet betaling op Finom, klikt in admin.

**Overdue cron `invoice-overdue-check`** — Vercel cron, dagelijks:

```ts
await prisma.invoice.updateMany({
  where: {
    status: 'SENT',
    dueAt: { lte: new Date() },
  },
  data: { status: 'OVERDUE' },
});
```

`OVERDUE` is **uitsluitend een UI-flag** — geen klantmail wordt verzonden. Romano ziet rode invoices in admin, beslist zelf of hij belt of mailt. Reden: betalingsherinneringen zijn een gevoelig moment dat menselijk oordeel verdient.

**Cancellation pad.** "Annuleer factuur" knop alleen op DRAFT en SENT (niet PAID):

- DRAFT → CANCELLED: status update, geen vervolg.
- SENT → CANCELLED: status update + UI-prompt "Wil je een credit-factuur sturen?" — buiten scope voor v1, alleen status-update; Romano regelt zelf.

## §6 UI surfaces

**Project tab op prospect-detail.** Verschijnt zodra Project bestaat (= Quote ACCEPTED). Layout van boven naar beneden:

1. **Header:** klantnaam, project-naam, totaalbedrag, ACCEPTED-datum, status-chip (ACTIVE / DELIVERED / ARCHIVED).
2. **Kickoff blok:** Cal.com booking status (booked op X / niet-booked, Y reminders verzonden), knop "Stuur kickoff link opnieuw" (handmatige reminder buiten cron om).
3. **Milestone checklist:** lijst uit `ProjectMilestone` records, per item:
   - Label + checkbox "Bereikt op [datum]"
   - Klik = `completedAt = NOW()` (of unset)
   - **Geen zijde-effecten** — vinken doet niets met invoices, dat is een aparte actie.
4. **Invoice queue:** tabel van bestaande invoices + knoppen voor klaarzetbare termijnen.
   - Per invoice: nummer, termijnlabel, bedrag, status-chip, datum, acties (Bekijk, Versturen / Markeer betaald / Annuleer afhankelijk van status).
   - Onderaan: knoppen voor termijnen die nog geen Invoice hebben ("Maak factuur klaar — termijn 2: 25% bij oplevering MVP").

**Invoice detail-page** (`/admin/invoices/[id]`). Linear-style sidebar + main content (consistent met admin DESIGN.md). DRAFT = bewerkbare velden + "Versturen" actie. SENT/PAID/OVERDUE = read-only + status-specifieke acties.

**Email templates** in `components/clients/klarifai/`:

- `invoice-email.tsx`
- `kickoff-reminder-email.tsx`

Past in directory-conventie geintroduceerd in `2026-04-26-multi-tenant-auth-design.md`.

**Geen top-level "Klanten" route.** Romano's workflow blijft prospect-centric. Een prospect met ACCEPTED quote is de facto een klant — vindbaar via de bestaande prospect-lijst (eventueel met filter "alleen actieve klanten"). Dedicated klanten-route is YAGNI tot je 5+ actieve klanten hebt.

## §7 Multi-tenant + bestaande state-machine integratie

- Alle nieuwe tRPC procedures via `projectAdminProcedure` (filtert op `ctx.allowedProjectSlug` → `projectId_fk`).
- Project + Invoice + ProjectMilestone queries hebben altijd `where: { projectId_fk: ctx.projectId }`.
- State-machine integratie: bestaande `lib/quote-state-machine.ts` ACCEPTED-handler krijgt de Project-creation toegevoegd. Geen nieuwe state machine — Quote blijft de bron van Quote-state, Project heeft een eigen lichte status (ACTIVE/DELIVERED/ARCHIVED) zonder transitie-logic.
- `OutreachLog` en bestaande email-infra blijft hergebruikt — invoice-email volgt hetzelfde Resend-pad als Quote/outreach mails, met aparte template.

## §8 Validation

**Pre-merge:**

- `npx tsc --noEmit` clean
- Vitest groene tests:
  - Project-creation op ACCEPTED state-transition
  - `invoice.prepare` idempotency (CONFLICT bij dubbele termijn)
  - `invoice.send` atomic update (DRAFT → SENT)
  - Cron-logica `cal-kickoff-reminder` (5d/7d/2x guard)
  - Cron-logica `invoice-overdue-check` (dueAt-filter)
- E2E smoke test: Maintix-style accept → Project ontstaat → milestone seeded → factuur klaarzetten → versturen → email check → markeer betaald

**Synthetische verificatie van goal:**

1. Set up testklant Z (Project + Quote met 50/25/25 betaalschema).
2. Mock Quote → ACCEPTED.
3. Verifieer: Project ontstaat, 3 milestones aangemaakt, milestone[0] heeft completedAt.
4. Click "Maak factuur 1 klaar" → Invoice met amountCents = 50% van totaal, status DRAFT.
5. Click "Versturen" → status SENT, dueAt = sentAt+30d, pdfUrl populated, email gestuurd.
6. Mock cron run met dueAt in verleden → status OVERDUE.
7. Click "Markeer betaald" → status PAID, paidAt populated.

## §9 Failure modes & mitigation

| Scenario                                                      | Mitigatie                                                                                                                                                                         |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cal.com webhook mist boeking                                  | Persistent kickoff-link blijft werken; Romano kan handmatig `kickoffBookedAt` zetten via admin (knop "Markeer als geboekt").                                                      |
| Reminder cron faalt halverwege                                | Idempotent — `kickoffReminderLastAt` check zorgt dat dubbele-runs niet dubbele mails sturen.                                                                                      |
| PDF generation faalt                                          | `invoice.send` rolled back in transactie; status blijft DRAFT, geen email verzonden. Toon fout aan Romano.                                                                        |
| Email verzending faalt                                        | Status SET → DRAFT terug? Nee — Resend bevestigt voor we status updaten; als Resend faalt blijft DRAFT en zien we de fout. Geen `SENT` zonder bevestigde verzending.              |
| `invoice.prepare` race condition (twee tabs tegelijk klikken) | Compound unique `@@unique([projectId, termijnIndex])` op Invoice (zie §2) maakt tweede insert atomair onmogelijk. tRPC vangt `P2002` Prisma error en gooit `CONFLICT`.            |
| Klant boekt Cal.com slot meerdere keren (reschedule)          | Webhook update `kickoffBookedAt` naar laatste boeking. Reminder-cron stopt zodra `kickoffBookedAt != null`.                                                                       |
| Quote-bewerking na ACCEPTED                                   | Quote zou immutable moeten zijn na ACCEPTED — bestaande state-machine logic. Verifieer in plan-fase. Invoice gebruikt snapshot-bedrag, dus al-verstuurde invoices niet beïnvloed. |

## §10 Out of scope (gedocumenteerd voor later)

- **Finom auto-detect van betalingen** — bank-API's zijn fragiel; handmatig "Markeer betaald" voorlopig.
- **Automatische overdue-mails aan klant** — gevoelig moment, mensen-werk.
- **Creditfactuur-flow** — bij SENT-cancellation regelt Romano zelf. Pas oppakken bij echt-keer-incident.
- **Klant-facing project status portaal** — discover-stijl page voor lopende klanten ("Klarifai bouwt X, Y opgeleverd"). Waarde-add maar geen acute pijn.
- **Top-level Klanten-route** — pipeline blijft prospect-centric.
- **`ProjectEvent` activiteitslog** — chronologisch overzicht is leuk, niet noodzakelijk.
- **Invoice-bewerking nadat verzonden** — DRAFT bewerkbaar, SENT locked. Bij fout: cancel + nieuwe maken.
- **Boekhoud-export** (CSV / Snelstart / Moneybird-import) — pas relevant wanneer accountant erover begint.
- **Multi-currency** — Klarifai is NL-zakelijk, EUR only.
- **BTW-shifted (intracommunautair / B2C / 0%)** — alle invoices vast 21%; aparte afhandeling bij internationale klanten.
- **Multi-project per klant** (recurring relaties) — pas relevant bij re-engagements.

## §11 Definition of done

- ☐ `Project`, `Invoice`, `ProjectMilestone` modellen + migration via project drift-workflow
- ☐ `ProjectStatus` + `InvoiceStatus` enums
- ☐ `lib/quote-state-machine.ts` ACCEPTED-handler creëert Project + milestones (eerste = completed)
- ☐ Acceptance email bevat persistent kickoff-link
- ☐ Cal.com webhook update `Project.kickoffBookedAt`
- ☐ `cal-kickoff-reminder` cron (max 2x, 7d tussenruimte) + email template
- ☐ `kickoff-reminder-email.tsx` template in `components/clients/klarifai/`
- ☐ tRPC procedures: `project.getByProspect`, `project.completeMilestone`, `project.markKickoffBooked`, `invoice.prepare`, `invoice.update`, `invoice.send`, `invoice.markPaid`, `invoice.cancel`
- ☐ `invoice-overdue-check` cron (UI-only, geen mail)
- ☐ Invoice PDF renderer (`components/clients/klarifai/invoice-renderer.tsx`)
- ☐ Invoice email template (`components/clients/klarifai/invoice-email.tsx`)
- ☐ Invoice number generator (per kalenderjaar opvolgend)
- ☐ Project tab op prospect-detail page
- ☐ Invoice detail-page (`/admin/invoices/[id]`)
- ☐ Multi-tenant scoping op alle queries (`projectId_fk` filter via `projectAdminProcedure`)
- ☐ Vitest unit tests voor cron-logic + state-transitions + invoice send/markPaid
- ☐ E2E synthetische verificatie (zie §8)
- ☐ `npx tsc --noEmit` clean

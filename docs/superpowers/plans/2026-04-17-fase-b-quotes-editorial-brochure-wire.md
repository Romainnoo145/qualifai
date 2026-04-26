# Fase B — Quotes Editorial + Brochure Wire Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign admin quotes UI to Editorial aesthetic and wire the client brochure's Page 4 Investering to real Quote data.

**Architecture:** Schema adds `isActiveProposal` Boolean to `Quote`. Admin quotes list + detail pages are rewritten to Editorial (paper/ink/gold tokens, Sora + Plex Mono). Brochure server component queries the active quote and passes line items to the Investering page. Existing tRPC CRUD + state machine unchanged — only new mutation is `setActiveProposal`.

**Tech Stack:** Next.js 15 App Router, tRPC v11, Prisma (PostgreSQL), Tailwind CSS v4

---

## File Map

**Schema:**

- Modify: `prisma/schema.prisma` — add `isActiveProposal` + compound index
- Create: `prisma/migrations/YYYYMMDD_add_is_active_proposal/migration.sql` (via docker exec)

**Backend:**

- Modify: `server/routers/quotes.ts` — add `setActiveProposal` mutation, include `isActiveProposal` in list/get responses

**Admin UI (rewrite):**

- Modify: `app/admin/quotes/page.tsx` — Editorial list layout
- Modify: `app/admin/quotes/[id]/page.tsx` — Editorial detail with sidebar + active voorstel toggle

**Brochure wire-up:**

- Modify: `app/offerte/[slug]/page.tsx` — query active quote, pass to BrochureCover
- Modify: `components/features/offerte/brochure-cover.tsx` — accept `quote` prop, replace hardcoded stub

**Existing components reused as-is:**

- `components/features/quotes/quote-form.tsx` — the form itself works, just needs wrapper restyling
- `components/features/quotes/quote-status-badge.tsx` — restyle if needed but keep API
- `components/features/quotes/quote-send-confirm.tsx` — works
- `components/features/quotes/quote-version-confirm.tsx` — works
- `lib/quotes/quote-totals.ts` — `computeQuoteTotals` + `formatEuro` reused in brochure

---

### Task 1: Schema — add `isActiveProposal` to Quote

**Files:**

- Modify: `prisma/schema.prisma:758-805`

- [ ] **Step 1: Add field to Quote model**

In `prisma/schema.prisma`, inside `model Quote { ... }`, before the `// Versioning` comment block (line ~791), add:

```prisma
  // Active voorstel flag — only one per prospect (Fase B)
  isActiveProposal Boolean @default(false)
```

Add compound index at the bottom of the model (before the closing `}`), after existing `@@index([prospectId])`:

```prisma
  @@index([prospectId, isActiveProposal])
```

- [ ] **Step 2: Apply migration via docker exec**

```bash
docker exec qualifai-db psql -U user -d qualifai -c "ALTER TABLE \"Quote\" ADD COLUMN \"isActiveProposal\" BOOLEAN NOT NULL DEFAULT false;"
docker exec qualifai-db psql -U user -d qualifai -c "CREATE INDEX \"Quote_prospectId_isActiveProposal_idx\" ON \"Quote\" (\"prospectId\", \"isActiveProposal\");"
```

- [ ] **Step 3: Create migration file**

```bash
mkdir -p prisma/migrations/20260417000000_add_is_active_proposal
```

Write `prisma/migrations/20260417000000_add_is_active_proposal/migration.sql`:

```sql
-- Fase B: active proposal flag per prospect
ALTER TABLE "Quote" ADD COLUMN "isActiveProposal" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Quote_prospectId_isActiveProposal_idx" ON "Quote" ("prospectId", "isActiveProposal");
```

- [ ] **Step 4: Regenerate Prisma client + backfill**

```bash
npx prisma generate
```

Backfill: set the first DRAFT quote per prospect as active:

```bash
docker exec qualifai-db psql -U user -d qualifai -c "
UPDATE \"Quote\" q
SET \"isActiveProposal\" = true
FROM (
  SELECT DISTINCT ON (\"prospectId\") id
  FROM \"Quote\"
  WHERE status = 'DRAFT'
  ORDER BY \"prospectId\", \"createdAt\" ASC
) sub
WHERE q.id = sub.id;
"
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit 2>&1 | grep -E "^(app|components|server)/" | head -20
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260417000000_add_is_active_proposal/
git commit -m "feat(schema): add isActiveProposal Boolean to Quote model

Fase B prerequisite: compound index on (prospectId, isActiveProposal)
for fast active-quote lookup. Backfill sets first DRAFT per prospect."
```

---

### Task 2: tRPC — add `setActiveProposal` mutation

**Files:**

- Modify: `server/routers/quotes.ts`

- [ ] **Step 1: Add `setActiveProposal` mutation**

In `server/routers/quotes.ts`, after the `createVersion` procedure (before the closing `});` of `quotesRouter`), add:

```typescript
  /**
   * Fase B — toggle "active voorstel" for a prospect.
   *
   * Atomically clears isActiveProposal on all quotes for the same prospect,
   * then sets it on the target quote. Passing `active: false` just clears.
   */
  setActiveProposal: projectAdminProcedure
    .input(
      z.object({
        id: z.string(),
        active: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const quote = await ctx.db.quote.findFirst({
        where: { id: input.id, prospect: { projectId: ctx.projectId } },
        select: { id: true, prospectId: true },
      });
      if (!quote) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Quote not found in active project scope',
        });
      }

      return ctx.db.$transaction(async (tx) => {
        // Clear all for this prospect first
        await tx.quote.updateMany({
          where: { prospectId: quote.prospectId },
          data: { isActiveProposal: false },
        });
        // Set the target if active=true
        if (input.active) {
          await tx.quote.update({
            where: { id: input.id },
            data: { isActiveProposal: true },
          });
        }
        return tx.quote.findUniqueOrThrow({
          where: { id: input.id },
          include: {
            lines: { orderBy: { position: 'asc' } },
            prospect: {
              select: {
                id: true,
                slug: true,
                readableSlug: true,
                companyName: true,
                status: true,
              },
            },
          },
        });
      });
    }),
```

- [ ] **Step 2: Add `isActiveProposal` to QuoteDetailRow type in list + get**

No change needed — Prisma auto-includes scalar fields. The `isActiveProposal` field is already included in `findMany` / `findUniqueOrThrow` responses. Just confirm the `Row` type in the admin list page gets updated (Task 3).

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit 2>&1 | grep -E "^(app|components|server)/" | head -20
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add server/routers/quotes.ts
git commit -m "feat(quotes): add setActiveProposal mutation

Atomically clears isActiveProposal on sibling quotes then sets the
target. Transaction ensures exactly 0 or 1 active quote per prospect."
```

---

### Task 3: Admin quotes list — Editorial restyle

**Files:**

- Modify: `app/admin/quotes/page.tsx` (full rewrite, ~150 lines)

- [ ] **Step 1: Rewrite quotes list page**

Replace the entire contents of `app/admin/quotes/page.tsx` with the Editorial-styled version. Key changes:

- Remove `glass-card`, `font-black`, `text-[#040026]`, `slate-*` classes
- Add paper-ink-gold Editorial tokens: `var(--color-ink)`, `var(--color-gold)`, `var(--color-muted-dark)`, `var(--color-border)`, `var(--color-surface-2)`
- Eyebrow header with Plex Mono
- Editorial table layout: ink header row, Plex Mono right-aligned numbers with `tabular-nums`
- Paper row striping (`var(--color-surface-2)` on even rows)
- Add `isActiveProposal` to `Row` type and show a gold dot indicator on active quotes
- Gold pill CTA: `+ Nieuwe offerte` top right (links to prospect selection — placeholder `href="/admin/prospects"` with title tooltip)

```tsx
'use client';

import Link from 'next/link';
import { api } from '@/components/providers';
import { PageLoader } from '@/components/ui/page-loader';
import { QuoteStatusBadge } from '@/components/features/quotes/quote-status-badge';
import { computeQuoteTotals, formatEuro } from '@/lib/quotes/quote-totals';
import type { QuoteStatus } from '@prisma/client';

// TODO: tRPC v11 inference gap — explicit Row type mirrors the list include
type Row = {
  id: string;
  nummer: string;
  onderwerp: string;
  status: QuoteStatus;
  btwPercentage: number;
  isActiveProposal: boolean;
  createdAt: string | Date;
  lines: { uren: number; tarief: number }[];
  prospect: {
    id: string;
    slug: string;
    readableSlug: string | null;
    companyName: string | null;
  };
};

const DRAFT_STATUSES: QuoteStatus[] = ['DRAFT'];
const SENT_STATUSES: QuoteStatus[] = [
  'SENT',
  'VIEWED',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
];
const ARCHIVED_STATUSES: QuoteStatus[] = ['ARCHIVED'];

export default function QuotesListPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list = (api.quotes.list as any).useQuery(undefined);

  if (list.isLoading) {
    return <PageLoader label="Offertes laden" description="Eén moment." />;
  }

  if (list.error) {
    return (
      <div className="border border-[var(--color-border)] rounded-md p-10">
        <p
          className="text-[11px] uppercase tracking-[0.18em] text-red-600"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Fout bij laden: {String(list.error.message)}
        </p>
      </div>
    );
  }

  const rows: Row[] = (list.data ?? []) as Row[];
  const draft = rows.filter((r) => DRAFT_STATUSES.includes(r.status));
  const sent = rows.filter((r) => SENT_STATUSES.includes(r.status));
  const archived = rows.filter((r) => ARCHIVED_STATUSES.includes(r.status));

  return (
    <div className="space-y-10">
      <header className="flex items-end justify-between">
        <div>
          <span
            className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-gold)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Offertes
          </span>
          <h1 className="mt-2 font-['Sora'] text-[40px] font-bold leading-[1] tracking-[-0.03em] text-[var(--color-ink)]">
            Offertes<span className="text-[var(--color-gold)]">.</span>
          </h1>
          <p className="mt-2 text-[13px] text-[var(--color-muted-dark)]">
            Maak een nieuwe offerte vanuit een prospect-detailpagina.
          </p>
        </div>
        <Link
          href="/admin/prospects"
          className="admin-btn-primary text-[13px]"
          title="Kies een prospect om een offerte voor aan te maken"
        >
          + Nieuwe offerte
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="border border-[var(--color-border)] rounded-md p-10 text-center">
          <p className="text-[13px] text-[var(--color-muted-dark)]">
            Nog geen offertes. Ga naar een prospect en klik &quot;Nieuwe
            offerte&quot;.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <QuoteSection title="Concept" rows={draft} defaultOpen />
          <QuoteSection title="Verstuurd" rows={sent} defaultOpen />
          <QuoteSection
            title="Gearchiveerd"
            rows={archived}
            defaultOpen={false}
          />
        </div>
      )}
    </div>
  );
}

function QuoteSection({
  title,
  rows,
  defaultOpen,
}: {
  title: string;
  rows: Row[];
  defaultOpen: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <details open={defaultOpen}>
      <summary
        className="cursor-pointer text-[13px] font-medium uppercase tracking-[0.14em] text-[var(--color-muted-dark)]"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {title} ({rows.length})
      </summary>
      <table className="mt-4 w-full text-[13px]">
        <thead>
          <tr
            className="border-b border-[var(--color-border-strong)] text-left text-[11px] uppercase tracking-[0.14em] text-[var(--color-muted-dark)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            <th className="pb-2 pr-4 font-medium">Ref</th>
            <th className="pb-2 pr-4 font-medium">Prospect</th>
            <th className="pb-2 pr-4 font-medium">Onderwerp</th>
            <th className="pb-2 pr-4 font-medium text-right">Bedrag</th>
            <th className="pb-2 pr-4 font-medium">Status</th>
            <th className="pb-2 font-medium text-right">Datum</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const totals = computeQuoteTotals(r.lines, r.btwPercentage);
            return (
              <tr
                key={r.id}
                className={`border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors ${
                  i % 2 === 0 ? '' : 'bg-[var(--color-surface-2)]'
                }`}
              >
                <td className="py-3 pr-4">
                  <Link
                    href={`/admin/quotes/${r.id}`}
                    className="inline-flex items-center gap-2 font-medium text-[var(--color-ink)] hover:underline"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {r.isActiveProposal && (
                      <span
                        className="inline-block h-2 w-2 rounded-full bg-[var(--color-gold)]"
                        title="Actief voorstel"
                      />
                    )}
                    {r.nummer}
                  </Link>
                </td>
                <td className="py-3 pr-4 text-[var(--color-muted-dark)]">
                  {r.prospect.companyName ?? r.prospect.slug}
                </td>
                <td className="py-3 pr-4 text-[var(--color-ink)]">
                  {r.onderwerp}
                </td>
                <td
                  className="py-3 pr-4 text-right font-medium text-[var(--color-ink)] tabular-nums"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {formatEuro(totals.bruto)}
                </td>
                <td className="py-3 pr-4">
                  <QuoteStatusBadge status={r.status} />
                </td>
                <td
                  className="py-3 text-right text-[var(--color-muted-dark)] tabular-nums"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {new Date(r.createdAt).toLocaleDateString('nl-NL')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </details>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit 2>&1 | grep -E "^(app|components|server)/" | head -20
npx eslint app/admin/quotes/page.tsx 2>&1 | tail -10
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/admin/quotes/page.tsx
git commit -m "feat(admin): restyle quotes list to Editorial aesthetic

Paper/ink/gold tokens, Plex Mono tabular numbers, table layout with
row striping. Gold dot indicator on active voorstel quotes."
```

---

### Task 4: Admin quote detail — Editorial rewrite with sidebar

**Files:**

- Modify: `app/admin/quotes/[id]/page.tsx` (full rewrite, ~350 lines)

- [ ] **Step 1: Rewrite quote detail page**

Replace entire contents of `app/admin/quotes/[id]/page.tsx`. The new layout:

- **Back link** to prospect page (Plex Mono eyebrow, like prospect sub-route shell)
- **Hero**: ref number (Plex Mono), title, status badge, dirty indicator
- **Two-column grid**: left = QuoteForm (existing component) + totals block, right = sidebar
- **Sidebar** (right column):
  - Prospect link card
  - "Actief voorstel" toggle (calls `setActiveProposal` mutation)
  - Preview button → opens `/offerte/[prospect-slug]` in new tab
  - Actions: Send / New version / Archive (reuse existing QuoteSendConfirm + QuoteVersionConfirm)
- **Totals block** below form: subtotal / BTW 21% / totaal with gold underline (Plex Mono tabular-nums)
- Remove `glass-card`, `slate-*`, `font-black`, tabs — form is always visible, no tab switching

Key: `isActiveProposal` comes from the `quote` query response (Prisma auto-includes scalars). The toggle calls `api.quotes.setActiveProposal.useMutation()`.

```tsx
'use client';

import type { Prisma } from '@prisma/client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { api } from '@/components/providers';
import { PageLoader } from '@/components/ui/page-loader';
import {
  QuoteForm,
  type QuoteFormValues,
} from '@/components/features/quotes/quote-form';
import { QuoteStatusBadge } from '@/components/features/quotes/quote-status-badge';
import { QuoteSendConfirm } from '@/components/features/quotes/quote-send-confirm';
import { QuoteVersionConfirm } from '@/components/features/quotes/quote-version-confirm';
import { computeQuoteTotals, formatEuro } from '@/lib/quotes/quote-totals';
import { buildDiscoverPath } from '@/lib/prospect-url';

type QuoteDetailRow = Prisma.QuoteGetPayload<{
  include: {
    lines: { orderBy: { position: 'asc' } };
    prospect: {
      select: {
        id: true;
        slug: true;
        readableSlug: true;
        companyName: true;
        status: true;
      };
    };
  };
}>;

export default function QuoteDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const utils = api.useUtils() as any;

  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [draft, setDraft] = useState<QuoteFormValues | null>(null);

  // TODO: tRPC v11 inference gap — quotes.get
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quoteQuery = (api.quotes.get as any).useQuery({ id });
  const quote = quoteQuery.data as QuoteDetailRow | undefined;

  // TODO: tRPC v11 inference gap — quotes.update
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateMutation = (api.quotes.update as any).useMutation({
    onSuccess: () => {
      utils.quotes?.get?.invalidate?.({ id });
      utils.quotes?.list?.invalidate?.();
      setIsDirty(false);
      setError(null);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      setError(err?.message ?? 'Kon offerte niet opslaan.');
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeProposalMutation = (
    api.quotes.setActiveProposal as any
  ).useMutation({
    onSuccess: () => {
      utils.quotes?.get?.invalidate?.({ id });
      utils.quotes?.list?.invalidate?.();
    },
  });

  useEffect(() => {
    if (!quote) return;
    setDraft({
      nummer: quote.nummer,
      datum: new Date(quote.datum).toISOString().slice(0, 10),
      geldigTot: new Date(quote.geldigTot).toISOString().slice(0, 10),
      onderwerp: quote.onderwerp,
      tagline: quote.tagline ?? '',
      introductie: quote.introductie ?? '',
      uitdaging: quote.uitdaging ?? '',
      aanpak: quote.aanpak ?? '',
      btwPercentage: quote.btwPercentage,
      scope: quote.scope ?? '',
      buitenScope: quote.buitenScope ?? '',
      lines: quote.lines.map((l) => ({
        fase: l.fase,
        omschrijving: l.omschrijving ?? '',
        oplevering: l.oplevering ?? '',
        uren: l.uren,
        tarief: l.tarief,
      })),
    });
    setIsDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote?.updatedAt]);

  const isReadOnly = useMemo(
    () => (quote ? quote.status !== 'DRAFT' : true),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quote?.status],
  );

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty && !isReadOnly) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty, isReadOnly]);

  if (quoteQuery.isLoading || !quote || !draft) {
    return <PageLoader label="Offerte laden" description="Eén moment." />;
  }
  if (quoteQuery.error) {
    return (
      <div className="border border-[var(--color-border)] rounded-md p-10 text-red-600 text-[13px]">
        Fout: {String(quoteQuery.error.message)}
      </div>
    );
  }

  const handleSubmit = (values: QuoteFormValues) => {
    setError(null);
    setDraft(values);
    setIsDirty(true);
    updateMutation.mutate({
      id: quote.id,
      nummer: values.nummer,
      datum: new Date(values.datum).toISOString(),
      geldigTot: new Date(values.geldigTot).toISOString(),
      onderwerp: values.onderwerp,
      tagline: values.tagline || undefined,
      introductie: values.introductie || undefined,
      uitdaging: values.uitdaging || undefined,
      aanpak: values.aanpak || undefined,
      btwPercentage: values.btwPercentage,
      scope: values.scope || undefined,
      buitenScope: values.buitenScope || undefined,
      lines: values.lines.map((l, idx) => ({
        fase: l.fase,
        omschrijving: l.omschrijving || undefined,
        oplevering: l.oplevering || undefined,
        uren: l.uren,
        tarief: l.tarief,
        position: idx,
      })),
    });
  };

  const totals = computeQuoteTotals(
    draft.lines.map((l) => ({ uren: l.uren, tarief: l.tarief })),
    draft.btwPercentage,
  );

  const offerteUrl = quote.prospect.readableSlug
    ? `/offerte/${quote.prospect.readableSlug}`
    : null;

  return (
    <div className="pb-20">
      {/* Back link */}
      <Link
        href={`/admin/prospects/${quote.prospect.id}`}
        className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted-dark)] hover:text-[var(--color-ink)] transition-colors"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        <ArrowLeft className="h-3 w-3" />
        {quote.prospect.companyName ?? quote.prospect.slug}
      </Link>

      {/* Hero */}
      <div className="mt-6 flex items-center gap-4">
        <h1
          className="font-medium text-[24px] text-[var(--color-ink)]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {quote.nummer}
        </h1>
        <QuoteStatusBadge status={quote.status} />
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(quote as any).isActiveProposal && (
          <span
            className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-gold)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Actief voorstel
          </span>
        )}
        {isDirty && !isReadOnly && (
          <span
            className="text-[11px] uppercase tracking-[0.14em] text-amber-600"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Niet opgeslagen
          </span>
        )}
      </div>
      <p className="mt-2 text-[15px] text-[var(--color-muted-dark)]">
        {quote.onderwerp}
      </p>

      {error && (
        <div className="mt-4 border-l-4 border-red-500 bg-red-50 p-4 text-[13px] text-red-700">
          {error}
        </div>
      )}

      {/* Two-column grid: form left, sidebar right */}
      <div className="mt-8 grid grid-cols-[1fr_280px] gap-8">
        {/* Left: form + totals */}
        <div className="space-y-6">
          <QuoteForm
            initial={draft}
            mode="edit"
            onSubmit={handleSubmit}
            isReadOnly={isReadOnly}
            isSubmitting={updateMutation.isPending}
            error={error}
          />

          {/* Totals block */}
          <div className="border-t border-[var(--color-border-strong)] pt-4">
            <div className="ml-auto w-[280px] space-y-2">
              <TotalsRow label="Subtotaal" value={formatEuro(totals.netto)} />
              <TotalsRow
                label={`BTW ${draft.btwPercentage}%`}
                value={formatEuro(totals.btw)}
              />
              <div className="border-t-2 border-[var(--color-gold)] pt-2">
                <TotalsRow
                  label="Totaal incl. BTW"
                  value={formatEuro(totals.bruto)}
                  bold
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: sidebar */}
        <aside className="space-y-6">
          {/* Prospect card */}
          <div className="border border-[var(--color-border)] rounded-md p-4">
            <span
              className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-dark)]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Prospect
            </span>
            <Link
              href={`/admin/prospects/${quote.prospect.id}`}
              className="mt-1 block text-[14px] font-medium text-[var(--color-ink)] hover:underline"
            >
              {quote.prospect.companyName ?? quote.prospect.slug}
            </Link>
          </div>

          {/* Active voorstel toggle */}
          <div className="border border-[var(--color-border)] rounded-md p-4">
            <span
              className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-dark)]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Brochure-koppeling
            </span>
            <label className="mt-3 flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                checked={(quote as any).isActiveProposal ?? false}
                onChange={(e) =>
                  activeProposalMutation.mutate({
                    id: quote.id,
                    active: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-[var(--color-border-strong)] text-[var(--color-gold)] focus:ring-[var(--color-gold)]"
              />
              <span className="text-[13px] text-[var(--color-ink)]">
                Actief voorstel
              </span>
            </label>
            <p className="mt-2 text-[11px] text-[var(--color-muted-dark)]">
              Toont deze offerte op de brochure-pagina van de prospect.
            </p>
          </div>

          {/* Preview link */}
          {offerteUrl && (
            <a
              href={offerteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="admin-btn-secondary flex items-center justify-center gap-2 w-full text-[13px]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Bekijk brochure
            </a>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <QuoteSendConfirm
              quoteId={quote.id}
              status={quote.status}
              lines={quote.lines.map((l) => ({
                uren: l.uren,
                tarief: l.tarief,
              }))}
              btwPercentage={quote.btwPercentage}
            />
            <QuoteVersionConfirm quoteId={quote.id} status={quote.status} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function TotalsRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between items-baseline">
      <span
        className={`text-[12px] uppercase tracking-[0.12em] ${bold ? 'text-[var(--color-ink)] font-medium' : 'text-[var(--color-muted-dark)]'}`}
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {label}
      </span>
      <span
        className={`tabular-nums ${bold ? 'text-[16px] font-medium text-[var(--color-ink)]' : 'text-[14px] text-[var(--color-ink)]'}`}
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {value}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit 2>&1 | grep -E "^(app|components|server)/" | head -20
npx eslint "app/admin/quotes/[id]/page.tsx" 2>&1 | tail -10
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "app/admin/quotes/[id]/page.tsx"
git commit -m "feat(admin): rewrite quote detail to Editorial with sidebar

Two-column layout: form + totals left, sidebar right with prospect
card, active-voorstel toggle, brochure preview link, and send/version
actions. Gold underline on totals. Removes glass-card and tab UI."
```

---

### Task 5: Brochure wire-up — replace hardcoded Page 4 with real Quote data

**Files:**

- Modify: `app/offerte/[slug]/page.tsx`
- Modify: `components/features/offerte/brochure-cover.tsx`

- [ ] **Step 1: Update server component to query active quote**

In `app/offerte/[slug]/page.tsx`, add a query for the active quote and pass it to `BrochureCover`:

```tsx
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { BrochureCover } from '@/components/features/offerte/brochure-cover';
import { prettifyDomainToName } from '@/lib/enrichment/company-name';

export default async function OffertePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const prospect = await prisma.prospect.findFirst({
    where: { readableSlug: slug },
    select: {
      id: true,
      companyName: true,
      domain: true,
      logoUrl: true,
      readableSlug: true,
    },
  });

  if (!prospect) {
    notFound();
  }

  // Active quote for brochure Page 4 (Fase B wire-up)
  const activeQuote = await prisma.quote.findFirst({
    where: {
      prospectId: prospect.id,
      isActiveProposal: true,
    },
    include: {
      lines: { orderBy: { position: 'asc' } },
    },
  });

  const displayName =
    (prospect.companyName && prospect.companyName.trim()) ||
    prettifyDomainToName(prospect.domain) ||
    slug;

  return (
    <BrochureCover
      slug={slug}
      prospect={{
        companyName: displayName,
        logoUrl: prospect.logoUrl ?? null,
        domain: prospect.domain ?? null,
      }}
      quote={
        activeQuote
          ? {
              nummer: activeQuote.nummer,
              onderwerp: activeQuote.onderwerp,
              btwPercentage: activeQuote.btwPercentage,
              lines: activeQuote.lines.map((l) => ({
                fase: l.fase,
                omschrijving: l.omschrijving ?? '',
                uren: l.uren,
                tarief: l.tarief,
              })),
            }
          : null
      }
    />
  );
}
```

- [ ] **Step 2: Update BrochureCover to accept quote prop**

In `components/features/offerte/brochure-cover.tsx`, update the component props and the `BrochureProspect` export area.

Find the `BrochureCover` function signature and its props type. Add:

```typescript
export type BrochureQuote = {
  nummer: string;
  onderwerp: string;
  btwPercentage: number;
  lines: {
    fase: string;
    omschrijving: string;
    uren: number;
    tarief: number;
  }[];
} | null;
```

Add `quote` prop to `BrochureCover`:

```typescript
export function BrochureCover({
  slug,
  prospect,
  quote,
}: {
  slug: string;
  prospect: BrochureProspect;
  quote?: BrochureQuote;
}) {
```

Pass `quote` through to the `Investering` component call:

```tsx
<Investering
  onNext={...}
  onBack={...}
  progressLabel={...}
  prospect={prospect}
  quote={quote ?? null}
/>
```

- [ ] **Step 3: Update Investering component to use real quote data**

In the `Investering` function (line ~645), add `quote` param:

```typescript
function Investering({
  onNext,
  onBack,
  progressLabel,
  prospect,
  quote,
}: {
  onNext: () => void;
  onBack: () => void;
  progressLabel: string;
  prospect: BrochureProspect;
  quote: BrochureQuote;
}) {
```

Replace the hardcoded `RATE` and `lines` with:

```typescript
// Real data from active quote, or placeholder if no quote linked yet
const hasQuote = quote && quote.lines.length > 0;

const lines = hasQuote
  ? quote.lines.map((l, i) => ({
      num: String(i + 1).padStart(2, '0'),
      fase: l.fase,
      desc: l.omschrijving,
      uren: l.uren,
      rate: l.tarief,
    }))
  : [
      // Placeholder shown when no active quote is set
      {
        num: '—',
        fase: 'Voorstel in voorbereiding',
        desc: 'De offerte voor dit project wordt momenteel samengesteld.',
        uren: 0,
        rate: 0,
      },
    ];

const btwPct = hasQuote ? quote.btwPercentage / 100 : 0.21;
```

Replace the totals calculation:

```typescript
const subtotal = lines.reduce((acc, l) => acc + l.uren * l.rate, 0);
const vat = subtotal * btwPct;
const total = subtotal + vat;
```

Update the JSX rendering to use `l.rate` instead of the old shared `RATE` constant, and use `l.desc` etc. Make sure each line item shows its own rate in the row:

In the line items map, change from:

```
{l.uren}u × €{RATE}
```

To:

```
{l.uren}u × €{l.rate}
```

Update the summary card area (around line 1480) to also use the same `hasQuote` / computed totals. Search for `// Numbers mirror Investering page` — replace the hardcoded mirror with:

```typescript
// Numbers from real quote data (wired in Fase B)
const displayTotal = hasQuote ? total : null;
```

If `!hasQuote`, show the "Voorstel in voorbereiding" placeholder text instead of numbers.

Remove the old `const RATE = 95;` and the old hardcoded `lines` array entirely.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit 2>&1 | grep -E "^(app|components|server)/" | head -20
npx eslint app/offerte/\[slug\]/page.tsx components/features/offerte/brochure-cover.tsx 2>&1 | tail -10
```

Then smoke test:

```bash
curl -s -o /dev/null -w "/offerte/marfa HTTP %{http_code}\n" http://localhost:9200/offerte/marfa
```

Expected: HTTP 200.

- [ ] **Step 5: Commit**

```bash
git add app/offerte/\[slug\]/page.tsx components/features/offerte/brochure-cover.tsx
git commit -m "feat(offerte): wire brochure Page 4 to real Quote data

Server component queries active quote (isActiveProposal=true) and
passes line items to BrochureCover. Investering page renders real
phase breakdown + computed totals. Fallback placeholder when no
active quote is set. Removes hardcoded 200u × €95 stub."
```

---

### Task 6: Final validation

- [ ] **Step 1: Full typecheck + lint**

```bash
npx tsc --noEmit 2>&1 | grep -E "^(app|components|server)/" | head -20
npx eslint app/admin/quotes/ app/offerte/ components/features/offerte/brochure-cover.tsx 2>&1 | tail -20
```

- [ ] **Step 2: Smoke test admin routes**

```bash
curl -s -o /dev/null -w "quotes-list HTTP %{http_code}\n" http://localhost:9200/admin/quotes
curl -s -o /dev/null -w "offerte-marfa HTTP %{http_code}\n" http://localhost:9200/offerte/marfa
```

Expected: both HTTP 200.

- [ ] **Step 3: Manual browser verification**

Visit in browser:

1. `/admin/quotes` — Editorial table with Marfa quotes visible
2. Click a quote → `/admin/quotes/[id]` → Editorial detail with sidebar
3. Toggle "Actief voorstel" checkbox → refresh `/offerte/marfa` → Page 4 shows real line items
4. Toggle off → refresh → Page 4 shows "Voorstel in voorbereiding" placeholder
5. `/offerte/marfa` Pages 1-3 and 5-7 still render correctly

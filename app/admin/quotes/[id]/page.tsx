'use client';

/**
 * Quote detail — Editorial two-column layout.
 *
 * Left: QuoteForm + totals block.
 * Right sidebar: prospect card, active proposal toggle, preview link, actions.
 *
 * Read-only branching on `status !== 'DRAFT'`. Dirty tracking + beforeunload
 * warning only active for DRAFT edits.
 */

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

// tRPC v11 inference gap — mirror ResearchRunRow pattern.
type QuoteDetailRow = Prisma.QuoteGetPayload<{
  include: {
    lines: { orderBy: { position: 'asc' } };
    prospect: {
      select: {
        id: true;
        slug: true;
        readableSlug: true;
        companyName: true;
      };
    };
  };
}>;

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

  // Seed draft whenever the server row arrives/changes (updatedAt as change signal
  // so we don't reseed after a local edit).
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
        tarief: l.tarief, // SIGNED — preserve negative discount lines
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isActiveProposal = (quote as any)?.isActiveProposal as
    | boolean
    | undefined;

  // beforeunload warning for uncommitted changes
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
      <div className="p-10 text-sm text-red-600">
        Fout: {String(quoteQuery.error.message)}
      </div>
    );
  }

  const totals = computeQuoteTotals(
    draft.lines.map((l) => ({ uren: l.uren, tarief: l.tarief })),
    draft.btwPercentage,
  );

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
        tarief: l.tarief, // SIGNED — never clamp
        position: idx,
      })),
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Back link */}
      <Link
        href={`/admin/prospects/${quote.prospect.id}`}
        className="inline-flex items-center gap-1.5 hover:opacity-70 transition-opacity"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        <ArrowLeft
          className="h-3 w-3"
          style={{ color: 'var(--color-muted)' }}
        />
        <span
          className="text-[11px] uppercase tracking-[0.18em]"
          style={{ color: 'var(--color-muted)' }}
        >
          {quote.prospect.companyName ?? quote.prospect.slug}
        </span>
      </Link>

      {/* Hero */}
      <header className="space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className="text-[24px] leading-none"
            style={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-ink)',
            }}
          >
            {quote.nummer}
          </span>
          <QuoteStatusBadge status={quote.status} />
          {isActiveProposal && (
            <span
              className="text-[11px] uppercase tracking-[0.18em]"
              style={{
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-gold)',
              }}
            >
              Actief voorstel
            </span>
          )}
          {isDirty && !isReadOnly && (
            <span
              className="text-[11px] uppercase tracking-[0.14em]"
              style={{ fontFamily: 'var(--font-mono)', color: '#b45309' }}
            >
              Niet opgeslagen
            </span>
          )}
        </div>
        <p className="text-[13px]" style={{ color: 'var(--color-muted)' }}>
          {quote.onderwerp}
        </p>
      </header>

      {error && (
        <div
          className="border-l-2 p-4 text-[13px]"
          style={{ borderColor: '#dc2626', color: '#dc2626' }}
        >
          {error}
        </div>
      )}

      {/* Two-column grid */}
      <div className="grid grid-cols-[1fr_280px] gap-8 items-start">
        {/* Left: form + totals */}
        <div className="space-y-8">
          <QuoteForm
            initial={draft}
            mode="edit"
            onSubmit={handleSubmit}
            isReadOnly={isReadOnly}
            isSubmitting={updateMutation.isPending}
            error={error}
          />

          {/* Totals block */}
          <div className="flex justify-end">
            <div className="w-[280px] space-y-2">
              <TotalsRow label="Subtotaal" value={formatEuro(totals.netto)} />
              <TotalsRow
                label={`BTW ${draft.btwPercentage}%`}
                value={formatEuro(totals.btw)}
              />
              <div
                className="border-t-2 pt-2"
                style={{ borderColor: 'var(--color-gold)' }}
              >
                <TotalsRow
                  label="Totaal incl. BTW"
                  value={formatEuro(totals.bruto)}
                  bold
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Prospect card */}
          <div
            className="p-4 space-y-1 border"
            style={{ borderColor: 'var(--color-border, #e5e3da)' }}
          >
            <p
              className="text-[10px] uppercase tracking-[0.18em] mb-2"
              style={{
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-muted)',
              }}
            >
              Prospect
            </p>
            <Link
              href={`/admin/prospects/${quote.prospect.id}`}
              className="block text-[14px] font-medium hover:opacity-70 transition-opacity"
              style={{ color: 'var(--color-ink)' }}
            >
              {quote.prospect.companyName ?? quote.prospect.slug}
            </Link>
          </div>

          {/* Active proposal toggle */}
          <div
            className="p-4 border"
            style={{ borderColor: 'var(--color-border, #e5e3da)' }}
          >
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!!isActiveProposal}
                onChange={(e) =>
                  activeProposalMutation.mutate({
                    id: quote.id,
                    isActiveProposal: e.target.checked,
                  })
                }
                className="h-4 w-4 accent-[var(--color-gold)]"
              />
              <span
                className="text-[12px] uppercase tracking-[0.14em]"
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-ink)',
                }}
              >
                Actief voorstel
              </span>
            </label>
          </div>

          {/* Preview button */}
          {quote.prospect.readableSlug && (
            <a
              href={`/offerte/${quote.prospect.readableSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="admin-btn-secondary w-full flex items-center justify-center gap-2 text-[12px]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Bekijk brochure
            </a>
          )}

          {/* Actions */}
          <div className="space-y-2" data-testid="quote-actions-slot">
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
        </div>
      </div>
    </div>
  );
}

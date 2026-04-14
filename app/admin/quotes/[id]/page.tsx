'use client';

/**
 * Phase 61-03 / ADMIN-07 wiring — Quote detail page.
 *
 * Tabs: Details / Voorbeeld / Tijdlijn (CSS `hidden` pattern — panels stay
 * mounted so tab switches never refetch). Read-only branching on
 * `status !== 'DRAFT'` flips the shared QuoteForm into read-only mode.
 * Dirty tracking + beforeunload warning only active for DRAFT edits.
 *
 * Action slot (Verstuur / Nieuwe versie) is intentionally empty here —
 * 61-04 mounts those actions into the dedicated slot div below.
 */

import type { Prisma } from '@prisma/client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/components/providers';
import { PageLoader } from '@/components/ui/page-loader';
import {
  QuoteForm,
  type QuoteFormValues,
} from '@/components/features/quotes/quote-form';
import { QuoteStatusBadge } from '@/components/features/quotes/quote-status-badge';
import { QuoteStatusTimeline } from '@/components/features/quotes/quote-status-timeline';
import { QuotePreviewIframe } from '@/components/features/quotes/quote-preview-iframe';
import { QuoteSendConfirm } from '@/components/features/quotes/quote-send-confirm';
import { QuoteVersionConfirm } from '@/components/features/quotes/quote-version-confirm';

// Pitfall 5 / tRPC v11 inference gap — mirror ResearchRunRow pattern from
// app/admin/prospects/[id]/page.tsx.
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'border-b-2 border-[#EBCB4B] pb-2 text-sm font-black text-[#040026]'
          : 'pb-2 text-sm font-semibold text-slate-500 hover:text-[#040026]'
      }
    >
      {children}
    </button>
  );
}

export default function QuoteDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const utils = api.useUtils() as any;

  const [tab, setTab] = useState<'details' | 'preview' | 'timeline'>('details');
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

  // Seed the draft whenever the server row arrives/changes (uses updatedAt
  // as the change signal so we don't reseed after a local edit).
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

  // beforeunload warning for uncommitted changes (O7)
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
      <div className="glass-card p-10 text-red-600">
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
        tarief: l.tarief, // SIGNED — never clamp
        position: idx,
      })),
    });
  };

  return (
    <div className="space-y-6 p-10">
      <header className="space-y-3">
        <Link
          href={`/admin/prospects/${quote.prospect.id}`}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#040026]"
        >
          <ArrowLeft className="h-4 w-4" /> Terug naar{' '}
          {quote.prospect.companyName ?? quote.prospect.slug}
        </Link>
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-black text-[#040026]">{quote.nummer}</h1>
          <QuoteStatusBadge status={quote.status} />
          {isDirty && !isReadOnly && (
            <span className="text-xs font-bold text-amber-600">
              Niet opgeslagen wijzigingen
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500">{quote.onderwerp}</p>
      </header>

      {error && (
        <div className="glass-card border-l-4 border-red-500 p-6 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Acties slot — Verstuur (DRAFT) + Nieuwe versie (SENT/VIEWED). */}
      <div
        className="flex flex-wrap items-center gap-3"
        data-testid="quote-actions-slot"
      >
        <QuoteSendConfirm
          quoteId={quote.id}
          status={quote.status}
          lines={quote.lines.map((l) => ({ uren: l.uren, tarief: l.tarief }))}
          btwPercentage={quote.btwPercentage}
        />
        <QuoteVersionConfirm quoteId={quote.id} status={quote.status} />
      </div>

      <nav className="flex gap-4 border-b border-slate-200">
        <TabButton active={tab === 'details'} onClick={() => setTab('details')}>
          Details
        </TabButton>
        <TabButton active={tab === 'preview'} onClick={() => setTab('preview')}>
          Voorbeeld
        </TabButton>
        <TabButton
          active={tab === 'timeline'}
          onClick={() => setTab('timeline')}
        >
          Tijdlijn
        </TabButton>
      </nav>

      <section className={tab === 'details' ? '' : 'hidden'}>
        <QuoteForm
          initial={draft}
          mode="edit"
          onSubmit={handleSubmit}
          isReadOnly={isReadOnly}
          isSubmitting={updateMutation.isPending}
          error={error}
        />
      </section>

      <section className={tab === 'preview' ? '' : 'hidden'}>
        <QuotePreviewIframe quoteId={quote.id} />
      </section>

      <section className={tab === 'timeline' ? '' : 'hidden'}>
        <QuoteStatusTimeline
          createdAt={quote.createdAt}
          snapshotAt={quote.snapshotAt}
          viewedAt={null}
          acceptedAt={null}
        />
      </section>
    </div>
  );
}

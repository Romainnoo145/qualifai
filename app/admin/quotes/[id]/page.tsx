'use client';

/**
 * Quote detail — single-column notes → narrative → line items → actions flow.
 *
 * Read-only branching on `status !== 'DRAFT'`.
 */

import type { Prisma } from '@prisma/client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Loader2, Mail } from 'lucide-react';
import { api } from '@/components/providers';
import { PageLoader } from '@/components/ui/page-loader';
import { QuoteStatusBadge } from '@/components/features/quotes/quote-status-badge';
import { QuoteVersionConfirm } from '@/components/features/quotes/quote-version-confirm';
import { NarrativePreview } from '@/components/features/quotes/narrative-preview';
import {
  LineItemsEditor,
  type LineItemDraft,
} from '@/components/features/quotes/line-items-editor';
import { EmailCompose } from '@/components/features/quotes/email-compose';
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)] whitespace-nowrap">
        {children}
      </span>
      <span className="flex-1 h-px bg-[var(--color-border)]" />
    </div>
  );
}

function Block({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-8 border-b border-[var(--color-surface-2)]">
      {children}
    </div>
  );
}

export default function QuoteDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const utils = api.useUtils() as any;

  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineItemDraft[]>([]);
  const [showEmailCompose, setShowEmailCompose] = useState(false);

  // Narrative fields (editable inline via NarrativePreview)
  const [introductie, setIntroductie] = useState('');
  const [uitdaging, setUitdaging] = useState('');
  const [aanpak, setAanpak] = useState('');

  // TODO: tRPC v11 inference gap — quotes.get
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quoteQuery = (api.quotes.get as any).useQuery({ id });
  const quote = quoteQuery.data as QuoteDetailRow | undefined;

  // TODO: tRPC v11 inference gap — quotes.updateNotes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateNotesMutation = (api.quotes.updateNotes as any).useMutation();

  // TODO: tRPC v11 inference gap — quotes.generateNarrative
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const generateMutation = (api.quotes.generateNarrative as any).useMutation({
    onSuccess: () => {
      utils.quotes?.get?.invalidate?.({ id });
      utils.quotes?.list?.invalidate?.();
    },
  });

  // TODO: tRPC v11 inference gap — quotes.update
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateMutation = (api.quotes.update as any).useMutation({
    onSuccess: () => {
      utils.quotes?.get?.invalidate?.({ id });
      utils.quotes?.list?.invalidate?.();
    },
  });

  // TODO: tRPC v11 inference gap — quotes.setActiveProposal
  const activeProposalMutation = (api.quotes as any).setActiveProposal // eslint-disable-line @typescript-eslint/no-explicit-any
    .useMutation({
      onSuccess: () => {
        utils.quotes?.get?.invalidate?.({ id });
        utils.quotes?.list?.invalidate?.();
      },
    });

  // TODO: tRPC v11 inference gap — quotes.sendEmail (if available)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sendEmailMutation = (api.quotes as any).sendEmail?.useMutation?.({
    onSuccess: () => setShowEmailCompose(false),
  });

  // Seed local state when quote loads / changes (updatedAt as change signal).
  useEffect(() => {
    if (!quote) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = quote as any;
    setNotes(q.meetingNotes ?? '');
    setIntroductie(quote.introductie ?? '');
    setUitdaging(quote.uitdaging ?? '');
    setAanpak(quote.aanpak ?? '');
    setLines(
      quote.lines.map((l) => ({
        omschrijving: l.omschrijving ?? '',
        uren: l.uren,
        tarief: l.tarief,
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote?.updatedAt]);

  if (quoteQuery.isLoading || !quote) {
    return <PageLoader label="Offerte laden" description="Eén moment." />;
  }
  if (quoteQuery.error) {
    return (
      <div className="p-10 text-[13px]" style={{ color: '#dc2626' }}>
        Fout: {String(quoteQuery.error.message)}
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = quote as any;
  const isReadOnly = quote.status !== 'DRAFT';
  const isActiveProposal = q.isActiveProposal as boolean | undefined;
  const narrativeGeneratedAt = q.narrativeGeneratedAt as string | null;
  const hasNarrative = !!(introductie || uitdaging || aanpak);

  const brochureUrl = quote.prospect.readableSlug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/offerte/${quote.prospect.readableSlug}`
    : '';

  const handleNarrativeUpdate = (
    field: 'introductie' | 'uitdaging' | 'aanpak',
    value: string,
  ) => {
    if (field === 'introductie') setIntroductie(value);
    if (field === 'uitdaging') setUitdaging(value);
    if (field === 'aanpak') setAanpak(value);
    updateMutation.mutate({
      id: quote.id,
      introductie: field === 'introductie' ? value : introductie,
      uitdaging: field === 'uitdaging' ? value : uitdaging,
      aanpak: field === 'aanpak' ? value : aanpak,
    });
  };

  const handleSaveLines = () => {
    updateMutation.mutate({
      id: quote.id,
      lines: lines.map((l, idx) => ({
        omschrijving: l.omschrijving || undefined,
        uren: l.uren,
        tarief: l.tarief,
        position: idx,
      })),
    });
  };

  const totals = computeQuoteTotals(
    lines.map((l) => ({ uren: l.uren, tarief: l.tarief })),
    quote.btwPercentage,
  );
  const datumStr = new Date(quote.datum ?? quote.createdAt).toLocaleDateString(
    'nl-NL',
    { day: 'numeric', month: 'short' },
  );
  const datumYear = new Date(quote.datum ?? quote.createdAt).getFullYear();
  const geldigStr = quote.geldigTot
    ? new Date(quote.geldigTot).toLocaleDateString('nl-NL', {
        day: 'numeric',
        month: 'short',
      })
    : '—';

  return (
    <div className="max-w-[1400px] space-y-0 pb-20">
      {/* Back line */}
      <div className="flex items-center gap-2 pb-4 mb-8 border-b border-[var(--color-border)]">
        <Link
          href={`/admin/prospects/${quote.prospect.id}`}
          className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {quote.prospect.companyName ?? quote.prospect.slug}
        </Link>
        <span className="text-[10px] text-[var(--color-border-strong)]">/</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-ink)]">
          {quote.nummer}
        </span>
      </div>

      {/* Hero */}
      <header className="grid grid-cols-[1fr_auto] gap-10 items-end pb-7 mb-9 border-b border-[var(--color-ink)]">
        <div>
          <h1 className="font-['Sora'] text-[clamp(32px,5vw,48px)] font-bold leading-[1.05] tracking-[-0.025em] text-[var(--color-ink)]">
            {quote.nummer}
            <span className="text-[var(--color-gold)]">.</span>
          </h1>
          {quote.onderwerp && (
            <p className="mt-3 max-w-[600px] text-[16px] font-light leading-[1.55] text-[var(--color-muted-dark)]">
              {quote.onderwerp}
            </p>
          )}
          <QuoteStatusBadge status={quote.status} />
        </div>
        <div className="flex flex-col gap-2">
          {quote.prospect.readableSlug && (
            <button
              type="button"
              onClick={() =>
                window.open(`/offerte/${quote.prospect.readableSlug}`, '_blank')
              }
              className="inline-flex items-center gap-2 rounded-[6px] border border-[var(--color-border-strong)] px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-ink)] hover:border-[var(--color-ink)] transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Bekijk brochure
            </button>
          )}
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => setShowEmailCompose((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full border border-[#e4c33c] bg-gradient-to-b from-[#e4c33c] to-[#f4d95a] px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-ink)]"
            >
              <Mail className="h-3.5 w-3.5" />
              {showEmailCompose ? 'Annuleer' : 'Email versturen'}
            </button>
          )}
        </div>
      </header>

      {/* Mega-stat bar */}
      <section className="grid grid-cols-[repeat(4,minmax(0,1fr))] border-b border-[var(--color-ink)] mb-10">
        <div className="py-5 pr-6">
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)]">
            Status
          </span>
          <div className="mt-2 font-['Sora'] text-[32px] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--color-ink)]">
            {quote.status === 'DRAFT'
              ? 'Concept'
              : quote.status === 'SENT'
                ? 'Verstuurd'
                : quote.status === 'ACCEPTED'
                  ? 'Geaccepteerd'
                  : quote.status}
            <span className="text-[var(--color-gold)]">.</span>
          </div>
          <div className="mt-1 text-[11px] font-light text-[var(--color-muted)]">
            {quote.status === 'DRAFT' ? 'nog niet verstuurd' : 'actief'}
          </div>
        </div>
        <div className="py-5 px-6 border-l border-[var(--color-border)]">
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)]">
            Bedrag
          </span>
          <div className="mt-2 font-['Sora'] text-[32px] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--color-ink)]">
            {formatEuro(totals.bruto)}
          </div>
          <div className="mt-1 text-[11px] font-light text-[var(--color-muted)]">
            excl. BTW
          </div>
        </div>
        <div className="py-5 px-6 border-l border-[var(--color-border)]">
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)]">
            Datum
          </span>
          <div className="mt-2 font-['Sora'] text-[32px] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--color-ink)]">
            {datumStr}
          </div>
          <div className="mt-1 text-[11px] font-light text-[var(--color-muted)]">
            {datumYear}
          </div>
        </div>
        <div className="py-5 pl-6 border-l border-[var(--color-border)]">
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)]">
            Geldig tot
          </span>
          <div className="mt-2 font-['Sora'] text-[32px] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--color-ink)]">
            {geldigStr}
          </div>
          <div className="mt-1 text-[11px] font-light text-[var(--color-muted)]">
            30 dagen
          </div>
        </div>
      </section>

      {/* 2-column grid */}
      <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-10">
        {/* Left: content */}
        <div className="space-y-10">
          {/* Notes */}
          <Block>
            <SectionLabel>Gespreksnotities</SectionLabel>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() =>
                updateNotesMutation.mutate({
                  id: quote.id,
                  meetingNotes: notes,
                })
              }
              rows={6}
              disabled={isReadOnly}
              placeholder="Wat heb je besproken? Pijnpunten, context, concrete vragen..."
              className="input-minimal w-full text-[14px] leading-[1.6] resize-none"
            />
            {!isReadOnly && (
              <div className="mt-4">
                <button
                  type="button"
                  disabled={generateMutation.isPending || !notes.trim()}
                  onClick={() => generateMutation.mutate({ id: quote.id })}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-medium uppercase tracking-[0.08em] bg-gradient-to-b from-[#e4c33c] to-[#f4d95a] text-[var(--color-ink)] border border-[#e4c33c] disabled:opacity-50"
                >
                  {generateMutation.isPending && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  {generateMutation.isPending
                    ? 'Genereren...'
                    : 'Genereer voorstel'}
                </button>
              </div>
            )}
          </Block>

          {/* Narrative */}
          {(hasNarrative || narrativeGeneratedAt) && (
            <Block>
              <SectionLabel>Narratief</SectionLabel>
              <NarrativePreview
                introductie={introductie}
                uitdaging={uitdaging}
                aanpak={aanpak}
                isGenerated={!!narrativeGeneratedAt}
                isReadOnly={isReadOnly}
                onUpdate={handleNarrativeUpdate}
              />
            </Block>
          )}

          {/* Line Items */}
          <Block>
            <SectionLabel>Regels</SectionLabel>
            <LineItemsEditor
              lines={lines}
              btwPercentage={quote.btwPercentage}
              isReadOnly={isReadOnly}
              onChange={setLines}
            />
            {!isReadOnly && (
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  disabled={updateMutation.isPending}
                  onClick={handleSaveLines}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-[10px] font-medium uppercase tracking-[0.06em] bg-transparent text-[var(--color-ink)] border border-[var(--color-border)] hover:border-[var(--color-ink)] transition-all disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Opslaan...' : 'Regels opslaan'}
                </button>
              </div>
            )}
          </Block>

          {/* Email compose (inline, below line items) */}
          {showEmailCompose && !isReadOnly && (
            <Block>
              <SectionLabel>Email opstellen</SectionLabel>
              <EmailCompose
                defaultTo={''}
                defaultSubject={`Voorstel ${quote.nummer} — ${quote.onderwerp}`}
                brochureUrl={brochureUrl}
                isSubmitting={sendEmailMutation?.isPending ?? false}
                onSend={(data) =>
                  sendEmailMutation?.mutate?.({ id: quote.id, ...data })
                }
                onCancel={() => setShowEmailCompose(false)}
              />
            </Block>
          )}
        </div>

        {/* Right: actions */}
        <aside className="space-y-8">
          <div>
            <SectionLabel>Acties</SectionLabel>
            <div className="space-y-1.5">
              {quote.prospect.readableSlug && (
                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      `/offerte/${quote.prospect.readableSlug}`,
                      '_blank',
                    )
                  }
                  className="flex w-full items-center gap-2 px-4 py-2.5 rounded-[6px] border border-[var(--color-border)] text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-ink)] hover:border-[var(--color-ink)] transition-all text-left"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Bekijk brochure
                  <span className="ml-auto text-[var(--color-border-strong)]">
                    →
                  </span>
                </button>
              )}
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => setShowEmailCompose((v) => !v)}
                  className="flex w-full items-center gap-2 px-4 py-2.5 rounded-[6px] border border-[var(--color-border)] text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-ink)] hover:border-[var(--color-ink)] transition-all text-left"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Email versturen
                  <span className="ml-auto text-[var(--color-border-strong)]">
                    →
                  </span>
                </button>
              )}
              <div className="pt-1">
                <QuoteVersionConfirm quoteId={quote.id} status={quote.status} />
              </div>
            </div>
          </div>

          <div>
            <SectionLabel>Instellingen</SectionLabel>
            <label className="flex items-center gap-2 py-3 border-b border-[var(--color-surface-2)] cursor-pointer">
              <input
                type="checkbox"
                checked={!!isActiveProposal}
                onChange={(e) =>
                  activeProposalMutation.mutate({
                    id: quote.id,
                    active: e.target.checked,
                  })
                }
                className="h-3.5 w-3.5 accent-[var(--color-gold)]"
              />
              <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-muted-dark)]">
                Actief voorstel
              </span>
            </label>
          </div>
        </aside>
      </div>
    </div>
  );
}

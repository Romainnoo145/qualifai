'use client';

/**
 * Quote detail — reordered layout: Onderwerp → Investering → Betalingsschema
 * → Concept-tekst (collapsible, hidden for BESPOKE prospects).
 *
 * Read-only branching on `status !== 'DRAFT'`.
 */

import type { Prisma } from '@prisma/client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Mail,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
import {
  DEFAULT_PAYMENT_SCHEDULE,
  type PaymentInstallment,
} from '@/lib/quote-defaults';

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
        voorstelMode: true;
        contacts: {
          select: {
            id: true;
            firstName: true;
            lastName: true;
            primaryEmail: true;
          };
        };
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

type SaveStatusState = 'idle' | 'saving' | 'saved';

function SaveStatus({ status }: { status: SaveStatusState }) {
  if (status === 'idle') return null;
  return (
    <span className="text-[11px] text-[var(--color-muted)] transition-opacity">
      {status === 'saving' ? 'Bezig…' : 'Opgeslagen ✓'}
    </span>
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
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const utils = api.useUtils() as any;

  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineItemDraft[]>([]);
  const [showEmailCompose, setShowEmailCompose] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [conceptTekstOpen, setConceptTekstOpen] = useState(false);
  const [clipboardFeedback, setClipboardFeedback] = useState(false);

  // Payment schedule
  const [termijnen, setTermijnen] = useState(false);
  const [schedule, setSchedule] = useState<PaymentInstallment[]>([]);

  // Auto-save guards: don't fire on initial hydration from server.
  const hasLinesEdited = useRef(false);
  const hasScheduleEdited = useRef(false);

  // Global save status indicator.
  const [saveStatus, setSaveStatus] = useState<SaveStatusState>('idle');
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Narrative fields (editable inline via NarrativePreview)
  const [introductie, setIntroductie] = useState('');
  const [uitdaging, setUitdaging] = useState('');
  const [aanpak, setAanpak] = useState('');

  // TODO: tRPC v11 inference gap — quotes.get
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quoteQuery = (api.quotes.get as any).useQuery({ slug });
  const quote = quoteQuery.data as QuoteDetailRow | undefined;

  // TODO: tRPC v11 inference gap — quotes.updateNotes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateNotesMutation = (api.quotes.updateNotes as any).useMutation();

  // TODO: tRPC v11 inference gap — quotes.generateNarrative
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const generateMutation = (api.quotes.generateNarrative as any).useMutation({
    onSuccess: () => {
      utils.quotes?.get?.invalidate?.({ slug });
      utils.quotes?.list?.invalidate?.();
    },
  });

  // TODO: tRPC v11 inference gap — quotes.update
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateMutation = (api.quotes.update as any).useMutation({
    onSuccess: () => {
      utils.quotes?.get?.invalidate?.({ slug });
      utils.quotes?.list?.invalidate?.();
      setSaveStatus('saved');
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = setTimeout(
        () => setSaveStatus('idle'),
        2000,
      );
    },
    onMutate: () => {
      setSaveStatus('saving');
    },
  });

  // TODO: tRPC v11 inference gap — quotes.setActiveProposal
  const activeProposalMutation = (api.quotes as any).setActiveProposal // eslint-disable-line @typescript-eslint/no-explicit-any
    .useMutation({
      onSuccess: () => {
        utils.quotes?.get?.invalidate?.({ slug });
        utils.quotes?.list?.invalidate?.();
      },
    });

  const sendEmailMutation = api.quotes.sendEmail.useMutation({
    onSuccess: () => {
      setShowEmailCompose(false);
      utils.quotes?.get?.invalidate?.({ slug });
      utils.quotes?.list?.invalidate?.();
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deleteMutation = (api.quotes.delete as any).useMutation({
    onSuccess: () => router.push('/admin/quotes'),
  });

  // Seed local state when quote loads / changes (updatedAt as change signal).
  // Reset "hasEdited" guards so newly-hydrated state doesn't trigger auto-save.
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
    // Seed payment schedule state from stored data
    const stored = q.paymentSchedule as PaymentInstallment[] | null | undefined;
    if (Array.isArray(stored) && stored.length > 0) {
      setTermijnen(true);
      setSchedule(stored);
    } else {
      setTermijnen(false);
      setSchedule([]);
    }
    // Reset guards — next change will be a genuine user edit.
    hasLinesEdited.current = false;
    hasScheduleEdited.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote?.updatedAt]);

  // Auto-save: line items — 500ms debounce after user edits.
  useEffect(() => {
    if (!quote || quote.status !== 'DRAFT') return;
    if (!hasLinesEdited.current) {
      // First render after hydration — mark ready, don't save.
      hasLinesEdited.current = true;
      return;
    }
    const timer = setTimeout(() => {
      updateMutation.mutate({
        id: quote.id,
        lines: lines.map((l, idx) => ({
          omschrijving: l.omschrijving || undefined,
          uren: l.uren,
          tarief: l.tarief,
          position: idx,
        })),
      });
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines]);

  // Auto-save: payment schedule — 500ms debounce after user edits.
  // Only commits when schedule is valid (100%) or termijnen is toggled off.
  useEffect(() => {
    if (!quote || quote.status !== 'DRAFT') return;
    if (!hasScheduleEdited.current) {
      hasScheduleEdited.current = true;
      return;
    }
    // When termijnen is off, always save (clear schedule).
    // When termijnen is on, only save when schedule totals 100%.
    const currentTotal = schedule.reduce(
      (acc, r) => acc + (r.percentage || 0),
      0,
    );
    const currentValid = Math.round(currentTotal) === 100;
    if (termijnen && !currentValid) return;

    const timer = setTimeout(() => {
      updateMutation.mutate({
        id: quote.id,
        paymentSchedule: termijnen && schedule.length > 0 ? schedule : null,
      });
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule, termijnen]);

  // Redirect legacy CUID URLs to canonical slug URL.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = quote as any;
    if (q?.slug && slug !== q.slug) {
      router.replace(`/admin/quotes/${q.slug}`);
    }
  }, [quote, slug, router]);

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
  const isBespoke =
    (quote.prospect as unknown as { voorstelMode?: string }).voorstelMode ===
    'BESPOKE';

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

  const handleCopyLink = async () => {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/offerte/${quote.prospect.readableSlug}`
        : brochureUrl;
    try {
      await navigator.clipboard.writeText(url);
      setClipboardFeedback(true);
      setTimeout(() => setClipboardFeedback(false), 2000);
    } catch {
      // clipboard not available (e.g. non-https) — silently ignore
    }
  };

  const scheduleTotal = schedule.reduce(
    (acc, row) => acc + (row.percentage || 0),
    0,
  );
  const scheduleValid = Math.round(scheduleTotal) === 100;

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
      {showDeleteConfirm && (
        <ConfirmDialog
          title={`Offerte ${quote.nummer} verwijderen`}
          description="Deze actie kan niet ongedaan worden gemaakt. Alle regels worden ook verwijderd."
          confirmLabel="Ja, verwijderen"
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate({ id: quote.id })}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
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
      <header className="grid grid-cols-[1fr_auto] gap-10 items-end pb-5 mb-5">
        <div>
          <h1 className="font-['Sora'] text-[clamp(32px,5vw,48px)] font-bold leading-[1.05] tracking-[-0.025em] text-[var(--color-ink)]">
            {quote.nummer}
            <span className="text-[var(--color-gold)]">.</span>
          </h1>
          {quote.onderwerp && (
            <p className="mt-2 text-[12px] text-[var(--color-muted)]">
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
              Bekijk offerte
            </button>
          )}
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => setShowEmailCompose((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full border border-[#e4c33c] bg-gradient-to-b from-[#e4c33c] to-[#f4d95a] px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-ink)]"
            >
              <Mail className="h-3.5 w-3.5" />
              {showEmailCompose ? 'Annuleer' : 'Versturen'}
            </button>
          )}
        </div>
      </header>

      {/* Mega-stat bar */}
      <section className="grid grid-cols-[repeat(4,minmax(0,1fr))] border-t border-b border-[var(--color-ink)] mb-10">
        <MegaStat
          label="Status"
          value={
            quote.status === 'DRAFT'
              ? 'Concept'
              : quote.status === 'SENT'
                ? 'Verstuurd'
                : quote.status === 'ACCEPTED'
                  ? 'Geaccepteerd'
                  : quote.status
          }
          sub={quote.status === 'DRAFT' ? 'nog niet verstuurd' : 'actief'}
          goldDot
        />
        <MegaStat
          label="Bedrag"
          value={formatEuro(totals.bruto)}
          sub="excl. BTW"
        />
        <MegaStat label="Datum" value={datumStr} sub={String(datumYear)} />
        <MegaStat label="Geldig tot" value={geldigStr} sub="30 dagen" />
      </section>

      {/* 2-column grid */}
      <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-10">
        {/* Left: content */}
        <div className="space-y-10">
          {/* Investering (line items) */}
          <Block>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)] whitespace-nowrap">
                Investering
              </span>
              <span className="flex-1 h-px bg-[var(--color-border)]" />
              <SaveStatus status={saveStatus} />
            </div>
            <LineItemsEditor
              lines={lines}
              btwPercentage={quote.btwPercentage}
              isReadOnly={isReadOnly}
              onChange={setLines}
            />
          </Block>

          {/* Betalingsschema */}
          <Block>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)] whitespace-nowrap">
                Betalingsschema
              </span>
              <span className="flex-1 h-px bg-[var(--color-border)]" />
              <SaveStatus status={saveStatus} />
            </div>
            <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={termijnen}
                onChange={(e) => {
                  setTermijnen(e.target.checked);
                  if (e.target.checked && schedule.length === 0) {
                    setSchedule([...DEFAULT_PAYMENT_SCHEDULE]);
                  }
                }}
                disabled={isReadOnly}
                className="h-3.5 w-3.5 accent-[var(--color-gold)]"
              />
              <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-muted-dark)]">
                In termijnen factureren
              </span>
            </label>

            {!termijnen ? (
              <p className="text-[13px] font-light text-[var(--color-muted)]">
                Volledige betaling 14 dagen na oplevering.
              </p>
            ) : (
              <div className="space-y-2">
                {/* Header row */}
                <div className="grid grid-cols-[1fr_80px_1fr_28px] gap-2 pb-1 border-b border-[var(--color-border)]">
                  <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
                    Termijn
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)] text-right">
                    %
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
                    Vervaldatum tekst
                  </span>
                  <span />
                </div>

                {schedule.map((row, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[1fr_80px_1fr_28px] gap-2 items-center"
                  >
                    <input
                      type="text"
                      value={row.label}
                      disabled={isReadOnly}
                      onChange={(e) => {
                        setSchedule(
                          schedule.map((r, i) =>
                            i === idx
                              ? {
                                  label: e.target.value,
                                  percentage: r.percentage,
                                  dueOn: r.dueOn,
                                }
                              : r,
                          ),
                        );
                      }}
                      placeholder="Termijnnaam"
                      className="input-minimal text-[13px]"
                    />
                    <input
                      type="number"
                      value={row.percentage}
                      disabled={isReadOnly}
                      onChange={(e) => {
                        setSchedule(
                          schedule.map((r, i) =>
                            i === idx
                              ? {
                                  label: r.label,
                                  percentage: Number(e.target.value),
                                  dueOn: r.dueOn,
                                }
                              : r,
                          ),
                        );
                      }}
                      min={0}
                      max={100}
                      className="input-minimal text-[13px] text-right"
                    />
                    <input
                      type="text"
                      value={row.dueOn}
                      disabled={isReadOnly}
                      onChange={(e) => {
                        setSchedule(
                          schedule.map((r, i) =>
                            i === idx
                              ? {
                                  label: r.label,
                                  percentage: r.percentage,
                                  dueOn: e.target.value,
                                }
                              : r,
                          ),
                        );
                      }}
                      placeholder="bijv. binnen 14 dagen na akkoord"
                      className="input-minimal text-[13px]"
                    />
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() =>
                          setSchedule(schedule.filter((_, i) => i !== idx))
                        }
                        className="flex items-center justify-center h-6 w-6 rounded text-[var(--color-muted)] hover:text-red-500 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}

                {/* Live total */}
                <div
                  className={`flex items-center gap-2 pt-2 text-[12px] font-medium ${scheduleValid ? 'text-[var(--color-gold)]' : 'text-red-500'}`}
                >
                  {scheduleValid ? (
                    <span className="text-[var(--color-gold)]">✓</span>
                  ) : (
                    <span>⚠</span>
                  )}
                  Totaal: {scheduleTotal}%
                  {!scheduleValid && ' (moet 100% zijn)'}
                </div>

                {!isReadOnly && (
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSchedule([
                          ...schedule,
                          { label: '', percentage: 0, dueOn: '' },
                        ])
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-medium uppercase tracking-[0.06em] border border-[var(--color-border)] text-[var(--color-muted-dark)] hover:border-[var(--color-ink)] transition-all"
                    >
                      <Plus className="h-3 w-3" />
                      Termijn toevoegen
                    </button>
                    <button
                      type="button"
                      onClick={() => setSchedule([...DEFAULT_PAYMENT_SCHEDULE])}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-medium uppercase tracking-[0.06em] border border-[var(--color-border)] text-[var(--color-muted-dark)] hover:border-[var(--color-ink)] transition-all"
                    >
                      Gebruik 30/40/30 standaard
                    </button>
                  </div>
                )}

                {/* Auto-saves when scheduleValid — no manual button needed */}
              </div>
            )}
          </Block>

          {/* Concept-tekst — collapsible, hidden entirely for BESPOKE */}
          {!isBespoke && (
            <Block>
              {/* Collapsible header */}
              <button
                type="button"
                onClick={() => setConceptTekstOpen((v) => !v)}
                className="flex w-full items-center gap-3 mb-2 group"
              >
                <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)] whitespace-nowrap">
                  Concept-tekst
                </span>
                <span className="flex-1 h-px bg-[var(--color-border)]" />
                {conceptTekstOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 text-[var(--color-muted)] group-hover:text-[var(--color-ink)] transition-colors flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-[var(--color-muted)] group-hover:text-[var(--color-ink)] transition-colors flex-shrink-0" />
                )}
              </button>
              {!conceptTekstOpen && (
                <p className="text-[11px] text-[var(--color-muted)] font-light">
                  Voor de standaard koude-track brochure. Gebruik
                  gespreksnotities + AI om narrative te genereren.
                </p>
              )}

              {conceptTekstOpen && (
                <div className="mt-4 space-y-8">
                  {/* Notes */}
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)] whitespace-nowrap">
                        Gespreksnotities
                      </span>
                      <span className="flex-1 h-px bg-[var(--color-border)]" />
                    </div>
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
                          onClick={() =>
                            generateMutation.mutate({ id: quote.id })
                          }
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-medium uppercase tracking-[0.08em] bg-gradient-to-b from-[#e4c33c] to-[#f4d95a] text-[var(--color-ink)] border border-[#e4c33c] disabled:opacity-50"
                        >
                          {generateMutation.isPending && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          )}
                          {generateMutation.isPending
                            ? 'Genereren...'
                            : 'Genereer concept-tekst'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Narrative */}
                  {(hasNarrative || narrativeGeneratedAt) && (
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)] whitespace-nowrap">
                          Narratief
                        </span>
                        <span className="flex-1 h-px bg-[var(--color-border)]" />
                      </div>
                      <NarrativePreview
                        introductie={introductie}
                        uitdaging={uitdaging}
                        aanpak={aanpak}
                        isGenerated={!!narrativeGeneratedAt}
                        isReadOnly={isReadOnly}
                        onUpdate={handleNarrativeUpdate}
                      />
                    </div>
                  )}
                </div>
              )}
            </Block>
          )}

          {/* Email compose (inline, below main content) */}
          {showEmailCompose && !isReadOnly && (
            <Block>
              <SectionLabel>Email opstellen</SectionLabel>
              <EmailCompose
                defaultSubject={`Voorstel ${quote.nummer} — ${quote.onderwerp}`}
                brochureUrl={brochureUrl}
                contacts={quote.prospect.contacts ?? []}
                isSubmitting={sendEmailMutation.isPending}
                onSend={(data) =>
                  sendEmailMutation.mutate({ id: quote.id, ...data })
                }
                onCancel={() => setShowEmailCompose(false)}
              />
            </Block>
          )}
        </div>

        {/* Right: actions */}
        <aside className="space-y-8">
          {/* INSTELLINGEN */}
          <div>
            <SectionLabel>Instellingen</SectionLabel>
            <label className="flex items-start gap-2 py-3 border-b border-[var(--color-surface-2)] cursor-pointer">
              <input
                type="checkbox"
                checked={!!isActiveProposal}
                onChange={(e) =>
                  activeProposalMutation.mutate({
                    id: quote.id,
                    active: e.target.checked,
                  })
                }
                className="h-3.5 w-3.5 mt-0.5 accent-[var(--color-gold)] flex-shrink-0"
              />
              <div>
                <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-muted-dark)] block">
                  Live op klantpagina
                </span>
                <span className="text-[10px] font-light text-[var(--color-muted)] leading-[1.5] block mt-0.5">
                  Slechts één offerte per klant kan tegelijk live zijn op
                  /offerte/[slug]
                </span>
              </div>
            </label>
            <button
              type="button"
              disabled={deleteMutation.isPending || isReadOnly}
              onClick={() => setShowDeleteConfirm(true)}
              className="flex w-full items-center gap-2 px-4 py-2.5 rounded-[6px] border border-[var(--color-border)] text-[11px] font-medium uppercase tracking-[0.06em] text-red-500 hover:border-red-300 hover:bg-red-50 transition-all disabled:opacity-40 mt-4"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Verwijder offerte
            </button>
          </div>

          {/* ACTIES */}
          <div>
            <SectionLabel>Acties</SectionLabel>
            <div className="space-y-1.5">
              {quote.prospect.readableSlug && (
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex w-full items-center gap-2 px-4 py-2.5 rounded-[6px] border border-[var(--color-border)] text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-ink)] hover:border-[var(--color-ink)] transition-all text-left"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {clipboardFeedback ? 'Gekopieerd ✓' : 'Kopieer offerte-link'}
                </button>
              )}
              {quote.prospect.readableSlug && (
                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      `/offerte/${quote.prospect.readableSlug}/print`,
                      '_blank',
                    )
                  }
                  className="flex w-full items-center gap-2 px-4 py-2.5 rounded-[6px] border border-[var(--color-border)] text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-ink)] hover:border-[var(--color-ink)] transition-all text-left"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download als PDF
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
        </aside>
      </div>
    </div>
  );
}

function MegaStat({
  label,
  value,
  sub,
  goldDot,
}: {
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  goldDot?: boolean;
}) {
  return (
    <div className="py-3 border-r border-[var(--color-border)] last:border-r-0 first:pl-0 pl-5 pr-5">
      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)]">
        {label}
      </span>
      <div className="mt-1.5 font-['Sora'] text-[26px] font-bold leading-[1.15] tracking-[-0.02em] text-[var(--color-ink)]">
        {value}
        {goldDot ? (
          <span className="text-[var(--color-gold-hi)]">.</span>
        ) : null}
      </div>
      <div className="mt-2 text-[12px] font-normal text-[var(--color-muted)]">
        {sub}
      </div>
    </div>
  );
}

'use client';

/**
 * Phase 61-04 / ADMIN-05 — Verstuur flow.
 *
 * QuoteSendConfirm renders the "Verstuur" button on a DRAFT quote and a
 * Dutch confirm modal with the inclusive-BTW total. Clicking "Verstuur
 * definitief" calls api.quotes.transition with {id, newStatus: 'SENT'} —
 * EXACTLY those two keys. The server (lib/state-machines/quote.ts,
 * transitionQuote) owns snapshot freeze atomically; the UI NEVER
 * builds a QuoteSnapshot. See Pitfall 1 + Q9 in 61-RESEARCH.md.
 */

import { useEffect, useState } from 'react';
import type { QuoteStatus } from '@prisma/client';
import { api } from '@/components/providers';
import { computeQuoteTotals, formatEuro } from '@/lib/quotes/quote-totals';

interface Props {
  quoteId: string;
  status: QuoteStatus;
  lines: { uren: number; tarief: number }[];
  btwPercentage: number;
}

export function QuoteSendConfirm({
  quoteId,
  status,
  lines,
  btwPercentage,
}: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const utils = api.useUtils() as any;

  // TODO: tRPC v11 inference gap — quotes.transition
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mutation = (api.quotes.transition as any).useMutation({
    onSuccess: () => {
      utils.quotes?.get?.invalidate?.({ id: quoteId });
      utils.quotes?.list?.invalidate?.();
      setOpen(false);
      setError(null);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => setError(err?.message ?? 'Versturen mislukt.'),
  });

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  if (status !== 'DRAFT') return null;

  const totals = computeQuoteTotals(lines, btwPercentage);
  const brutoFmt = formatEuro(totals.bruto);

  const handleConfirm = () => {
    setError(null);
    // Payload is exactly {id, newStatus}. Phase 60-04 state machine
    // owns snapshot freeze inside its own $transaction.
    mutation.mutate({ id: quoteId, newStatus: 'SENT' });
  };

  return (
    <>
      <button
        type="button"
        className="btn-pill-primary"
        onClick={() => setOpen(true)}
        data-testid="quote-send-button"
      >
        Verstuur
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quote-send-title"
        >
          <div className="glass-card w-full max-w-md space-y-6 p-8">
            <h2
              id="quote-send-title"
              className="text-xl font-black text-[#040026]"
            >
              Offerte versturen
            </h2>
            <p className="text-sm text-slate-600">
              Je staat op het punt deze offerte te versturen. Na versturen kun
              je de offerte niet meer aanpassen. Totaal:{' '}
              <strong>{brutoFmt}</strong>. Weet je het zeker?
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="btn-pill-secondary"
                onClick={() => setOpen(false)}
                disabled={mutation.isPending}
              >
                Annuleren
              </button>
              <button
                type="button"
                className="btn-pill-primary"
                onClick={handleConfirm}
                disabled={mutation.isPending}
                data-testid="quote-send-confirm-button"
              >
                Verstuur definitief
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

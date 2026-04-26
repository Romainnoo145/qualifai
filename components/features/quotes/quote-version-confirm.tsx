'use client';

/**
 * Phase 61-04 / ADMIN-08 — Nieuwe versie flow.
 *
 * QuoteVersionConfirm renders a "Nieuwe versie" button only when the
 * quote status is SENT or VIEWED (O5 locked decision). Clicking opens
 * a Dutch confirm modal and, on confirm, calls api.quotes.createVersion
 * with {fromId}. The server (61-01) clones fields into a new DRAFT
 * and archives the original inside ONE prisma.$transaction. On success,
 * the user is redirected to the new DRAFT detail page.
 *
 * The component NEVER uses a replacesId hack via the plain create
 * mutation — createVersion is the only supported path (Pitfall 3).
 */

import { useEffect, useState } from 'react';
import type { QuoteStatus } from '@prisma/client';
import { useRouter } from 'next/navigation';
import { GitBranch } from 'lucide-react';
import { api } from '@/components/providers';

// O6 verbatim Dutch copy — grep-enforced.
const MODAL_TITLE = 'Nieuwe versie maken';
const MODAL_BODY =
  'Je maakt een nieuwe DRAFT op basis van deze offerte. Het origineel wordt gearchiveerd en kan niet meer worden verstuurd. Ga je verder?';
const PRIMARY_LABEL = 'Nieuwe versie maken';
const CANCEL_LABEL = 'Annuleren';

// O5 locked — button visible ONLY for SENT + VIEWED (not DRAFT, not ACCEPTED,
// not REJECTED, not EXPIRED, not ARCHIVED). Tested via it.each visibility matrix.
const ALLOWED_STATUSES: readonly QuoteStatus[] = ['SENT', 'VIEWED'] as const;

interface Props {
  quoteId: string;
  status: QuoteStatus;
}

export function QuoteVersionConfirm({ quoteId, status }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const utils = api.useUtils() as any;

  // TODO: tRPC v11 inference gap — quotes.createVersion
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mutation = (api.quotes.createVersion as any).useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (newQuote: any) => {
      utils.quotes?.list?.invalidate?.();
      setOpen(false);
      setError(null);
      router.push(`/admin/quotes/${newQuote.id}`);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) =>
      setError(err?.message ?? 'Kon nieuwe versie niet maken.'),
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

  if (!ALLOWED_STATUSES.includes(status)) return null;

  const handleConfirm = () => {
    setError(null);
    mutation.mutate({ fromId: quoteId });
  };

  return (
    <>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-2.5 rounded-[6px] border border-[var(--color-border)] text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-ink)] hover:border-[var(--color-ink)] transition-all text-left"
        onClick={() => setOpen(true)}
        data-testid="quote-version-button"
      >
        <GitBranch className="h-3.5 w-3.5" />
        Nieuwe versie
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quote-version-title"
        >
          <div className="glass-card w-full max-w-md space-y-6 p-8">
            <h2
              id="quote-version-title"
              className="text-xl font-black text-[#040026]"
            >
              {MODAL_TITLE}
            </h2>
            <p className="text-sm text-slate-600">{MODAL_BODY}</p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-muted-dark)] hover:border-[var(--color-ink)] transition-colors"
                onClick={() => setOpen(false)}
                disabled={mutation.isPending}
              >
                {CANCEL_LABEL}
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-[#e4c33c] bg-gradient-to-b from-[#e4c33c] to-[#f4d95a] px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-ink)] disabled:opacity-50"
                onClick={handleConfirm}
                disabled={mutation.isPending}
                data-testid="quote-version-confirm-button"
              >
                {PRIMARY_LABEL}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

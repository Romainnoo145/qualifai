'use client';

import { api } from '@/components/providers';

interface InvoiceLite {
  id: string;
  status: string;
  pdfUrl?: string | null;
  invoiceNumber: string;
}

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

export function InvoiceActions({
  invoice,
  onChange,
}: {
  invoice: InvoiceLite;
  onChange: () => void;
}) {
  // TODO: tRPC v11 inference gap — invoice.send
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sendMut = (api.invoice.send as any).useMutation({
    onSuccess: onChange,
  });
  // TODO: tRPC v11 inference gap — invoice.markPaid
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markPaidMut = (api.invoice.markPaid as any).useMutation({
    onSuccess: onChange,
  });
  // TODO: tRPC v11 inference gap — invoice.cancel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cancelMut = (api.invoice.cancel as any).useMutation({
    onSuccess: onChange,
  });

  const showSend = invoice.status === 'DRAFT';
  const showMarkPaid =
    invoice.status === 'SENT' || invoice.status === 'OVERDUE';
  const showCancel =
    invoice.status === 'DRAFT' ||
    invoice.status === 'SENT' ||
    invoice.status === 'OVERDUE';

  return (
    <div className="space-y-3 sticky top-6">
      <SectionLabel>Acties</SectionLabel>

      {showSend && (
        <button
          type="button"
          onClick={() => {
            if (confirm('Factuur versturen aan klant?')) {
              sendMut.mutate({ invoiceId: invoice.id });
            }
          }}
          disabled={sendMut.isPending}
          className="flex w-full items-center justify-center rounded-[6px] border border-[var(--color-gold)] bg-[var(--color-gold)] px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-ink)] disabled:opacity-50"
        >
          {sendMut.isPending ? 'Versturen…' : 'Versturen'}
        </button>
      )}

      {showMarkPaid && (
        <button
          type="button"
          onClick={() => markPaidMut.mutate({ invoiceId: invoice.id })}
          disabled={markPaidMut.isPending}
          className="flex w-full items-center justify-center rounded-[6px] border border-[var(--color-gold)] bg-[var(--color-gold)] px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-ink)] disabled:opacity-50"
        >
          {markPaidMut.isPending ? 'Bijwerken…' : 'Markeer betaald'}
        </button>
      )}

      {showCancel && (
        <button
          type="button"
          onClick={() => {
            if (confirm('Factuur annuleren?')) {
              cancelMut.mutate({ invoiceId: invoice.id });
            }
          }}
          disabled={cancelMut.isPending}
          className="flex w-full items-center justify-center rounded-[6px] border border-[var(--color-border)] px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-ink)] hover:border-[var(--color-border-strong)] transition-colors disabled:opacity-50"
        >
          Annuleren
        </button>
      )}

      {invoice.status === 'PAID' && (
        <p className="text-[12px] text-[var(--color-muted)] py-2">
          Betaald — geen acties beschikbaar.
        </p>
      )}

      {invoice.status === 'CANCELLED' && (
        <p className="text-[12px] text-[var(--color-muted)] py-2">
          Geannuleerd — geen acties beschikbaar.
        </p>
      )}
    </div>
  );
}

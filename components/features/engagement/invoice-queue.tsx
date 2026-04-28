'use client';

import Link from 'next/link';
import { api } from '@/components/providers';

const formatEur = (cents: number) =>
  (cents / 100).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' });

const STATUS_BG: Record<string, string> = {
  DRAFT: 'bg-zinc-100 text-zinc-700',
  SENT: 'bg-blue-50 text-blue-700',
  PAID: 'bg-green-50 text-green-700',
  OVERDUE: 'bg-red-50 text-red-700',
  CANCELLED: 'bg-zinc-50 text-zinc-500',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Concept',
  SENT: 'Verzonden',
  PAID: 'Betaald',
  OVERDUE: 'Vervallen',
  CANCELLED: 'Geannuleerd',
};

type PaymentTerm = {
  label: string;
  percentage: number;
};

export function InvoiceQueue({
  engagement,
  onChange,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  engagement: any;
  onChange: () => void;
}) {
  // TODO: tRPC v11 inference gap — invoice.prepare
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prepareMut = (api.invoice.prepare as any).useMutation({
    onSuccess: onChange,
  });

  const schedule = (engagement.quote.paymentSchedule ?? []) as PaymentTerm[];
  const existingTermijnen = new Set<number>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (engagement.invoices as any[]).map((i: any) => i.termijnIndex as number),
  );

  // Compute quote subtotal excl BTW from line items (euros, not cents)

  const subtotalEur = (engagement.quote.lines ?? []).reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sum: number, l: any) => sum + (l.uren ?? 0) * (l.tarief ?? 0),
    0,
  );

  return (
    <section className="space-y-3">
      <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)]">
        Facturen
      </span>

      {/* Existing invoices table */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(engagement.invoices as any[]).length > 0 && (
        <table className="w-full text-[13px]">
          <thead className="text-[11px] text-[var(--color-muted)] text-left">
            <tr>
              <th className="py-2 font-medium">Nummer</th>
              <th className="py-2 font-medium">Termijn</th>
              <th className="py-2 font-medium text-right">Bedrag</th>
              <th className="py-2 font-medium">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(engagement.invoices as any[]).map((inv: any) => (
              <tr
                key={inv.id}
                className="border-t border-[var(--color-border)]"
              >
                <td className="py-2 text-[var(--color-ink)]">
                  {inv.invoiceNumber}
                </td>
                <td className="py-2 text-[var(--color-muted-dark)]">
                  {inv.termijnLabel}
                </td>
                <td className="py-2 text-right text-[var(--color-ink)]">
                  {formatEur(inv.amountCents as number)}
                </td>
                <td className="py-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-medium ${STATUS_BG[inv.status as string] ?? 'bg-zinc-100 text-zinc-700'}`}
                  >
                    {STATUS_LABELS[inv.status as string] ??
                      (inv.status as string)}
                  </span>
                </td>
                <td className="py-2 text-right">
                  <Link
                    href={`/admin/invoices/${inv.id as string}`}
                    className="text-[var(--color-ink)] hover:underline text-[13px]"
                  >
                    Bekijk →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Prepare buttons for missing termijnen */}
      <div className="space-y-2 pt-1">
        {schedule.map((term, idx) =>
          existingTermijnen.has(idx) ? null : (
            <button
              key={idx}
              onClick={() =>
                prepareMut.mutate({
                  engagementId: engagement.id as string,
                  termijnIndex: idx,
                })
              }
              disabled={prepareMut.isPending}
              className="w-full text-left px-3 py-2 border border-dashed border-[var(--color-border)] rounded text-[13px] hover:bg-zinc-50 disabled:opacity-50"
            >
              + Maak factuur klaar — termijn {idx + 1}: {term.label} (
              {term.percentage}% ·{' '}
              {formatEur(
                Math.round((subtotalEur * term.percentage) / 100) * 100,
              )}{' '}
              excl. BTW)
            </button>
          ),
        )}
        {schedule.length > 0 && schedule.length === existingTermijnen.size && (
          <p className="text-[12px] text-[var(--color-muted)]">
            Alle termijnen hebben een factuur.
          </p>
        )}
        {schedule.length === 0 && (
          <p className="text-[12px] text-[var(--color-muted)]">
            Geen betaalschema ingesteld op de offerte.
          </p>
        )}
      </div>
    </section>
  );
}

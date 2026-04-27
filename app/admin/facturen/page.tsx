'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/components/providers';

const formatEur = (cents: number) =>
  (cents / 100).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' });

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Concept',
  SENT: 'Verzonden',
  PAID: 'Betaald',
  OVERDUE: 'Vervallen',
  CANCELLED: 'Geannuleerd',
};

const STATUS_BG: Record<string, string> = {
  DRAFT: 'bg-zinc-100 text-zinc-700',
  SENT: 'bg-blue-50 text-blue-700',
  PAID: 'bg-green-50 text-green-700',
  OVERDUE: 'bg-red-50 text-red-700',
  CANCELLED: 'bg-zinc-50 text-zinc-500',
};

type StatusFilter =
  | 'DRAFT'
  | 'SENT'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED'
  | undefined;

export default function FacturenPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(undefined);

  // TODO: tRPC v11 inference gap — invoice.listForTenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, isLoading } = (api.invoice.listForTenant as any).useQuery({
    status: statusFilter,
  });

  if (isLoading) return <div className="p-6">Laden…</div>;
  if (!data) return <div className="p-6">Geen toegang</div>;

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-medium text-[var(--color-ink)]">
          Facturen
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Bedragen excl. BTW
        </p>
      </header>

      <div className="grid grid-cols-3 gap-4">
        <div className="border border-[var(--color-border)] rounded p-4">
          <div className="text-xs text-[var(--color-muted)]">Openstaand</div>
          <div className="text-2xl font-medium mt-1">
            {formatEur(data.totals.outstanding)}
          </div>
        </div>
        <div className="border border-[var(--color-border)] rounded p-4">
          <div className="text-xs text-[var(--color-muted)]">
            Deze maand betaald
          </div>
          <div className="text-2xl font-medium mt-1">
            {formatEur(data.totals.paidThisMonth)}
          </div>
        </div>
        <div className="border border-[var(--color-border)] rounded p-4">
          <div className="text-xs text-[var(--color-muted)]">
            Aantal per status
          </div>
          <div className="text-sm space-y-0.5 mt-1">
            {Object.entries(data.totals.countByStatus).map(([s, n]) => (
              <div key={s}>
                {STATUS_LABEL[s] ?? s}: {n as number}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-4 text-sm border-b border-[var(--color-border)] pb-2">
        <button
          onClick={() => setStatusFilter(undefined)}
          className={
            !statusFilter
              ? 'font-medium text-[var(--color-ink)]'
              : 'text-[var(--color-muted)]'
          }
        >
          Alle
        </button>
        {(['DRAFT', 'SENT', 'OVERDUE', 'PAID', 'CANCELLED'] as const).map(
          (s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={
                statusFilter === s
                  ? 'font-medium text-[var(--color-ink)]'
                  : 'text-[var(--color-muted)]'
              }
            >
              {STATUS_LABEL[s]}
            </button>
          ),
        )}
      </div>

      {data.invoices.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)] py-8 text-center">
          Geen facturen.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs text-[var(--color-muted)] text-left">
            <tr>
              <th className="py-2">Nummer</th>
              <th>Klant</th>
              <th>Termijn</th>
              <th className="text-right">Bedrag</th>
              <th>Status</th>
              <th>Datum</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {data.invoices.map((inv: any) => (
              <tr
                key={inv.id}
                className="border-t border-[var(--color-border)]"
              >
                <td className="py-2">{inv.invoiceNumber}</td>
                <td>
                  {inv.engagement.prospect.companyName ??
                    inv.engagement.prospect.domain}
                </td>
                <td>{inv.termijnLabel}</td>
                <td className="text-right">{formatEur(inv.amountCents)}</td>
                <td>
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${STATUS_BG[inv.status] ?? ''}`}
                  >
                    {STATUS_LABEL[inv.status] ?? inv.status}
                  </span>
                </td>
                <td>
                  {new Date(inv.sentAt ?? inv.createdAt).toLocaleDateString(
                    'nl-NL',
                  )}
                </td>
                <td>
                  <Link
                    href={`/admin/invoices/${inv.id}`}
                    className="text-[var(--color-ink)] hover:underline"
                  >
                    Bekijk →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

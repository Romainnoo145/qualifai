'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/components/providers';
import { cn } from '@/lib/utils';
import { useDelayedLoading } from '@/lib/hooks/use-delayed-loading';
import { FacturenSkeleton } from '@/components/features/invoice/facturen-skeleton';

const formatEur = (cents: number) =>
  (cents / 100).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' });

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Concept',
  SENT: 'Verzonden',
  PAID: 'Betaald',
  OVERDUE: 'Vervallen',
  CANCELLED: 'Geannuleerd',
};

// Status badges use brand-aware tints — neutral surface + subtle ink shifts.
// No invented Tailwind colors (no blue/green/red): DESIGN.md hard rule.
const STATUS_BADGE: Record<string, string> = {
  DRAFT:
    'bg-[var(--color-surface-2)] text-[var(--color-muted)] border-[var(--color-border)]',
  SENT: 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border-[var(--color-border)]',
  PAID: 'bg-[#f4d95a]/15 text-[var(--color-ink)] border-[var(--color-gold)]/40',
  OVERDUE:
    'bg-[var(--color-ink)]/5 text-[var(--color-ink)] border-[var(--color-ink)]/30 font-medium',
  CANCELLED:
    'bg-[var(--color-surface-2)] text-[var(--color-muted)] border-[var(--color-border)] line-through',
};

type StatusFilter =
  | 'DRAFT'
  | 'SENT'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED'
  | undefined;

const FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: undefined, label: 'Alles' },
  { key: 'DRAFT', label: 'Concept' },
  { key: 'SENT', label: 'Verzonden' },
  { key: 'OVERDUE', label: 'Vervallen' },
  { key: 'PAID', label: 'Betaald' },
  { key: 'CANCELLED', label: 'Geannuleerd' },
];

export default function FacturenPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(undefined);

  // TODO: tRPC v11 inference gap — invoice.listForTenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, isLoading } = (api.invoice.listForTenant as any).useQuery({
    status: statusFilter,
  });

  const showSkeleton = useDelayedLoading(isLoading);
  if (isLoading) {
    return showSkeleton ? <FacturenSkeleton /> : null;
  }
  if (!data) {
    return (
      <div className="max-w-[1400px] p-6 text-sm text-[var(--color-muted)]">
        Geen toegang
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] space-y-10">
      {/* Header — matches /admin/prospects pattern (48px bold + gold period) */}
      <div className="flex items-baseline justify-between pb-6 border-b border-[var(--color-border)]">
        <h1 className="text-[48px] font-bold text-[var(--color-ink)] tracking-[-0.025em] leading-[1.05]">
          Facturen<span className="text-[var(--color-gold)]">.</span>
        </h1>
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)]">
          Bedragen excl. BTW
        </p>
      </div>

      {/* Stat trio — section-label header pattern */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-[var(--color-gold)] font-medium tabular-nums">
            [ 01 ]
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)]">
            Pulse
          </span>
        </div>
        <div className="grid grid-cols-3 gap-px bg-[var(--color-border)] border border-[var(--color-border)] rounded-md overflow-hidden">
          <StatCard
            label="Openstaand"
            value={formatEur(data.totals.outstanding)}
            accent
          />
          <StatCard
            label="Deze maand betaald"
            value={formatEur(data.totals.paidThisMonth)}
          />
          <StatCard
            label="Per status"
            valueNode={
              <div className="text-sm space-y-0.5 mt-1 leading-tight">
                {Object.keys(data.totals.countByStatus).length === 0 ? (
                  <span className="text-[var(--color-muted)]">—</span>
                ) : (
                  Object.entries(data.totals.countByStatus).map(([s, n]) => (
                    <div
                      key={s}
                      className="flex items-baseline justify-between"
                    >
                      <span className="text-[var(--color-muted)]">
                        {STATUS_LABEL[s] ?? s}
                      </span>
                      <span className="tabular-nums">{n as number}</span>
                    </div>
                  ))
                )}
              </div>
            }
          />
        </div>
      </section>

      {/* Lijst — section-label + filter pills + table */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-[var(--color-gold)] font-medium tabular-nums">
            [ 02 ]
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)]">
            Lijst
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.label}
              onClick={() => setStatusFilter(filter.key)}
              className={cn(
                'px-3.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.08em] rounded-md border transition-all',
                statusFilter === filter.key
                  ? 'bg-[var(--color-ink)] text-white border-[var(--color-ink)]'
                  : 'bg-transparent text-[var(--color-muted)] border-[var(--color-border)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]',
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {data.invoices.length === 0 ? (
          <div className="border border-dashed border-[var(--color-border)] rounded-md py-16 text-center">
            <p className="text-sm text-[var(--color-muted)]">
              Geen facturen
              {statusFilter ? ` in status ${STATUS_LABEL[statusFilter]}` : ''}.
            </p>
          </div>
        ) : (
          <div className="border border-[var(--color-border)] rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--color-muted)] bg-[var(--color-surface-2)] text-left">
                  <th className="py-3 px-4">Nummer</th>
                  <th className="py-3 px-4">Klant</th>
                  <th className="py-3 px-4">Termijn</th>
                  <th className="py-3 px-4 text-right">Bedrag</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Datum</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {data.invoices.map((inv: any) => (
                  <tr
                    key={inv.id}
                    className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/50 transition-colors"
                  >
                    <td className="py-3 px-4 tabular-nums text-[var(--color-ink)] font-medium">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 text-[var(--color-ink)]">
                      {inv.engagement.prospect.companyName ??
                        inv.engagement.prospect.domain}
                    </td>
                    <td className="py-3 px-4 text-[var(--color-muted)]">
                      {inv.termijnLabel}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-[var(--color-ink)]">
                      {formatEur(inv.amountCents)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-[0.06em] border',
                          STATUS_BADGE[inv.status] ?? '',
                        )}
                      >
                        {STATUS_LABEL[inv.status] ?? inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[var(--color-muted)] tabular-nums">
                      {new Date(inv.sentAt ?? inv.createdAt).toLocaleDateString(
                        'nl-NL',
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/admin/invoices/${inv.id}`}
                        className="text-[var(--color-ink)] hover:text-[var(--color-gold)] text-sm transition-colors"
                      >
                        Bekijk →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  valueNode,
  accent,
}: {
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="bg-[var(--color-surface)] p-5 space-y-1">
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)]">
        {label}
      </div>
      {valueNode ?? (
        <div
          className={cn(
            'text-[28px] font-bold tabular-nums tracking-[-0.02em] leading-none',
            accent ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink)]',
          )}
        >
          {value}
        </div>
      )}
    </div>
  );
}

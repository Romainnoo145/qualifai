'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { api } from '@/components/providers';
import { cn } from '@/lib/utils';
import { useDelayedLoading } from '@/lib/hooks/use-delayed-loading';
import { FacturenSkeleton } from '@/components/features/invoice/facturen-skeleton';

const formatEur = (cents: number) =>
  (cents / 100).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' });

type InvoiceStatus = 'DRAFT' | 'SENT' | 'OVERDUE' | 'PAID' | 'CANCELLED';

const COLUMN_LABEL: Record<Exclude<InvoiceStatus, 'CANCELLED'>, string> = {
  DRAFT: 'Concept',
  SENT: 'Verzonden',
  OVERDUE: 'Vervallen',
  PAID: 'Betaald',
};

// Order of kanban columns left-to-right — the lifecycle of money in motion.
const COLUMN_ORDER: Array<Exclude<InvoiceStatus, 'CANCELLED'>> = [
  'DRAFT',
  'SENT',
  'OVERDUE',
  'PAID',
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Invoice = any;

export default function FacturenPage() {
  // TODO: tRPC v11 inference gap — invoice.listForTenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, isLoading } = (api.invoice.listForTenant as any).useQuery({
    status: undefined,
  });

  const showSkeleton = useDelayedLoading(isLoading);

  const grouped = useMemo(() => {
    const result: Record<Exclude<InvoiceStatus, 'CANCELLED'>, Invoice[]> = {
      DRAFT: [],
      SENT: [],
      OVERDUE: [],
      PAID: [],
    };
    if (!data?.invoices) return result;
    for (const inv of data.invoices as Invoice[]) {
      if (inv.status === 'CANCELLED') continue;
      const key = inv.status as Exclude<InvoiceStatus, 'CANCELLED'>;
      if (result[key]) result[key].push(inv);
    }
    return result;
  }, [data]);

  if (isLoading) {
    return showSkeleton ? <FacturenSkeleton /> : null;
  }
  if (!data) {
    return (
      <div className="max-w-[1500px] p-6 text-sm text-[var(--color-muted)]">
        Geen toegang
      </div>
    );
  }

  const totalCount = (data.invoices as Invoice[]).length;
  const cancelledCount =
    grouped.DRAFT.length === 0 && grouped.SENT.length === 0
      ? 0
      : (data.invoices as Invoice[]).filter((i) => i.status === 'CANCELLED')
          .length;

  return (
    <div className="max-w-[1500px] space-y-8">
      {/* Header */}
      <div className="flex items-baseline justify-between pb-6 border-b border-[var(--color-border)]">
        <h1 className="text-[48px] font-bold text-[var(--color-ink)] tracking-[-0.025em] leading-[1.05]">
          Facturen<span className="text-[var(--color-gold)]">.</span>
        </h1>
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)]">
          Bedragen excl. BTW
        </p>
      </div>

      {/* Summary line — thin, single-row inventory */}
      <div className="text-[13px] text-[var(--color-muted)] flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>
          <strong className="text-[var(--color-ink)] font-medium tabular-nums">
            {totalCount}
          </strong>{' '}
          facturen
        </span>
        <span className="text-[var(--color-border-strong)]">·</span>
        <span>
          <strong className="text-[var(--color-ink)] font-medium tabular-nums">
            {formatEur(data.totals.outstanding)}
          </strong>{' '}
          openstaand
        </span>
        <span className="text-[var(--color-border-strong)]">·</span>
        <span>
          <strong className="text-[var(--color-ink)] font-medium tabular-nums">
            {formatEur(data.totals.paidThisMonth)}
          </strong>{' '}
          betaald deze maand
        </span>
        {grouped.OVERDUE.length > 0 && (
          <>
            <span className="text-[var(--color-border-strong)]">·</span>
            <span className="text-[var(--color-ink)] font-medium">
              {grouped.OVERDUE.length} vervallen
            </span>
          </>
        )}
        {cancelledCount > 0 && (
          <>
            <span className="text-[var(--color-border-strong)]">·</span>
            <span>{cancelledCount} geannuleerd</span>
          </>
        )}
      </div>

      {/* 4-column kanban */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLUMN_ORDER.map((status) => (
          <KanbanColumn
            key={status}
            label={COLUMN_LABEL[status]}
            invoices={grouped[status]}
            warn={status === 'OVERDUE'}
          />
        ))}
      </div>

      {totalCount === 0 && (
        <div className="border border-dashed border-[var(--color-border)] rounded-md py-16 text-center">
          <p className="text-sm text-[var(--color-muted)]">
            Nog geen facturen. Maak er een aan vanuit een engagement.
          </p>
        </div>
      )}
    </div>
  );
}

function KanbanColumn({
  label,
  invoices,
  warn,
}: {
  label: string;
  invoices: Invoice[];
  warn: boolean;
}) {
  return (
    <div
      className={cn(
        'border rounded-lg p-4 min-h-[400px]',
        warn
          ? 'bg-[#f4d95a]/5 border-[var(--color-gold)]/40'
          : 'bg-[var(--color-surface)] border-[var(--color-border)]',
      )}
    >
      {/* Column head */}
      <div className="flex items-baseline justify-between pb-3 mb-3 border-b border-[var(--color-border)]">
        <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-ink)]">
          {label}
        </span>
        <span
          className={cn(
            'text-[11px] font-medium px-2 py-0.5 rounded-full tabular-nums',
            warn
              ? 'bg-[#f4d95a]/25 text-[var(--color-ink)]'
              : 'bg-[var(--color-surface-2)] text-[var(--color-muted)]',
          )}
        >
          {invoices.length}
        </span>
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {invoices.length === 0 ? (
          <p className="text-[11px] text-[var(--color-muted)] py-2">—</p>
        ) : (
          invoices.map((inv) => <InvoiceCard key={inv.id} invoice={inv} />)
        )}
      </div>
    </div>
  );
}

function InvoiceCard({ invoice }: { invoice: Invoice }) {
  const klant =
    invoice.engagement.prospect.companyName ??
    invoice.engagement.prospect.domain;
  const dateStr = new Date(
    invoice.sentAt ?? invoice.createdAt,
  ).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit' });

  return (
    <Link
      href={`/admin/facturen/${invoice.id}`}
      className="block bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-3 hover:border-[var(--color-ink)] transition-colors"
    >
      <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--color-muted)] tabular-nums mb-1">
        {invoice.invoiceNumber}
      </div>
      <div className="text-[14px] font-medium text-[var(--color-ink)] leading-tight mb-2 truncate">
        {klant}
      </div>
      <div className="text-[18px] font-bold text-[var(--color-ink)] tabular-nums mb-2">
        {formatEur(invoice.amountCents)}
      </div>
      <div className="text-[11px] text-[var(--color-muted)] flex justify-between">
        <span className="truncate">{invoice.termijnLabel}</span>
        <span className="tabular-nums shrink-0 ml-2">{dateStr}</span>
      </div>
    </Link>
  );
}

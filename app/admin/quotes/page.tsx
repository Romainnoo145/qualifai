'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/components/providers';
import { PageLoader } from '@/components/ui/page-loader';
import { QuoteStatusBadge } from '@/components/features/quotes/quote-status-badge';
import { computeQuoteTotals, formatEuro } from '@/lib/quotes/quote-totals';
import type { QuoteStatus } from '@prisma/client';
import { cn } from '@/lib/utils';

type Row = {
  id: string;
  nummer: string;
  onderwerp: string;
  status: QuoteStatus;
  btwPercentage: number;
  createdAt: string | Date;
  isActiveProposal: boolean;
  lines: { uren: number; tarief: number }[];
  prospect: {
    id: string;
    slug: string;
    readableSlug: string | null;
    companyName: string | null;
  };
};

type Filter = 'ALL' | 'DRAFT' | 'SENT' | 'ACCEPTED' | 'ARCHIVED';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'Alles' },
  { key: 'DRAFT', label: 'Concept' },
  { key: 'SENT', label: 'Verstuurd' },
  { key: 'ACCEPTED', label: 'Geaccepteerd' },
  { key: 'ARCHIVED', label: 'Gearchiveerd' },
];

function matchesFilter(status: QuoteStatus, filter: Filter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'SENT')
    return ['SENT', 'VIEWED', 'EXPIRED', 'REJECTED'].includes(status);
  return status === filter;
}

export default function QuotesListPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list = (api.quotes.list as any).useQuery(undefined);
  const [filter, setFilter] = useState<Filter>('ALL');

  if (list.isLoading) {
    return <PageLoader label="Offertes laden" description="Eén moment." />;
  }

  if (list.error) {
    return (
      <p className="p-6 text-[13px] text-red-500">
        Fout bij laden: {String(list.error.message)}
      </p>
    );
  }

  const allRows: Row[] = (list.data ?? []) as Row[];
  const rows = allRows.filter((r) => matchesFilter(r.status, filter));

  return (
    <div className="max-w-[1400px] space-y-10">
      {/* Header */}
      <div className="flex items-baseline justify-between pb-6 border-b border-[var(--color-border)]">
        <h1 className="text-[48px] font-bold text-[var(--color-ink)] tracking-[-0.025em] leading-[1.05]">
          Offertes<span className="text-[var(--color-gold)]">.</span>
        </h1>
        <Link
          href="/admin/prospects"
          className="inline-flex items-center gap-2 px-6 py-2.5 text-[11px] font-medium uppercase tracking-[0.1em] bg-gradient-to-b from-[#e4c33c] to-[#f4d95a] text-[var(--color-ink)] border border-[#e4c33c] rounded-full"
        >
          + Nieuwe offerte
        </Link>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2">
        {FILTERS.map((f) => {
          const count =
            f.key === 'ALL'
              ? allRows.length
              : allRows.filter((r) => matchesFilter(r.status, f.key)).length;
          if (count === 0 && f.key !== 'ALL') return null;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'px-3.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.08em] rounded-md border transition-all',
                filter === f.key
                  ? 'bg-[var(--color-ink)] text-white border-[var(--color-ink)]'
                  : 'bg-transparent text-[var(--color-muted)] border-[var(--color-border)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]',
              )}
            >
              {f.label}
              <span className="ml-1 opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <p className="py-16 text-center text-[13px] font-light text-[var(--color-muted)]">
          Geen offertes met deze filter.
        </p>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left">
              {[
                'Nummer',
                'Bedrijf',
                'Onderwerp',
                'Status',
                'Bedrag',
                'Datum',
              ].map((col) => (
                <th
                  key={col}
                  className={cn(
                    'pb-2 pr-4 text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]',
                    (col === 'Bedrag' || col === 'Datum') && 'text-right',
                  )}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const totals = computeQuoteTotals(r.lines, r.btwPercentage);
              return (
                <tr
                  key={r.id}
                  className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-2)] transition-colors"
                >
                  <td className="py-3 pr-4">
                    <Link
                      href={`/admin/quotes/${r.id}`}
                      className="inline-flex items-center gap-2 font-medium text-[var(--color-ink)] hover:underline"
                    >
                      {r.isActiveProposal && (
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-[var(--color-gold)]"
                          title="Actief voorstel"
                        />
                      )}
                      {r.nummer}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-[var(--color-muted-dark)]">
                    {r.prospect.companyName ?? r.prospect.slug}
                  </td>
                  <td className="py-3 pr-4 text-[var(--color-muted-dark)] max-w-[260px] truncate">
                    {r.onderwerp}
                  </td>
                  <td className="py-3 pr-4">
                    <QuoteStatusBadge status={r.status} />
                  </td>
                  <td className="py-3 pr-4 text-right font-medium text-[var(--color-ink)] tabular-nums">
                    {formatEuro(totals.bruto)}
                  </td>
                  <td className="py-3 text-right text-[var(--color-muted)] tabular-nums text-[12px]">
                    {new Date(r.createdAt).toLocaleDateString('nl-NL')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

'use client';

/**
 * /admin/quotes — list page grouped by status.
 *
 * Sections in fixed order:
 *  - Concept (DRAFT, open)
 *  - Verstuurd (SENT/VIEWED/ACCEPTED/REJECTED/EXPIRED, open)
 *  - Gearchiveerd (ARCHIVED, collapsed by default via <details>)
 *
 * Row target is /admin/quotes/${id} (detail page ships in Plan 61-03).
 */

import Link from 'next/link';
import { api } from '@/components/providers';
import { PageLoader } from '@/components/ui/page-loader';
import { QuoteStatusBadge } from '@/components/features/quotes/quote-status-badge';
import { computeQuoteTotals, formatEuro } from '@/lib/quotes/quote-totals';
import type { QuoteStatus } from '@prisma/client';

// TODO: tRPC v11 inference gap — explicit Row type mirrors the list include
type Row = {
  id: string;
  nummer: string;
  onderwerp: string;
  status: QuoteStatus;
  btwPercentage: number;
  createdAt: string | Date;
  lines: { uren: number; tarief: number }[];
  prospect: {
    id: string;
    slug: string;
    readableSlug: string | null;
    companyName: string | null;
  };
};

const DRAFT_STATUSES: QuoteStatus[] = ['DRAFT'];
const SENT_STATUSES: QuoteStatus[] = [
  'SENT',
  'VIEWED',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
];
const ARCHIVED_STATUSES: QuoteStatus[] = ['ARCHIVED'];

export default function QuotesListPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list = (api.quotes.list as any).useQuery(undefined);

  if (list.isLoading) {
    return <PageLoader label="Offertes laden" description="Eén moment." />;
  }

  if (list.error) {
    return (
      <div className="glass-card p-10">
        <p className="text-xs font-bold text-red-500">
          Fout bij laden: {String(list.error.message)}
        </p>
      </div>
    );
  }

  const rows: Row[] = (list.data ?? []) as Row[];
  const draft = rows.filter((r) => DRAFT_STATUSES.includes(r.status));
  const sent = rows.filter((r) => SENT_STATUSES.includes(r.status));
  const archived = rows.filter((r) => ARCHIVED_STATUSES.includes(r.status));

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-4xl font-black tracking-tighter text-[#040026]">
          Offertes
        </h1>
        <p className="text-sm font-bold text-slate-400">
          Maak een nieuwe offerte vanuit een prospect-detailpagina.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <p className="text-sm font-bold text-slate-500">
            Nog geen offertes. Ga naar een prospect en klik &quot;Nieuwe
            offerte&quot;.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <QuoteSection title="Concept" rows={draft} defaultOpen />
          <QuoteSection title="Verstuurd" rows={sent} defaultOpen />
          <QuoteSection
            title="Gearchiveerd"
            rows={archived}
            defaultOpen={false}
          />
        </div>
      )}
    </div>
  );
}

function QuoteSection({
  title,
  rows,
  defaultOpen,
}: {
  title: string;
  rows: Row[];
  defaultOpen: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <details open={defaultOpen} className="glass-card p-6">
      <summary className="cursor-pointer text-lg font-black text-[#040026]">
        {title} ({rows.length})
      </summary>
      <div className="mt-4 space-y-3">
        {rows.map((r) => {
          const totals = computeQuoteTotals(r.lines, r.btwPercentage);
          return (
            <Link
              key={r.id}
              href={`/admin/quotes/${r.id}`}
              className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/40 p-4 hover:bg-slate-50"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="font-black text-[#040026]">{r.nummer}</span>
                  <QuoteStatusBadge status={r.status} />
                </div>
                <div className="text-sm text-slate-600">{r.onderwerp}</div>
                <div className="text-xs text-slate-400">
                  {r.prospect.companyName ?? r.prospect.slug}
                </div>
              </div>
              <div className="text-right">
                <div className="font-black text-[#040026]">
                  {formatEuro(totals.bruto)}
                </div>
                <div className="text-xs text-slate-400">
                  {new Date(r.createdAt).toLocaleDateString('nl-NL')}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </details>
  );
}

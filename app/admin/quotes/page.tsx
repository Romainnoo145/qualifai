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
  isActiveProposal: boolean;
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
      <div
        style={{
          background: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: '4px',
          padding: '24px',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: '#c0392b',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
          }}
        >
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
      {/* Header */}
      <header className="flex items-start justify-between gap-6">
        <div className="space-y-1">
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
              color: 'var(--color-muted)',
            }}
          >
            Overzicht
          </p>
          <h1
            className="text-3xl font-semibold"
            style={{
              color: 'var(--color-ink)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Offertes
            <span style={{ color: 'var(--color-gold)' }}>.</span>
          </h1>
        </div>
        <Link href="/admin/prospects" className="admin-btn-primary">
          + Nieuwe offerte
        </Link>
      </header>

      {rows.length === 0 ? (
        <div
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: '4px',
            padding: '48px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
              color: 'var(--color-muted)',
            }}
          >
            Nog geen offertes. Ga naar een prospect en klik &quot;Nieuwe
            offerte&quot;.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
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
    <details
      open={defaultOpen}
      style={{ border: '1px solid var(--color-border)', borderRadius: '4px' }}
    >
      {/* Section header */}
      <summary
        style={{
          cursor: 'pointer',
          padding: '14px 20px',
          borderRadius: '4px',
          listStyle: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
            color: 'var(--color-muted-dark)',
            fontWeight: 500,
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--color-muted)',
            letterSpacing: '0.12em',
          }}
        >
          {rows.length}
        </span>
      </summary>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr
              style={{
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              {(
                [
                  'Nummer',
                  'Bedrijf',
                  'Onderwerp',
                  'Status',
                  'Bedrag',
                  'Datum',
                ] as const
              ).map((col) => (
                <th
                  key={col}
                  style={{
                    padding: '10px 20px',
                    textAlign:
                      col === 'Bedrag' || col === 'Datum' ? 'right' : 'left',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.18em',
                    color: 'var(--color-ink)',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
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
                  style={{
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  {/* Nummer */}
                  <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                    <Link
                      href={`/admin/quotes/${r.id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        textDecoration: 'none',
                      }}
                    >
                      {r.isActiveProposal && (
                        <span
                          title="Actief voorstel"
                          style={{
                            display: 'inline-block',
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            background: 'var(--color-gold)',
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '12px',
                          fontWeight: 500,
                          color: 'var(--color-ink)',
                          letterSpacing: '0.04em',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {r.nummer}
                      </span>
                    </Link>
                  </td>

                  {/* Bedrijf */}
                  <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                    <Link
                      href={`/admin/quotes/${r.id}`}
                      style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: 'var(--color-ink)',
                        textDecoration: 'none',
                      }}
                    >
                      {r.prospect.companyName ?? r.prospect.slug}
                    </Link>
                  </td>

                  {/* Onderwerp */}
                  <td
                    style={{
                      padding: '14px 20px',
                      fontSize: '13px',
                      color: 'var(--color-muted-dark)',
                      maxWidth: '280px',
                    }}
                  >
                    <Link
                      href={`/admin/quotes/${r.id}`}
                      style={{
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: 'inherit',
                        textDecoration: 'none',
                      }}
                    >
                      {r.onderwerp}
                    </Link>
                  </td>

                  {/* Status */}
                  <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                    <QuoteStatusBadge status={r.status} />
                  </td>

                  {/* Bedrag */}
                  <td
                    style={{
                      padding: '14px 20px',
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Link
                      href={`/admin/quotes/${r.id}`}
                      style={{ textDecoration: 'none' }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: 'var(--color-ink)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatEuro(totals.bruto)}
                      </span>
                    </Link>
                  </td>

                  {/* Datum */}
                  <td
                    style={{
                      padding: '14px 20px',
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: 'var(--color-muted)',
                        letterSpacing: '0.06em',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {new Date(r.createdAt).toLocaleDateString('nl-NL')}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

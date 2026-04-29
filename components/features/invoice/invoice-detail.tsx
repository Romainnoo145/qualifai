'use client';

import Link from 'next/link';
import { api } from '@/components/providers';
import { InvoiceActions } from './invoice-actions';
import { useDelayedLoading } from '@/lib/hooks/use-delayed-loading';
import { InvoiceDetailSkeleton } from './invoice-detail-skeleton';
import { KLARIFAI_BUSINESS } from '@/lib/klarifai-business';

const formatEur = (cents: number) =>
  (cents / 100).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' });

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Concept',
  SENT: 'Verzonden',
  PAID: 'Betaald',
  OVERDUE: 'Vervallen',
  CANCELLED: 'Geannuleerd',
};

export function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  // TODO: tRPC v11 inference gap — invoice.getById
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, isLoading, refetch } = (api.invoice.getById as any).useQuery({
    invoiceId,
  });

  // TODO: tRPC v11 inference gap — invoice.update
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateMut = (api.invoice.update as any).useMutation({
    onSuccess: () => refetch(),
  });

  const showSkeleton = useDelayedLoading(isLoading);
  if (isLoading) return showSkeleton ? <InvoiceDetailSkeleton /> : null;
  if (!data)
    return (
      <div className="p-6 text-[13px] text-[var(--color-muted)]">
        Factuur niet gevonden.
      </div>
    );

  const isDraft = data.status === 'DRAFT';
  const subtotalCents = data.amountCents as number;
  const vatCents = Math.round(
    subtotalCents * ((data.vatPercentage as number) / 100),
  );
  const totalCents = subtotalCents + vatCents;

  const klant =
    (data.engagement.prospect.companyName as string | null) ??
    (data.engagement.prospect.domain as string);
  const klantCity = data.engagement.prospect.city as string | null;

  const dateStr = (d: Date | string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('nl-NL') : '—';

  return (
    <div>
      {/* Breadcrumb */}
      <div className="text-[11px] uppercase tracking-[0.1em] text-[var(--color-muted)] font-medium mb-6">
        <Link href="/admin/facturen" className="hover:text-[var(--color-ink)]">
          Facturen
        </Link>
        <span className="opacity-40 mx-2">/</span>
        <span>{data.invoiceNumber}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-10 max-w-[1300px]">
        {/* Document — paper-style, mimics the printable PDF */}
        <article className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-12 lg:p-16 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_20px_rgba(0,0,0,0.04)]">
          {/* Doc head: sender (left) + meta + status (right) */}
          <header className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-10 pb-8 mb-8 border-b-2 border-[var(--color-ink)]">
            <div>
              <div className="text-[22px] font-bold tracking-[-0.02em] mb-3">
                {KLARIFAI_BUSINESS.name}
                <span className="text-[var(--color-gold)]">.</span>
              </div>
              <div className="text-[11px] text-[var(--color-muted)] leading-[1.6]">
                {KLARIFAI_BUSINESS.street}
                <br />
                {KLARIFAI_BUSINESS.postal} {KLARIFAI_BUSINESS.city}
                <br />
                KvK {KLARIFAI_BUSINESS.kvk} · BTW {KLARIFAI_BUSINESS.btw}
                <br />
                {KLARIFAI_BUSINESS.email}
              </div>
            </div>
            <div className="md:text-right">
              <h1 className="text-[28px] font-bold tracking-[-0.02em] mb-3 tabular-nums">
                Factuur {data.invoiceNumber as string}
              </h1>
              <div className="text-[11px] text-[var(--color-muted)] leading-[1.6]">
                <div>
                  <strong className="text-[var(--color-ink)] font-medium">
                    Datum:
                  </strong>{' '}
                  {dateStr(data.sentAt ?? data.createdAt)}
                </div>
                <div>
                  <strong className="text-[var(--color-ink)] font-medium">
                    Vervaldatum:
                  </strong>{' '}
                  {dateStr(data.dueAt)}
                </div>
              </div>
              <div className="mt-3 inline-block px-3 py-1 text-[10px] font-medium uppercase tracking-[0.1em] bg-[#f4d95a]/18 text-[var(--color-ink)] border border-[var(--color-gold)]/40 rounded-full">
                {STATUS_LABELS[data.status as string] ?? data.status}
              </div>
            </div>
          </header>

          {/* Aan: klant block */}
          <section className="mb-9">
            <div className="text-[9px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)] mb-2">
              Aan
            </div>
            <div className="text-[16px] font-medium text-[var(--color-ink)] mb-1">
              {klant}
            </div>
            <div className="text-[12px] text-[var(--color-muted)] leading-[1.6]">
              {klantCity ? `${klantCity}, ` : ''}
              {data.engagement.prospect.country ?? 'Nederland'}
              {data.engagement.prospect.domain && (
                <>
                  <br />
                  {data.engagement.prospect.domain}
                </>
              )}
            </div>
            {(data.engagement.quote as { nummer?: string | null }).nummer && (
              <p className="mt-3 text-[12px] text-[var(--color-muted)]">
                Conform offerte{' '}
                <span className="text-[var(--color-ink)] font-medium">
                  {(data.engagement.quote as { nummer: string }).nummer}
                </span>
              </p>
            )}
          </section>

          {/* Lines table */}
          <table className="w-full border-collapse mb-6">
            <thead>
              <tr>
                <th className="py-2.5 px-3 text-left text-[9px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)] border-b border-[var(--color-ink)]">
                  Omschrijving
                </th>
                <th className="py-2.5 px-3 text-right text-[9px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)] border-b border-[var(--color-ink)] w-[80px]">
                  Aantal
                </th>
                <th className="py-2.5 px-3 text-right text-[9px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)] border-b border-[var(--color-ink)] w-[120px]">
                  Tarief
                </th>
                <th className="py-2.5 px-3 text-right text-[9px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)] border-b border-[var(--color-ink)] w-[120px]">
                  Totaal
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-3.5 px-3 text-[13px] text-[var(--color-ink)] border-b border-[var(--color-border)]">
                  {isDraft ? (
                    <input
                      type="text"
                      defaultValue={data.termijnLabel as string}
                      onBlur={(e) => {
                        if (e.target.value !== (data.termijnLabel as string)) {
                          updateMut.mutate({
                            invoiceId,
                            termijnLabel: e.target.value,
                          });
                        }
                      }}
                      className="input-minimal w-full text-[13px]"
                    />
                  ) : (
                    (data.termijnLabel as string)
                  )}
                </td>
                <td className="py-3.5 px-3 text-right text-[13px] text-[var(--color-ink)] border-b border-[var(--color-border)] tabular-nums">
                  1
                </td>
                <td className="py-3.5 px-3 text-right text-[13px] text-[var(--color-ink)] border-b border-[var(--color-border)] tabular-nums">
                  {formatEur(subtotalCents)}
                </td>
                <td className="py-3.5 px-3 text-right text-[13px] text-[var(--color-ink)] border-b border-[var(--color-border)] tabular-nums">
                  {formatEur(subtotalCents)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Totals — right-aligned half-width */}
          <div className="ml-auto w-full md:w-1/2 py-2">
            <div className="flex justify-between py-1.5 text-[13px] text-[var(--color-muted-dark)] tabular-nums">
              <span>Subtotaal</span>
              <span>{formatEur(subtotalCents)}</span>
            </div>
            <div className="flex justify-between py-1.5 text-[13px] text-[var(--color-muted)] tabular-nums">
              <span>BTW {data.vatPercentage as number}%</span>
              <span>{formatEur(vatCents)}</span>
            </div>
            <div className="flex justify-between mt-2 pt-3 text-[16px] font-bold text-[var(--color-ink)] border-t-2 border-[var(--color-ink)] tabular-nums">
              <span>Totaal</span>
              <span>{formatEur(totalCents)}</span>
            </div>
          </div>

          {/* Notitie (intern/voor klant) */}
          {(isDraft ||
            ((data.notes as string | null) ?? '').trim().length > 0) && (
            <section className="mt-10 pt-6 border-t border-[var(--color-border)]">
              <div className="text-[9px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)] mb-2">
                Notitie
              </div>
              <textarea
                defaultValue={(data.notes as string | null) ?? ''}
                disabled={!isDraft}
                onBlur={(e) => {
                  if (
                    e.target.value !== ((data.notes as string | null) ?? '')
                  ) {
                    updateMut.mutate({ invoiceId, notes: e.target.value });
                  }
                }}
                className="input-minimal w-full text-[13px] min-h-[60px] resize-none disabled:opacity-50"
                placeholder={
                  isDraft ? 'Optionele notitie (intern of voor klant)' : ''
                }
              />
            </section>
          )}

          {/* Footer payment terms */}
          <footer className="mt-12 pt-6 border-t border-[var(--color-border)] text-[11px] text-[var(--color-muted)] leading-[1.6]">
            Betaling binnen 30 dagen op IBAN{' '}
            <span className="text-[var(--color-ink)] font-medium">
              {KLARIFAI_BUSINESS.iban}
            </span>{' '}
            t.n.v. {KLARIFAI_BUSINESS.name}. Vermeld factuurnummer{' '}
            <span className="text-[var(--color-ink)] font-medium tabular-nums">
              {data.invoiceNumber as string}
            </span>
            .
          </footer>
        </article>

        {/* Action sidebar */}
        <aside>
          <InvoiceActions invoice={data} onChange={refetch} />

          {/* Meta block */}
          <div className="mt-6 pt-4 border-t border-[var(--color-border)] space-y-2 text-[11px] text-[var(--color-muted)]">
            <div className="flex justify-between">
              <span>Aangemaakt</span>
              <span className="text-[var(--color-ink)] font-medium tabular-nums">
                {dateStr(data.createdAt)}
              </span>
            </div>
            {(data.sentAt as Date | null) && (
              <div className="flex justify-between">
                <span>Verzonden</span>
                <span className="text-[var(--color-ink)] font-medium tabular-nums">
                  {dateStr(data.sentAt)}
                </span>
              </div>
            )}
            {(data.dueAt as Date | null) && (
              <div className="flex justify-between">
                <span>Vervalt</span>
                <span className="text-[var(--color-ink)] font-medium tabular-nums">
                  {dateStr(data.dueAt)}
                </span>
              </div>
            )}
            {(data.paidAt as Date | null) && (
              <div className="flex justify-between">
                <span>Betaald</span>
                <span className="text-[var(--color-ink)] font-medium tabular-nums">
                  {dateStr(data.paidAt)}
                </span>
              </div>
            )}
            {(data.pdfUrl as string | null) && (
              <div className="pt-2">
                <a
                  href={data.pdfUrl as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-ink)] underline hover:text-[var(--color-gold)]"
                >
                  PDF downloaden
                </a>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

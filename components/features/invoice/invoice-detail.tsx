'use client';

import { api } from '@/components/providers';
import { InvoiceActions } from './invoice-actions';
import { useDelayedLoading } from '@/lib/hooks/use-delayed-loading';
import { InvoiceDetailSkeleton } from './invoice-detail-skeleton';

const formatEur = (cents: number) =>
  (cents / 100).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' });

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Concept',
  SENT: 'Verzonden',
  PAID: 'Betaald',
  OVERDUE: 'Vervallen',
  CANCELLED: 'Geannuleerd',
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'text-zinc-700 bg-zinc-100',
  SENT: 'text-blue-700 bg-blue-50',
  PAID: 'text-green-700 bg-green-50',
  OVERDUE: 'text-red-700 bg-red-50',
  CANCELLED: 'text-zinc-500 bg-zinc-50',
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

  return (
    <div className="grid grid-cols-[1fr_280px] gap-10 p-6 max-w-[1400px]">
      <main className="space-y-8">
        {/* Header */}
        <header className="pb-5 border-b border-[var(--color-border)]">
          <div className="flex items-baseline gap-3">
            <h1 className="font-['Sora'] text-[28px] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--color-ink)]">
              {data.invoiceNumber as string}
              <span className="text-[var(--color-gold)]">.</span>
            </h1>
            <span
              className={`text-[10px] font-medium uppercase tracking-[0.08em] px-2 py-0.5 rounded ${STATUS_COLOR[data.status as string] ?? ''}`}
            >
              {STATUS_LABELS[data.status as string] ?? (data.status as string)}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-[var(--color-muted)]">
            {formatEur(totalCents)} incl. BTW &nbsp;·&nbsp; {klant}
          </p>
        </header>

        {/* Klant */}
        <section className="space-y-1.5">
          <span className="block text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)]">
            Klant
          </span>
          <p className="text-[13px] text-[var(--color-ink)]">{klant}</p>
          {(data.engagement.quote as { nummer?: string | null }).nummer && (
            <p className="text-[12px] text-[var(--color-muted)]">
              Conform offerte{' '}
              {(data.engagement.quote as { nummer: string }).nummer}
            </p>
          )}
        </section>

        {/* Termijn */}
        <section className="space-y-1.5">
          <span className="block text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)]">
            Termijn
          </span>
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
            <p className="text-[13px] text-[var(--color-ink)]">
              {data.termijnLabel as string}
            </p>
          )}
        </section>

        {/* Bedragen */}
        <section className="space-y-1.5">
          <span className="block text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)]">
            Bedragen
          </span>
          <div className="text-[13px] space-y-1 max-w-xs">
            <div className="flex justify-between">
              <span className="text-[var(--color-muted-dark)]">Subtotaal</span>
              <span className="text-[var(--color-ink)]">
                {formatEur(subtotalCents)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-muted)]">
                BTW {data.vatPercentage as number}%
              </span>
              <span className="text-[var(--color-muted)]">
                {formatEur(vatCents)}
              </span>
            </div>
            <div className="flex justify-between font-medium pt-2 border-t border-[var(--color-border)]">
              <span className="text-[var(--color-ink)]">Totaal</span>
              <span className="text-[var(--color-ink)]">
                {formatEur(totalCents)}
              </span>
            </div>
          </div>
        </section>

        {/* Notitie */}
        <section className="space-y-1.5">
          <span className="block text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)]">
            Notitie
          </span>
          <textarea
            defaultValue={(data.notes as string | null) ?? ''}
            disabled={!isDraft}
            onBlur={(e) => {
              if (e.target.value !== ((data.notes as string | null) ?? '')) {
                updateMut.mutate({ invoiceId, notes: e.target.value });
              }
            }}
            className="input-minimal w-full text-[13px] min-h-[80px] resize-none disabled:opacity-50"
            placeholder={
              isDraft ? 'Optionele notitie (intern of voor klant)' : ''
            }
          />
        </section>

        {/* Tijdlijn */}
        {(data.sentAt as Date | null) && (
          <section className="space-y-1 text-[12px] text-[var(--color-muted)] border-t border-[var(--color-border)] pt-4">
            <div>
              Verzonden:{' '}
              {new Date(data.sentAt as Date).toLocaleDateString('nl-NL')}
            </div>
            {(data.dueAt as Date | null) && (
              <div>
                Vervaldatum:{' '}
                {new Date(data.dueAt as Date).toLocaleDateString('nl-NL')}
              </div>
            )}
            {(data.paidAt as Date | null) && (
              <div>
                Betaald:{' '}
                {new Date(data.paidAt as Date).toLocaleDateString('nl-NL')}
              </div>
            )}
          </section>
        )}
      </main>

      <aside>
        <InvoiceActions invoice={data} onChange={refetch} />
      </aside>
    </div>
  );
}

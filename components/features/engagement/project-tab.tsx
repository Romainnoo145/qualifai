'use client';

import { api } from '@/components/providers';
import { computeQuoteTotals, formatEuro } from '@/lib/quotes/quote-totals';
import { KickoffBlock } from './kickoff-block';
import { MilestoneChecklist } from './milestone-checklist';
import { InvoiceQueue } from './invoice-queue';

export function ProjectTab({ prospectId }: { prospectId: string }) {
  // TODO: tRPC v11 inference gap — engagement.getByProspect

  const {
    data: engagement,
    isLoading,
    refetch,
  } = (api.engagement.getByProspect as any).useQuery({ prospectId });

  if (isLoading) {
    return (
      <div className="text-[13px] text-[var(--color-muted)]">
        Project laden…
      </div>
    );
  }

  if (!engagement) {
    return (
      <div className="text-[13px] text-[var(--color-muted-dark)]">
        Project verschijnt zodra een offerte is geaccepteerd.
      </div>
    );
  }

  const totals = computeQuoteTotals(
    engagement.quote.lines,
    engagement.quote.btwPercentage,
  );
  const totalEur = formatEuro(totals.bruto);

  return (
    <div className="space-y-8 max-w-2xl">
      <header className="space-y-1">
        <h2 className="font-['Sora'] text-[20px] font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
          Project
          <span className="text-[var(--color-gold-hi)]">.</span>
        </h2>
        <p className="text-[13px] text-[var(--color-muted-dark)]">
          Offerte {engagement.quote.nummer ?? engagement.quote.id} · {totalEur}{' '}
          incl. BTW · geaccepteerd op{' '}
          {new Date(engagement.acceptedAt).toLocaleDateString('nl-NL')}
        </p>
      </header>

      <KickoffBlock engagement={engagement} />
      <MilestoneChecklist
        milestones={engagement.milestones}
        onChange={refetch}
      />
      <InvoiceQueue engagement={engagement} onChange={refetch} />
    </div>
  );
}

'use client';

import { api } from '@/components/providers';
import { computeQuoteTotals, formatEuro } from '@/lib/quotes/quote-totals';

export function ProjectTab({ prospectId }: { prospectId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: engagement, isLoading } = (
    api.engagement.getByProspect as any
  ).useQuery({ prospectId }) as {
    data: EngagementData | null | undefined;
    isLoading: boolean;
  };

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

  // uren * tarief = euros (tarief is signed int in euros, negative for discounts)
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
          Offerte {engagement.quote.nummer} · {totalEur} · geaccepteerd op{' '}
          {new Date(engagement.acceptedAt).toLocaleDateString('nl-NL')}
        </p>
      </header>

      <section>
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)] block mb-2">
          Kickoff
        </span>
        <p className="text-[14px] text-[var(--color-ink)]">
          {engagement.kickoffBookedAt
            ? `Geboekt op ${new Date(engagement.kickoffBookedAt).toLocaleDateString('nl-NL')}`
            : 'Nog niet geboekt'}
        </p>
        {engagement.kickoffReminderCount > 0 && (
          <p className="text-[12px] text-[var(--color-muted)] mt-1">
            {engagement.kickoffReminderCount} herinnering(en) verzonden
          </p>
        )}
      </section>

      <section>
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)] block mb-2">
          Milestones
        </span>
        {engagement.milestones.length === 0 ? (
          <p className="text-[13px] text-[var(--color-muted)]">
            Nog geen milestones.
          </p>
        ) : (
          <ul className="space-y-2">
            {engagement.milestones.map((m: Milestone) => (
              <li key={m.id} className="flex items-center gap-3 text-[13px]">
                <span
                  className={
                    m.completedAt
                      ? 'text-[var(--color-gold-hi)] font-medium'
                      : 'text-[var(--color-muted)]'
                  }
                >
                  {m.completedAt ? '✓' : '○'}
                </span>
                <span className="text-[var(--color-ink)]">{m.label}</span>
                {m.completedAt && (
                  <span className="text-[var(--color-muted)] text-[12px]">
                    {new Date(m.completedAt).toLocaleDateString('nl-NL')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)] block mb-2">
          Facturen
        </span>
        <p className="text-[13px] text-[var(--color-muted)]">
          Invoice queue volgt in Wave B.
        </p>
      </section>
    </div>
  );
}

// ── Local types (mirrors Prisma return shape) ──────────────────────────

type QuoteLine = {
  uren: number;
  tarief: number;
};

type Milestone = {
  id: string;
  label: string;
  completedAt: Date | string | null;
};

type EngagementData = {
  id: string;
  acceptedAt: Date | string;
  kickoffBookedAt: Date | string | null;
  kickoffReminderCount: number;
  quote: {
    id: string;
    nummer: string;
    btwPercentage: number;
    lines: QuoteLine[];
  };
  milestones: Milestone[];
};

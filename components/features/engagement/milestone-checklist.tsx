'use client';

import { api } from '@/components/providers';

type Milestone = {
  id: string;
  label: string;
  completedAt: Date | string | null;
  ordering: number;
};

export function MilestoneChecklist({
  milestones,
  onChange,
}: {
  milestones: Milestone[];
  onChange: () => void;
}) {
  // TODO: tRPC v11 inference gap — engagement.completeMilestone
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const completeMut = (api.engagement.completeMilestone as any).useMutation({
    onSuccess: onChange,
  });

  return (
    <section className="space-y-2">
      <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)]">
        Milestones
      </span>
      {milestones.length === 0 ? (
        <p className="text-[13px] text-[var(--color-muted)]">
          Nog geen milestones.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {milestones.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={!!m.completedAt}
                onChange={(e) =>
                  completeMut.mutate({
                    milestoneId: m.id,
                    completed: e.target.checked,
                  })
                }
                className="accent-[var(--color-gold)]"
              />
              <span className="text-[var(--color-ink)]">{m.label}</span>
              {m.completedAt && (
                <span className="text-[var(--color-muted)] text-[12px] ml-auto">
                  {new Date(m.completedAt).toLocaleDateString('nl-NL')}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

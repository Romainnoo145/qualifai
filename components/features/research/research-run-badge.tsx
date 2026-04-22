'use client';

import type { ResearchStatus } from '@prisma/client';
import { isActiveStatus, statusLabel } from '@/lib/research/status-labels';

interface Props {
  status: ResearchStatus | string | null | undefined;
}

export function ResearchRunBadge({ status }: Props) {
  if (!isActiveStatus(status)) return null;

  const label = statusLabel(status) ?? 'bezig';

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={`Onderzoek loopt: ${label}`}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-ink)] bg-[var(--color-gold)]/15 border border-[var(--color-gold)]/40 animate-klarifai-pulse"
    >
      <span
        className="h-1.5 w-1.5 rounded-full bg-[var(--color-gold)]"
        aria-hidden="true"
      />
      onderzoek loopt
    </span>
  );
}

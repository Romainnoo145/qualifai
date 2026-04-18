/**
 * QuoteStatusBadge — Dutch-labeled status chip for a Quote.
 */

import type { QuoteStatus } from '@prisma/client';

const LABELS: Record<QuoteStatus, string> = {
  DRAFT: 'Concept',
  SENT: 'Verstuurd',
  VIEWED: 'Bekeken',
  ACCEPTED: 'Geaccepteerd',
  REJECTED: 'Afgewezen',
  EXPIRED: 'Verlopen',
  ARCHIVED: 'Gearchiveerd',
};

const CLASSES: Record<QuoteStatus, string> = {
  DRAFT: 'bg-[var(--color-surface-2)] text-[var(--color-muted-dark)]',
  SENT: 'bg-[var(--color-tag-run-bg)] text-[var(--color-tag-run-text)]',
  VIEWED:
    'bg-[var(--color-tag-outreach-bg)] text-[var(--color-tag-outreach-text)]',
  ACCEPTED:
    'bg-[var(--color-tag-enrich-bg)] text-[var(--color-tag-enrich-text)]',
  REJECTED: 'bg-red-50 text-red-600',
  EXPIRED:
    'bg-[var(--color-tag-quality-bg)] text-[var(--color-tag-quality-text)]',
  ARCHIVED: 'bg-[var(--color-surface-2)] text-[var(--color-muted)]',
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${CLASSES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}

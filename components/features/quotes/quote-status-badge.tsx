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
  DRAFT: 'bg-slate-100 text-slate-700',
  SENT: 'bg-blue-100 text-blue-700',
  VIEWED: 'bg-indigo-100 text-indigo-700',
  ACCEPTED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-amber-100 text-amber-700',
  ARCHIVED: 'bg-slate-50 text-slate-400',
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${CLASSES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}

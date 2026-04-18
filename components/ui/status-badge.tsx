'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: string;
  label?: string; // optional override
}

const STATUS_CLASS_MAP: Record<string, string> = {
  // Positive / green tint
  READY: 'admin-state-success',
  CONVERTED: 'admin-state-success',
  ACCEPTED: 'admin-state-success',
  VIEWED: 'admin-state-success',
  COMPLETED: 'admin-state-success',
  LOW_RISK: 'admin-state-success',
  // Amber / pending
  DRAFT: 'admin-state-warning',
  SENT: 'admin-state-warning',
  GENERATING: 'admin-state-warning',
  NEEDS_REVIEW: 'admin-state-warning',
  QUOTE_SENT: 'admin-state-warning',
  EXPIRED: 'admin-state-warning',
  // Red / negative
  BLOCKED: 'admin-state-danger',
  REJECTED: 'admin-state-danger',
  FAILED: 'admin-state-danger',
  // Neutral
  ARCHIVED: 'admin-state-neutral',
  ENRICHED: 'admin-state-neutral',
  IMPORTED: 'admin-state-neutral',
  // Info / active
  ENGAGED: 'admin-state-info',
  RESEARCHING: 'admin-state-info',
  // Accent
  OUTREACH: 'admin-state-accent',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Concept',
  SENT: 'Verstuurd',
  VIEWED: 'Bekeken',
  ACCEPTED: 'Geaccepteerd',
  REJECTED: 'Afgewezen',
  EXPIRED: 'Verlopen',
  ARCHIVED: 'Gearchiveerd',
  READY: 'Ready',
  CONVERTED: 'Geconverteerd',
  ENGAGED: 'Engaged',
  ENRICHED: 'Enriched',
  GENERATING: 'Bezig...',
  IMPORTED: 'Imported',
  RESEARCHING: 'Researching',
  QUOTE_SENT: 'Offerte verstuurd',
  BLOCKED: 'Geblokkeerd',
  FAILED: 'Mislukt',
  NEEDS_REVIEW: 'Review nodig',
  LOW_RISK: 'Laag risico',
  COMPLETED: 'Voltooid',
  OUTREACH: 'Outreach',
};

const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, status, label, ...props }, ref) => {
    const stateClass = STATUS_CLASS_MAP[status] ?? 'admin-state-neutral';
    const displayLabel = label ?? STATUS_LABELS[status] ?? status;
    return (
      <span
        ref={ref}
        className={cn('admin-state-pill', stateClass, className)}
        {...props}
      >
        {displayLabel}
      </span>
    );
  },
);

StatusBadge.displayName = 'StatusBadge';

export { StatusBadge };
export type { StatusBadgeProps };

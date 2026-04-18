'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type StatusType =
  | 'DRAFT'
  | 'ENRICHED'
  | 'GENERATING'
  | 'READY'
  | 'SENT'
  | 'VIEWED'
  | 'ENGAGED'
  | 'CONVERTED'
  | 'ARCHIVED'
  | 'LOW_RISK'
  | 'NEEDS_REVIEW'
  | 'BLOCKED';

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: string | StatusType;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: {
    label: 'Draft',
    className: 'bg-slate-50 text-slate-400 border-slate-100',
  },
  ENRICHED: {
    label: 'Enriched',
    className: 'bg-blue-50 text-blue-500 border-blue-100',
  },
  GENERATING: {
    label: 'Generating',
    className: 'bg-[#EBCB4B]/10 text-[#040026] border-[#EBCB4B]/20',
  },
  READY: {
    label: 'Ready',
    className: 'bg-emerald-50 text-emerald-500 border-emerald-100',
  },
  SENT: {
    label: 'Sent',
    className: 'bg-[#040026]/5 text-[#040026] border-[#040026]/10',
  },
  VIEWED: {
    label: 'Viewed',
    className: 'bg-cyan-50 text-cyan-500 border-cyan-100',
  },
  ENGAGED: {
    label: 'Engaged',
    className: 'bg-purple-50 text-purple-500 border-purple-100',
  },
  CONVERTED: {
    label: 'Converted',
    className: 'bg-[#EBCB4B] text-[#040026] border-[#EBCB4B]',
  },
  ARCHIVED: {
    label: 'Archived',
    className: 'bg-slate-50 text-slate-300 border-slate-100',
  },
  LOW_RISK: {
    label: 'Low Risk',
    className: 'bg-emerald-50 text-emerald-500 border-emerald-100',
  },
  NEEDS_REVIEW: {
    label: 'Needs Review',
    className: 'bg-[#EBCB4B]/10 text-[#040026] border-[#EBCB4B]/20',
  },
  BLOCKED: {
    label: 'Blocked',
    className: 'bg-red-50 text-red-500 border-red-100',
  },
};

const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, status, ...props }, ref) => {
    const config = statusConfig[status] || {
      label: status,
      className: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider',
          config.className,
          className,
        )}
        {...props}
      >
        {config.label}
      </span>
    );
  },
);

StatusBadge.displayName = 'StatusBadge';

export { StatusBadge };

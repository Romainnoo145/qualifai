'use client';

import { api } from '@/components/providers';
import {
  Mail,
  Phone,
  Linkedin,
  MessageCircle,
  Globe,
  Loader2,
} from 'lucide-react';

interface CadenceTabProps {
  prospectId: string;
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function channelIcon(channel: string) {
  switch (channel) {
    case 'email':
      return <Mail className="w-4 h-4 text-slate-400" />;
    case 'call':
      return <Phone className="w-4 h-4 text-slate-400" />;
    case 'linkedin':
      return <Linkedin className="w-4 h-4 text-slate-400" />;
    case 'whatsapp':
      return <MessageCircle className="w-4 h-4 text-slate-400" />;
    default:
      return <Globe className="w-4 h-4 text-slate-400" />;
  }
}

function statusBadge(status: string) {
  switch (status) {
    case 'DRAFTED':
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 font-black uppercase tracking-widest">
          Drafted
        </span>
      );
    case 'QUEUED':
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-black uppercase tracking-widest">
          Queued
        </span>
      );
    case 'SENT':
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-black uppercase tracking-widest">
          Sent
        </span>
      );
    case 'CLOSED_LOST':
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-black uppercase tracking-widest">
          Closed Lost
        </span>
      );
    default:
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-black uppercase tracking-widest">
          {status}
        </span>
      );
  }
}

function metadataChannel(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata))
    return 'email';
  return ((metadata as Record<string, unknown>).channel as string) ?? 'email';
}

interface StepItem {
  id: string;
  stepOrder: number;
  status: string;
  scheduledAt: Date | string | null;
  triggeredBy: string | null;
  nextStepReadyAt: Date | string | null;
  sentAt: Date | string | null;
  metadata: unknown;
  createdAt: Date | string;
  isPending?: boolean;
}

function TimelineItem({ step }: { step: StepItem }) {
  const channel = metadataChannel(step.metadata);
  const displayDate =
    step.status === 'SENT' || step.status === 'QUEUED'
      ? (step.sentAt ?? step.scheduledAt)
      : (step.nextStepReadyAt ?? step.scheduledAt);

  return (
    <div
      className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${
        step.isPending
          ? 'border-blue-200 bg-blue-50/50'
          : 'border-slate-100 bg-white'
      }`}
    >
      {/* Pulse dot for pending */}
      <div className="flex-shrink-0 mt-0.5">
        {step.isPending ? (
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
          </span>
        ) : (
          <span className="inline-flex h-3 w-3 rounded-full bg-slate-200" />
        )}
      </div>

      {/* Channel icon */}
      <div className="flex-shrink-0">{channelIcon(channel)}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-xs font-black text-slate-700 uppercase tracking-widest">
            {channel}
          </span>
          {statusBadge(step.status)}
          {step.triggeredBy && (
            <span className="text-[10px] text-slate-400 font-mono">
              via {step.triggeredBy}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400">
          {formatDate(displayDate)}
        </span>
      </div>
    </div>
  );
}

export function CadenceTab({ prospectId }: CadenceTabProps) {
  const cadence = api.sequences.getCadenceState.useQuery({ prospectId });

  if (cadence.isLoading) {
    return (
      <div className="flex items-center gap-3 text-slate-400 text-sm py-8">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading cadence data...
      </div>
    );
  }

  const data = cadence.data;
  if (!data || data.sequences.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <p className="text-sm text-slate-500">
          No cadence history for this prospect. Cadence starts after the first
          outreach sequence is sent.
        </p>
      </div>
    );
  }

  const { sequences, engagementLevel, summary } = data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seqs = sequences as any[];
  const isExhausted = seqs.every(
    (s: { status: string }) => s.status === 'CLOSED_LOST',
  );
  const activeSeq = seqs.find(
    (s: { status: string }) => s.status !== 'CLOSED_LOST',
  ) as { id: string; steps: StepItem[] } | undefined;
  const totalTouches = summary.touchCount;

  // Build flat timeline across all sequences ordered by stepOrder within sequence
  const allSteps: StepItem[] = seqs.flatMap(
    (seq: { id: string; steps: StepItem[] }) => {
      const firstDraftedIdx = seq.steps.findIndex(
        (s) => s.status === 'DRAFTED',
      );
      return seq.steps.map((step, idx) => ({
        ...step,
        isPending:
          seq.id === activeSeq?.id &&
          step.status === 'DRAFTED' &&
          idx === firstDraftedIdx,
      }));
    },
  );

  return (
    <div className="space-y-8">
      {/* Summary card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Engagement level */}
          {engagementLevel === 'high' ? (
            <span className="text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              High Engagement
            </span>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              Normal
            </span>
          )}

          {/* Status */}
          {isExhausted ? (
            <span className="text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full bg-red-50 text-red-700 border border-red-200">
              Exhausted (closed lost)
            </span>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Active
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Touch count */}
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
              Touches Completed
            </p>
            <p className="text-sm font-black text-slate-900">
              {totalTouches} of {allSteps.length} touches
            </p>
          </div>

          {/* Next step */}
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
              Next Step
            </p>
            {summary.hasPendingStep && summary.nextStepReadyAt ? (
              <p className="text-sm font-black text-slate-900">
                {summary.nextChannel ?? 'touch'} scheduled for{' '}
                {formatDate(summary.nextStepReadyAt)}
              </p>
            ) : (
              <p className="text-sm text-slate-400">No pending step</p>
            )}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div>
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
          Touch Timeline
        </h3>
        <div className="space-y-2">
          {allSteps.map((step) => (
            <TimelineItem key={step.id} step={step} />
          ))}
        </div>
      </div>
    </div>
  );
}

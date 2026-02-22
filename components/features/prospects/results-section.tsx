'use client';

import { api } from '@/components/providers';
import {
  Mail,
  Phone,
  Linkedin,
  MessageCircle,
  Globe,
  Calendar,
  FileText,
} from 'lucide-react';

function fmt(date: Date | string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function channelIcon(channel: string) {
  const cls = 'w-4 h-4 text-slate-400';
  switch (channel) {
    case 'email':
      return <Mail className={cls} />;
    case 'call':
      return <Phone className={cls} />;
    case 'linkedin':
      return <Linkedin className={cls} />;
    case 'whatsapp':
      return <MessageCircle className={cls} />;
    default:
      return <Globe className={cls} />;
  }
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    DRAFTED: 'bg-yellow-50 text-yellow-700',
    QUEUED: 'bg-blue-50 text-blue-700',
    SENT: 'bg-emerald-50 text-emerald-700',
    CLOSED_LOST: 'bg-red-50 text-red-700',
  };
  const label: Record<string, string> = { CLOSED_LOST: 'Closed Lost' };
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${map[status] ?? 'bg-slate-100 text-slate-600'}`}
    >
      {label[status] ?? status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function metaCh(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata))
    return 'email';
  return ((metadata as Record<string, unknown>).channel as string) ?? 'email';
}

interface Step {
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

function TimelineItem({ step }: { step: Step }) {
  const ch = metaCh(step.metadata);
  const date = ['SENT', 'QUEUED'].includes(step.status)
    ? (step.sentAt ?? step.scheduledAt)
    : (step.nextStepReadyAt ?? step.scheduledAt);
  return (
    <div
      className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${step.isPending ? 'border-blue-200 bg-blue-50/50' : 'border-slate-100 bg-white'}`}
    >
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
      <div className="flex-shrink-0">{channelIcon(ch)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-xs font-black text-slate-700 uppercase tracking-widest">
            {ch}
          </span>
          {statusBadge(step.status)}
          {step.triggeredBy && (
            <span className="text-[10px] text-slate-400 font-mono">
              via {step.triggeredBy}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400">{fmt(date)}</span>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 space-y-1">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
        {label}
      </p>
      <p
        className={`text-lg font-black ${accent ? 'text-emerald-600' : 'text-slate-900'}`}
      >
        {value}
      </p>
    </div>
  );
}

export function ResultsSection({
  prospectId,
  prospect,
}: {
  prospectId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prospect: any;
}) {
  const cadence = api.sequences.getCadenceState.useQuery({ prospectId });

  if (cadence.isLoading) {
    return (
      <div className="glass-card p-8 space-y-4 animate-pulse rounded-2xl">
        <div className="h-4 bg-slate-200 rounded w-40" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const data = cadence.data;
  const seqs = (data?.sequences ?? []) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  const engHigh = data?.engagementLevel === 'high';
  const summary = data?.summary;

  // Engagement metrics
  const allStepsFlat = seqs.flatMap((s: { steps: Step[] }) => s.steps ?? []);
  const emailsSent = allStepsFlat.filter((s) => s.status === 'SENT').length;
  const replies = seqs.filter((s: { status: string }) =>
    ['REPLIED', 'BOOKED'].includes(s.status),
  ).length;
  const bookingsFromSeqs = seqs.filter(
    (s: { status: string }) => s.status === 'BOOKED',
  ).length;

  // Session metrics from prospect prop
  const sessions: any[] = prospect?.sessions ?? []; // eslint-disable-line @typescript-eslint/no-explicit-any
  const latest = sessions[0] ?? null;
  const bookingsFromSessions = sessions.filter(
    (s: { callBooked: boolean }) => s.callBooked,
  ).length;
  const pdfDownloads = sessions.filter(
    (s: { pdfDownloaded: boolean }) => s.pdfDownloaded,
  ).length;
  const quoteRequests = sessions.filter(
    (s: { quoteRequested: boolean }) => s.quoteRequested,
  ).length;

  // Timeline
  const activeSeq = seqs.find(
    (s: { status: string }) => s.status !== 'CLOSED_LOST',
  ) as { id: string; steps: Step[] } | undefined;
  const isExhausted =
    seqs.length > 0 &&
    seqs.every((s: { status: string }) => s.status === 'CLOSED_LOST');
  const allSteps: Step[] = seqs.flatMap(
    (seq: { id: string; steps: Step[] }) => {
      const firstDrafted = seq.steps.findIndex((s) => s.status === 'DRAFTED');
      return seq.steps.map((step, idx) => ({
        ...step,
        isPending:
          seq.id === activeSeq?.id &&
          step.status === 'DRAFTED' &&
          idx === firstDrafted,
      }));
    },
  );

  return (
    <div className="space-y-6">
      {/* 1. Engagement Summary */}
      <div className="glass-card p-6 space-y-4 rounded-2xl">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
          Engagement Summary
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="Engagement"
            value={engHigh ? 'High' : 'Normal'}
            accent={engHigh}
          />
          <MetricCard label="Emails Sent" value={emailsSent} />
          <MetricCard label="Replies" value={replies} />
          <MetricCard
            label="Bookings"
            value={bookingsFromSeqs + bookingsFromSessions}
          />
          <MetricCard label="PDF Downloads" value={pdfDownloads} />
          <MetricCard label="Quote Requests" value={quoteRequests} />
        </div>
      </div>

      {/* 2. Dashboard Activity */}
      <div className="glass-card p-6 space-y-4 rounded-2xl">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-slate-300" /> Dashboard Activity
        </p>
        {sessions.length > 0 && latest ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-300" />
              {sessions.length} session{sessions.length !== 1 ? 's' : ''} total
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Max Step Reached
                </p>
                <p className="text-sm font-black text-slate-900">
                  Step {latest.maxStepReached ?? 0}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  PDF Downloaded
                </p>
                <p
                  className={`text-sm font-black ${latest.pdfDownloaded ? 'text-emerald-600' : 'text-slate-400'}`}
                >
                  {latest.pdfDownloaded
                    ? `Yes${latest.pdfDownloadedAt ? ` (${fmt(latest.pdfDownloadedAt)})` : ''}`
                    : 'No'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Meeting Booked
                </p>
                <p
                  className={`text-sm font-black ${latest.callBooked ? 'text-emerald-600' : 'text-slate-400'}`}
                >
                  {latest.callBooked
                    ? `Yes${latest.callBookedAt ? ` (${fmt(latest.callBookedAt)})` : ''}`
                    : 'No'}
                </p>
              </div>
            </div>
            {prospect?.readableSlug && (
              <p className="text-xs text-slate-400">
                Tracking:{' '}
                <span className="font-mono text-slate-600">
                  /voor/{prospect.readableSlug}
                </span>
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            No prospect dashboard activity yet.
          </p>
        )}
      </div>

      {/* 3. Outreach Timeline */}
      <div className="glass-card p-6 space-y-6 rounded-2xl">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
          Outreach Timeline
        </p>
        {seqs.length === 0 ? (
          <p className="text-sm text-slate-400">No outreach sent yet.</p>
        ) : (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full border ${engHigh ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}
                >
                  {engHigh ? 'High Engagement' : 'Normal'}
                </span>
                <span
                  className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full border ${isExhausted ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}
                >
                  {isExhausted ? 'Exhausted' : 'Active'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                    Touches Completed
                  </p>
                  <p className="text-sm font-black text-slate-900">
                    {summary?.touchCount ?? 0} of {allSteps.length} touches
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                    Next Step
                  </p>
                  {summary?.hasPendingStep && summary.nextStepReadyAt ? (
                    <p className="text-sm font-black text-slate-900">
                      {summary.nextChannel ?? 'touch'} scheduled for{' '}
                      {fmt(summary.nextStepReadyAt)}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400">No pending step</p>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {allSteps.map((step) => (
                <TimelineItem key={step.id} step={step} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

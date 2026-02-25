'use client';

import { api } from '@/components/providers';
import { buildDiscoverPath } from '@/lib/prospect-url';
import {
  Mail,
  Phone,
  Linkedin,
  MessageCircle,
  Globe,
  Calendar,
  Activity,
  ExternalLink,
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
    DRAFTED: 'bg-slate-100 text-slate-600 border border-slate-200',
    QUEUED: 'bg-slate-100 text-slate-700 border border-slate-200',
    SENT: 'bg-slate-200 text-slate-800 border border-slate-300',
    CLOSED_LOST: 'bg-red-50 text-red-700 border border-red-200',
  };
  const label: Record<string, string> = { CLOSED_LOST: 'Closed Lost' };
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${map[status] ?? 'bg-slate-100 text-slate-600 border border-slate-200'}`}
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
      className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${step.isPending ? 'border-slate-300 bg-slate-50' : 'border-slate-100 bg-white'}`}
    >
      <div className="flex-shrink-0 mt-0.5">
        <span
          className={`inline-flex h-2.5 w-2.5 rounded-full ${step.isPending ? 'bg-slate-500' : 'bg-slate-200'}`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {channelIcon(ch)}
            {statusBadge(step.status)}
          </div>
          <span className="text-[11px] font-bold text-slate-400">
            {fmt(date)}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500">
            Step {step.stepOrder}
          </span>
          {step.triggeredBy && (
            <span className="text-[11px] text-slate-400">
              via {step.triggeredBy}
            </span>
          )}
        </div>
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
  const compact =
    typeof value === 'string' && value.length >= 4 ? 'text-xl' : 'text-2xl';
  const valueTone =
    accent === true
      ? 'text-emerald-600'
      : accent === false
        ? 'text-sky-700'
        : 'text-[#040026]';

  return (
    <div className="flex flex-col gap-1 py-1.5">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
        {label}
      </p>
      <p
        className={`${compact} font-black tracking-tighter leading-none ${valueTone}`}
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
      <div className="glass-card p-6 space-y-4 animate-pulse rounded-[1.6rem]">
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
  const dashboardUrl = prospect?.slug
    ? buildDiscoverPath({
        slug: prospect.slug,
        readableSlug: prospect.readableSlug ?? null,
        companyName: prospect.companyName ?? null,
        domain: prospect.domain ?? null,
      })
    : null;

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
    <div className="space-y-4">
      {/* 1. Engagement Summary */}
      <div className="glass-card p-6 rounded-[1.6rem] space-y-5 mt-1">
        <h4 className="text-lg font-black text-[#040026] tracking-tight">
          Engagement Summary
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-5">
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
      <div className="glass-card p-6 rounded-[1.6rem] space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-lg font-black text-[#040026] tracking-tight flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-400" /> Dashboard Activity
          </h4>
          <div className="flex items-center gap-2">
            {dashboardUrl && (
              <a
                href={dashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ui-tap inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-[#040026]"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Preview
              </a>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700">
              <Activity className="w-3.5 h-3.5" />
              {sessions.length}
            </span>
          </div>
        </div>
        {sessions.length > 0 && latest ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Max Step Reached
                </p>
                <p className="text-lg font-black tracking-tight text-[#040026] leading-none">
                  Step {latest.maxStepReached ?? 0}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  PDF Downloaded
                </p>
                <p
                  className={`text-lg font-black tracking-tight leading-none ${latest.pdfDownloaded ? 'text-emerald-600' : 'text-slate-500'}`}
                >
                  {latest.pdfDownloaded ? `Yes` : 'No'}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Meeting Booked
                </p>
                <p
                  className={`text-lg font-black tracking-tight leading-none ${latest.callBooked ? 'text-emerald-600' : 'text-slate-500'}`}
                >
                  {latest.callBooked ? `Yes` : 'No'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            No prospect dashboard activity yet.
          </p>
        )}
      </div>

      {/* 3. Outreach Timeline */}
      <div className="glass-card p-6 rounded-[1.6rem] space-y-5">
        <h4 className="text-lg font-black text-[#040026] tracking-tight">
          Outreach Timeline
        </h4>
        {seqs.length === 0 ? (
          <p className="text-sm text-slate-400">No outreach sent yet.</p>
        ) : (
          <>
            <div className="space-y-3 border-b border-slate-100 pb-5 mb-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full border bg-slate-100 text-slate-600 border-slate-200">
                  {engHigh ? 'High Engagement' : 'Normal'}
                </span>
                <span
                  className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full border ${isExhausted ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-200 text-slate-700 border-slate-300'}`}
                >
                  {isExhausted ? 'Exhausted' : 'Active'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
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
            <div className="space-y-1.5">
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

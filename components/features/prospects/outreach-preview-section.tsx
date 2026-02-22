'use client';

import { api } from '@/components/providers';
import { Mail, ExternalLink, FileText, Loader2, Download } from 'lucide-react';

type PlanItem = {
  action: string;
  goal?: string;
  metric?: string;
};

function parsePlanItems(raw: unknown): PlanItem[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is PlanItem =>
      typeof item === 'object' && item !== null && 'action' in item,
  );
}

function CallPlanGrid({ plan }: { plan: Record<string, unknown> }) {
  const sections = [
    { label: '30 days', items: parsePlanItems(plan['plan30']) },
    { label: '60 days', items: parsePlanItems(plan['plan60']) },
    { label: '90 days', items: parsePlanItems(plan['plan90']) },
  ];
  return (
    <div className="space-y-4">
      {!!plan['summary'] && (
        <p className="text-sm text-slate-600">{String(plan['summary'])}</p>
      )}
      <div className="grid grid-cols-3 gap-3">
        {sections.map(({ label, items }) => (
          <div
            key={label}
            className="rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-2"
          >
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              {label}
            </p>
            {items.length > 0 ? (
              <ul className="space-y-1.5">
                {items.slice(0, 3).map((item, i) => (
                  <li key={i} className="text-xs text-slate-600">
                    {item.action}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400">No items</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function OutreachPreviewSection({
  prospectId,
  prospect,
  latestRunId,
}: {
  prospectId: string;
  prospect: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  latestRunId: string | null;
}) {
  const utils = api.useUtils();

  const latestAsset = api.assets.getLatest.useQuery({ prospectId });
  const callPrep = api.callPrep.getLatest.useQuery({ prospectId });
  const sequences = api.sequences.list.useQuery({ prospectId });

  const generateReport = api.assets.generate.useMutation({
    onSuccess: () => {
      void utils.assets.getLatest.invalidate({ prospectId });
    },
  });

  const queueOutreach = api.assets.queueOutreachDraft.useMutation({
    onSuccess: () => {
      void utils.sequences.list.invalidate({ prospectId });
    },
  });

  const regenerateCallBrief = api.callPrep.regenerate.useMutation({
    onSuccess: () => {
      void utils.callPrep.getLatest.invalidate({ prospectId });
    },
  });

  const lossMap = latestAsset.data;
  const plan = callPrep.data;
  const seqList = sequences.data ?? [];
  const firstContact = prospect?.contacts?.[0];

  const dashboardUrl = prospect?.readableSlug
    ? `/voor/${prospect.readableSlug}`
    : prospect?.slug
      ? `/discover/${prospect.slug}`
      : null;
  const dashboardLabel = prospect?.readableSlug
    ? 'Preview Dashboard'
    : 'Preview Wizard';

  const isLoading =
    latestAsset.isLoading || callPrep.isLoading || sequences.isLoading;

  if (isLoading) {
    return (
      <div className="glass-card p-6 space-y-4 animate-pulse rounded-2xl">
        <div className="h-4 bg-slate-200 rounded w-40" />
        <div className="h-3 bg-slate-100 rounded w-full" />
        <div className="h-3 bg-slate-100 rounded w-3/4" />
      </div>
    );
  }

  const activeSeq = seqList[0];

  return (
    <div className="space-y-6">
      {/* Sequence status indicator */}
      {activeSeq && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
          Outreach sequence: {activeSeq.status.toLowerCase()} &mdash;{' '}
          {activeSeq.steps?.length ?? 0} steps
        </div>
      )}

      {/* 1. Email Content */}
      <div className="glass-card p-6 space-y-4 rounded-2xl">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
            <Mail className="w-3.5 h-3.5 text-slate-300" />
            Email Content
          </p>
          <div className="flex items-center gap-2">
            {lossMap?.pdfUrl && (
              <a
                href={lossMap.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ui-tap flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-500 hover:text-[#040026] hover:bg-slate-100 transition-all border border-slate-100"
              >
                <Download className="w-3 h-3" /> PDF
              </a>
            )}
            <button
              onClick={() => {
                if (!latestRunId) return;
                generateReport.mutate({ runId: latestRunId });
              }}
              disabled={!latestRunId || generateReport.isPending}
              className="ui-tap flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-500 hover:text-[#040026] hover:bg-slate-100 transition-all border border-slate-100 disabled:opacity-40"
            >
              {generateReport.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : null}
              {lossMap ? 'Regenerate' : 'Generate Email'}
            </button>
            {lossMap && firstContact && (
              <button
                onClick={() =>
                  queueOutreach.mutate({
                    workflowLossMapId: lossMap.id,
                    contactId: firstContact.id,
                  })
                }
                disabled={queueOutreach.isPending}
                className="ui-tap flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-[#040026] text-white hover:bg-[#040026]/90 transition-all disabled:opacity-40"
              >
                {queueOutreach.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : null}
                Queue Draft
              </button>
            )}
          </div>
        </div>

        {lossMap ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-klarifai-midnight">
              {lossMap.emailSubject}
            </p>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm font-mono text-xs text-slate-600 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
              {lossMap.emailBodyText}
            </div>
            {(lossMap.ctaStep1 || lossMap.ctaStep2) && (
              <div className="grid grid-cols-2 gap-3">
                {lossMap.ctaStep1 && (
                  <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">
                      Step 1
                    </p>
                    <p className="text-xs text-blue-700">{lossMap.ctaStep1}</p>
                  </div>
                )}
                {lossMap.ctaStep2 && (
                  <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2">
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">
                      Step 2
                    </p>
                    <p className="text-xs text-indigo-700">
                      {lossMap.ctaStep2}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            No outreach email generated yet.{' '}
            {!latestRunId && 'Run research first to enable generation.'}
          </p>
        )}
      </div>

      {/* 2. Prospect Dashboard */}
      <div className="glass-card p-6 space-y-3 rounded-2xl">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
          <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
          Prospect Dashboard
        </p>
        <p className="text-xs text-slate-400">
          This is what the prospect sees when they click the link in the email.
        </p>
        {dashboardUrl ? (
          <a
            href={dashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ui-tap inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-600 hover:text-[#040026] hover:bg-slate-100 border border-slate-100 transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {dashboardLabel}
          </a>
        ) : (
          <p className="text-sm text-slate-400">No dashboard URL available.</p>
        )}
      </div>

      {/* 3. Call Brief */}
      <div className="glass-card p-6 space-y-4 rounded-2xl">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-slate-300" />
            Call Brief
          </p>
          <button
            onClick={() => {
              if (!latestRunId) return;
              regenerateCallBrief.mutate({ runId: latestRunId });
            }}
            disabled={!latestRunId || regenerateCallBrief.isPending}
            className="ui-tap flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-500 hover:text-[#040026] hover:bg-slate-100 transition-all border border-slate-100 disabled:opacity-40"
          >
            {regenerateCallBrief.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : null}
            {plan ? 'Regenerate' : 'Generate 30/60/90 Plan'}
          </button>
        </div>

        {plan ? (
          <CallPlanGrid plan={plan as unknown as Record<string, unknown>} />
        ) : (
          <p className="text-sm text-slate-400">
            No call brief generated yet.{' '}
            {!latestRunId && 'Run research first to enable generation.'}
          </p>
        )}
      </div>
    </div>
  );
}

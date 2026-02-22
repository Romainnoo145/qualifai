'use client';

import { api } from '@/components/providers';
import { ExternalLink, ChevronDown } from 'lucide-react';

const SRC_LABELS: Record<string, string> = {
  WEBSITE: 'Website',
  DOCS: 'Documentation',
  CAREERS: 'Career Pages',
  HELP_CENTER: 'Help Center',
  JOB_BOARD: 'Job Listings',
  REVIEWS: 'Reviews',
  MANUAL_URL: 'Manual',
};

type Finding = {
  id: string;
  kind: 'hypothesis' | 'opportunity';
  title: string;
  summary: string;
  status: 'DRAFT' | 'ACCEPTED' | 'REJECTED';
  confidenceScore: number;
  evidenceItems: Array<{
    id: string;
    sourceUrl: string;
    snippet: string;
    sourceType: string;
    title?: string | null;
  }>;
  proofMatches: Array<{
    id: string;
    score: number;
    proofTitle: string;
    useCase?: { id: string; title: string; category: string } | null;
  }>;
};

const STATUS_PILL: Record<string, string> = {
  ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
};

const BTN =
  'text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors border';

type SetStatus = (
  kind: 'hypothesis' | 'opportunity',
  id: string,
  status: 'DRAFT' | 'ACCEPTED' | 'REJECTED',
) => void;

function FindingCard({
  finding,
  onSetStatus,
}: {
  finding: Finding;
  onSetStatus: SetStatus;
}) {
  const visible = finding.evidenceItems.slice(0, 4);
  const more = finding.evidenceItems.length - visible.length;
  const set = (s: 'DRAFT' | 'ACCEPTED' | 'REJECTED') =>
    onSetStatus(finding.kind, finding.id, s);

  return (
    <div className="glass-card p-6 space-y-4 rounded-2xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${STATUS_PILL[finding.status]}`}
          >
            {finding.status}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-klarifai-midnight leading-snug">
              {finding.title}
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">
              {finding.kind === 'hypothesis' ? 'Challenge' : 'Improvement'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {finding.status !== 'ACCEPTED' && (
            <button
              onClick={() => set('ACCEPTED')}
              className={`${BTN} bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200`}
            >
              Accept
            </button>
          )}
          {finding.status !== 'REJECTED' && (
            <button
              onClick={() => set('REJECTED')}
              className={`${BTN} bg-red-50 text-red-600 hover:bg-red-100 border-red-200`}
            >
              Reject
            </button>
          )}
          {finding.status !== 'DRAFT' && (
            <button
              onClick={() => set('DRAFT')}
              className={`${BTN} bg-slate-50 text-slate-500 hover:bg-slate-100 border-slate-200`}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-slate-500 leading-relaxed">
        {finding.summary}
      </p>

      <div className="space-y-2">
        <div className="bg-slate-50 rounded-xl p-4 space-y-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
            Based on
          </p>
          {visible.length > 0 ? (
            <div className="space-y-2">
              {visible.map((ev) => (
                <div key={ev.id} className="flex items-start gap-2">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 shrink-0 mt-0.5">
                    {SRC_LABELS[ev.sourceType] ?? ev.sourceType}
                  </span>
                  <div className="min-w-0 flex-1">
                    <a
                      href={ev.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-klarifai-blue hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        {ev.title ??
                          ev.sourceUrl.slice(0, 55) +
                            (ev.sourceUrl.length > 55 ? '…' : '')}
                      </span>
                    </a>
                    {ev.snippet && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                        {ev.snippet.slice(0, 160)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {more > 0 && (
                <p className="text-[11px] text-slate-400">
                  and {more} more source{more !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400">No specific sources linked</p>
          )}
        </div>

        <div className="flex justify-center">
          <ChevronDown className="w-4 h-4 text-slate-300" />
        </div>

        <div className="bg-slate-50 rounded-xl p-4 space-y-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
            We can help because
          </p>
          {finding.proofMatches.length > 0 ? (
            <div className="space-y-2">
              {finding.proofMatches.map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-klarifai-midnight truncate">
                      {m.useCase?.title ?? m.proofTitle}
                    </p>
                    {m.useCase?.category && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">
                        {m.useCase.category}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-emerald-600 shrink-0">
                    {Math.round(m.score * 100)}% match
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              {/* TERM-02: "proof matching" replaced with plain language */}
              No services matched yet — run service matching
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toFinding(raw: any, kind: 'hypothesis' | 'opportunity'): Finding {
  return {
    id: raw.id,
    kind,
    title: raw.title,
    summary: kind === 'hypothesis' ? raw.problemStatement : raw.description,
    status: raw.status,
    confidenceScore: raw.confidenceScore,
    evidenceItems: raw.evidenceItems ?? [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    proofMatches: (raw.proofMatches ?? []).map((pm: any) => ({
      id: pm.id,
      score: pm.score,
      proofTitle: pm.proofTitle,
      useCase: pm.useCase ?? null,
    })),
  };
}

const ORDER: Record<string, number> = { ACCEPTED: 0, DRAFT: 1, REJECTED: 2 };

export function AnalysisSection({
  prospectId,
  onSetStatus,
}: {
  prospectId: string;
  onSetStatus: SetStatus;
}) {
  const { data, isLoading } = api.hypotheses.listByProspect.useQuery({
    prospectId,
  }) as { data: any; isLoading: boolean };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((n) => (
          <div
            key={n}
            className="glass-card p-6 animate-pulse space-y-3 rounded-2xl"
          >
            <div className="h-4 bg-slate-200 rounded w-64" />
            <div className="h-3 bg-slate-100 rounded w-full" />
            <div className="h-3 bg-slate-100 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  const findings: Finding[] = [
    ...((data?.hypotheses ?? []) as any[]).map((h: any) =>
      toFinding(h, 'hypothesis'),
    ),
    ...((data?.opportunities ?? []) as any[]).map((o: any) =>
      toFinding(o, 'opportunity'),
    ),
  ].sort((a, b) => {
    const d = (ORDER[a.status] ?? 1) - (ORDER[b.status] ?? 1);
    return d !== 0 ? d : b.confidenceScore - a.confidenceScore;
  });

  const accepted = findings.filter((f) => f.status === 'ACCEPTED').length;

  if (findings.length === 0) {
    return (
      <div className="glass-card p-8 text-center rounded-[2.5rem]">
        <p className="text-sm text-slate-400">
          {/* TERM-02: "proof matching" replaced with plain language */}
          No analysis available yet. Run research and service matching to
          generate findings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
        Analysis ({findings.length} finding{findings.length !== 1 ? 's' : ''}
        {accepted > 0 ? `, ${accepted} accepted` : ''})
      </p>
      {findings.map((f) => (
        <FindingCard
          key={`${f.kind}-${f.id}`}
          finding={f}
          onSetStatus={onSetStatus}
        />
      ))}
    </div>
  );
}

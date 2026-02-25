'use client';

import { api } from '@/components/providers';
import {
  ExternalLink,
  Database,
  Link2,
  FileText,
  MessageSquare,
  Briefcase,
} from 'lucide-react';

type Finding = {
  id: string;
  kind: 'hypothesis' | 'opportunity';
  title: string;
  summary: string;
  status: 'DRAFT' | 'ACCEPTED' | 'REJECTED' | 'PENDING' | 'DECLINED';
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

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Pending validation',
  ACCEPTED: 'Confirmed by prospect', // Confirmed by prospect on public discovery dashboard
  PENDING: 'Pending validation',
  REJECTED: 'Skipped', // Legacy admin-rejected
  DECLINED: 'Declined by prospect',
};

const STATUS_PILL: Record<string, string> = {
  ACCEPTED: 'bg-[#EBCB4B] text-[#040026] border-[#D4B43B]',
  REJECTED: 'bg-slate-100 text-slate-500 border-slate-200',
  DRAFT: 'bg-slate-100/50 text-[#040026]/70 border-slate-200',
  PENDING: 'bg-[#040026] text-white border-[#040026]',
  DECLINED: 'bg-red-50 text-red-600 border-red-200',
};

function compactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/, '');
    return `${parsed.hostname.replace(/^www\./, '')}${path}`;
  } catch {
    return url.length > 52 ? `${url.slice(0, 52)}...` : url;
  }
}

function sourceIcon(sourceType: string) {
  const upper = sourceType.toUpperCase();
  if (upper === 'REVIEWS') return MessageSquare;
  if (upper === 'CAREERS' || upper === 'JOB_BOARD') return Briefcase;
  if (upper === 'DOCS' || upper === 'HELP_CENTER') return FileText;
  return Link2;
}

function matchVisual(pct: number): { badge: string } {
  if (pct >= 95) {
    return {
      badge: 'bg-emerald-50/70 text-emerald-700 border-emerald-100',
    };
  }
  if (pct >= 85) {
    return {
      badge: 'bg-blue-50/70 text-blue-700 border-blue-100',
    };
  }
  if (pct >= 70) {
    return {
      badge: 'bg-slate-100 text-slate-700 border-slate-200',
    };
  }
  return {
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
  };
}

function FindingCard({ finding }: { finding: Finding }) {
  const visible = finding.evidenceItems.slice(0, 4);
  const more = finding.evidenceItems.length - visible.length;

  return (
    <div className="glass-card p-5 space-y-4 rounded-[1.6rem] hover:border-slate-200 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className={`text-[9px] uppercase font-extrabold tracking-widest px-2.5 py-1 rounded-full border shadow-sm shrink-0 ${STATUS_PILL[finding.status] ?? STATUS_PILL.DRAFT}`}
          >
            {STATUS_LABELS[finding.status] ?? 'Pending validation'}
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-[#040026] leading-snug">
              {finding.title}
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">
              {finding.kind === 'hypothesis' ? 'Challenge' : 'Improvement'}
            </span>
          </div>
        </div>
      </div>

      <p className="text-[13px] text-slate-500 leading-relaxed line-clamp-3">
        {finding.summary}
      </p>

      <div className="space-y-4 relative z-10 pt-1">
        <div className="space-y-3">
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" /> Insights
          </h4>
          {visible.length > 0 ? (
            <div className="space-y-3">
              {visible.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-xl border border-slate-100/80 bg-white px-3 py-2.5"
                >
                  <div className="flex items-start gap-2.5">
                    {(() => {
                      const Icon = sourceIcon(ev.sourceType);
                      return (
                        <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      );
                    })()}
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                        {ev.sourceType.replace(/_/g, ' ')}
                      </p>
                      <a
                        href={ev.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[12px] font-semibold text-[#040026] hover:text-[#EBCB4B] flex items-center gap-1.5 transition-colors"
                      >
                        <span className="truncate">
                          {ev.title ??
                            ev.sourceUrl.slice(0, 52) +
                              (ev.sourceUrl.length > 52 ? '...' : '')}
                        </span>
                        <ExternalLink className="w-3 h-3 shrink-0 text-slate-400" />
                      </a>
                      <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                        {compactUrl(ev.sourceUrl)}
                      </p>
                      {ev.snippet && (
                        <p className="text-[11px] text-slate-500 leading-relaxed mt-1 line-clamp-2">
                          {ev.snippet}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {more > 0 && (
                <p className="text-[11px] font-medium text-slate-400">
                  + {more} extra insight source{more !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400">No specific sources linked</p>
          )}
        </div>

        <div className="pt-1 border-t border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Matching Solutions
            </span>
            <span className="h-px bg-slate-200/80 flex-1" />
          </div>
          {finding.proofMatches.length > 0 ? (
            <div className="grid grid-cols-1 gap-2.5 transition-all">
              {finding.proofMatches
                .slice()
                .sort((a, b) => b.score - a.score)
                .map((m) => {
                  const pct = Math.round(m.score * 100);
                  const visual = matchVisual(pct);

                  return (
                    <div
                      key={m.id}
                      className="group rounded-xl border border-slate-100 bg-white px-3.5 py-3 transition-colors hover:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {m.useCase?.category && (
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                              {m.useCase.category}
                            </p>
                          )}
                          <p className="text-[13px] font-bold text-slate-800 group-hover:text-[#040026] transition-colors line-clamp-2 leading-snug mt-0.5">
                            {m.useCase?.title ?? m.proofTitle}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black tracking-tight shrink-0 ${visual.badge}`}
                        >
                          {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-sm text-slate-400 pb-1">
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

function topMatchScore(finding: Finding): number {
  if (finding.proofMatches.length === 0) return 0;
  return finding.proofMatches.reduce(
    (max, current) => (current.score > max ? current.score : max),
    0,
  );
}

const ORDER: Record<string, number> = {
  PENDING: 0,
  ACCEPTED: 0,
  DRAFT: 1,
  DECLINED: 2,
  REJECTED: 3,
};

export function AnalysisSection({ prospectId }: { prospectId: string }) {
  const { data, isLoading } = api.hypotheses.listByProspect.useQuery({
    prospectId,
  }) as { data: any; isLoading: boolean };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((n) => (
          <div
            key={n}
            className="glass-card p-5 rounded-[1.6rem] relative overflow-hidden h-[180px]"
          >
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-slate-100/50 to-transparent" />
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="h-5 bg-slate-100/80 rounded w-20" />
                <div className="h-5 bg-slate-100/80 rounded flex-1 max-w-[200px]" />
              </div>
              <div className="h-3 bg-slate-50 rounded-lg w-full mt-4" />
              <div className="h-3 bg-slate-50 rounded-lg w-full" />
              <div className="h-3 bg-slate-50 rounded-lg w-3/4" />
            </div>
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
    const matchDelta = topMatchScore(b) - topMatchScore(a);
    if (matchDelta !== 0) return matchDelta;
    const confidenceDelta = b.confidenceScore - a.confidenceScore;
    if (confidenceDelta !== 0) return confidenceDelta;
    return (ORDER[a.status] ?? 1) - (ORDER[b.status] ?? 1);
  });

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
      <p className="text-xs font-black text-slate-400 uppercase tracking-[0.15em]">
        Analysis ({findings.length} finding{findings.length !== 1 ? 's' : ''})
      </p>
      {findings.map((f) => (
        <FindingCard key={`${f.kind}-${f.id}`} finding={f} />
      ))}
    </div>
  );
}

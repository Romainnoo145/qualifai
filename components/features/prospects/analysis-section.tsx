'use client';

import { api } from '@/components/providers';
import { ExternalLink, Database, Briefcase } from 'lucide-react';

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

function matchVisual(pct: number): { badge: string } {
  if (pct >= 95) {
    return {
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    };
  }
  if (pct >= 80) {
    return {
      badge: 'bg-emerald-50/70 text-emerald-700 border-emerald-100',
    };
  }
  if (pct >= 70) {
    return {
      badge: 'bg-amber-50/70 text-amber-700 border-amber-200',
    };
  }
  return {
    badge: 'bg-slate-100 text-slate-500 border-slate-200',
  };
}

function FindingCard({ finding }: { finding: Finding }) {
  const visible = finding.evidenceItems.slice(0, 4);
  const more = finding.evidenceItems.length - visible.length;

  return (
    <div className="glass-card p-5 rounded-[1.4rem] border border-slate-100 hover:border-slate-200 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] shrink-0 ${STATUS_PILL[finding.status] ?? STATUS_PILL.DRAFT}`}
            >
              {STATUS_LABELS[finding.status] ?? 'Pending validation'}
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-200 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500 bg-slate-50/70">
              {finding.kind === 'hypothesis' ? 'Challenge' : 'Improvement'}
            </span>
          </div>
          <h3 className="text-[15px] font-black text-[#040026] leading-tight line-clamp-2">
            {finding.title}
          </h3>
        </div>
      </div>

      <p className="mt-3 text-[13px] text-slate-600 leading-relaxed line-clamp-3">
        {finding.summary}
      </p>

      <div className="mt-4 space-y-4">
        <details
          open
          className="rounded-2xl border border-slate-100 overflow-hidden"
        >
          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" /> Insights (
              {finding.evidenceItems.length})
            </p>
          </summary>
          <div className="px-4 pb-4 border-t border-slate-100/80 space-y-2.5">
            {visible.length > 0 ? (
              <>
                {visible.map((ev) => (
                  <div
                    key={ev.id}
                    className="glass-card p-4 rounded-[1.2rem] border border-slate-100 hover:border-slate-200 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="inline-flex items-center rounded-full border border-slate-200 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500 bg-slate-50/70 mb-2">
                          {ev.sourceType.replace(/_/g, ' ')}
                        </span>
                        <a
                          href={ev.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group/link inline-flex items-start gap-2"
                        >
                          <p className="text-[13px] font-black text-[#040026] leading-tight line-clamp-2 group-hover/link:text-[#EBCB4B] transition-colors">
                            {ev.title ??
                              ev.sourceUrl.slice(0, 52) +
                                (ev.sourceUrl.length > 52 ? '...' : '')}
                          </p>
                        </a>
                        <p className="mt-0.5 text-[11px] font-medium text-slate-400 line-clamp-1">
                          {compactUrl(ev.sourceUrl)}
                        </p>
                        {ev.snippet && (
                          <p className="mt-2 text-[12px] text-slate-500 leading-relaxed line-clamp-2">
                            {ev.snippet}
                          </p>
                        )}
                      </div>
                      <a
                        href={ev.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ui-tap p-2 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-[#040026] transition-colors shrink-0"
                        aria-label="Open source"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
                {more > 0 && (
                  <p className="text-[11px] font-medium text-slate-400 pt-1">
                    + {more} more source{more !== 1 ? 's' : ''}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-400 py-2">
                No specific sources linked
              </p>
            )}
          </div>
        </details>

        {finding.proofMatches.length > 0 && (
          <details
            open
            className="rounded-2xl border border-slate-100 overflow-hidden"
          >
            <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" /> Matching Solutions (
                {finding.proofMatches.length})
              </p>
            </summary>
            <div className="px-4 pb-4 border-t border-slate-100/80 space-y-2.5">
              {finding.proofMatches
                .slice()
                .sort((a, b) => b.score - a.score)
                .map((m) => {
                  const pct = Math.round(m.score * 100);
                  const visual = matchVisual(pct);

                  return (
                    <div
                      key={m.id}
                      className="glass-card p-4 rounded-[1.2rem] border border-slate-100 hover:border-slate-200 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {m.useCase?.category && (
                            <span className="inline-flex items-center rounded-full border border-[#EBCB4B] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#040026] bg-white mb-2">
                              {m.useCase.category}
                            </span>
                          )}
                          <p className="text-[13px] font-black text-[#040026] leading-tight line-clamp-2">
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
          </details>
        )}
        {finding.proofMatches.length === 0 && (
          <p className="text-xs text-slate-400 px-1">
            No services matched yet — run service matching
          </p>
        )}
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
    <div className="space-y-6">
      <p className="text-xs font-black text-slate-400 uppercase tracking-[0.15em]">
        Analysis ({findings.length} finding{findings.length !== 1 ? 's' : ''})
      </p>
      {findings.map((f) => (
        <FindingCard key={`${f.kind}-${f.id}`} finding={f} />
      ))}
    </div>
  );
}

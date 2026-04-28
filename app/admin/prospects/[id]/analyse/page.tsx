'use client';

import { useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/components/providers';
import { useDelayedLoading } from '@/lib/hooks/use-delayed-loading';
import { ProspectAnalyseSkeleton } from '@/components/features/prospects/prospect-analyse-skeleton';
import { RerunLoadingScreen } from '@/components/features/research/rerun-loading-screen';
import { SubRouteShell } from '../_shared/sub-route-shell';
import type { NarrativeAnalysis, NarrativeSection } from '@/lib/analysis/types';

type AnalysisRow = {
  id: string;
  version: string;
  content: unknown;
  modelUsed: string | null;
  createdAt: string;
  inputSnapshot: unknown;
};

function SectionCard({ section }: { section: NarrativeSection }) {
  return (
    <article className="border-b border-[var(--color-border)] pb-8 last:border-b-0">
      {section.punchline && (
        <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-gold)] mb-2">
          {section.punchline}
        </p>
      )}
      <h3 className="font-['Sora'] text-[20px] font-semibold tracking-[-0.01em] text-[var(--color-ink)] leading-snug">
        {section.title}
        <span className="text-[var(--color-gold-hi)]">.</span>
      </h3>
      <div className="mt-3 text-[14px] leading-[1.65] text-[var(--color-muted-dark)] whitespace-pre-line">
        {section.body}
      </div>

      {/* Visual data block */}
      {section.visualData && (
        <div className="mt-4 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          {section.visualData.type === 'quote' && (
            <blockquote className="border-l-2 border-[var(--color-gold)] pl-4">
              <p className="text-[14px] italic text-[var(--color-ink)] leading-relaxed">
                &ldquo;{section.visualData.quote}&rdquo;
              </p>
              <cite className="mt-2 block text-[12px] not-italic text-[var(--color-muted)]">
                — {section.visualData.attribution}
              </cite>
            </blockquote>
          )}
          {section.visualData.type === 'stats' && (
            <div className="grid grid-cols-3 gap-4">
              {section.visualData.items.map((s, i) => (
                <div key={i}>
                  <div className="font-['Sora'] text-[22px] font-bold text-[var(--color-ink)]">
                    {s.value}
                  </div>
                  <div className="text-[11px] font-medium text-[var(--color-muted)]">
                    {s.label}
                  </div>
                  {s.context && (
                    <div className="text-[10px] text-[var(--color-muted)]">
                      {s.context}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {section.visualData.type === 'signals' && (
            <div className="space-y-2">
              {section.visualData.items.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-[13px]"
                >
                  <span className="text-[var(--color-ink)]">{s.label}</span>
                  <span className="flex items-center gap-2 text-[var(--color-muted-dark)] tabular-nums">
                    {s.value}
                    <span>
                      {s.trend === 'up' ? '↑' : s.trend === 'down' ? '↓' : '→'}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
          {section.visualData.type === 'comparison' && (
            <div className="space-y-2">
              {section.visualData.items.map((c, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_1fr_1fr] gap-3 text-[13px]"
                >
                  <span className="font-medium text-[var(--color-ink)]">
                    {c.label}
                  </span>
                  <span className="text-[var(--color-muted)]">{c.before}</span>
                  <span className="text-[var(--color-ink)]">{c.after}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Citations */}
      {section.citations.length > 0 && (
        <details className="mt-3">
          <summary className="text-[11px] text-[var(--color-muted)] cursor-pointer hover:text-[var(--color-ink)] transition-colors">
            {section.citations.length} bronverwijzing
            {section.citations.length !== 1 ? 'en' : ''}
          </summary>
          <ul className="mt-2 space-y-1 pl-3">
            {section.citations.map((cite, i) => (
              <li
                key={i}
                className="text-[11px] text-[var(--color-muted)] list-disc"
              >
                {cite}
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

export default function AnalysePage() {
  const params = useParams();
  const id = params.id as string;

  // TODO: tRPC v11 inference — getAnalysis return type too deep for TS
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const analysisQuery = (api.admin.getAnalysis as any).useQuery({
    prospectId: id,
  }) as {
    data: AnalysisRow | null | undefined;
    isLoading: boolean;
    refetch?: () => Promise<unknown>;
  };
  const { data: analysis, isLoading } = analysisQuery;
  const showSkeleton = useDelayedLoading(isLoading);

  const activeRun = api.research.getActiveStatusByProspectId.useQuery(
    { prospectId: id },
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      refetchInterval: (q: any) => (q.state.data?.isActive ? 5000 : false),
      refetchOnWindowFocus: true,
    },
  );

  const refetchAnalysis = analysisQuery.refetch;

  const wasActiveRef = useRef(false);
  // React Query returns a fresh data object on each poll, so this effect runs
  // every 5s while active. The wasActiveRef ensures refetch fires exactly once
  // on the active→inactive transition and not on subsequent inactive observations.
  useEffect(() => {
    const isActive = activeRun.data?.isActive ?? false;
    if (isActive) {
      wasActiveRef.current = true;
      return;
    }
    if (wasActiveRef.current) {
      wasActiveRef.current = false;
      void refetchAnalysis?.();
    }
  }, [activeRun.data?.isActive, refetchAnalysis]);

  return (
    <SubRouteShell active="analyse">
      {isLoading ? (
        showSkeleton ? (
          <ProspectAnalyseSkeleton />
        ) : null
      ) : activeRun.data?.isActive ? (
        <RerunLoadingScreen
          variant="inline"
          currentStep={activeRun.data.currentStep}
          currentStatus={activeRun.data.status}
        />
      ) : !analysis ? (
        <div className="py-16 text-center">
          <p className="text-[15px] text-[var(--color-muted-dark)]">
            Nog geen analyse gegenereerd.
          </p>
          <p className="mt-2 text-[13px] text-[var(--color-muted)]">
            Genereer een analyse vanuit het prospect-dossier.
          </p>
        </div>
      ) : (
        <AnalysisContent analysis={analysis} />
      )}
    </SubRouteShell>
  );
}

function AnalysisContent({ analysis }: { analysis: AnalysisRow }) {
  const content = analysis.content as NarrativeAnalysis;
  const isV2 = analysis.version === 'analysis-v2' && content?.sections;

  if (!isV2) {
    // Legacy v1 — show raw JSON summary
    return (
      <div className="max-w-3xl">
        <div className="flex items-baseline gap-3 mb-6">
          <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-muted)]">
            {analysis.version}
          </span>
          <span className="text-[11px] text-[var(--color-muted)]">
            {analysis.modelUsed}
          </span>
        </div>
        <pre className="text-[12px] leading-relaxed text-[var(--color-muted-dark)] bg-[var(--color-surface)] rounded-[6px] p-4 overflow-x-auto border border-[var(--color-border)]">
          {JSON.stringify(content, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-baseline gap-3 mb-4">
          <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-gold)]">
            Narratieve analyse
          </span>
          <span className="text-[11px] text-[var(--color-muted)]">
            {analysis.modelUsed} ·{' '}
            {new Date(analysis.createdAt).toLocaleDateString('nl-NL')}
          </span>
        </div>

        {/* Executive summary */}
        {content.executiveSummary && (
          <div className="rounded-[6px] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-5 mb-6">
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)] block mb-2">
              Executive summary
            </span>
            <p className="text-[14px] leading-[1.65] text-[var(--color-ink)]">
              {content.executiveSummary}
            </p>
          </div>
        )}

        {/* Opening hook */}
        {content.openingHook && (
          <p className="text-[15px] font-light leading-[1.6] text-[var(--color-muted-dark)] italic">
            {content.openingHook}
          </p>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-8">
        {content.sections.map((section, i) => (
          <SectionCard key={section.id || i} section={section} />
        ))}
      </div>

      {/* SPV Recommendations */}
      {content.spvRecommendations?.length > 0 && (
        <div className="mt-10 pt-8 border-t border-[var(--color-border)]">
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)] block mb-4">
            Aanbevolen trajecten
          </span>
          <div className="grid gap-3">
            {content.spvRecommendations.map((rec, i) => (
              <div
                key={i}
                className="rounded-[6px] border border-[var(--color-border)] p-4"
              >
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span className="font-['Sora'] text-[14px] font-semibold text-[var(--color-ink)]">
                    {rec.spvName}
                  </span>
                  <span className="text-[10px] text-[var(--color-muted)] bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded-[3px]">
                    {rec.spvCode}
                  </span>
                </div>
                <p className="text-[13px] leading-[1.5] text-[var(--color-muted-dark)]">
                  {rec.relevanceNarrative}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

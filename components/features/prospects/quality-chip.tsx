'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/components/providers';
import { cn } from '@/lib/utils';
import { computeTrafficLight } from '@/lib/quality-config';
import { Check, Loader2, RefreshCw } from 'lucide-react';

interface QualityChipProps {
  /** From listProspects: latest run data (list view) */
  runId: string | null;
  evidenceCount: number;
  hypothesisCount: number;
  qualityApproved: boolean | null; // null = not reviewed
  qualityReviewedAt: Date | string | null;
  /** Summary JSON from ResearchRun.summary — contains gate.sourceTypeCount and gate.averageConfidence */
  summary?: unknown;
  /** Optional: for detail view where we have full data */
  runStatus?: string;
}

const CHIP_COLORS: Record<'red' | 'amber' | 'green', string> = {
  red: 'bg-red-50 text-red-600 border-red-100',
  amber: 'bg-amber-50 text-amber-600 border-amber-100',
  green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
};

const CHIP_LABELS: Record<'red' | 'amber' | 'green', string> = {
  red: 'THIN',
  amber: 'LIMITED',
  green: 'SOLID',
};

function formatReviewedAt(dt: Date | string | null): string {
  if (!dt) return '';
  const d = new Date(dt);
  return d.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function QualityChip({
  runId,
  evidenceCount,
  hypothesisCount,
  qualityApproved,
  qualityReviewedAt,
  summary,
}: QualityChipProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLButtonElement>(null);

  const utils = api.useUtils();

  // Lazy-fetch full run details only when breakdown is open
  const runQuery = api.research.getRun.useQuery(
    { runId: runId ?? '' },
    { enabled: open && !!runId },
  );

  const approveQuality = api.research.approveQuality.useMutation({
    onSuccess: () => {
      void utils.admin.listProspects.invalidate();
      void utils.research.listRuns.invalidate();
      void utils.research.getRun.invalidate({ runId: runId ?? '' });
      void utils.hypotheses.listByProspect.invalidate();
    },
  });

  const retryRun = api.research.retryRun.useMutation({
    onSuccess: () => {
      void utils.admin.listProspects.invalidate();
      void utils.research.listRuns.invalidate();
      setOpen(false);
    },
  });

  // Close panel on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        chipRef.current &&
        !chipRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // No research run yet — show grey placeholder chip
  if (!runId) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border bg-slate-50 text-slate-400 border-slate-100">
        Geen data
      </span>
    );
  }

  // Extract real quality metrics from stored gate data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gate = (summary as any)?.gate;
  const realSourceTypeCount: number =
    typeof gate?.sourceTypeCount === 'number' ? gate.sourceTypeCount : 1;
  const realAvgConf: number =
    typeof gate?.averageConfidence === 'number' ? gate.averageConfidence : 0.65;

  const trafficLight = computeTrafficLight(
    evidenceCount,
    realSourceTypeCount,
    realAvgConf,
  );

  // If we have full run data use it for a more accurate display.
  // Cast as any to avoid TS2589 deep inference from Prisma — established project pattern.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fullRun = runQuery.data as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const evidenceItems: any[] = fullRun?.evidenceItems ?? [];
  const evidenceCount2 = fullRun?._count?.evidenceItems ?? 0;
  const sourceTypeCount2 = new Set(
    evidenceItems.map((e: { sourceType: string }) => e.sourceType),
  ).size;
  // Exclude placeholders (notFound) and noise (aiRelevance < 0.5) from average
  const scorableItems = evidenceItems.filter(
    (e: { confidenceScore: number; metadata?: unknown }) => {
      const meta = e.metadata as Record<string, unknown> | null;
      if (meta?.notFound === true) return false;
      if (typeof meta?.aiRelevance === 'number' && meta.aiRelevance < 0.5)
        return false;
      return true;
    },
  );
  const avgConf2 =
    scorableItems.length > 0
      ? scorableItems.reduce(
          (sum: number, e: { confidenceScore: number }) =>
            sum + e.confidenceScore,
          0,
        ) / scorableItems.length
      : 0;
  const fullTrafficLight = fullRun
    ? computeTrafficLight(evidenceCount2, sourceTypeCount2, avgConf2)
    : trafficLight;
  const gateFromSummary = (() => {
    const summary = fullRun?.summary;
    if (!summary || typeof summary !== 'object' || Array.isArray(summary))
      return null;
    const gate = (summary as Record<string, unknown>).gate;
    if (!gate || typeof gate !== 'object' || Array.isArray(gate)) return null;
    const gatePayload = gate as Record<string, unknown>;
    const reasonsRaw = gatePayload.reasons;
    const reasons = Array.isArray(reasonsRaw)
      ? reasonsRaw.filter((item): item is string => typeof item === 'string')
      : [];
    const pain = gatePayload.painConfirmation;
    const painPayload =
      pain && typeof pain === 'object' && !Array.isArray(pain)
        ? (pain as Record<string, unknown>)
        : null;
    return {
      reasons,
      painConfirmed:
        typeof painPayload?.observedEvidenceCount === 'number'
          ? painPayload.observedEvidenceCount
          : null,
    };
  })();

  const displayLight = fullRun ? fullTrafficLight : trafficLight;
  const isReviewed = qualityApproved !== null;
  const isApproved = qualityApproved === true;

  return (
    <div className="relative">
      <button
        ref={chipRef}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border transition-all ui-tap',
          CHIP_COLORS[displayLight],
        )}
      >
        {CHIP_LABELS[displayLight]}
        {isApproved && ' ✓'}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute left-0 top-[calc(100%+6px)] z-20 min-w-[220px] max-w-xs glass-card p-5 shadow-xl shadow-slate-200/60 space-y-4"
        >
          {runQuery.isLoading ? (
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Laden...
            </div>
          ) : fullRun ? (
            <>
              {/* Breakdown rows */}
              <div className="space-y-2">
                <BreakdownRow
                  label="Bewijsstukken"
                  value={`${fullRun._count.evidenceItems}`}
                />
                <BreakdownRow
                  label="Brontypen"
                  value={`${new Set(fullRun.evidenceItems.map((e: { sourceType: string }) => e.sourceType)).size}`}
                />
                <BreakdownRow
                  label="Gem. betrouwbaarheid"
                  value={
                    fullRun.evidenceItems.length > 0
                      ? `${Math.round(
                          (fullRun.evidenceItems.reduce(
                            (sum: number, e: { confidenceScore: number }) =>
                              sum + e.confidenceScore,
                            0,
                          ) /
                            fullRun.evidenceItems.length) *
                            100,
                        )}%`
                      : '—'
                  }
                />
                <BreakdownRow
                  label="Hypothesen"
                  value={`${fullRun._count.workflowHypotheses}`}
                />
                {gateFromSummary?.painConfirmed !== null && (
                  <BreakdownRow
                    label="Confirmed evidence"
                    value={`${gateFromSummary?.painConfirmed}`}
                  />
                )}
              </div>

              {/* Quality reasons */}
              {(() => {
                const reasons =
                  gateFromSummary?.reasons ??
                  ((): string[] => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const evidenceItems: any[] = fullRun.evidenceItems ?? [];
                    const sourceTypeCount = new Set(
                      evidenceItems.map(
                        (e: { sourceType: string }) => e.sourceType,
                      ),
                    ).size;
                    const avgConf =
                      evidenceItems.length > 0
                        ? evidenceItems.reduce(
                            (sum: number, e: { confidenceScore: number }) =>
                              sum + e.confidenceScore,
                            0,
                          ) / evidenceItems.length
                        : 0;
                    const fallback: string[] = [];
                    if (evidenceItems.length < 3)
                      fallback.push('Min. 3 bewijsstukken vereist');
                    if (sourceTypeCount < 2)
                      fallback.push('Min. 2 brontypen vereist');
                    if (avgConf < 0.65)
                      fallback.push('Gem. betrouwbaarheid < 65%');
                    return fallback;
                  })();
                return reasons.length > 0 ? (
                  <ul className="space-y-1">
                    {reasons.map((r) => (
                      <li
                        key={r}
                        className="text-[10px] font-bold text-amber-600 flex items-start gap-1.5"
                      >
                        <span className="shrink-0 mt-0.5">!</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                ) : null;
              })()}

              {/* Review state */}
              {isReviewed && (
                <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600">
                  <Check className="w-3 h-3" />
                  Beoordeeld op {formatReviewedAt(qualityReviewedAt)}
                </div>
              )}

              {/* Amber warning */}
              {displayLight === 'amber' && !isReviewed && (
                <p className="text-[10px] font-bold text-amber-600">
                  Beperkt bewijs — toch doorgaan?
                </p>
              )}

              {/* Action buttons */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                {!isReviewed && (
                  <>
                    <ActionButton
                      onClick={() =>
                        approveQuality.mutate({ runId: runId!, approved: true })
                      }
                      loading={approveQuality.isPending}
                      variant="primary"
                    >
                      Onderzoek goedkeuren
                    </ActionButton>
                    {displayLight === 'amber' && (
                      <ActionButton
                        onClick={() =>
                          approveQuality.mutate({
                            runId: runId!,
                            approved: true,
                            notes:
                              'Proceed with limited research — amber override',
                          })
                        }
                        loading={approveQuality.isPending}
                        variant="amber"
                      >
                        Toch goedkeuren (beperkt)
                      </ActionButton>
                    )}
                  </>
                )}

                {isApproved && (
                  <ActionButton
                    onClick={() => retryRun.mutate({ runId: runId! })}
                    loading={retryRun.isPending}
                    icon={<RefreshCw className="w-3 h-3" />}
                    variant="ghost"
                  >
                    Onderzoek herhalen
                  </ActionButton>
                )}

                {qualityApproved === false && (
                  <p className="text-[10px] font-bold text-slate-400">
                    Meer onderzoek nodig
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="text-xs font-bold text-slate-400">
              Geen rundata beschikbaar
            </p>
          )}

          {/* Fallback before full run loaded: show basic counts */}
          {!fullRun && !runQuery.isLoading && (
            <div className="space-y-2">
              <BreakdownRow label="Bewijsstukken" value={`${evidenceCount}`} />
              <BreakdownRow label="Hypothesen" value={`${hypothesisCount}`} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[10px] font-bold text-slate-400">{label}</span>
      <span className="text-[10px] font-black text-slate-700">{value}</span>
    </div>
  );
}

function ActionButton({
  onClick,
  loading,
  children,
  icon,
  variant = 'primary',
}: {
  onClick: () => void;
  loading: boolean;
  children: React.ReactNode;
  icon?: React.ReactNode;
  variant?: 'primary' | 'amber' | 'ghost';
}) {
  const styles = {
    primary: 'bg-[#040026] text-white hover:bg-[#1E1E4A] disabled:opacity-50',
    amber:
      'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 disabled:opacity-50',
    ghost:
      'bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-100 disabled:opacity-50',
  };
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        'ui-tap w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
        styles[variant],
      )}
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : icon}
      {children}
    </button>
  );
}

'use client';

import { api } from '@/components/providers';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  IntentVariables,
  IntentCategory,
  IntentSignal,
  ExtraCategory,
} from '@/lib/extraction/types';

const CATEGORY_LABELS: Record<IntentCategory, string> = {
  sector_fit: 'Sector Fit',
  operational_pains: 'Operational Pains',
  esg_csrd: 'ESG / CSRD',
  investment_growth: 'Investment & Growth',
  workforce: 'Workforce',
};

const CATEGORY_ORDER: IntentCategory[] = [
  'sector_fit',
  'operational_pains',
  'esg_csrd',
  'investment_growth',
  'workforce',
];

function confidenceBadgeClass(confidence: number): string {
  if (confidence >= 0.7)
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (confidence >= 0.4) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-red-50 text-red-700 border-red-200';
}

function sourceTypeChipClass(): string {
  return 'bg-slate-100 text-slate-600';
}

function SignalRow({ signal }: { signal: IntentSignal }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 leading-snug">{signal.signal}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span
          className={cn(
            'text-[10px] font-bold px-2 py-0.5 rounded-full border',
            confidenceBadgeClass(signal.confidence),
          )}
        >
          {(signal.confidence * 100).toFixed(0)}%
        </span>
        {signal.sourceType && (
          <span
            className={cn(
              'text-[10px] font-semibold px-2 py-0.5 rounded-full',
              sourceTypeChipClass(),
            )}
          >
            {signal.sourceType}
          </span>
        )}
        {signal.sourceUrl && (
          <a
            href={signal.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-slate-700 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

function CategoryCard({
  label,
  signals,
}: {
  label: string;
  signals: IntentSignal[];
}) {
  return (
    <div className="glass-card p-4">
      <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
        {label}
      </h4>
      {signals.length > 0 ? (
        <div className="space-y-0">
          {signals.map((signal, i) => (
            <SignalRow key={`${signal.sourceUrl}-${i}`} signal={signal} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic">No signals extracted</p>
      )}
    </div>
  );
}

export function IntentSignalsSection({ runId }: { runId: string | null }) {
  const intentQuery = api.research.getIntentExtraction.useQuery(
    { runId: runId! },
    { enabled: !!runId },
  );

  if (!runId) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-sm text-slate-400">No research run available</p>
      </div>
    );
  }

  if (intentQuery.isLoading) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-48 mb-4" />
        <div className="h-3 bg-slate-200 rounded w-full" />
      </div>
    );
  }

  if (!intentQuery.data) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-sm text-slate-400">
          No intent extraction available for this run
        </p>
      </div>
    );
  }

  // TODO: tRPC v11 inference — getIntentExtraction return type too deep
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extraction = intentQuery.data as any;
  const intentVars = extraction.variables as IntentVariables;

  if (!intentVars || !intentVars.categories) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-sm text-slate-400">
          Intent extraction data is malformed
        </p>
      </div>
    );
  }

  const extras = (intentVars.extras ?? []) as ExtraCategory[];

  return (
    <div className="space-y-4">
      {/* Sparse warning */}
      {intentVars.sparse && (
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 text-xs font-semibold">
          Sparse extraction — fewer than 3 categories populated
        </div>
      )}

      {/* Core category cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CATEGORY_ORDER.map((cat) => (
          <CategoryCard
            key={cat}
            label={CATEGORY_LABELS[cat]}
            signals={intentVars.categories[cat] ?? []}
          />
        ))}
      </div>

      {/* Extra categories */}
      {extras.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mt-4">
            Additional Categories
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {extras.map((extra) => (
              <CategoryCard
                key={extra.category}
                label={extra.category.replace(/_/g, ' ')}
                signals={extra.signals}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { api } from '@/components/providers';
import { ExternalLink, Zap, Clock, Database } from 'lucide-react';

const SOURCE_TYPE_LABELS: Record<string, string> = {
  WEBSITE: 'Website Pages',
  DOCS: 'Documentation',
  CAREERS: 'Career Pages',
  HELP_CENTER: 'Help Center',
  JOB_BOARD: 'Job Listings',
  REVIEWS: 'Reviews',
  MANUAL_URL: 'Manually Added',
};

// TERM-02: workflowTag enum values mapped to plain-language labels
const WORKFLOW_TAG_LABELS: Record<string, string> = {
  lead_qualification: 'Lead Quality',
  workflow_bottleneck: 'Process Bottleneck',
  tech_stack_gap: 'Technology Gap',
  hiring_signal: 'Hiring Activity',
  customer_sentiment: 'Customer Feedback',
  automation_potential: 'Improvement Area',
};

function toSentenceCase(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function truncateUrl(url: string, maxLen = 60): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen) + '…';
}

function ConfidenceDot({ score }: { score: number }) {
  const color =
    score >= 0.7
      ? 'bg-emerald-400'
      : score >= 0.4
        ? 'bg-amber-400'
        : 'bg-slate-300';
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${color}`}
      title={`Confidence: ${(score * 100).toFixed(0)}%`}
    />
  );
}

type Signal = {
  id: string;
  signalType: string;
  title: string;
  description?: string | null;
  detectedAt: string | Date;
};

type EvidenceItem = {
  id: string;
  sourceType: string;
  sourceUrl: string;
  title?: string | null;
  snippet: string;
  workflowTag: string;
  confidenceScore: number;
};

export function EvidenceSection({
  prospectId,
  signals,
}: {
  prospectId: string;
  signals?: Signal[];
}) {
  const evidence = api.research.listEvidence.useQuery({ prospectId });
  const items: EvidenceItem[] = evidence.data ?? [];

  // Group by sourceType
  const groups: Record<string, EvidenceItem[]> = {};
  for (const item of items) {
    const existing = groups[item.sourceType];
    if (existing) {
      existing.push(item);
    } else {
      groups[item.sourceType] = [item];
    }
  }

  const totalCount = items.length + (signals?.length ?? 0);

  if (evidence.isLoading) {
    return (
      <div className="glass-card p-6 space-y-3 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-48" />
        <div className="h-3 bg-slate-100 rounded w-full" />
        <div className="h-3 bg-slate-100 rounded w-3/4" />
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <Database className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-400">
          No evidence collected yet. Run research to gather sources.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 space-y-6">
      <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
        Evidence ({totalCount} sources)
      </p>

      {/* Buying Signals group */}
      {signals && signals.length > 0 && (
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-3">
            Buying Signals
          </p>
          <div className="space-y-2">
            {signals.map((signal) => (
              <div
                key={signal.id}
                className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0"
              >
                <Zap className="w-3.5 h-3.5 text-klarifai-yellow-dark shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-xs font-medium text-slate-600">
                      {signal.signalType.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 ml-auto">
                      <Clock className="w-3 h-3" />
                      {new Date(signal.detectedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-klarifai-midnight">
                    {signal.title}
                  </p>
                  {signal.description && (
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                      {signal.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidence groups by source type */}
      {Object.entries(groups).map(([sourceType, groupItems]) => (
        <div key={sourceType}>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-3">
            {SOURCE_TYPE_LABELS[sourceType] ?? toSentenceCase(sourceType)} (
            {groupItems.length})
          </p>
          <div className="space-y-2">
            {groupItems.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0"
              >
                <ConfidenceDot score={item.confidenceScore} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2 flex-wrap mb-1">
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={item.sourceUrl}
                      className="text-xs font-medium text-klarifai-blue hover:underline flex items-center gap-1 min-w-0"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate max-w-[340px]">
                        {item.title ?? truncateUrl(item.sourceUrl)}
                      </span>
                    </a>
                    {item.workflowTag && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 shrink-0">
                        {/* TERM-02: workflowTag displayed as plain label */}
                        {WORKFLOW_TAG_LABELS[item.workflowTag] ??
                          toSentenceCase(item.workflowTag.replace(/_/g, ' '))}
                      </span>
                    )}
                  </div>
                  {item.snippet && (
                    <p className="text-xs text-slate-400 line-clamp-2">
                      {item.snippet.slice(0, 200)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

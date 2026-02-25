'use client';

import { api } from '@/components/providers';
import { ExternalLink, Zap, Clock, Database, FileText } from 'lucide-react';
import { useState } from 'react';

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

function formatDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '');
  } catch {
    return url.length > 50 ? url.slice(0, 50) + '…' : url;
  }
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

type SourceDiagnostic = {
  source: string;
  status: 'ok' | 'warning' | 'error' | 'skipped';
  message: string;
};

function parseDiagnostics(summary: unknown): SourceDiagnostic[] {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    return [];
  }
  const diagnostics = (summary as Record<string, unknown>).diagnostics;
  if (!Array.isArray(diagnostics)) return [];

  const normalized: SourceDiagnostic[] = [];
  for (const item of diagnostics) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const raw = item as Record<string, unknown>;
    const source = typeof raw.source === 'string' ? raw.source.trim() : '';
    const message = typeof raw.message === 'string' ? raw.message.trim() : '';
    const status =
      raw.status === 'ok' ||
      raw.status === 'warning' ||
      raw.status === 'error' ||
      raw.status === 'skipped'
        ? raw.status
        : null;
    if (!source || !message || !status) continue;
    normalized.push({ source, status, message });
  }

  return normalized;
}

function sourceLabel(source: string): string {
  return toSentenceCase(source.replace(/_/g, ' '));
}

function EvidenceCard({ item }: { item: EvidenceItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="glass-card px-5 py-4 rounded-2xl hover:border-slate-200 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#040026] leading-snug">
            {item.title ?? formatDomain(item.sourceUrl)}
          </p>
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-slate-400 hover:text-slate-500 flex items-center gap-1 mt-0.5"
          >
            <ExternalLink className="w-3 h-3 shrink-0" />
            <span className="truncate">{formatDomain(item.sourceUrl)}</span>
          </a>
        </div>
        {item.workflowTag && (
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0 mt-0.5">
            {/* TERM-02: workflowTag displayed as plain label */}
            {WORKFLOW_TAG_LABELS[item.workflowTag] ??
              toSentenceCase(item.workflowTag.replace(/_/g, ' '))}
          </span>
        )}
      </div>
      {item.snippet && (
        <>
          <p
            className={`text-xs text-slate-400 mt-2 leading-relaxed ${expanded ? '' : 'line-clamp-1'}`}
          >
            {item.snippet.slice(0, 300)}
          </p>
          {item.snippet.length > 80 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-slate-400 hover:text-slate-600 mt-1"
            >
              {expanded ? 'Less' : 'More'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function EvidenceSection({
  prospectId,
  signals,
  latestRunSummary,
  latestRunError,
}: {
  prospectId: string;
  signals?: Signal[];
  latestRunSummary?: unknown;
  latestRunError?: string | null;
}) {
  const evidence = api.research.listEvidence.useQuery({ prospectId });
  const items: EvidenceItem[] = evidence.data ?? [];
  const diagnostics = parseDiagnostics(latestRunSummary);
  const actionableDiagnostics = diagnostics.filter(
    (item) => item.status === 'warning' || item.status === 'error',
  );

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

  if (evidence.isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-16 bg-slate-100 rounded-2xl" />
        <div className="h-16 bg-slate-50 rounded-2xl" />
        <div className="h-16 bg-slate-50 rounded-2xl" />
      </div>
    );
  }

  const totalCount = items.length + (signals?.length ?? 0);

  if (totalCount === 0) {
    return (
      <div className="glass-card p-8 text-center rounded-[2.5rem]">
        <Database className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-400">
          No evidence collected yet. Run research to gather sources.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {(latestRunError || actionableDiagnostics.length > 0) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-700 mb-2">
            Source Diagnostics
          </p>
          {latestRunError && (
            <p className="text-xs text-amber-800 font-medium mb-2">
              Research run error: {latestRunError}
            </p>
          )}
          <div className="space-y-1.5">
            {actionableDiagnostics.map((item) => (
              <p
                key={`${item.source}:${item.message}`}
                className="text-xs text-amber-800"
              >
                <span className="font-semibold">
                  {sourceLabel(item.source)}:
                </span>{' '}
                {item.message}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Buying Signals */}
      {signals && signals.length > 0 && (
        <div>
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.15em] mb-3">
            Buying Signals
          </p>
          <div className="space-y-2">
            {signals.map((signal) => (
              <div
                key={signal.id}
                className="glass-card px-5 py-4 rounded-2xl flex items-start gap-3"
              >
                <Zap className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#040026]">
                    {signal.title}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-slate-400">
                      {signal.signalType.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] text-slate-300 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(signal.detectedAt).toLocaleDateString()}
                    </span>
                  </div>
                  {signal.description && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">
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
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-3.5 h-3.5 text-slate-300" />
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.15em]">
              {SOURCE_TYPE_LABELS[sourceType] ?? toSentenceCase(sourceType)} (
              {groupItems.length})
            </p>
          </div>
          <div className="space-y-2">
            {groupItems.map((item) => (
              <EvidenceCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

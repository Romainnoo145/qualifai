'use client';

import { api } from '@/components/providers';
import {
  ExternalLink,
  Zap,
  Clock,
  Database,
  FileText,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { useMemo, useState } from 'react';

const SOURCE_TYPE_LABELS: Record<string, string> = {
  WEBSITE: 'Website Pages',
  DOCS: 'Documentation',
  CAREERS: 'Career Pages',
  HELP_CENTER: 'Help Center',
  JOB_BOARD: 'Job Listings',
  REVIEWS: 'Reviews',
  MANUAL_URL: 'Manually Added',
};

const WORKFLOW_TAG_LABELS: Record<string, string> = {
  'workflow-context': 'Workflow-context',
  'lead-intake': 'Lead-intake',
  handoff: 'Handoff',
  planning: 'Planning',
  billing: 'Billing',
  lead_qualification: 'Lead Quality',
  workflow_bottleneck: 'Process Bottleneck',
  tech_stack_gap: 'Technology Gap',
  hiring_signal: 'Hiring Activity',
  customer_sentiment: 'Customer Feedback',
  automation_potential: 'Improvement Area',
};

type EvidenceGroupKey = 'website' | 'reviews' | 'career' | 'other';

const EVIDENCE_GROUPS: Array<{
  key: EvidenceGroupKey;
  label: string;
  sourceTypes: string[];
}> = [
  {
    key: 'website',
    label: 'Website Pages',
    sourceTypes: ['WEBSITE', 'DOCS', 'HELP_CENTER', 'MANUAL_URL'],
  },
  { key: 'reviews', label: 'Reviews', sourceTypes: ['REVIEWS'] },
  {
    key: 'career',
    label: 'Career Pages',
    sourceTypes: ['CAREERS', 'JOB_BOARD'],
  },
  { key: 'other', label: 'Other Sources', sourceTypes: [] },
];

const INITIAL_VISIBLE_PER_GROUP = 5;
const EMPTY_EVIDENCE_ITEMS: EvidenceItem[] = [];

function toSentenceCase(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function formatDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '');
  } catch {
    return url.length > 50 ? `${url.slice(0, 50)}…` : url;
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

type ProcessedEvidenceGroup = {
  key: EvidenceGroupKey;
  label: string;
  rawCount: number;
  items: EvidenceItem[];
  stackClues: Array<{ label: string; tone: string }>;
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

function workflowTagLabel(tag: string): string {
  const normalized = tag.trim();
  if (!normalized) return 'Signal';
  return (
    WORKFLOW_TAG_LABELS[normalized] ??
    toSentenceCase(normalized.replace(/[_-]/g, ' '))
  );
}

function normalizedText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizedUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.hostname.replace(/^www\./, '')}${url.pathname.replace(/\/$/, '')}`;
  } catch {
    return normalizedText(value).replace(/\/$/, '');
  }
}

function evidenceGroupOf(sourceType: string): EvidenceGroupKey {
  for (const group of EVIDENCE_GROUPS) {
    if (group.sourceTypes.includes(sourceType)) return group.key;
  }
  return 'other';
}

function isStackClueItem(item: EvidenceItem): boolean {
  const source = `${item.title ?? ''} ${item.snippet}`.toLowerCase();
  return source.includes('stack clues');
}

function extractStackClues(item: EvidenceItem): string[] {
  const text = `${item.title ?? ''} ${item.snippet}`;
  const parsed = text.match(
    /(?:stack clues detected|stack clues|tech stack(?: clues)? detected)\s*:\s*([^\n.]+)/i,
  );
  if (!parsed?.[1]) return [];

  return parsed[1]
    .split(',')
    .map((part) =>
      part
        .trim()
        .replace(/[`'".]/g, '')
        .replace(/\s+/g, ' ')
        .toLowerCase(),
    )
    .filter((part) => part.length > 0);
}

const STACK_CLUE_TOPSET: Array<{
  keys: string[];
  label: string;
  tone: string;
}> = [
  {
    keys: ['hubspot', 'hsforms'],
    label: 'HubSpot',
    tone: 'border-orange-200 bg-orange-50 text-orange-700',
  },
  {
    keys: ['salesforce'],
    label: 'Salesforce',
    tone: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  {
    keys: ['google-analytics', 'google analytics', 'ga4'],
    label: 'Google Analytics',
    tone: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  },
  {
    keys: ['gtm', 'google tag manager', 'googletagmanager'],
    label: 'Google Tag Manager',
    tone: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  {
    keys: ['segment', 'mixpanel', 'matomo'],
    label: 'Product Analytics',
    tone: 'border-violet-200 bg-violet-50 text-violet-700',
  },
  {
    keys: ['wordpress', 'wp-content', 'wp-includes'],
    label: 'WordPress',
    tone: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  {
    keys: ['shopify', 'cdn.shopify', 'shopify.theme'],
    label: 'Shopify',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  {
    keys: ['nextjs', 'next.js', '_next/static', '__next_data__'],
    label: 'Next.js',
    tone: 'border-slate-300 bg-slate-100 text-slate-700',
  },
  {
    keys: ['webflow'],
    label: 'Webflow',
    tone: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  },
  {
    keys: ['wix'],
    label: 'Wix',
    tone: 'border-purple-200 bg-purple-50 text-purple-700',
  },
  {
    keys: ['aws', 'azure', 'gcp', 'cloudflare', 'vercel', 'netlify'],
    label: 'Infrastructure',
    tone: 'border-slate-300 bg-slate-100 text-slate-700',
  },
];

function normalizeClueKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function stackCluePresentation(clue: string): {
  label: string;
  tone: string;
  priority: number;
} {
  const normalized = normalizeClueKey(clue);

  for (let i = 0; i < STACK_CLUE_TOPSET.length; i += 1) {
    const item = STACK_CLUE_TOPSET[i]!;
    if (item.keys.some((key) => normalized.includes(normalizeClueKey(key)))) {
      return { label: item.label, tone: item.tone, priority: i };
    }
  }

  return {
    label: clue,
    tone: 'border-slate-200 bg-slate-50 text-slate-600',
    priority: 999,
  };
}

function buildEvidenceGroups(items: EvidenceItem[]): ProcessedEvidenceGroup[] {
  const buckets: Record<EvidenceGroupKey, EvidenceItem[]> = {
    website: [],
    reviews: [],
    career: [],
    other: [],
  };

  for (const item of items) {
    buckets[evidenceGroupOf(item.sourceType)].push(item);
  }

  return EVIDENCE_GROUPS.map((group) => {
    const rawItems = buckets[group.key];
    const deduped: EvidenceItem[] = [];
    const seen = new Set<string>();
    const clueKeys = new Set<string>();
    const stackCluesRaw: string[] = [];

    for (const item of rawItems) {
      if (isStackClueItem(item)) {
        const clues = extractStackClues(item);
        for (const clue of clues) {
          const key = normalizedText(clue);
          if (clueKeys.has(key)) continue;
          clueKeys.add(key);
          stackCluesRaw.push(clue);
        }
        continue;
      }

      const key = [
        normalizedUrl(item.sourceUrl),
        normalizedText(item.title ?? ''),
        normalizedText(item.snippet).slice(0, 220),
        normalizedText(item.workflowTag),
      ].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }

    const stackCluesByLabel = new Map<
      string,
      { label: string; tone: string; priority: number }
    >();
    for (const clue of stackCluesRaw) {
      const presentation = stackCluePresentation(clue);
      const key = normalizeClueKey(presentation.label);
      if (!stackCluesByLabel.has(key)) {
        stackCluesByLabel.set(key, presentation);
      }
    }

    const stackClues = Array.from(stackCluesByLabel.values())
      .sort((a, b) => {
        const byPriority = a.priority - b.priority;
        if (byPriority !== 0) return byPriority;
        return a.label.localeCompare(b.label, 'nl', { sensitivity: 'base' });
      })
      .map(({ label, tone }) => ({ label, tone }));

    return {
      key: group.key,
      label: group.label,
      rawCount: rawItems.length,
      items: deduped,
      stackClues,
    };
  }).filter((group) => group.rawCount > 0);
}

function EvidenceCard({ item }: { item: EvidenceItem }) {
  const title = item.title?.trim() || formatDomain(item.sourceUrl);

  return (
    <div className="glass-card p-5 rounded-[1.4rem] border border-slate-100 hover:border-slate-200 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center rounded-full border border-[#EBCB4B] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#040026] bg-white">
              {workflowTagLabel(item.workflowTag)}
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-200 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500 bg-slate-50/70">
              {SOURCE_TYPE_LABELS[item.sourceType] ??
                toSentenceCase(item.sourceType.replace(/_/g, ' '))}
            </span>
          </div>
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group/link inline-flex items-start gap-2"
          >
            <p className="text-[15px] font-black text-[#040026] leading-tight line-clamp-2 group-hover/link:text-[#EBCB4B] transition-colors">
              {title}
            </p>
          </a>
          <p className="mt-1 text-[11px] font-medium text-slate-400 line-clamp-1">
            {formatDomain(item.sourceUrl)}
          </p>
        </div>
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ui-tap p-2 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-[#040026] transition-colors"
          aria-label="Open source"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
      {item.snippet && (
        <p className="mt-3 text-[13px] leading-relaxed text-slate-600 line-clamp-2">
          {item.snippet}
        </p>
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
  const items: EvidenceItem[] = evidence.data ?? EMPTY_EVIDENCE_ITEMS;
  const groupedEvidence = useMemo(() => buildEvidenceGroups(items), [items]);
  const [visibleByGroup, setVisibleByGroup] = useState<
    Partial<Record<EvidenceGroupKey, number>>
  >({});

  const diagnostics = parseDiagnostics(latestRunSummary);
  const actionableDiagnostics = diagnostics.filter(
    (item) => item.status === 'warning' || item.status === 'error',
  );

  if (evidence.isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="glass-card p-6 rounded-3xl relative overflow-hidden h-[120px]"
          >
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-slate-100/50 to-transparent" />
            <div className="space-y-3">
              <div className="h-4 bg-slate-100/80 rounded-lg w-1/3" />
              <div className="h-3 bg-slate-50 rounded-lg w-1/4" />
              <div className="h-3 bg-slate-50 rounded-lg w-full mt-4" />
            </div>
          </div>
        ))}
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

  const visibleCount = (key: EvidenceGroupKey) =>
    visibleByGroup[key] ?? INITIAL_VISIBLE_PER_GROUP;

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

      {signals && signals.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-black text-slate-400 uppercase tracking-[0.15em]">
            Buying Signals
          </p>
          <div className="space-y-2">
            {signals.map((signal) => (
              <div
                key={signal.id}
                className="glass-card px-6 py-5 rounded-3xl flex items-start gap-4 hover:border-slate-200 transition-colors"
              >
                <Zap className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#040026]">
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
                    <p className="text-[13px] text-slate-500 mt-2 leading-relaxed">
                      {signal.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {groupedEvidence.map((group) => {
        const currentVisible = visibleCount(group.key);
        const visibleItems = group.items.slice(0, currentVisible);
        const hiddenCount = Math.max(
          0,
          group.items.length - visibleItems.length,
        );

        return (
          <details
            key={group.key}
            open
            className="glass-card rounded-[2rem] border border-slate-100 overflow-hidden"
          >
            <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden px-6 py-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-[0.15em]">
                  {group.label} ({group.rawCount})
                </p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            </summary>

            <div className="px-5 pb-5 border-t border-slate-100/80 space-y-3">
              {group.stackClues.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" />
                    Stack Clues
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {group.stackClues.map((clue) => {
                      return (
                        <span
                          key={`${group.key}:${clue.label}`}
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold ${clue.tone}`}
                        >
                          {clue.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-2.5">
                {visibleItems.map((item) => (
                  <EvidenceCard key={item.id} item={item} />
                ))}
              </div>

              {hiddenCount > 0 && (
                <button
                  onClick={() =>
                    setVisibleByGroup((prev) => ({
                      ...prev,
                      [group.key]:
                        (prev[group.key] ?? INITIAL_VISIBLE_PER_GROUP) + 5,
                    }))
                  }
                  className="ui-tap w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-black uppercase tracking-[0.12em] text-slate-600 hover:text-[#040026] transition-colors"
                >
                  Load More ({hiddenCount})
                </button>
              )}
            </div>
          </details>
        );
      })}

      {groupedEvidence.length === 0 && (
        <div className="glass-card p-8 text-center rounded-[2.5rem]">
          <Database className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">
            No evidence cards available yet.
          </p>
        </div>
      )}
    </div>
  );
}

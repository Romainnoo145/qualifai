'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '@/components/providers';
import { PageLoader } from '@/components/ui/page-loader';
import { SubRouteShell } from '../_shared/sub-route-shell';

// Source type display config
const SOURCE_META: Record<string, { label: string; color: string }> = {
  WEBSITE: { label: 'Website', color: 'var(--color-tag-run-bg)' },
  REVIEWS: { label: 'Reviews', color: 'var(--color-tag-quality-bg)' },
  NEWS: { label: 'Nieuws', color: 'var(--color-tag-outreach-bg)' },
  CAREERS: { label: 'Vacatures', color: 'var(--color-tag-evidence-bg)' },
  LINKEDIN: { label: 'LinkedIn', color: 'var(--color-tag-enrich-bg)' },
  REGISTRY: { label: 'KvK / Register', color: 'var(--color-surface-2)' },
  DOCS: { label: 'Documentatie', color: 'var(--color-surface-2)' },
  HELP_CENTER: { label: 'Help Center', color: 'var(--color-surface-2)' },
  JOB_BOARD: { label: 'Vacaturesite', color: 'var(--color-surface-2)' },
  MANUAL_URL: { label: 'Handmatig', color: 'var(--color-surface-2)' },
};

function ConfidenceDot({ score }: { score: number }) {
  const color =
    score >= 0.7
      ? 'var(--color-tag-quality-text)'
      : score >= 0.5
        ? 'var(--color-gold)'
        : 'var(--color-muted)';
  return (
    <span
      className="inline-block h-2 w-2 rounded-full shrink-0"
      style={{ background: color }}
      title={`Confidence: ${(score * 100).toFixed(0)}%`}
    />
  );
}

// Sort order for source types (most valuable first)
const SOURCE_ORDER = [
  'REVIEWS',
  'LINKEDIN',
  'NEWS',
  'CAREERS',
  'REGISTRY',
  'WEBSITE',
  'DOCS',
  'HELP_CENTER',
  'JOB_BOARD',
  'MANUAL_URL',
];

export default function EvidencePage() {
  const params = useParams();
  const id = params.id as string;
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(SOURCE_ORDER),
  );

  const { data, isLoading } = api.admin.listEvidence.useQuery({
    prospectId: id,
  });

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <SubRouteShell active="evidence">
      {isLoading ? (
        <PageLoader label="Evidence laden" description="Items ophalen." />
      ) : !data || data.total === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[15px] text-[var(--color-muted-dark)]">
            Nog geen evidence items verzameld.
          </p>
          <p className="mt-2 text-[13px] text-[var(--color-muted)]">
            Start een research run om evidence te verzamelen.
          </p>
        </div>
      ) : (
        <div className="max-w-4xl">
          {/* Summary bar */}
          <div className="flex items-baseline gap-4 mb-8">
            <span className="font-['Sora'] text-[32px] font-bold tracking-[-0.02em] text-[var(--color-ink)]">
              {data.total}
              <span className="text-[var(--color-gold-hi)]">.</span>
            </span>
            <span className="text-[13px] text-[var(--color-muted-dark)]">
              evidence items uit{' '}
              <b className="text-[var(--color-ink)]">
                {Object.keys(data.grouped).length}
              </b>{' '}
              brontypen
            </span>
          </div>

          {/* Grouped list */}
          <div className="space-y-1">
            {SOURCE_ORDER.filter((st) => data.grouped[st]?.length).map(
              (sourceType) => {
                const items = data.grouped[sourceType]!;
                const meta = SOURCE_META[sourceType] ?? {
                  label: sourceType,
                  color: 'var(--color-surface-2)',
                };
                const isOpen = expandedGroups.has(sourceType);

                return (
                  <div key={sourceType}>
                    {/* Group header */}
                    <button
                      type="button"
                      onClick={() => toggleGroup(sourceType)}
                      className="flex w-full items-center gap-3 py-3 px-2 rounded-[6px] hover:bg-[var(--color-surface-hover)] transition-colors text-left"
                    >
                      {isOpen ? (
                        <ChevronDown
                          className="h-3.5 w-3.5 text-[var(--color-muted)]"
                          strokeWidth={1.75}
                        />
                      ) : (
                        <ChevronRight
                          className="h-3.5 w-3.5 text-[var(--color-muted)]"
                          strokeWidth={1.75}
                        />
                      )}
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-[3px]"
                        style={{ background: meta.color }}
                      />
                      <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink)]">
                        {meta.label}
                      </span>
                      <span className="text-[11px] tabular-nums text-[var(--color-muted)]">
                        {items.length}
                      </span>
                    </button>

                    {/* Items */}
                    {isOpen && (
                      <div className="ml-9 border-l border-[var(--color-border)] pl-4 pb-2 space-y-0">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="group py-2.5 pr-2 border-b border-[var(--color-border)] last:border-b-0"
                          >
                            <div className="flex items-start gap-2">
                              <ConfidenceDot score={item.confidenceScore} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2">
                                  <span className="text-[13px] font-medium text-[var(--color-ink)] leading-snug line-clamp-1">
                                    {item.title || item.sourceUrl}
                                  </span>
                                  <span className="shrink-0 text-[10px] tabular-nums text-[var(--color-muted)]">
                                    {(item.confidenceScore * 100).toFixed(0)}%
                                  </span>
                                </div>
                                <p className="mt-0.5 text-[12px] leading-[1.5] text-[var(--color-muted-dark)] line-clamp-2">
                                  {item.snippet}
                                </p>
                                <div className="mt-1 flex items-center gap-3">
                                  {item.workflowTag && (
                                    <span className="text-[10px] text-[var(--color-muted)] bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded-[3px]">
                                      {item.workflowTag}
                                    </span>
                                  )}
                                  {item.sourceUrl && (
                                    <a
                                      href={item.sourceUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
                                    >
                                      bron
                                      <ExternalLink
                                        className="h-2.5 w-2.5"
                                        strokeWidth={2}
                                      />
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              },
            )}
          </div>
        </div>
      )}
    </SubRouteShell>
  );
}

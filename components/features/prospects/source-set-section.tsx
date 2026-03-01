'use client';

import { api } from '@/components/providers';
import {
  extractSourceSet,
  type UrlProvenance,
} from '@/lib/enrichment/source-discovery';
import { Link as LinkIcon, ChevronDown, RefreshCw } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SourceSetSectionProps {
  runId: string;
  inputSnapshot: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(isoString: string): string {
  const ms = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(isoString).toLocaleDateString('nl-NL');
}

const PROVENANCE_LABELS: Record<UrlProvenance, string> = {
  sitemap: 'Sitemap',
  serp: 'SERP',
  default: 'Default',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SourceSetSection({
  runId,
  inputSnapshot,
}: SourceSetSectionProps) {
  const utils = api.useUtils();
  const rediscover = api.research.rediscoverSources.useMutation({
    onSuccess: () => utils.research.listRuns.invalidate(),
  });

  const sourceSet = extractSourceSet(inputSnapshot);

  // No sourceSet means no research has run yet — render nothing
  if (!sourceSet) return null;

  const { urls, discoveredAt, dedupRemovedCount, rawCounts } = sourceSet;

  // Build per-provenance breakdown for summary line
  const provenanceOrder: UrlProvenance[] = ['sitemap', 'serp', 'default'];
  const breakdownParts: string[] = [];

  for (const prov of provenanceOrder) {
    const rc = rawCounts[prov];
    const count = urls.filter((u) => u.provenance === prov).length;
    if (count === 0) continue;

    // Show "X of Y" format when original list was larger than capped count
    const wasCapped = rc.discovered > rc.capped;
    if (wasCapped) {
      breakdownParts.push(`${count} of ${rc.discovered} ${prov}`);
    } else {
      breakdownParts.push(`${count} ${prov}`);
    }
  }

  const summaryLine = [
    `${urls.length} source URLs (${breakdownParts.join(', ')})`,
    dedupRemovedCount > 0 ? `${dedupRemovedCount} duplicates removed` : null,
    `Discovered ${relativeTime(discoveredAt)}`,
  ]
    .filter(Boolean)
    .join(' · ');

  // Group URLs by provenance for expanded view
  const grouped = provenanceOrder
    .map((prov) => ({
      prov,
      label: PROVENANCE_LABELS[prov],
      items: urls.filter((u) => u.provenance === prov),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <details className="glass-card rounded-[2rem] border border-slate-100 overflow-hidden mb-4">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden px-6 py-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <LinkIcon className="w-4 h-4 text-slate-400 shrink-0" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-[0.15em] truncate">
            {summaryLine}
          </p>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
      </summary>

      <div className="px-5 pb-5 border-t border-slate-100/80 space-y-4">
        {/* URL groups */}
        {grouped.map(({ prov, label, items }) => (
          <div key={prov}>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2 mt-3">
              {label} ({items.length})
            </p>
            <ul className="space-y-1">
              {items.map(({ url }) => (
                <li key={url} className="flex items-center gap-2 min-w-0">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-slate-500 hover:text-[#040026] hover:underline truncate font-mono"
                    title={url}
                  >
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Re-discover button */}
        <div className="pt-2 border-t border-slate-100/60">
          <button
            onClick={() => rediscover.mutate({ runId, force: false })}
            disabled={rediscover.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 bg-white/60 hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${rediscover.isPending ? 'animate-spin' : ''}`}
            />
            Re-discover sources
          </button>
        </div>
      </div>
    </details>
  );
}

import type { EvidenceItem } from './types';

export type EvidenceSelectorOptions = {
  limit: number;
  maxPerSource: number;
};

const DEFAULT_OPTIONS: EvidenceSelectorOptions = { limit: 20, maxPerSource: 5 };

/**
 * Select the best evidence items for prompt injection.
 *
 * Sorts by confidenceScore descending, then caps total at `opts.limit` and
 * each sourceType at `opts.maxPerSource` to ensure source diversity.
 */
export function selectEvidenceForPrompt(
  items: EvidenceItem[],
  opts: EvidenceSelectorOptions = DEFAULT_OPTIONS,
): EvidenceItem[] {
  const sorted = [...items].sort(
    (a, b) => b.confidenceScore - a.confidenceScore,
  );
  const sourceCounts: Record<string, number> = {};
  const selected: EvidenceItem[] = [];
  for (const item of sorted) {
    if (selected.length >= opts.limit) break;
    const count = sourceCounts[item.sourceType] ?? 0;
    if (count >= opts.maxPerSource) continue;
    sourceCounts[item.sourceType] = count + 1;
    selected.push(item);
  }
  return selected;
}

/**
 * Count evidence items per sourceType.
 *
 * Useful for logging and prompt source-breakdown headers.
 */
export function buildSourceBreakdown(
  items: EvidenceItem[],
): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item.sourceType] = (acc[item.sourceType] ?? 0) + 1;
    return acc;
  }, {});
}

const ACTIVE_RESEARCH_STATUSES = new Set([
  'PENDING',
  'CRAWLING',
  'EXTRACTING',
  'HYPOTHESIS',
  'BRIEFING',
]);

export function isDeepCrawlSnapshot(snapshot: unknown): boolean {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return false;
  }
  return (snapshot as Record<string, unknown>).deepCrawl === true;
}

export function deepAnalysisStatus(
  run:
    | {
        status?: string | null;
        inputSnapshot?: unknown;
      }
    | null
    | undefined,
): 'not_started' | 'running' | 'completed' | 'failed' {
  if (!run || !isDeepCrawlSnapshot(run.inputSnapshot)) return 'not_started';

  if (run.status && ACTIVE_RESEARCH_STATUSES.has(run.status)) return 'running';
  if (run.status === 'COMPLETED') return 'completed';
  if (run.status === 'FAILED') return 'failed';

  return 'not_started';
}

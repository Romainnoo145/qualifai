'use client';

import {
  mapMutationError,
  FRIENDLY_ERROR_GEMINI_FALLBACK,
} from './error-mapping';
import { cn } from '@/lib/utils';

interface ProspectLastRunStatusProps {
  latestRun: {
    finishedAt: Date | null;
    completedAt: Date | null;
    status: string;
    _count?: { evidenceItems: number };
  } | null;
  prospect: {
    lastAnalysisError: string | null;
    lastAnalysisAttemptedAt: Date | null;
    lastAnalysisModelUsed: string | null; // 'gemini-2.5-pro' | 'gemini-2.5-flash' | null
  };
}

function formatNl(date: Date): string {
  return new Date(date).toLocaleString('nl-NL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Laatste run indicator. Render priority (highest first):
 *   1. lastAnalysisError present           → error (red)
 *   2. lastAnalysisModelUsed === 'flash'   → fallback (amber) — ROADMAP SC #2
 *   3. latestRun status === COMPLETED      → success (green)
 *   4. latestRun status !== COMPLETED      → run-warning (amber)
 *   5. neither present                     → null
 *
 * Phase 61.1 POLISH-09 / SC #2
 */
export function ProspectLastRunStatus({
  latestRun,
  prospect,
}: ProspectLastRunStatusProps): React.ReactElement | null {
  // 1) Error state takes priority — analysis failure is the loudest signal
  if (prospect.lastAnalysisError && prospect.lastAnalysisAttemptedAt) {
    return (
      <div
        className="inline-flex items-center gap-2 rounded-[var(--radius-full)] border border-[#e0b8a8] bg-[#fef2f2] px-3.5 py-1.5 text-[12px] font-medium text-[var(--color-brand-danger)]"
        data-testid="last-run-status"
        data-state="error"
      >
        <span>
          Laatste analyse: {formatNl(prospect.lastAnalysisAttemptedAt)} — ✗
          Mislukt: {mapMutationError(new Error(prospect.lastAnalysisError))}
        </span>
      </div>
    );
  }

  // 2) Fallback-used state — ROADMAP SC #2
  //    lastAnalysisError is null (success) but lastAnalysisModelUsed === 'gemini-2.5-flash'
  //    means the retry layer fell back. Show amber warning, not green.
  if (
    prospect.lastAnalysisError === null &&
    prospect.lastAnalysisModelUsed === 'gemini-2.5-flash' &&
    prospect.lastAnalysisAttemptedAt
  ) {
    return (
      <div
        className="inline-flex items-center gap-2 rounded-[var(--radius-full)] border border-[var(--color-tag-quality-border)] bg-[var(--color-tag-quality-bg)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--color-tag-quality-text)]"
        data-testid="last-run-status"
        data-state="fallback"
        title={FRIENDLY_ERROR_GEMINI_FALLBACK}
      >
        <span>
          Laatste analyse: {formatNl(prospect.lastAnalysisAttemptedAt)} — ⚠
          Fallback gebruikt (gemini-2.5-flash)
        </span>
      </div>
    );
  }

  // 3 + 4) latestRun-based states
  if (!latestRun) return null;

  const runDate = latestRun.finishedAt ?? latestRun.completedAt;
  if (!runDate) return null;

  const evidenceCount = latestRun._count?.evidenceItems ?? 0;
  const isSuccess = latestRun.status === 'COMPLETED';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-[var(--radius-full)] border px-3.5 py-1.5 text-[12px] font-medium',
        isSuccess
          ? 'border-[var(--color-tag-enrich-border)] bg-[var(--color-tag-enrich-bg)] text-[var(--color-tag-enrich-text)]'
          : 'border-[var(--color-tag-quality-border)] bg-[var(--color-tag-quality-bg)] text-[var(--color-tag-quality-text)]',
      )}
      data-testid="last-run-status"
      data-state={isSuccess ? 'success' : 'warning'}
    >
      <span>
        Laatste research: {formatNl(runDate)} —{' '}
        {isSuccess ? '✓ Geslaagd' : `⚠ ${latestRun.status}`}
        {isSuccess && ` (${evidenceCount} evidence items)`}
      </span>
    </div>
  );
}

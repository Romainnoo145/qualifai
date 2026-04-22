'use client';

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { ResearchStatus } from '@prisma/client';
import { cn } from '@/lib/utils';
import {
  ACTIVE_RESEARCH_STATUSES,
  statusLabel,
} from '@/lib/research/status-labels';

// Ordered list of phases used by PhaseProgress
const PHASES = ACTIVE_RESEARCH_STATUSES;

const PHASE_MARKER_LABELS: Record<(typeof PHASES)[number], string> = {
  PENDING: 'Start',
  CRAWLING: 'Bronnen',
  EXTRACTING: 'Extract',
  HYPOTHESIS: 'Hypothese',
  BRIEFING: 'Briefing',
};

interface Props {
  variant?: 'full' | 'inline';
  currentStep?: string | null;
  currentStatus?: ResearchStatus | null;
}

export function RerunLoadingScreen({
  variant = 'inline',
  currentStep,
  currentStatus,
}: Props) {
  const isFull = variant === 'full';

  return (
    <div
      className={cn(
        'flex items-center justify-center',
        isFull ? 'fixed inset-0 z-50 bg-[var(--color-ink)]' : 'py-24',
      )}
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          'flex flex-col items-center gap-8 px-6 text-center',
          isFull ? 'max-w-[540px]' : 'max-w-[480px]',
        )}
      >
        {/* Heading block */}
        <div className="flex flex-col gap-2">
          <h2
            className={cn(
              'text-2xl font-medium',
              isFull ? 'text-white' : 'text-[var(--color-ink)]',
            )}
          >
            Analyse wordt bijgewerkt
          </h2>
          <p
            className={cn(
              'text-sm font-light',
              isFull ? 'text-white/70' : 'text-[var(--color-muted)]',
            )}
          >
            Dit duurt een paar minuten.
          </p>
        </div>

        {/* Phase progress visual */}
        <PhaseProgress status={currentStatus ?? null} inverted={isFull} />

        {/* Dynamic step label — crossfades on change */}
        <AnimatePresence mode="wait">
          <motion.p
            key={currentStep ?? 'idle'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={cn(
              'text-xs font-medium uppercase tracking-[0.14em]',
              isFull ? 'text-white/60' : 'text-[var(--color-muted)]',
              currentStep ? 'text-[var(--color-gold)]' : 'opacity-0',
            )}
          >
            {currentStep ?? ' '}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PhaseProgress — horizontal 5-phase indicator
// ─────────────────────────────────────────────────────────────────────

function PhaseProgress({
  status,
  inverted,
}: {
  status: ResearchStatus | null;
  inverted: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();

  // Resolve current phase index (null = unknown / not active)
  const currentIdx = status ? PHASES.findIndex((p) => p === status) : -1;

  // Fall back: status is null or not in active list — show simple pulse
  if (currentIdx === -1) {
    return (
      <div className="flex items-center justify-center h-10">
        <motion.div
          className="h-2 w-2 rounded-full bg-[var(--color-gold)]"
          animate={shouldReduceMotion ? {} : { opacity: [0.4, 1, 0.4] }}
          transition={
            shouldReduceMotion
              ? {}
              : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
          }
        />
      </div>
    );
  }

  return (
    <div className="w-full" aria-hidden="true">
      {/* Dot row with connecting lines */}
      <div className="relative flex items-center justify-between">
        {/* Background connecting track */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-[var(--color-gold)]/15" />

        {/* Per-segment fills between dots */}
        {PHASES.slice(0, -1).map((_, segIdx) => {
          const isPastSegment = segIdx < currentIdx;
          const isCurrentSegment = segIdx === currentIdx - 1;
          const segWidth = 100 / (PHASES.length - 1);
          const leftPct = segIdx * segWidth;

          return (
            <div
              key={segIdx}
              className="absolute top-1/2 -translate-y-1/2 h-px overflow-hidden"
              style={{
                left: `${leftPct}%`,
                width: `${segWidth}%`,
              }}
            >
              {isPastSegment ? (
                <div className="h-full w-full bg-[var(--color-gold)]" />
              ) : isCurrentSegment ? (
                <motion.div
                  className="h-full bg-[var(--color-gold)] origin-left"
                  initial={shouldReduceMotion ? { scaleX: 1 } : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={
                    shouldReduceMotion ? {} : { duration: 8, ease: 'linear' }
                  }
                />
              ) : (
                <div className="h-full w-full bg-[var(--color-gold)]/15" />
              )}
            </div>
          );
        })}

        {/* Phase dots */}
        {PHASES.map((phase, idx) => {
          const isPast = idx < currentIdx;
          const isCurrent = idx === currentIdx;

          return (
            <div
              key={phase}
              className="relative z-10 flex flex-col items-center"
            >
              {isCurrent ? (
                <motion.div
                  className="h-2 w-2 rounded-full bg-[var(--color-gold)]"
                  animate={
                    shouldReduceMotion
                      ? {}
                      : {
                          scale: [1, 1.4, 1],
                          opacity: [0.7, 1, 0.7],
                        }
                  }
                  transition={
                    shouldReduceMotion
                      ? {}
                      : {
                          duration: 1.6,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }
                  }
                />
              ) : isPast ? (
                <div className="h-2 w-2 rounded-full bg-[var(--color-gold)]" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-[var(--color-gold)]/15 border border-[var(--color-gold)]/30" />
              )}
            </div>
          );
        })}
      </div>

      {/* Label row — gap-3 below dot row */}
      <div className="mt-3 flex items-start justify-between">
        {PHASES.map((phase, idx) => {
          const isPast = idx < currentIdx;
          const isCurrent = idx === currentIdx;

          return (
            <span
              key={phase}
              className={cn(
                'text-[10px] font-medium uppercase tracking-[0.14em] text-center',
                isCurrent
                  ? 'text-[var(--color-gold)]'
                  : isPast
                    ? inverted
                      ? 'text-white/40'
                      : 'text-[var(--color-muted)]'
                    : inverted
                      ? 'text-white/25'
                      : 'text-[var(--color-muted)]/50',
              )}
              style={{ width: `${100 / PHASES.length}%` }}
            >
              {PHASE_MARKER_LABELS[phase]}
            </span>
          );
        })}
      </div>

      {/* Dynamic phase description label — crossfades on status change */}
      <div className="mt-2">
        <AnimatePresence mode="wait">
          <motion.p
            key={status ?? 'idle'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={cn(
              'text-[11px] font-light',
              inverted ? 'text-white/50' : 'text-[var(--color-muted)]',
            )}
          >
            {statusLabel(status) ?? ' '}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

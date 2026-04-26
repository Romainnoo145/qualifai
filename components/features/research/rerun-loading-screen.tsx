'use client';

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { ResearchStatus } from '@prisma/client';
import { cn } from '@/lib/utils';
import {
  ACTIVE_RESEARCH_STATUSES,
  statusLabel,
  type ActiveResearchStatus,
} from '@/lib/research/status-labels';

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
        </div>

        {/* Progress ring visual */}
        <ProgressRing variant={variant} currentStatus={currentStatus ?? null} />

        {/* Subtext below ring */}
        <p
          className={cn(
            'text-sm font-light',
            isFull ? 'text-white/70' : 'text-[var(--color-muted)]',
          )}
        >
          Dit duurt een paar minuten.
        </p>

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
            {currentStep ?? ' '}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ProgressRing — circular SVG progress meter
// ─────────────────────────────────────────────────────────────────────

const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ProgressRing({
  variant,
  currentStatus,
}: {
  variant: 'full' | 'inline';
  currentStatus: ResearchStatus | null;
}) {
  const shouldReduceMotion = useReducedMotion();
  const isFull = variant === 'full';

  // Resolve phase index; -1 means unknown / not active
  const phaseIndex = currentStatus
    ? ACTIVE_RESEARCH_STATUSES.indexOf(currentStatus as ActiveResearchStatus)
    : -1;

  const size = isFull ? 220 : 160;

  // Fallback: no valid phase — pulsing dot
  if (phaseIndex === -1) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <motion.div
          className="h-3 w-3 rounded-full bg-[var(--color-gold)]"
          animate={
            shouldReduceMotion
              ? {}
              : { scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }
          }
          transition={
            shouldReduceMotion
              ? {}
              : { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
          }
        />
      </div>
    );
  }

  const progress = (phaseIndex + 1) / ACTIVE_RESEARCH_STATUSES.length;
  const dashOffset = CIRCUMFERENCE * (1 - progress);
  const stepNumber = phaseIndex + 1;
  const totalSteps = ACTIVE_RESEARCH_STATUSES.length;
  const label = statusLabel(currentStatus);

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* SVG ring layers */}
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{ display: 'block' }}
      >
        {/* 1. Background ring */}
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          stroke="var(--color-gold)"
          strokeOpacity={0.15}
          strokeWidth={4}
        />

        {/* 2. Progress arc */}
        {shouldReduceMotion ? (
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke="var(--color-gold)"
            strokeWidth={4}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
          />
        ) : (
          <motion.circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke="var(--color-gold)"
            strokeWidth={4}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            strokeDasharray={CIRCUMFERENCE}
            animate={{ strokeDashoffset: dashOffset }}
            initial={{ strokeDashoffset: CIRCUMFERENCE }}
            transition={{ duration: 1.2, ease: 'easeInOut' }}
          />
        )}

        {/* 3. Continuous rotating accent (skip when reduced motion) */}
        {!shouldReduceMotion && (
          <motion.circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke="var(--color-gold)"
            strokeOpacity={0.4}
            strokeWidth={2}
            strokeDasharray={`${CIRCUMFERENCE * 0.12} ${CIRCUMFERENCE * 0.88}`}
            style={{ transformOrigin: '50px 50px' }}
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 2.4, ease: 'linear', repeat: Infinity }}
          />
        )}
      </svg>

      {/* Center text overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        {/* "X / 5" */}
        <span
          className={cn(
            'font-medium leading-none',
            isFull ? 'text-3xl text-white' : 'text-2xl text-[var(--color-ink)]',
          )}
        >
          {stepNumber} / {totalSteps}
        </span>

        {/* Dutch phase label — crossfades on transition */}
        {shouldReduceMotion ? (
          <span className="text-xs font-normal uppercase tracking-[0.14em] text-[var(--color-gold)]">
            {label}
          </span>
        ) : (
          <AnimatePresence mode="wait">
            <motion.span
              key={label}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3 }}
              className="text-xs font-normal uppercase tracking-[0.14em] text-[var(--color-gold)]"
            >
              {label}
            </motion.span>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

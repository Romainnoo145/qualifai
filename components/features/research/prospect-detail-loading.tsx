'use client';

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ACTIVE_RESEARCH_STATUSES,
  statusLabel,
} from '@/lib/research/status-labels';

type ActivePhase = (typeof ACTIVE_RESEARCH_STATUSES)[number];

interface Props {
  currentStatus: ActivePhase;
}

// ─────────────────────────────────────────────────────────────────────
// Phase metadata — concise uppercase titles for the chapter cards.
// Order matches ACTIVE_RESEARCH_STATUSES.
// ─────────────────────────────────────────────────────────────────────

const PHASE_TITLES: Record<ActivePhase, string> = {
  PENDING: 'ONDERZOEK START',
  CRAWLING: 'BRONNEN VERZAMELEN',
  EXTRACTING: 'DATA-EXTRACTIE',
  HYPOTHESIS: 'HYPOTHESES',
  BRIEFING: 'BRIEFING',
};

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

// ─────────────────────────────────────────────────────────────────────
// Variant B — Process vault (light theme)
// 5 horizontal "chapter" cards mirroring Klarifai brochure section labels.
// ─────────────────────────────────────────────────────────────────────

export function ProspectDetailLoadingB({ currentStatus }: Props) {
  const shouldReduceMotion = useReducedMotion();
  const phaseIndex = ACTIVE_RESEARCH_STATUSES.indexOf(currentStatus);
  const stepNumber = phaseIndex + 1;
  const totalSteps = ACTIVE_RESEARCH_STATUSES.length;

  return (
    <div
      className="flex flex-col items-center gap-10"
      role="status"
      aria-live="polite"
    >
      {/* Heading */}
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="text-sm font-medium text-[var(--color-ink)]">
          Analyse wordt bijgewerkt
          <span style={{ color: 'var(--color-gold)' }}>.</span>
        </h2>
        <p className="text-xs font-light text-[var(--color-muted)]">
          Dit duurt een paar minuten.
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-5 gap-4 max-w-[1100px] mx-auto w-full">
        {ACTIVE_RESEARCH_STATUSES.map((phase, idx) => {
          const isPast = idx < phaseIndex;
          const isActive = idx === phaseIndex;
          const isFuture = idx > phaseIndex;

          // Border style per state
          let borderClass = 'border-[var(--color-border)]';
          if (isActive) borderClass = 'border-[var(--color-gold)]';
          else if (isPast) borderClass = 'border-[var(--color-gold)]/50';

          const bracketClass = isFuture
            ? 'text-[var(--color-gold)]/30'
            : 'text-[var(--color-gold)]';
          const titleClass = isFuture
            ? 'text-[var(--color-muted)]'
            : 'text-[var(--color-ink)]';

          const title = PHASE_TITLES[phase];

          const cardInner = (
            <>
              <div
                className={`text-[11px] font-medium uppercase tracking-[0.15em] ${bracketClass}`}
              >
                [ {pad2(idx + 1)} ]
              </div>
              <div
                className={`mt-3 text-[11px] font-medium uppercase tracking-[0.12em] leading-tight ${titleClass}`}
              >
                {title}
              </div>

              {/* Past: small checkmark */}
              {isPast ? (
                <div
                  className="absolute bottom-3 right-3 text-sm font-medium"
                  style={{ color: 'var(--color-gold)' }}
                  aria-hidden="true"
                >
                  ✓
                </div>
              ) : null}

              {/* Active: bottom progress fill */}
              {isActive ? (
                <div className="absolute inset-x-0 bottom-0 h-[3px] overflow-hidden rounded-b-md">
                  {shouldReduceMotion ? (
                    <div
                      className="h-full bg-[var(--color-gold)]"
                      style={{ width: '50%' }}
                    />
                  ) : (
                    <motion.div
                      className="h-full bg-[var(--color-gold)]"
                      initial={{ width: '8%' }}
                      animate={{ width: ['8%', '92%'] }}
                      transition={{
                        duration: 2.4,
                        ease: 'easeInOut',
                        repeat: Infinity,
                        repeatType: 'reverse',
                      }}
                    />
                  )}
                </div>
              ) : null}
            </>
          );

          if (isActive && !shouldReduceMotion) {
            return (
              <motion.div
                key={phase}
                className={`relative min-h-[160px] p-5 rounded-md border-[1.5px] bg-[var(--color-surface)] ${borderClass}`}
                animate={{
                  boxShadow: [
                    '0 0 16px -6px rgb(228 195 60 / 0.25)',
                    '0 0 28px -2px rgb(228 195 60 / 0.6)',
                    '0 0 16px -6px rgb(228 195 60 / 0.25)',
                  ],
                }}
                transition={{
                  duration: 2,
                  ease: 'easeInOut',
                  repeat: Infinity,
                }}
                aria-current="step"
                aria-label={`${statusLabel(phase) ?? title} — actieve stap`}
              >
                {cardInner}
              </motion.div>
            );
          }

          return (
            <div
              key={phase}
              className={`relative min-h-[160px] p-5 rounded-md border-[1.5px] bg-[var(--color-surface)] ${borderClass}`}
              aria-label={statusLabel(phase) ?? title}
            >
              {cardInner}
            </div>
          );
        })}
      </div>

      {/* Step caption */}
      <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-gold)]">
        Stap {pad2(stepNumber)} van {pad2(totalSteps)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Variant C — Ambient pulse (light theme)
// Single dominant typographic centerpiece, brochure-titlepage feel.
// ─────────────────────────────────────────────────────────────────────

export function ProspectDetailLoadingC({ currentStatus }: Props) {
  const shouldReduceMotion = useReducedMotion();
  const phaseIndex = ACTIVE_RESEARCH_STATUSES.indexOf(currentStatus);
  const stepNumber = phaseIndex + 1;
  const totalSteps = ACTIVE_RESEARCH_STATUSES.length;
  const label = statusLabel(currentStatus) ?? '';

  return (
    <div
      className="flex flex-col items-center justify-center text-center py-20"
      role="status"
      aria-live="polite"
    >
      {/* Heading */}
      <h2 className="text-sm font-medium text-[var(--color-ink)]">
        Analyse wordt bijgewerkt
        <span style={{ color: 'var(--color-gold)' }}>.</span>
      </h2>

      <div className="h-8" />

      {/* Mono step label */}
      <div
        className="text-[14px] font-medium uppercase text-[var(--color-gold)]"
        style={{ letterSpacing: '0.2em' }}
      >
        {pad2(stepNumber)} / {pad2(totalSteps)}
      </div>

      <div className="h-6" />

      {/* Giant title */}
      <AnimatePresence mode="wait">
        <motion.h1
          key={currentStatus}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="font-bold tracking-[-0.025em] leading-[1.05] text-[var(--color-ink)]"
          style={{ fontSize: 'clamp(48px, 7vw, 88px)' }}
        >
          {label}
          <span style={{ color: 'var(--color-gold)' }}>.</span>
        </motion.h1>
      </AnimatePresence>

      <div className="h-10" />

      {/* Progress bar with pulsing puck */}
      <div className="relative w-full max-w-[600px] h-[2px] bg-[var(--color-border)]">
        {shouldReduceMotion ? (
          <>
            <div
              className="absolute inset-y-0 left-0 bg-[var(--color-gold)]"
              style={{ width: '40%' }}
            />
            <div
              className="absolute top-1/2 w-2 h-2 rounded-full bg-[var(--color-gold)]"
              style={{
                left: '40%',
                transform: 'translate(-50%, -50%)',
                opacity: 0.85,
              }}
            />
          </>
        ) : (
          <>
            <motion.div
              className="absolute inset-y-0 left-0 bg-[var(--color-gold)]"
              initial={{ width: '38%' }}
              animate={{ width: ['38%', '42%'] }}
              transition={{
                duration: 1.8,
                ease: 'easeInOut',
                repeat: Infinity,
                repeatType: 'reverse',
              }}
            />
            <motion.div
              className="absolute top-1/2 w-2 h-2 rounded-full bg-[var(--color-gold)]"
              style={{ transform: 'translate(-50%, -50%)' }}
              initial={{ left: '38%', scale: 1, opacity: 0.7 }}
              animate={{
                left: ['38%', '42%'],
                scale: [1, 1.6, 1],
                opacity: [0.7, 1, 0.7],
              }}
              transition={{
                duration: 1.4,
                ease: 'easeInOut',
                repeat: Infinity,
              }}
            />
          </>
        )}
      </div>

      <div className="h-4" />

      {/* Step caption */}
      <p className="text-xs font-light text-[var(--color-muted)]">
        Stap {pad2(stepNumber)} van {pad2(totalSteps)}
      </p>

      <div className="h-12" />

      {/* Subtext */}
      <p className="text-sm font-light text-[var(--color-muted-dark)]">
        Dit duurt een paar minuten.
      </p>
    </div>
  );
}

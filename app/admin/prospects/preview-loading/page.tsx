'use client';

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { statusLabel } from '@/lib/research/status-labels';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActivePhase =
  | 'PENDING'
  | 'CRAWLING'
  | 'EXTRACTING'
  | 'HYPOTHESIS'
  | 'BRIEFING';

const PHASES: readonly ActivePhase[] = [
  'PENDING',
  'CRAWLING',
  'EXTRACTING',
  'HYPOTHESIS',
  'BRIEFING',
] as const;

// Concise card titles (separate from full statusLabel)
const CARD_TITLES: Record<ActivePhase, string> = {
  PENDING: 'ONDERZOEK START',
  CRAWLING: 'BRONNEN VERZAMELEN',
  EXTRACTING: 'DATA-EXTRACTIE',
  HYPOTHESIS: 'HYPOTHESES',
  BRIEFING: 'BRIEFING',
};

// ---------------------------------------------------------------------------
// Variant B — Process vault
// ---------------------------------------------------------------------------

function ProcessVaultLoading({
  currentStatus,
}: {
  currentStatus: ActivePhase;
}) {
  const prefersReducedMotion = useReducedMotion();
  const currentIndex = PHASES.indexOf(currentStatus);

  return (
    <div className="flex flex-col items-center">
      {/* Heading row */}
      <div className="text-center mb-10">
        <motion.span
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="block text-sm font-medium text-white"
        >
          Analyse wordt bijgewerkt
          <span style={{ color: 'var(--color-gold)' }}>.</span>
        </motion.span>
        <p className="mt-2 text-xs font-light text-white/60">
          Dit duurt een paar minuten.
        </p>
      </div>

      {/* Card row */}
      <div className="grid grid-cols-5 gap-4 max-w-[1100px] mx-auto w-full">
        {PHASES.map((phase, idx) => {
          const number = String(idx + 1).padStart(2, '0');
          const isActive = idx === currentIndex;
          const isComplete = idx < currentIndex;
          const isUpcoming = idx > currentIndex;

          const borderClass = isActive
            ? 'border-[var(--color-gold)]'
            : isComplete
              ? 'border-[var(--color-gold)]/60'
              : 'border-white/15';

          const bracketColor = isUpcoming
            ? 'text-[var(--color-gold)]/30'
            : 'text-[var(--color-gold)]';

          const titleColor = isUpcoming ? 'text-white/30' : 'text-white';

          const activeShadow = isActive
            ? prefersReducedMotion
              ? { boxShadow: '0 0 24px -4px rgb(228 195 60 / 0.5)' }
              : undefined
            : undefined;

          return (
            <motion.div
              key={phase}
              className={`relative border-[1.5px] ${borderClass} rounded-md p-5 min-h-[160px] flex flex-col`}
              style={activeShadow}
              animate={
                isActive && !prefersReducedMotion
                  ? {
                      boxShadow: [
                        '0 0 20px -8px rgb(228 195 60 / 0.3)',
                        '0 0 32px -4px rgb(228 195 60 / 0.6)',
                        '0 0 20px -8px rgb(228 195 60 / 0.3)',
                      ],
                    }
                  : undefined
              }
              transition={
                isActive && !prefersReducedMotion
                  ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
                  : undefined
              }
            >
              <span
                className={`text-[11px] font-medium uppercase tracking-[0.15em] ${bracketColor}`}
              >
                [ {number} ]
              </span>

              <span
                className={`mt-3 text-[11px] font-medium uppercase tracking-[0.12em] leading-tight ${titleColor}`}
              >
                {CARD_TITLES[phase]}
              </span>

              {/* Completed checkmark */}
              {isComplete && (
                <span
                  className="absolute bottom-3 right-3 text-sm font-medium"
                  style={{ color: 'var(--color-gold)' }}
                >
                  ✓
                </span>
              )}

              {/* Active progress fill */}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/5 overflow-hidden">
                  {prefersReducedMotion ? (
                    <div
                      className="h-[3px]"
                      style={{
                        width: '70%',
                        backgroundColor: 'var(--color-gold)',
                      }}
                    />
                  ) : (
                    <motion.div
                      className="h-[3px]"
                      style={{ backgroundColor: 'var(--color-gold)' }}
                      animate={{ width: ['0%', '70%'] }}
                      transition={{
                        duration: 2.4,
                        repeat: Infinity,
                        repeatType: 'reverse',
                        ease: 'easeInOut',
                      }}
                    />
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Caption */}
      <p
        className="mt-8 text-[11px] font-medium uppercase tracking-[0.15em]"
        style={{ color: 'var(--color-gold)' }}
      >
        Stap {String(currentIndex + 1).padStart(2, '0')} van{' '}
        {String(PHASES.length).padStart(2, '0')}
      </p>

      {/* Hidden helper to confirm statusLabel is wired (used for a11y/title) */}
      <span className="sr-only">{statusLabel(currentStatus)}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant C — Ambient pulse
// ---------------------------------------------------------------------------

function AmbientPulseLoading({
  currentStatus,
}: {
  currentStatus: ActivePhase;
}) {
  const prefersReducedMotion = useReducedMotion();
  const currentIndex = PHASES.indexOf(currentStatus);
  const stepLabel = `${String(currentIndex + 1).padStart(2, '0')} / ${String(PHASES.length).padStart(2, '0')}`;
  const fullLabel = statusLabel(currentStatus) ?? '';

  return (
    <div className="flex flex-col items-center justify-center text-center">
      {/* Top heading */}
      <span className="text-sm font-medium text-white">
        Analyse wordt bijgewerkt
        <span style={{ color: 'var(--color-gold)' }}>.</span>
      </span>

      <div className="h-8" />

      {/* Mono step label */}
      <span
        className="text-[14px] font-medium uppercase"
        style={{
          color: 'var(--color-gold)',
          letterSpacing: '0.2em',
        }}
      >
        {stepLabel}
      </span>

      <div className="h-6" />

      {/* Giant title */}
      <AnimatePresence mode="wait">
        <motion.h1
          key={currentStatus}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="font-bold text-white"
          style={{
            fontSize: 'clamp(56px, 8vw, 96px)',
            letterSpacing: '-0.025em',
            lineHeight: 1.05,
          }}
        >
          {fullLabel}
          <span style={{ color: 'var(--color-gold)' }}>.</span>
        </motion.h1>
      </AnimatePresence>

      <div className="h-10" />

      {/* Progress bar */}
      <div className="relative w-full max-w-[600px] h-[2px] bg-white/10">
        {prefersReducedMotion ? (
          <>
            <div
              className="absolute inset-y-0 left-0"
              style={{
                width: '40%',
                backgroundColor: 'var(--color-gold)',
              }}
            />
            <div
              className="absolute top-1/2 w-2 h-2 rounded-full -translate-y-1/2 -translate-x-1/2"
              style={{
                left: '40%',
                backgroundColor: 'var(--color-gold)',
              }}
            />
          </>
        ) : (
          <>
            <motion.div
              className="absolute inset-y-0 left-0"
              style={{ backgroundColor: 'var(--color-gold)' }}
              animate={{ width: ['38%', '42%'] }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                repeatType: 'reverse',
                ease: 'easeInOut',
              }}
            />
            <motion.div
              className="absolute top-1/2 w-2 h-2 rounded-full -translate-y-1/2 -translate-x-1/2"
              style={{
                backgroundColor: 'var(--color-gold)',
              }}
              animate={{
                left: ['38%', '42%'],
                scale: [1, 1.6, 1],
                opacity: [0.7, 1, 0.7],
              }}
              transition={{
                left: {
                  duration: 1.8,
                  repeat: Infinity,
                  repeatType: 'reverse',
                  ease: 'easeInOut',
                },
                scale: {
                  duration: 1.4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                },
                opacity: {
                  duration: 1.4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                },
              }}
            />
          </>
        )}
      </div>

      <div className="h-4" />

      <p className="text-xs font-light text-white/50">
        Stap {String(currentIndex + 1).padStart(2, '0')} van{' '}
        {String(PHASES.length).padStart(2, '0')}
      </p>

      <div className="h-12" />

      <p className="text-sm font-light text-white/60">
        Dit duurt een paar minuten.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PreviewLoadingPage() {
  return (
    <main className="mx-auto max-w-[1280px] px-8 py-12 space-y-16">
      <header>
        <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-gold)] font-medium mb-2">
          LOADING STATE PREVIEW
        </p>
        <h1 className="text-4xl font-bold text-[var(--color-ink)] tracking-[-0.02em] mb-3">
          Vergelijk varianten
          <span style={{ color: 'var(--color-gold)' }}>.</span>
        </h1>
        <p className="text-sm font-light text-[var(--color-muted)]">
          Beide tonen mock-status CRAWLING (fase 02/05). Klik niet — ze pollen
          niet.
        </p>
      </header>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-[var(--color-muted)] mb-6">
          Variant B — Process vault
        </h2>
        <div className="rounded-md overflow-hidden border border-[var(--color-border)]">
          <div
            className="py-20 px-8"
            style={{ backgroundColor: 'var(--color-ink)' }}
          >
            <ProcessVaultLoading currentStatus="CRAWLING" />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-[var(--color-muted)] mb-6">
          Variant C — Ambient pulse
        </h2>
        <div className="rounded-md overflow-hidden border border-[var(--color-border)]">
          <div
            className="py-32 px-8"
            style={{ backgroundColor: 'var(--color-ink)' }}
          >
            <AmbientPulseLoading currentStatus="CRAWLING" />
          </div>
        </div>
      </section>
    </main>
  );
}

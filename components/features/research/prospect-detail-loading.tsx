'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  ACTIVE_RESEARCH_STATUSES,
  statusLabel,
} from '@/lib/research/status-labels';

type ActivePhase = (typeof ACTIVE_RESEARCH_STATUSES)[number];

interface Props {
  currentStatus: ActivePhase;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export function ProspectDetailLoading({ currentStatus }: Props) {
  const shouldReduceMotion = useReducedMotion();
  const phaseIndex = ACTIVE_RESEARCH_STATUSES.indexOf(currentStatus);
  const stepNumber = phaseIndex + 1;
  const totalSteps = ACTIVE_RESEARCH_STATUSES.length;
  const label = statusLabel(currentStatus) ?? currentStatus;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Analyse loopt: ${label}`}
    >
      {/* Section header — same pattern as admin section rows */}
      <div className="flex items-center gap-4">
        <span
          className="text-[10px] font-medium uppercase tracking-[0.15em] whitespace-nowrap flex-shrink-0"
          style={{ color: 'var(--color-muted)' }}
        >
          Analyse loopt
        </span>
        <div
          className="flex-1 h-px relative overflow-hidden"
          style={{ background: 'var(--color-border)' }}
        >
          {shouldReduceMotion ? (
            <div
              className="absolute inset-y-0"
              style={{
                left: '0',
                width: '40%',
                background: 'var(--color-ink)',
              }}
            />
          ) : (
            <motion.div
              className="absolute inset-y-0"
              style={{ background: 'var(--color-ink)', width: '35%' }}
              animate={{ left: ['-35%', '110%'] }}
              transition={{
                duration: 1.8,
                ease: [0.4, 0, 0.2, 1],
                repeat: Infinity,
                repeatType: 'loop',
              }}
            />
          )}
        </div>
      </div>

      {/* Phase label — brochure eyebrow pattern */}
      <div className="mt-5 flex items-baseline gap-3">
        <span
          className="text-[11px] font-medium uppercase tracking-[0.15em]"
          style={{ color: 'var(--color-gold)' }}
        >
          [ {pad2(stepNumber)} ]
        </span>
        <span
          className="text-[11px] font-medium uppercase tracking-[0.15em]"
          style={{ color: 'var(--color-ink)' }}
        >
          {label.toUpperCase()}
        </span>
        <span
          className="text-[11px] font-medium tracking-[0.1em] ml-auto"
          style={{
            color: 'var(--color-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {pad2(stepNumber)} / {pad2(totalSteps)}
        </span>
      </div>
    </div>
  );
}

// Keep old exports so any remaining preview references don't break
export { ProspectDetailLoading as ProspectDetailLoadingB };
export { ProspectDetailLoading as ProspectDetailLoadingC };

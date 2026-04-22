'use client';

import type { ResearchStatus } from '@prisma/client';
import { motion, useReducedMotion } from 'framer-motion';
import { isActiveStatus, statusLabel } from '@/lib/research/status-labels';

interface Props {
  status: ResearchStatus | string | null | undefined;
}

export function ResearchRunBadge({ status }: Props) {
  const reduceMotion = useReducedMotion();

  if (!isActiveStatus(status)) return null;

  const label = statusLabel(status) ?? 'bezig';

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={`Onderzoek loopt: ${label}`}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-ink)] bg-[var(--color-gold)]/15 border border-[var(--color-gold)]/40"
    >
      <span className="flex items-center gap-0.5" aria-hidden="true">
        {[0, 0.15, 0.3].map((delay, i) => (
          <motion.span
            key={i}
            className="h-1 w-1 rounded-full bg-[var(--color-gold)]"
            animate={
              reduceMotion ? {} : { scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }
            }
            transition={
              reduceMotion
                ? undefined
                : {
                    duration: 1.2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay,
                  }
            }
          />
        ))}
      </span>
      onderzoek loopt
    </span>
  );
}

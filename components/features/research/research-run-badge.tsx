'use client';

import type { ResearchStatus } from '@prisma/client';
import { motion, useReducedMotion } from 'framer-motion';
import { isActiveStatus } from '@/lib/research/status-labels';

interface Props {
  status: ResearchStatus | string | null | undefined;
}

export function ResearchRunBadge({ status }: Props) {
  const reduceMotion = useReducedMotion();

  if (!isActiveStatus(status)) return null;

  return (
    <motion.span
      role="status"
      aria-live="polite"
      aria-label="Onderzoek loopt"
      className="text-[11px] font-300 italic"
      style={{ color: 'var(--color-muted)' }}
      animate={reduceMotion ? {} : { opacity: [0.45, 1, 0.45] }}
      transition={
        reduceMotion
          ? undefined
          : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
      }
    >
      onderzoek loopt…
    </motion.span>
  );
}

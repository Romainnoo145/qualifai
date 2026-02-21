'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  interactive?: boolean;
  intensity?: 'low' | 'medium' | 'high';
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      className,
      hoverable = false,
      interactive = false,
      intensity = 'medium',
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'glass-card',
          hoverable && 'glass-card-hover',
          interactive && 'card-interactive cursor-pointer',
          intensity === 'low' && 'bg-white/5 backdrop-blur-md',
          intensity === 'high' && 'bg-white/[0.08] backdrop-blur-2xl',
          className,
        )}
        {...props}
      />
    );
  },
);

GlassCard.displayName = 'GlassCard';

export { GlassCard };

'use client';

import { useState } from 'react';
import { buildInlineGoogleFaviconUrl } from '@/lib/enrichment/favicon';
import { cn } from '@/lib/utils';

interface ProspectLogoProps {
  prospect: {
    logoUrl: string | null;
    domain: string | null;
    companyName: string | null;
  };
  size?: number;
  shape?: 'circle' | 'rounded'; // drives base shape class, default 'circle'
  className?: string;
}

type Stage = 'apollo' | 'favicon' | 'initial';

/**
 * Three-level logo fallback: Apollo logoUrl → Google favicon → initial
 * letter circle. Uses `<img onError>` to cascade through stages client-side
 * without any probing latency.
 *
 * Phase 61.1 POLISH-10 / POLISH-11 — rendered in both the prospect list
 * cards (shape='rounded', size=56) and the prospect detail page header
 * (shape='circle', size=64).
 *
 * The `shape` prop drives the base rounding class (rounded-full vs
 * rounded-2xl) so callers don't have to fight tailwind-merge precedence
 * via className overrides.
 */
export function ProspectLogo({
  prospect,
  size = 40,
  shape = 'circle',
  className,
}: ProspectLogoProps): React.ReactElement {
  // Decide the initial stage from the data we have
  const initialStage: Stage = prospect.logoUrl
    ? 'apollo'
    : prospect.domain
      ? 'favicon'
      : 'initial';

  const [stage, setStage] = useState<Stage>(initialStage);

  const handleError = () => {
    if (stage === 'apollo') {
      setStage(prospect.domain ? 'favicon' : 'initial');
    } else if (stage === 'favicon') {
      setStage('initial');
    }
  };

  const initial =
    (prospect.companyName ?? prospect.domain ?? '?')
      .trim()
      .charAt(0)
      .toUpperCase() || '?';

  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-2xl';

  const sharedStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
  };

  if (stage === 'initial') {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-slate-200 font-bold text-slate-700',
          shapeClass,
          className,
        )}
        style={sharedStyle}
        aria-label={`Logo placeholder for ${prospect.companyName ?? prospect.domain ?? 'unknown prospect'}`}
        data-testid="prospect-logo-initial"
        data-shape={shape}
      >
        {initial}
      </div>
    );
  }

  const src =
    stage === 'apollo'
      ? prospect.logoUrl!
      : (buildInlineGoogleFaviconUrl(prospect.domain!, size * 2) ?? '');

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={prospect.companyName ?? prospect.domain ?? 'Prospect logo'}
      width={size}
      height={size}
      loading="lazy"
      onError={handleError}
      className={cn('object-contain', shapeClass, className)}
      style={sharedStyle}
      data-testid={`prospect-logo-${stage}`}
      data-shape={shape}
    />
  );
}

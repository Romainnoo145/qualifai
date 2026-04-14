'use client';

import { useState } from 'react';
import {
  buildInlineDuckDuckGoFaviconUrl,
  buildInlineGoogleFaviconUrl,
} from '@/lib/enrichment/favicon';
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

type Stage = 'apollo' | 'ddg' | 'google' | 'initial';

/**
 * Four-level logo fallback: Apollo logoUrl → DuckDuckGo favicon → Google
 * favicon → initial letter circle. Uses `<img onError>` to cascade through
 * stages client-side without any probing latency.
 *
 * DuckDuckGo is the primary favicon source because it scrapes the site's
 * own favicon directly (works for small Dutch SMBs). Google's s2 is the
 * secondary because it returns a generic globe with HTTP 200 for misses,
 * which would otherwise stick forever without onError firing.
 *
 * Phase 61.1 POLISH-10 / POLISH-11 — rendered in both the prospect list
 * cards (shape='rounded', size=56) and the prospect detail page header
 * (shape='circle', size=64).
 */
export function ProspectLogo({
  prospect,
  size = 40,
  shape = 'circle',
  className,
}: ProspectLogoProps): React.ReactElement {
  const initialStage: Stage = prospect.logoUrl
    ? 'apollo'
    : prospect.domain
      ? 'ddg'
      : 'initial';

  const [stage, setStage] = useState<Stage>(initialStage);

  const handleError = () => {
    if (stage === 'apollo') {
      setStage(prospect.domain ? 'ddg' : 'initial');
    } else if (stage === 'ddg') {
      setStage(prospect.domain ? 'google' : 'initial');
    } else if (stage === 'google') {
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
      : stage === 'ddg'
        ? (buildInlineDuckDuckGoFaviconUrl(prospect.domain!) ?? '')
        : (buildInlineGoogleFaviconUrl(prospect.domain!, 128) ?? '');

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

'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ProspectLogoProps {
  prospect: {
    logoUrl: string | null;
    companyName: string | null;
    domain: string | null;
  };
  size?: number;
  shape?: 'circle' | 'rounded';
  className?: string;
}

/**
 * Three-stage logo cascade:
 *   1. Google Favicon API (clean 128px icon for most domains)
 *   2. Stored logoUrl with object-cover crop (handles banners/og:images)
 *   3. Initial-letter avatar fallback
 *
 * Each stage falls through on load error.
 */
export function ProspectLogo({
  prospect,
  size = 40,
  shape = 'circle',
  className,
}: ProspectLogoProps): React.ReactElement {
  const [stage, setStage] = useState<'favicon' | 'stored' | 'initial'>(
    'favicon',
  );

  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-2xl';
  const sharedStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
  };

  const faviconUrl = prospect.domain
    ? `https://www.google.com/s2/favicons?domain=${prospect.domain}&sz=128`
    : null;

  // Determine what to show based on current stage
  if (stage === 'favicon' && faviconUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={faviconUrl}
        alt={prospect.companyName ?? prospect.domain ?? 'Prospect logo'}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setStage(prospect.logoUrl ? 'stored' : 'initial')}
        className={cn('object-contain bg-white', shapeClass, className)}
        style={sharedStyle}
        data-testid="prospect-logo-favicon"
      />
    );
  }

  if (stage !== 'initial' && prospect.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={prospect.logoUrl}
        alt={prospect.companyName ?? prospect.domain ?? 'Prospect logo'}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setStage('initial')}
        className={cn('object-cover bg-white', shapeClass, className)}
        style={sharedStyle}
        data-testid="prospect-logo-stored"
      />
    );
  }

  // Stage 3: initial letter avatar
  const initial =
    (prospect.companyName ?? prospect.domain ?? '?')
      .trim()
      .charAt(0)
      .toUpperCase() || '?';
  return (
    <div
      className={cn(
        'flex items-center justify-center bg-[var(--color-surface-2)] font-medium text-[var(--color-muted-dark)]',
        shapeClass,
        className,
      )}
      style={sharedStyle}
      aria-label={`Logo placeholder for ${prospect.companyName ?? prospect.domain ?? 'unknown prospect'}`}
      data-testid="prospect-logo-initial"
    >
      {initial}
    </div>
  );
}

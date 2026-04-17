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
 * Two-stage logo: stored logoUrl → initial-letter avatar.
 *
 * Uses object-cover + rounded crop so even banner/og:images
 * render as clean square icons.
 */
export function ProspectLogo({
  prospect,
  size = 40,
  shape = 'circle',
  className,
}: ProspectLogoProps): React.ReactElement {
  const [failed, setFailed] = useState(false);

  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-xl';
  const sharedStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
  };

  if (prospect.logoUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={prospect.logoUrl}
        alt={prospect.companyName ?? prospect.domain ?? 'Prospect logo'}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn(
          'object-contain bg-[var(--color-surface-2)] shrink-0 p-1',
          shapeClass,
          className,
        )}
        style={{ ...sharedStyle, minWidth: `${size}px`, maxWidth: `${size}px` }}
        data-testid="prospect-logo-image"
      />
    );
  }

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

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
 * Two-stage logo rendering: validated DB logoUrl → initial-letter avatar.
 *
 * Phase 61.3 unification: the backend resolveLogoUrl pipeline guarantees that
 * whatever lands in `prospect.logoUrl` is a HEAD-verified live URL. We no
 * longer cascade through DDG / Google fallbacks in the browser. When logoUrl
 * is null or the img fails to load (e.g. network hiccup or URL went stale
 * post-write), we drop straight to the initial-letter avatar.
 *
 * The shape prop drives the base rounding class so callers can request
 * circle (detail header) or rounded (list card) without fighting Tailwind
 * class precedence via className overrides.
 */
export function ProspectLogo({
  prospect,
  size = 40,
  shape = 'circle',
  className,
}: ProspectLogoProps): React.ReactElement {
  const [imageFailed, setImageFailed] = useState(false);

  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-2xl';
  const sharedStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
  };

  // Prefer Google's favicon API for clean icons — the stored logoUrl
  // is often an og:image / social card banner, not a real logo.
  const faviconUrl = prospect.domain
    ? `https://www.google.com/s2/favicons?domain=${prospect.domain}&sz=128`
    : null;
  const imgSrc = !imageFailed ? (faviconUrl ?? prospect.logoUrl) : null;

  if (!imgSrc) {
    const initial =
      (prospect.companyName ?? prospect.domain ?? '?')
        .trim()
        .charAt(0)
        .toUpperCase() || '?';
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

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imgSrc}
      alt={prospect.companyName ?? prospect.domain ?? 'Prospect logo'}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setImageFailed(true)}
      className={cn('object-contain', shapeClass, className)}
      style={sharedStyle}
      data-testid="prospect-logo-image"
      data-shape={shape}
    />
  );
}

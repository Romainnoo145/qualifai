'use client';

import {
  NAVY,
  NAVY_DEEP,
  GOLD_GRADIENT,
  GOLD_LIGHT,
  TEXT_ON_NAVY,
} from '@/lib/brochure-tokens';

/**
 * Top-left brand chrome: Klarifai icon alone.
 *
 * Earlier iterations showed `Klarifai × ClientLogo` but most prospects only
 * have hero/banner photos in `prospect.logoUrl` (Wix og:image etc), not real
 * square logos. Displaying those as a "logo" looks broken. Until we have
 * proper logo sourcing (Brandfetch/Logo.dev/manual upload), the chrome is
 * Klarifai-only. The companyName already appears in the page content.
 */
export function BrandChrome() {
  return (
    <div
      style={{
        position: 'fixed',
        top: '32px',
        left: '48px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        fontFamily: 'var(--font-sora), sans-serif',
        zIndex: 20,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/klarifai-icon.svg"
        alt="Klarifai"
        width={36}
        height={36}
        style={{ width: '36px', height: '36px', display: 'block' }}
      />
    </div>
  );
}

export function ProgressIndicator({ label }: { label: string }) {
  return (
    <div
      aria-label={`Pagina ${label}`}
      style={{
        position: 'fixed',
        top: '32px',
        right: '32px',
        fontWeight: 500,
        fontSize: '11px',
        letterSpacing: '0.15em',
        color: GOLD_LIGHT,
        textTransform: 'uppercase',
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: 20,
      }}
    >
      {label}
    </div>
  );
}

/**
 * Subtle geometric backdrop echoing the video's motion graphics —
 * rotated rounded rectangles in a deeper navy, very low opacity.
 * Purely decorative, aria-hidden.
 */
export function GeometricBackdrop() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <defs>
        <linearGradient id="shape-fade" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={NAVY_DEEP} stopOpacity="0.7" />
          <stop offset="100%" stopColor={NAVY_DEEP} stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <g fill="url(#shape-fade)">
        <rect
          x="-120"
          y="-40"
          width="320"
          height="320"
          rx="40"
          transform="rotate(18 40 120)"
        />
        <rect
          x="60"
          y="420"
          width="260"
          height="260"
          rx="32"
          transform="rotate(18 190 550)"
        />
        <rect
          x="1180"
          y="-80"
          width="360"
          height="360"
          rx="44"
          transform="rotate(18 1360 100)"
        />
        <rect
          x="1080"
          y="520"
          width="280"
          height="280"
          rx="36"
          transform="rotate(18 1220 660)"
        />
      </g>
      <g stroke={NAVY_DEEP} strokeWidth="1" opacity="0.35">
        <line x1="-100" y1="780" x2="820" y2="-60" />
        <line x1="620" y1="960" x2="1540" y2="120" />
      </g>
    </svg>
  );
}

export function NextArrow({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Volgende pagina"
      style={{
        position: 'fixed',
        right: '48px',
        bottom: '48px',
        width: '64px',
        height: '64px',
        borderRadius: '9999px',
        border: 'none',
        cursor: 'pointer',
        background: GOLD_GRADIENT,
        color: NAVY,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.2), 0 8px 24px rgba(225, 195, 60, 0.35)',
        transition: 'transform 150ms ease-out, box-shadow 150ms ease-out',
        zIndex: 20,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px) scale(1.03)';
        e.currentTarget.style.boxShadow =
          '0 2px 4px rgba(0,0,0,0.2), 0 12px 32px rgba(225, 195, 60, 0.5)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow =
          '0 1px 2px rgba(0,0,0,0.2), 0 8px 24px rgba(225, 195, 60, 0.35)';
      }}
    >
      <ArrowIcon direction="right" />
    </button>
  );
}

export function BackArrow({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Vorige pagina"
      style={{
        position: 'fixed',
        left: '48px',
        bottom: '48px',
        width: '64px',
        height: '64px',
        borderRadius: '9999px',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        background: 'rgba(255, 255, 255, 0.04)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: TEXT_ON_NAVY,
        transition: 'background 150ms ease-out, transform 150ms ease-out',
        zIndex: 20,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
        e.currentTarget.style.transform = 'none';
      }}
    >
      <ArrowIcon direction="left" />
    </button>
  );
}

export function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  if (direction === 'left') {
    return (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
    );
  }
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

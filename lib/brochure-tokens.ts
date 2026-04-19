import type React from 'react';

export const NAVY = '#040026';
export const NAVY_DEEP = '#000319';
export const CONTAINER_GRADIENT =
  'linear-gradient(180deg, #040026 0%, #080054 100%)';
export const CONTAINER_BORDER = 'rgba(53, 59, 102, 0.55)';
export const GOLD_GRADIENT =
  'linear-gradient(180deg, #e1c33c 0%, #fdf97b 100%)';
export const GOLD_LIGHT = '#fdf97b';
export const GOLD_MID = '#e1c33c';
export const TEXT_ON_NAVY = '#fefefe';
export const TEXT_MUTED_ON_NAVY = '#898999';

export const pageBase: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: NAVY,
  overflow: 'hidden',
  fontFamily: 'var(--font-sora), sans-serif',
};

export const sectionLabelStyle: React.CSSProperties = {
  fontWeight: 500,
  fontSize: '12px',
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  display: 'flex',
  alignItems: 'center',
};

export const goldGradientText: React.CSSProperties = {
  background: GOLD_GRADIENT,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
};

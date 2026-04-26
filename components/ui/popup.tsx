'use client';

import { useEffect } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const SIZES: Record<NonNullable<Props['size']>, string> = {
  sm: 'max-w-[420px]',
  md: 'max-w-[560px]',
  lg: 'max-w-[720px]',
};

export function Popup({
  isOpen,
  onClose,
  title,
  eyebrow = 'Bewerken',
  size,
  children,
}: Props) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(10,10,46,0.35)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className={`w-full ${SIZES[size ?? 'sm']} mx-4 bg-white border border-[var(--color-border)] rounded-[8px] p-7 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)] mb-3">
          {eyebrow}
        </p>
        <h2 className="font-['Sora'] text-[22px] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--color-ink)] mb-6">
          {title}
          <span style={{ color: 'var(--color-gold)' }}>.</span>
        </h2>
        {children}
      </div>
    </div>
  );
}

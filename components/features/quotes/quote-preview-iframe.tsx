'use client';

/**
 * QuotePreviewIframe — Phase 61-03 / ADMIN-04.
 *
 * Client-side wrapper that reads the admin token from localStorage and
 * renders a sandboxed iframe pointing at /admin/quotes/[id]/preview.html.
 * The server route validates the token and returns the fully-rendered HTML.
 *
 * NEVER constructs a snapshot (Pitfall 1) — the server route reads the
 * live quote and feeds it to renderQuotePreview.
 */

import { useSyncExternalStore } from 'react';
import { ADMIN_TOKEN_STORAGE_KEY } from '@/lib/admin-token';

interface Props {
  quoteId: string;
}

// useSyncExternalStore snapshot reads localStorage without triggering the
// react-hooks/set-state-in-effect lint rule. SSR snapshot returns null; on
// hydrate the real token is read synchronously and the iframe renders.
function subscribeToken(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === ADMIN_TOKEN_STORAGE_KEY) onStoreChange();
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

function getTokenSnapshot(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
}

function getServerSnapshot(): string | null {
  return null;
}

export function QuotePreviewIframe({ quoteId }: Props) {
  const token = useSyncExternalStore(
    subscribeToken,
    getTokenSnapshot,
    getServerSnapshot,
  );

  if (token === null) {
    return (
      <div className="glass-card p-8 text-center text-sm text-red-600">
        Geen admin-token gevonden in deze browser. Log opnieuw in om het
        voorbeeld te bekijken.
      </div>
    );
  }

  const src = `/admin/quotes/${quoteId}/preview.html?token=${encodeURIComponent(token)}`;

  return (
    <div className="space-y-2">
      <div className="glass-card p-4">
        <iframe
          src={src}
          className="h-[80vh] w-full rounded-xl border border-slate-100"
          sandbox="allow-same-origin allow-scripts allow-popups"
          title="Offerte voorbeeld"
        />
      </div>
      <p className="text-xs text-slate-400">
        Tijdelijke voorbeeldrenderer (Phase 61). De nieuwe web-voorstel ervaring
        komt in Phase 62.
      </p>
    </div>
  );
}

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@/server/routers/_app';
import { useState } from 'react';
import { ADMIN_TOKEN_STORAGE_KEY, normalizeAdminToken } from '@/lib/admin-token';

export const api = createTRPCReact<AppRouter>();

function installPerformanceMeasureGuard() {
  if (typeof window === 'undefined' || !window.performance?.measure) return;

  const globalWindow = window as Window & {
    __qualifaiPerfMeasureGuardInstalled?: boolean;
  };
  if (globalWindow.__qualifaiPerfMeasureGuardInstalled) return;
  globalWindow.__qualifaiPerfMeasureGuardInstalled = true;

  const originalMeasure = window.performance.measure.bind(window.performance);
  window.performance.measure = ((
    ...args: Parameters<Performance['measure']>
  ) => {
    try {
      return originalMeasure(...args);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? '');
      if (message.includes('cannot have a negative time stamp')) {
        // Suppress known Next/Turbopack dev measurement issue
        return undefined as never;
      }
      throw error;
    }
  }) as Performance['measure'];
}

installPerformanceMeasureGuard();

function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  const storedToken = localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  const token = normalizeAdminToken(storedToken);

  if (!token) return null;
  if (storedToken !== token) {
    localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
  }

  return token;
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          headers() {
            const token = getAdminToken();
            if (!token) return {};

            return {
              'x-admin-token': token,
            };
          },
        }),
      ],
    }),
  );

  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </api.Provider>
  );
}

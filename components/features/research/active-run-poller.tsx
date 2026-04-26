'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/components/providers';
import { RerunLoadingScreen } from './rerun-loading-screen';

interface Props {
  slug: string;
}

export function ActiveRunPoller({ slug }: Props) {
  const router = useRouter();
  const wasActiveRef = useRef(false);

  const query = api.research.getActiveStatusBySlug.useQuery(
    { slug },
    {
      // TODO: tRPC v11 inference — q typed as Query<unknown>; cast to access data shape
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      refetchInterval: (q: any) =>
        (q.state.data as { isActive?: boolean } | undefined)?.isActive
          ? 5000
          : false,
      refetchOnWindowFocus: true,
    },
  );

  const data = query.data;

  // React Query returns a fresh data object on each poll, so this effect runs every
  // 5s while active. The wasActiveRef ensures router.refresh() fires exactly once on
  // the active→inactive transition and not on subsequent inactive observations.
  useEffect(() => {
    if (!data) return;
    if (data.isActive) {
      wasActiveRef.current = true;
      return;
    }
    if (wasActiveRef.current && !data.isActive) {
      wasActiveRef.current = false;
      router.refresh();
    }
  }, [data, router]);

  // Optimistic render: parent only mounts us when SSR says active.
  // Show loading until poll confirms otherwise — avoids a blank flash on first paint.
  if (data && !data.isActive) return null;

  return (
    <RerunLoadingScreen
      variant="full"
      currentStep={data?.currentStep ?? null}
      currentStatus={data?.status ?? null}
    />
  );
}

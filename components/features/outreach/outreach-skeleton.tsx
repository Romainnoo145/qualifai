import { Skeleton, SkelLine, SkelPill } from '@/components/ui/skeleton';

/**
 * Decision-inbox / queue skeleton — list of draft cards waiting for action.
 */
export function OutreachQueueSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 border border-[var(--color-border)] rounded-md"
        >
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 min-w-0 space-y-2">
            <SkelLine width="40%" className="h-3" />
            <SkelLine width="70%" className="h-2.5" />
          </div>
          <SkelPill width={70} />
          <SkelPill width={90} />
        </div>
      ))}
    </div>
  );
}

/**
 * Outreach settings form skeleton — labels + input rows.
 */
export function OutreachSettingsSkeleton() {
  return (
    <div className="space-y-6 max-w-2xl">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <SkelLine width="20%" className="h-2.5" />
          <Skeleton className="h-10 rounded-md" />
        </div>
      ))}
      <div className="flex gap-2 pt-4">
        <Skeleton className="h-9 w-28 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>
    </div>
  );
}

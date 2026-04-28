import {
  Skeleton,
  SkelHeading,
  SkelLine,
  SkelStatCard,
} from '@/components/ui/skeleton';

export function DashboardSkeleton() {
  return (
    <div className="max-w-[1400px] space-y-10">
      {/* Greeting / header */}
      <div className="flex items-baseline justify-between pb-6 border-b border-[var(--color-border)]">
        <SkelHeading width="40%" />
        <SkelLine width={140} className="h-2.5" />
      </div>

      {/* Stat trio */}
      <div className="grid grid-cols-3 gap-4">
        <SkelStatCard />
        <SkelStatCard />
        <SkelStatCard />
      </div>

      {/* Drafts queue */}
      <section className="space-y-4">
        <SkelLine width="15%" className="h-2.5" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[56px_1fr_auto] gap-4 py-3.5 border-b border-[var(--color-surface-2)]"
          >
            <Skeleton className="h-10 w-10 rounded-md" />
            <div className="space-y-2">
              <SkelLine width="35%" className="h-3" />
              <SkelLine width="65%" className="h-2.5" />
            </div>
            <SkelLine width={70} className="h-2.5" />
          </div>
        ))}
      </section>

      {/* Activity feed */}
      <section className="space-y-4">
        <SkelLine width="15%" className="h-2.5" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <Skeleton className="h-7 w-7 rounded-full" />
            <SkelLine width="45%" className="h-2.5" />
            <span className="flex-1" />
            <SkelLine width={60} className="h-2" />
          </div>
        ))}
      </section>
    </div>
  );
}

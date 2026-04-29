import { Skeleton, SkelHeading, SkelLine } from '@/components/ui/skeleton';

/** Kanban-shape skeleton — matches the 4-column status board. */
export function FacturenSkeleton() {
  return (
    <div className="max-w-[1500px] space-y-8">
      {/* Header */}
      <div className="flex items-baseline justify-between pb-6 border-b border-[var(--color-border)]">
        <SkelHeading width="30%" />
        <SkelLine width={140} className="h-2.5" />
      </div>

      {/* Summary line */}
      <SkelLine width="55%" className="h-3" />

      {/* 4-column kanban */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, col) => (
          <div
            key={col}
            className="border border-[var(--color-border)] rounded-lg p-4 min-h-[400px] bg-[var(--color-surface)]"
          >
            <div className="flex items-baseline justify-between pb-3 mb-3 border-b border-[var(--color-border)]">
              <SkelLine width="40%" className="h-2.5" />
              <Skeleton className="h-4 w-7 rounded-full" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, card) => (
                <div
                  key={card}
                  className="border border-[var(--color-border)] rounded-md p-3 space-y-2"
                >
                  <SkelLine width="40%" className="h-2" />
                  <SkelLine width="65%" className="h-3" />
                  <Skeleton className="h-5 w-24" />
                  <div className="flex justify-between">
                    <SkelLine width="50%" className="h-2" />
                    <SkelLine width={30} className="h-2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import {
  Skeleton,
  SkelHeading,
  SkelLine,
  SkelStatCard,
} from '@/components/ui/skeleton';

export function QuoteDetailSkeleton() {
  return (
    <div className="max-w-[1400px] space-y-0 pb-20">
      {/* Header */}
      <header className="grid grid-cols-[1fr_auto] gap-10 items-end pb-5 mb-5 border-b border-[var(--color-border)]">
        <div className="space-y-2">
          <SkelHeading width={360} />
          <SkelLine width={220} className="h-2.5" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32 rounded-full" />
          <Skeleton className="h-9 w-32 rounded-full" />
        </div>
      </header>

      {/* Stat strip — 4 cells */}
      <section className="grid grid-cols-4 border-t border-b border-[var(--color-ink)] mb-10">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkelStatCard key={i} />
        ))}
      </section>

      {/* Two-column body */}
      <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-10">
        {/* Main: line items */}
        <div className="space-y-6">
          {/* Lines table header */}
          <div className="grid grid-cols-[1fr_80px_1fr_28px] gap-2 pb-1 border-b border-[var(--color-border)]">
            <SkelLine width="40%" className="h-2" />
            <SkelLine width="60%" className="h-2" />
            <SkelLine width="40%" className="h-2" />
            <span />
          </div>
          {/* Lines */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_80px_1fr_28px] gap-2 items-center py-2"
            >
              <SkelLine width="80%" className="h-3" />
              <SkelLine width="50%" className="h-3" />
              <SkelLine width="40%" className="h-3" />
              <Skeleton className="h-6 w-6 rounded" />
            </div>
          ))}
        </div>

        {/* Sidebar */}
        <aside className="space-y-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <SkelLine width="50%" className="h-2.5" />
              <Skeleton className="h-20" />
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}

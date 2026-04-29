import {
  Skeleton,
  SkelHeading,
  SkelLine,
  SkelStatCard,
} from '@/components/ui/skeleton';

export function CampaignDetailSkeleton() {
  return (
    <div className="max-w-[1400px] space-y-10">
      {/* Header */}
      <div className="flex items-baseline justify-between pb-6 border-b border-[var(--color-border)]">
        <div className="space-y-2">
          <SkelHeading width={320} />
          <SkelLine width={200} className="h-2.5" />
        </div>
        <Skeleton className="h-9 w-36 rounded-full" />
      </div>

      {/* Funnel — 7-column grid */}
      <div className="grid grid-cols-7 border-b border-[var(--color-ink)] gap-px">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="p-4 space-y-2 text-center">
            <SkelLine width="60%" className="h-2 mx-auto" />
            <SkelHeading width="40%" />
          </div>
        ))}
      </div>

      {/* Stat trio */}
      <div className="grid grid-cols-3 gap-4">
        <SkelStatCard />
        <SkelStatCard />
        <SkelStatCard />
      </div>

      {/* Prospects table */}
      <div className="border border-[var(--color-border)] rounded-md overflow-hidden">
        <div
          className="grid gap-3 py-3 px-4 bg-[var(--color-surface-2)]"
          style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <SkelLine key={i} width="60%" className="h-2.5" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="grid gap-3 py-3 px-4 border-t border-[var(--color-border)]"
            style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}
          >
            {Array.from({ length: 5 }).map((_, j) => (
              <SkelLine key={j} className="h-3" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

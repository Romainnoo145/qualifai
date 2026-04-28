import {
  Skeleton,
  SkelHeading,
  SkelLine,
  SkelPill,
  SkelStatCard,
  SkelTableRow,
} from '@/components/ui/skeleton';

/** Page-shape skeleton for /admin/facturen — matches the actual layout. */
export function FacturenSkeleton() {
  return (
    <div className="max-w-[1400px] space-y-10">
      <div className="flex items-baseline justify-between pb-6 border-b border-[var(--color-border)]">
        <SkelHeading width={280} />
        <SkelLine width={140} className="h-3" />
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <SkelLine width={40} className="h-3" />
          <SkelLine width={80} className="h-2.5" />
        </div>
        <div className="grid grid-cols-3 gap-px bg-[var(--color-border)] border border-[var(--color-border)] rounded-md overflow-hidden">
          <SkelStatCard />
          <SkelStatCard />
          <SkelStatCard />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <SkelLine width={40} className="h-3" />
          <SkelLine width={80} className="h-2.5" />
        </div>
        <div className="flex flex-wrap gap-2">
          <SkelPill width={64} />
          <SkelPill width={84} />
          <SkelPill width={92} />
          <SkelPill width={84} />
          <SkelPill width={76} />
          <SkelPill width={104} />
        </div>
        <div className="border border-[var(--color-border)] rounded-md overflow-hidden">
          <div className="bg-[var(--color-surface-2)] py-3 px-4 grid grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-2.5 w-16" />
            ))}
          </div>
          <SkelTableRow cols={7} />
          <SkelTableRow cols={7} />
          <SkelTableRow cols={7} />
        </div>
      </section>
    </div>
  );
}

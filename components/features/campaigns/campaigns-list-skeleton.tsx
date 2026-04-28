import { Skeleton, SkelLine } from '@/components/ui/skeleton';

export function CampaignsListSkeleton() {
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <SkelLine width={130} className="h-2.5" />
        <span className="flex-1 h-px bg-[var(--color-border)]" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-5 py-4 border-b border-[var(--color-surface-2)]"
        >
          <Skeleton className="h-10 w-10 rounded-[8px]" />
          <div className="flex-1 min-w-0 space-y-2">
            <SkelLine width="30%" className="h-3" />
            <SkelLine width="20%" className="h-2.5" />
          </div>
          <SkelLine width={80} className="h-2.5" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      ))}
    </section>
  );
}

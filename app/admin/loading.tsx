import { Skeleton, SkelHeading, SkelLine } from '@/components/ui/skeleton';

export default function AdminLoading() {
  return (
    <div className="space-y-10">
      <div className="flex items-baseline justify-between pb-6 border-b border-[var(--color-border)]">
        <SkelHeading width="40%" />
        <SkelLine width={120} className="h-2.5" />
      </div>

      <div className="space-y-4">
        <SkelLine width="20%" className="h-2.5" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>

      <div className="space-y-3">
        <SkelLine width="15%" className="h-2.5" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    </div>
  );
}

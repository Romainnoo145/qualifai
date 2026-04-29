import { Skeleton, SkelLine, SkelPill } from '@/components/ui/skeleton';

export function ProspectEvidenceSkeleton() {
  return (
    <div className="space-y-6">
      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkelPill key={i} width={90} />
        ))}
      </div>

      {/* Evidence cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="border border-[var(--color-border)] rounded-md p-5 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <SkelLine width="40%" className="h-2.5" />
            </div>
            <SkelLine width="80%" className="h-3" />
            <SkelLine width="100%" className="h-2.5" />
            <SkelLine width="65%" className="h-2.5" />
          </div>
        ))}
      </div>
    </div>
  );
}

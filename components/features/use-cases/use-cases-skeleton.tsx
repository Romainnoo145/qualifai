import { Skeleton, SkelLine } from '@/components/ui/skeleton';

export function UseCasesSkeleton() {
  return (
    <div className="flex gap-6">
      {/* Sector sidebar */}
      <nav className="w-[220px] shrink-0 space-y-1">
        {Array.from({ length: 11 }).map((_, i) => (
          <Skeleton key={i} className="h-8 rounded-md" />
        ))}
      </nav>

      {/* Use case grid */}
      <div className="flex-1 grid grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="border border-[var(--color-border)] rounded-md p-5 space-y-3"
          >
            <SkelLine width="65%" className="h-4" />
            <SkelLine width="100%" className="h-2.5" />
            <SkelLine width="85%" className="h-2.5" />
            <div className="flex gap-2 pt-2">
              <SkelLine width={60} className="h-2" />
              <SkelLine width={80} className="h-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

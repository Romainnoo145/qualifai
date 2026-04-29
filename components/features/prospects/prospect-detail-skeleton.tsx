import {
  Skeleton,
  SkelHeading,
  SkelLine,
  SkelPill,
} from '@/components/ui/skeleton';

export function ProspectDetailSkeleton() {
  return (
    <div className="max-w-[1400px] space-y-0 pb-20">
      {/* Header — logo+name on left, actions on right */}
      <header className="grid grid-cols-[1fr_auto] gap-10 items-end pb-5 mb-5 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-md" />
          <div className="space-y-2">
            <SkelHeading width={280} />
            <SkelLine width={180} className="h-2.5" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-32 rounded-full" />
        </div>
      </header>

      {/* Tab strip */}
      <div className="flex gap-2 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkelPill key={i} width={90} />
        ))}
      </div>

      {/* Three-column body */}
      <div className="grid grid-cols-[180px_1fr_280px] gap-8">
        {/* Left aside — nav */}
        <aside className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-7 rounded-md" />
          ))}
        </aside>

        {/* Main feed */}
        <main className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="p-5 border border-[var(--color-border)] rounded-md space-y-3"
            >
              <SkelLine width="40%" className="h-3" />
              <SkelLine width="100%" className="h-2.5" />
              <SkelLine width="85%" className="h-2.5" />
            </div>
          ))}
        </main>

        {/* Right aside — sidebar */}
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

import { Skeleton, SkelHeading, SkelLine } from '@/components/ui/skeleton';

export function ContactDetailSkeleton() {
  return (
    <div className="max-w-[1400px] space-y-10">
      {/* Header */}
      <header className="flex items-start justify-between pb-8 border-b border-[var(--color-ink)]">
        <div className="flex items-center gap-5">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="space-y-2">
            <SkelHeading width={260} />
            <SkelLine width={200} className="h-2.5" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32 rounded-full" />
        </div>
      </header>

      {/* Two-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-10">
        {/* Main */}
        <div className="space-y-10">
          {Array.from({ length: 3 }).map((_, i) => (
            <section key={i} className="space-y-3">
              <SkelLine width="20%" className="h-2.5" />
              <div className="border border-[var(--color-border)] rounded-md p-5 space-y-3">
                <SkelLine width="100%" className="h-2.5" />
                <SkelLine width="90%" className="h-2.5" />
                <SkelLine width="60%" className="h-2.5" />
              </div>
            </section>
          ))}
        </div>

        {/* Sidebar */}
        <aside className="space-y-10">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <SkelLine width="40%" className="h-2.5" />
              <Skeleton className="h-16" />
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}

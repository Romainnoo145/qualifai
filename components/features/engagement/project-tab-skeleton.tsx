import { Skeleton, SkelLine, SkelHeading } from '@/components/ui/skeleton';

/** Page-shape skeleton for the Project sub-route on prospect detail. */
export function ProjectTabSkeleton() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <SkelHeading width={120} />
        <SkelLine width="50%" className="h-3" />
      </header>

      {/* Kickoff block */}
      <section className="space-y-2">
        <SkelLine width={80} className="h-2.5" />
        <SkelLine width="40%" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-7 w-44 rounded" />
          <Skeleton className="h-7 w-36 rounded" />
        </div>
      </section>

      {/* Milestones */}
      <section className="space-y-2">
        <SkelLine width={80} className="h-2.5" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-sm" />
              <SkelLine width={`${50 + i * 10}%`} className="h-3" />
            </div>
          ))}
        </div>
      </section>

      {/* Invoices */}
      <section className="space-y-2">
        <SkelLine width={80} className="h-2.5" />
        <Skeleton className="h-10 w-full rounded" />
        <Skeleton className="h-10 w-full rounded" />
      </section>
    </div>
  );
}

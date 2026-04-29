import { Skeleton, SkelLine, SkelHeading } from '@/components/ui/skeleton';

/** Document-shape skeleton — matches the paper-style invoice detail view. */
export function InvoiceDetailSkeleton() {
  return (
    <div>
      {/* Breadcrumb */}
      <SkelLine width={140} className="h-2.5 mb-6" />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-10 max-w-[1300px]">
        {/* Paper-style document */}
        <article className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-12 lg:p-16 space-y-8">
          {/* Doc head: sender + meta */}
          <header className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-10 pb-8 border-b-2 border-[var(--color-ink)]">
            <div className="space-y-3">
              <SkelHeading width={140} />
              <div className="space-y-1.5">
                <SkelLine width="55%" className="h-2" />
                <SkelLine width="50%" className="h-2" />
                <SkelLine width="60%" className="h-2" />
                <SkelLine width="40%" className="h-2" />
              </div>
            </div>
            <div className="space-y-3 md:text-right">
              <SkelHeading width={220} />
              <SkelLine width={140} className="h-2" />
              <SkelLine width={160} className="h-2" />
              <Skeleton className="h-6 w-24 rounded-full ml-auto" />
            </div>
          </header>

          {/* Aan block */}
          <section className="space-y-2">
            <SkelLine width={40} className="h-2" />
            <SkelLine width="35%" className="h-4" />
            <SkelLine width="50%" className="h-2.5" />
          </section>

          {/* Lines table */}
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_80px_120px_120px] gap-3 pb-2 border-b border-[var(--color-ink)]">
              <SkelLine width="40%" className="h-2" />
              <SkelLine width="60%" className="h-2" />
              <SkelLine width="50%" className="h-2" />
              <SkelLine width="50%" className="h-2" />
            </div>
            <div className="grid grid-cols-[1fr_80px_120px_120px] gap-3 py-2">
              <SkelLine width="80%" className="h-3" />
              <SkelLine width="40%" className="h-3" />
              <SkelLine width="60%" className="h-3" />
              <SkelLine width="60%" className="h-3" />
            </div>
          </div>

          {/* Totals */}
          <div className="ml-auto w-full md:w-1/2 space-y-2">
            <div className="flex justify-between">
              <SkelLine width={80} className="h-3" />
              <SkelLine width={90} className="h-3" />
            </div>
            <div className="flex justify-between">
              <SkelLine width={80} className="h-3" />
              <SkelLine width={70} className="h-3" />
            </div>
            <div className="flex justify-between pt-3 border-t-2 border-[var(--color-ink)]">
              <SkelLine width={80} className="h-4" />
              <SkelLine width={100} className="h-4" />
            </div>
          </div>
        </article>

        {/* Action sidebar */}
        <aside className="space-y-3">
          <SkelLine width={50} className="h-2" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />

          <div className="pt-4 mt-4 border-t border-[var(--color-border)] space-y-2">
            <div className="flex justify-between">
              <SkelLine width="40%" className="h-2.5" />
              <SkelLine width="35%" className="h-2.5" />
            </div>
            <div className="flex justify-between">
              <SkelLine width="35%" className="h-2.5" />
              <SkelLine width="35%" className="h-2.5" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

import { Skeleton, SkelLine, SkelHeading } from '@/components/ui/skeleton';

/** Page-shape skeleton for /admin/invoices/[id]. */
export function InvoiceDetailSkeleton() {
  return (
    <div className="grid grid-cols-[1fr_300px] gap-6 p-6">
      <main className="space-y-6">
        <header className="space-y-2">
          <div className="flex items-baseline gap-3">
            <SkelHeading width={200} />
            <Skeleton className="h-5 w-20 rounded" />
          </div>
          <SkelLine width="35%" className="h-3" />
        </header>

        {Array.from({ length: 4 }).map((_, i) => (
          <section key={i} className="space-y-2">
            <SkelLine width={80} className="h-2.5" />
            <SkelLine width="90%" />
            <SkelLine width="70%" />
          </section>
        ))}
      </main>

      <aside className="space-y-3">
        <SkelLine width={80} className="h-2.5" />
        <Skeleton className="h-9 w-full rounded" />
        <Skeleton className="h-9 w-full rounded" />
      </aside>
    </div>
  );
}

import { Skeleton, SkelLine, SkelPill } from '@/components/ui/skeleton';

/**
 * Prospects list skeleton — header staat op parent (ProspectList wrapper),
 * dus deze rendert alleen de filter-pills + group sections die AllCompanies
 * normaal toont.
 */
export function ProspectsListSkeleton() {
  return (
    <div className="space-y-8">
      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkelPill key={i} width={90} />
        ))}
      </div>

      {/* Stage groups */}
      {Array.from({ length: 3 }).map((_, g) => (
        <section key={g} className="space-y-3">
          <SkelLine width="15%" className="h-2.5" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-4 border border-[var(--color-border)] rounded-md"
              >
                <Skeleton className="h-9 w-9 rounded-md" />
                <div className="flex-1 space-y-2">
                  <SkelLine width="35%" className="h-3" />
                  <SkelLine width="55%" className="h-2.5" />
                </div>
                <SkelPill width={80} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

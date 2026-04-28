import {
  Skeleton,
  SkelHeading,
  SkelLine,
  SkelPill,
  SkelTableRow,
} from '@/components/ui/skeleton';

export function QuotesListSkeleton() {
  return (
    <div className="max-w-[1400px] space-y-10">
      {/* Header */}
      <div className="flex items-baseline justify-between pb-6 border-b border-[var(--color-border)]">
        <SkelHeading width="30%" />
        <Skeleton className="h-9 w-44 rounded-full" />
      </div>

      {/* Filter pills */}
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkelPill key={i} width={90} />
        ))}
      </div>

      {/* Table */}
      <div className="border border-[var(--color-border)] rounded-md overflow-hidden">
        <div
          className="grid gap-3 py-3 px-4 bg-[var(--color-surface-2)]"
          style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <SkelLine key={i} width="60%" className="h-2.5" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkelTableRow key={i} cols={6} />
        ))}
      </div>
    </div>
  );
}

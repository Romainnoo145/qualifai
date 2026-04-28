import { cn } from '@/lib/utils';

/**
 * Skeleton primitives — animated shimmer placeholders matching DESIGN.md
 * tokens (--color-surface-2, --color-border). Use to compose page-shape
 * skeletons that mirror the actual content layout, not generic "loading".
 *
 * Render conditionally via useDelayedLoading() so sub-200ms loads don't
 * flash a skeleton.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        'relative overflow-hidden rounded bg-[var(--color-surface-2)]',
        'before:absolute before:inset-0 before:-translate-x-full',
        'before:bg-gradient-to-r before:from-transparent before:via-[#ebebef] before:to-transparent',
        'before:animate-[shimmer_1.4s_ease-in-out_infinite]',
        className,
      )}
      {...props}
    />
  );
}

export function SkelLine({
  width = '100%',
  className,
}: {
  width?: string | number;
  className?: string;
}) {
  return <Skeleton style={{ width }} className={cn('h-3.5', className)} />;
}

export function SkelHeading({ width = '60%' }: { width?: string | number }) {
  return <Skeleton style={{ width }} className="h-9" />;
}

export function SkelPill({ width = 70 }: { width?: number }) {
  return <Skeleton style={{ width }} className="h-6 rounded-md" />;
}

export function SkelStatCard() {
  return (
    <div className="bg-[var(--color-surface)] p-5 space-y-3">
      <SkelLine width="40%" className="h-2.5" />
      <SkelLine width="60%" className="h-7" />
    </div>
  );
}

export function SkelTableRow({ cols = 5 }: { cols?: number }) {
  return (
    <div
      className="grid gap-3 py-3 px-4 border-t border-[var(--color-border)]"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      }}
    >
      {Array.from({ length: cols }).map((_, i) => (
        <SkelLine key={i} className="h-3" />
      ))}
    </div>
  );
}

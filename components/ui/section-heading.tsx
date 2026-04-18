import { cn } from '@/lib/utils';

interface SectionHeadingProps {
  icon?: React.ReactNode;
  label: string;
  count?: number;
  className?: string;
}

export function SectionHeading({
  icon,
  label,
  count,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {icon && <span className="text-[var(--color-muted)]">{icon}</span>}
      <h2 className="admin-eyebrow">{label}</h2>
      {count !== undefined && (
        <span className="admin-toggle-count">{count}</span>
      )}
    </div>
  );
}

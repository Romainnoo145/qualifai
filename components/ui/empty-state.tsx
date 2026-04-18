import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('glass-card p-12 text-center', className)}>
      {icon && (
        <div className="mb-4 flex justify-center text-[var(--color-muted)]">
          {icon}
        </div>
      )}
      <p className="text-[15px] font-medium text-[var(--color-ink)]">{title}</p>
      {description && <p className="admin-meta-text mt-2">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

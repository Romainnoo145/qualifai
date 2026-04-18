import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  action?: React.ReactNode;
  description?: string;
  className?: string;
}

export function PageHeader({
  title,
  action,
  description,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div>
        <h1 className="font-['Sora'] text-[32px] font-bold tracking-[-0.025em] text-[var(--color-ink)]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-[13px] text-[var(--color-muted)]">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

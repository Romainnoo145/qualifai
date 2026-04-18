import { cn } from '@/lib/utils';

interface DataTableProps {
  children: React.ReactNode;
  className?: string;
}

export function DataTable({ children, className }: DataTableProps) {
  return (
    <div
      className={cn(
        'glass-card divide-y divide-[var(--color-border)] overflow-hidden',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface DataRowProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  href?: string;
}

export function DataRow({ children, className, href, ...props }: DataRowProps) {
  const classes = cn(
    'flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--color-surface-hover)]',
    className,
  );

  if (href) {
    return (
      <a
        href={href}
        className={cn(classes, 'no-underline')}
        {...(props as any)}
      >
        {children}
      </a>
    );
  }

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

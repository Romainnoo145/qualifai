import { cn } from '@/lib/utils';

interface StatCardProps {
  eyebrow: string;
  value: string | number;
  delta?: string;
  className?: string;
}

export function StatCard({ eyebrow, value, delta, className }: StatCardProps) {
  return (
    <div className={cn('glass-card p-5', className)}>
      <p className="admin-eyebrow">{eyebrow}</p>
      <p className="text-data mt-2 text-[28px] font-bold tracking-[-0.02em] text-[var(--color-ink)]">
        {value}
      </p>
      {delta && <p className="admin-meta-text mt-1">{delta}</p>}
    </div>
  );
}

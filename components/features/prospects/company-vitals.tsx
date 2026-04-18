'use client';

import {
  Building2,
  Globe,
  MapPin,
  Users,
  DollarSign,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CompanyVitalsProps {
  prospect: any;
  className?: string;
}

export function CompanyVitals({ prospect, className }: CompanyVitalsProps) {
  const p = prospect;

  return (
    <div className={cn('glass-card p-8 flex flex-col gap-10', className)}>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
          {p.logo ? (
            <img
              src={p.logo}
              alt={p.companyName}
              className="w-7 h-7 object-contain rounded"
            />
          ) : (
            <Building2 className="w-6 h-6 text-[var(--color-border-strong)]" />
          )}
        </div>
        <div>
          <h3 className="text-sm font-bold text-[var(--color-ink)] tracking-tight">
            {p.companyName}
          </h3>
          <p className="admin-eyebrow">{p.domain}</p>
        </div>
      </div>

      <div className="space-y-8">
        <div>
          <p className="admin-eyebrow mb-4">Vitals</p>
          <div className="grid grid-cols-1 gap-5">
            <VitalItem icon={Globe} label="Industry" value={p.industry} />
            <VitalItem
              icon={Users}
              label="Size"
              value={p.employeeRange || p.employeeCount}
            />
            <VitalItem
              icon={DollarSign}
              label="Revenue"
              value={p.revenueEstimate || p.revenueRange}
            />
            <VitalItem
              icon={MapPin}
              label="Location"
              value={p.city ? `${p.city}, ${p.country}` : p.country}
            />
          </div>
        </div>

        {p.technologies?.length > 0 && (
          <div>
            <p className="admin-eyebrow mb-4">Stack</p>
            <div className="flex flex-wrap gap-2">
              {p.technologies.slice(0, 8).map((tech: string) => (
                <span
                  key={tech}
                  className="text-[10px] font-medium px-3 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted-dark)] rounded-[var(--radius-xs)]"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="pt-8 border-t border-[var(--color-border)] mt-auto">
        <Button
          variant="outline"
          className="w-full h-11 rounded-[var(--radius-sm)] text-xs border-[var(--color-border-strong)] text-[var(--color-muted-dark)] hover:bg-[var(--color-surface-2)] font-medium"
          leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
        >
          CRM Profile
        </Button>
      </div>
    </div>
  );
}

function VitalItem({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string | number | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between group">
      <div className="flex items-center gap-3">
        <Icon className="w-3.5 h-3.5 text-[var(--color-muted)] group-hover:text-[var(--color-muted-dark)] transition-colors" />
        <span className="admin-eyebrow">{label}</span>
      </div>
      <span className="text-[11px] text-[var(--color-ink)] font-bold">
        {value}
      </span>
    </div>
  );
}

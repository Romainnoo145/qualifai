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
    <div
      className={cn(
        'bg-[#FCFCFD] border border-[#F1F3F5] rounded-3xl p-8 flex flex-col gap-10',
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shadow-sm">
          {p.logo ? (
            <img
              src={p.logo}
              alt={p.companyName}
              className="w-7 h-7 object-contain rounded"
            />
          ) : (
            <Building2 className="w-6 h-6 text-slate-300" />
          )}
        </div>
        <div>
          <h3 className="text-sm font-bold text-[#040026] tracking-tight">
            {p.companyName}
          </h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            {p.domain}
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
            Vitals
          </p>
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
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
              Stack
            </p>
            <div className="flex flex-wrap gap-2">
              {p.technologies.slice(0, 8).map((tech: string) => (
                <span
                  key={tech}
                  className="text-[10px] font-bold px-3 py-1 bg-white border border-slate-100 text-slate-500 rounded-lg"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="pt-8 border-t border-slate-100 mt-auto">
        <Button
          variant="outline"
          className="w-full h-11 rounded-xl text-xs border-slate-200 text-slate-600 hover:bg-slate-50 font-bold"
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
        <Icon className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
        <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <span className="text-[11px] text-[#040026] font-black">{value}</span>
    </div>
  );
}

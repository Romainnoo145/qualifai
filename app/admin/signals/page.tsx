'use client';

import { api } from '@/components/providers';
import Link from 'next/link';
import { Zap, Building2, Users, Check, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const signalTypeColors: Record<string, string> = {
  JOB_CHANGE: 'admin-state-info',
  PROMOTION: 'admin-state-accent',
  NEW_JOB_LISTING: 'admin-state-info',
  HEADCOUNT_GROWTH: 'admin-state-success',
  FUNDING_EVENT: 'admin-state-warning',
  TECHNOLOGY_ADOPTION: 'admin-state-info',
  INTENT_TOPIC: 'admin-state-warning',
};

export default function SignalsPage() {
  const [typeFilter, setTypeFilter] = useState('');
  const [showProcessed, setShowProcessed] = useState(false);

  const signals = api.signals.list.useQuery({
    signalType: typeFilter || undefined,
    isProcessed: showProcessed ? undefined : false,
  });

  const utils = api.useUtils();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markProcessed = (api.signals.markProcessed as any).useMutation({
    onSuccess: () => utils.signals.list.invalidate(),
  });

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-4xl font-black text-[#040026] tracking-tighter">
          Signals
        </h1>
        <label className="admin-btn-primary cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showProcessed}
            onChange={(e) => setShowProcessed(e.target.checked)}
            className="sr-only"
          />
          <span
            className={cn(
              'inline-flex h-4 w-4 items-center justify-center rounded-md border',
              showProcessed
                ? 'border-[#040026] bg-[#040026]'
                : 'border-[#040026]/20 bg-[#F3DB7B]',
            )}
          />
          Show processed
        </label>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-6 py-3.5 rounded-2xl border border-slate-100 bg-white text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all appearance-none"
        >
          <option value="">All Signal Categories</option>
          <option value="JOB_CHANGE">Job Change</option>
          <option value="PROMOTION">Promotion</option>
          <option value="NEW_JOB_LISTING">New Job Listing</option>
          <option value="HEADCOUNT_GROWTH">Headcount Growth</option>
          <option value="FUNDING_EVENT">Funding Event</option>
          <option value="TECHNOLOGY_ADOPTION">Technology Adoption</option>
          <option value="INTENT_TOPIC">Intent Topic</option>
        </select>
      </div>

      {/* Signal feed */}
      {signals.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="glass-card p-8 animate-pulse rounded-[2.5rem]"
            >
              <div className="space-y-4">
                <div className="h-3 bg-slate-50 rounded w-1/6" />
                <div className="h-5 bg-slate-50 rounded w-3/4" />
                <div className="h-3 bg-slate-50 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : signals.data?.signals.length === 0 ? (
        <div className="glass-card p-20 text-center rounded-[2.5rem]">
          <Zap className="w-16 h-16 text-slate-100 mx-auto mb-6" />
          <p className="text-sm font-black text-[#040026] uppercase tracking-widest">
            No signals intercepted
          </p>
          <p className="text-xs font-bold text-slate-400 mt-2 leading-relaxed max-w-xs mx-auto">
            Propagate data discovery from individual profiles to initialize
            market signal interception.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(signals.data?.signals as any[])?.map((signal: any) => (
            <div
              key={signal.id}
              className={`glass-card p-8 rounded-[2.5rem] transition-all ${signal.isProcessed ? 'opacity-40 grayscale group' : 'group hover:border-[#EBCB4B]/20'}`}
            >
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={cn(
                        'admin-state-pill',
                        signalTypeColors[signal.signalType] ??
                          'admin-state-neutral',
                      )}
                    >
                      {signal.signalType.replace(/_/g, ' ')}
                    </span>
                    <span className="admin-eyebrow flex items-center gap-1.5 text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      Detected{' '}
                      {new Date(signal.detectedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-lg font-black text-[#040026] tracking-tight group-hover:text-[#040026] transition-colors leading-[1.1]">
                    {signal.title}
                  </p>
                  {signal.description && (
                    <p className="admin-meta-text leading-relaxed max-w-2xl">
                      {signal.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-4 pt-2">
                    {signal.prospect && (
                      <Link
                        href={`/admin/prospects/${signal.prospect.id}`}
                        className="admin-eyebrow text-[#040026] hover:text-[#EBCB4B] flex items-center gap-2 transition-colors"
                      >
                        <Building2 className="w-3.5 h-3.5 opacity-50" />
                        {signal.prospect.companyName ?? signal.prospect.domain}
                      </Link>
                    )}
                    {signal.contact && (
                      <Link
                        href={`/admin/contacts/${signal.contact.id}`}
                        className="admin-eyebrow text-[#040026] hover:text-[#EBCB4B] flex items-center gap-2 transition-colors"
                      >
                        <Users className="w-3.5 h-3.5 opacity-50" />
                        {signal.contact.firstName} {signal.contact.lastName}
                      </Link>
                    )}
                  </div>
                </div>
                {!signal.isProcessed && (
                  <button
                    onClick={() => markProcessed.mutate({ id: signal.id })}
                    className="admin-btn-icon admin-btn-icon-success"
                    title="Mark as processed"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

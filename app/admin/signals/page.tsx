'use client';

import { api } from '@/components/providers';
import Link from 'next/link';
import { Zap, Building2, Users, Check, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const signalTypeColors: Record<string, string> = {
  JOB_CHANGE: 'bg-blue-50 text-blue-600',
  PROMOTION: 'bg-purple-50 text-purple-600',
  NEW_JOB_LISTING: 'bg-cyan-50 text-cyan-600',
  HEADCOUNT_GROWTH: 'bg-emerald-50 text-emerald-600',
  FUNDING_EVENT: 'bg-amber-50 text-amber-600',
  TECHNOLOGY_ADOPTION: 'bg-indigo-50 text-indigo-600',
  INTENT_TOPIC: 'bg-orange-50 text-orange-600',
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
        <label className="ui-tap flex items-center gap-3 px-6 py-2.5 bg-white border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#040026] transition-all cursor-pointer">
          <input
            type="checkbox"
            checked={showProcessed}
            onChange={(e) => setShowProcessed(e.target.checked)}
            className="w-4 h-4 rounded-md border-slate-200 text-[#040026] focus:ring-[#EBCB4B]"
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
                        'text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest border',
                        signalTypeColors[signal.signalType]
                          ?.replace('bg-', 'bg-')
                          .replace('text-', 'text-') ??
                          'bg-slate-50 text-slate-400 border-slate-100',
                      )}
                    >
                      {signal.signalType.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-tighter">
                      <Clock className="w-3.5 h-3.5" />
                      Detected{' '}
                      {new Date(signal.detectedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-lg font-black text-[#040026] tracking-tight group-hover:text-[#040026] transition-colors leading-[1.1]">
                    {signal.title}
                  </p>
                  {signal.description && (
                    <p className="text-sm font-bold text-slate-400 leading-relaxed max-w-2xl">
                      {signal.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-4 pt-2">
                    {signal.prospect && (
                      <Link
                        href={`/admin/prospects/${signal.prospect.id}`}
                        className="text-[10px] font-black uppercase tracking-widest text-[#040026] hover:text-[#EBCB4B] flex items-center gap-2 transition-colors"
                      >
                        <Building2 className="w-3.5 h-3.5 opacity-50" />
                        {signal.prospect.companyName ?? signal.prospect.domain}
                      </Link>
                    )}
                    {signal.contact && (
                      <Link
                        href={`/admin/contacts/${signal.contact.id}`}
                        className="text-[10px] font-black uppercase tracking-widest text-[#040026] hover:text-[#EBCB4B] flex items-center gap-2 transition-colors"
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
                    className="ui-tap w-12 h-12 flex items-center justify-center rounded-2xl bg-[#FCFCFD] border border-slate-100 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 hover:border-emerald-100 transition-all shadow-sm"
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

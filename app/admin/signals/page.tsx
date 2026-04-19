'use client';

import { api } from '@/components/providers';
import Link from 'next/link';
import { Zap, Building2, Users, Check, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { PageLoader } from '@/components/ui/page-loader';

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
    <div className="max-w-[1400px] space-y-10">
      <div className="flex items-baseline justify-between pb-6 border-b border-[var(--color-border)]">
        <h1 className="text-[48px] font-bold text-[var(--color-ink)] tracking-[-0.025em] leading-[1.05]">
          Signals<span className="text-[var(--color-gold)]">.</span>
        </h1>
        <label className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--color-muted)] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showProcessed}
            onChange={(e) => setShowProcessed(e.target.checked)}
            className="w-3.5 h-3.5 rounded accent-[var(--color-ink)]"
          />
          Toon verwerkt
        </label>
      </div>

      {/* Filter */}
      <select
        value={typeFilter}
        onChange={(e) => setTypeFilter(e.target.value)}
        className="input-minimal px-3 py-2 rounded-md text-[13px] appearance-none max-w-xs"
      >
        <option value="">Alle categorieën</option>
        <option value="JOB_CHANGE">Job Change</option>
        <option value="PROMOTION">Promotion</option>
        <option value="NEW_JOB_LISTING">New Job Listing</option>
        <option value="HEADCOUNT_GROWTH">Headcount Growth</option>
        <option value="FUNDING_EVENT">Funding Event</option>
        <option value="TECHNOLOGY_ADOPTION">Technology Adoption</option>
        <option value="INTENT_TOPIC">Intent Topic</option>
      </select>

      {/* Signal feed */}
      {signals.isLoading ? (
        <PageLoader
          label="Loading signals"
          description="Pulling the latest buying signals."
        />
      ) : signals.data?.signals.length === 0 ? (
        <div className="py-20 text-center">
          <Zap className="w-12 h-12 text-[var(--color-border-strong)] mx-auto mb-4" />
          <p className="text-[15px] font-medium text-[var(--color-ink)] mb-1">
            Geen signals
          </p>
          <p className="text-[13px] font-light text-[var(--color-muted)]">
            Signals verschijnen zodra research runs market intelligence
            oppikken.
          </p>
        </div>
      ) : (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)] whitespace-nowrap">
              {signals.data?.signals.length ?? 0} signals
            </span>
            <span className="flex-1 h-px bg-[var(--color-border)]" />
          </div>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(signals.data?.signals as any[])?.map((signal: any) => (
            <div
              key={signal.id}
              className={cn(
                'py-5 border-b border-[var(--color-surface-2)] transition-all',
                signal.isProcessed && 'opacity-40',
              )}
            >
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <span className="text-[9px] font-medium uppercase tracking-[0.08em] px-2 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-muted)]">
                      {signal.signalType.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] font-light text-[var(--color-muted)] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(signal.detectedAt).toLocaleDateString('nl-NL', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </div>
                  <p className="text-[15px] font-medium text-[var(--color-ink)] leading-snug">
                    {signal.title}
                  </p>
                  {signal.description && (
                    <p className="text-[13px] font-light text-[var(--color-muted)] mt-1 max-w-2xl leading-relaxed">
                      {signal.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-4 mt-2">
                    {signal.prospect && (
                      <Link
                        href={`/admin/prospects/${signal.prospect.id}`}
                        className="text-[11px] font-medium text-[var(--color-ink)] hover:text-[var(--color-gold)] flex items-center gap-1.5 transition-colors"
                      >
                        <Building2 className="w-3 h-3" />
                        {signal.prospect.companyName ?? signal.prospect.domain}
                      </Link>
                    )}
                    {signal.contact && (
                      <Link
                        href={`/admin/contacts/${signal.contact.id}`}
                        className="text-[11px] font-medium text-[var(--color-ink)] hover:text-[var(--color-gold)] flex items-center gap-1.5 transition-colors"
                      >
                        <Users className="w-3 h-3" />
                        {signal.contact.firstName} {signal.contact.lastName}
                      </Link>
                    )}
                  </div>
                </div>
                {!signal.isProcessed && (
                  <button
                    onClick={() => markProcessed.mutate({ id: signal.id })}
                    className="w-8 h-8 rounded-full border border-[var(--color-border)] flex items-center justify-center text-[var(--color-muted)] hover:bg-[var(--color-ink)] hover:text-[var(--color-gold)] hover:border-[var(--color-ink)] transition-all shrink-0"
                    title="Markeer als verwerkt"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

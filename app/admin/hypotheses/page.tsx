'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/components/providers';
import {
  Lightbulb,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2,
  Building2,
} from 'lucide-react';

type StatusFilter = 'DRAFT' | 'ACCEPTED' | 'REJECTED' | undefined;

export default function HypothesesPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('DRAFT');

  const utils = api.useUtils();

  const hypotheses = api.hypotheses.listAll.useQuery({
    status: statusFilter,
    limit: 100,
  });

  const setStatus = api.hypotheses.setStatus.useMutation({
    onSuccess: async () => {
      await utils.hypotheses.listAll.invalidate();
    },
  });

  const statusPill = (status: string) =>
    status === 'ACCEPTED'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'REJECTED'
        ? 'bg-red-50 text-red-600'
        : 'bg-slate-100 text-slate-600';

  const list = hypotheses.data ?? [];

  const filterTabs: { label: string; value: StatusFilter }[] = [
    { label: 'Needs Review', value: 'DRAFT' },
    { label: 'Approved', value: 'ACCEPTED' },
    { label: 'Rejected', value: 'REJECTED' },
    { label: 'All', value: undefined },
  ];

  return (
    <div className="space-y-10">
      {/* Page header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Lightbulb className="w-7 h-7 text-[#040026]" />
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[#040026]">
              Hypothesis Review
            </h1>
            <p className="mt-1 text-sm text-slate-500 font-medium">
              Review AI-generated hypotheses before outreach
            </p>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.label}
            onClick={() => setStatusFilter(tab.value)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all ${
              statusFilter === tab.value
                ? 'bg-[#040026] text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tab.label}
            {!hypotheses.isLoading && (
              <span
                className={`text-xs font-mono ${
                  statusFilter === tab.value
                    ? 'text-white/70'
                    : 'text-slate-400'
                }`}
              >
                {tab.value === statusFilter ? list.length : ''}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {hypotheses.isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
        </div>
      )}

      {/* Empty state */}
      {!hypotheses.isLoading && list.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 shadow-sm text-center">
          <Lightbulb className="w-10 h-10 text-slate-200 mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-400">
            No hypotheses match this filter.
          </p>
        </div>
      )}

      {/* Hypothesis cards */}
      {list.length > 0 && (
        <div className="space-y-4">
          {list.map((h: any) => (
            <div
              key={h.id}
              className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm card-interactive"
            >
              {/* Header row: prospect name + status pill */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <Link
                    href={`/admin/prospects/${h.prospect.id}`}
                    className="font-bold text-[#040026] hover:underline"
                  >
                    {h.prospect.companyName ?? h.prospect.domain}
                  </Link>
                </div>
                <span
                  className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${statusPill(h.status)}`}
                >
                  {h.status}
                </span>
              </div>

              {/* Title */}
              <p className="text-sm font-semibold text-[#040026] mb-1">
                {h.title}
              </p>

              {/* Problem statement */}
              {h.problemStatement && (
                <p className="text-xs text-slate-500 line-clamp-2 mb-3">
                  {h.problemStatement}
                </p>
              )}

              {/* Matched use cases */}
              {h.proofMatches?.length > 0 && (
                <div className="mb-3 pt-3 border-t border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Matched Use Cases
                  </p>
                  <div className="space-y-1">
                    {h.proofMatches.map((match: any) => (
                      <div
                        key={match.id}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span className="font-mono text-emerald-600 font-bold text-[10px]">
                          {(match.score * 100).toFixed(0)}%
                        </span>
                        <span className="text-slate-700">
                          {match.useCase?.title ?? match.proofTitle}
                        </span>
                        {match.useCase?.category && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-400">
                            {match.useCase.category}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Confidence */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] text-slate-400 font-medium">
                  Confidence:
                </span>
                <span className="text-[10px] font-bold text-slate-600 font-mono">
                  {((h.confidenceScore ?? 0) * 100).toFixed(0)}%
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() =>
                    setStatus.mutate({
                      kind: 'hypothesis',
                      id: h.id,
                      status: 'ACCEPTED',
                    })
                  }
                  disabled={setStatus.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-all disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Accept
                </button>
                <button
                  onClick={() =>
                    setStatus.mutate({
                      kind: 'hypothesis',
                      id: h.id,
                      status: 'REJECTED',
                    })
                  }
                  disabled={setStatus.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition-all disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Reject
                </button>
                <button
                  onClick={() =>
                    setStatus.mutate({
                      kind: 'hypothesis',
                      id: h.id,
                      status: 'DRAFT',
                    })
                  }
                  disabled={setStatus.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

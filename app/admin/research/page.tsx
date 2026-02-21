'use client';

import { api } from '@/components/providers';
import { useMemo, useState } from 'react';
import { Beaker, Loader2, Play, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

type ProspectOption = {
  id: string;
  companyName: string | null;
  domain: string;
};

type ResearchRunRow = {
  id: string;
  status:
    | 'PENDING'
    | 'CRAWLING'
    | 'EXTRACTING'
    | 'HYPOTHESIS'
    | 'BRIEFING'
    | 'FAILED'
    | 'COMPLETED';
  error: string | null;
  summary: unknown;
  createdAt: string | Date;
  prospect: {
    companyName: string | null;
    domain: string;
  };
  _count: {
    evidenceItems: number;
    workflowHypotheses: number;
    automationOpportunities: number;
  };
};

type GateSummary = {
  passed: boolean;
  reasons: string[];
};

function gateFromSummary(summary: unknown): GateSummary | null {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary))
    return null;
  const gate = (summary as { gate?: unknown }).gate;
  if (!gate || typeof gate !== 'object' || Array.isArray(gate)) return null;
  const passed = (gate as { passed?: unknown }).passed;
  if (typeof passed !== 'boolean') return null;
  const reasonsRaw = (gate as { reasons?: unknown }).reasons;
  const reasons = Array.isArray(reasonsRaw)
    ? reasonsRaw.filter((item): item is string => typeof item === 'string')
    : [];
  return { passed, reasons };
}

export default function ResearchPage() {
  const [prospectId, setProspectId] = useState('');
  const [manualUrls, setManualUrls] = useState('');
  const [refreshStaleDays, setRefreshStaleDays] = useState('14');
  const [refreshLimit, setRefreshLimit] = useState('25');
  const [refreshResult, setRefreshResult] = useState<unknown>(null);
  const utils = api.useUtils();

  const prospects = api.admin.listProspects.useQuery();
  const runs = api.research.listRuns.useQuery();

  const startRun = api.research.startRun.useMutation({
    onSuccess: async () => {
      await utils.research.listRuns.invalidate();
    },
  });

  const retryRun = api.research.retryRun.useMutation({
    onSuccess: async () => {
      await utils.research.listRuns.invalidate();
    },
  });

  const runRefreshSweep = api.research.runRefreshSweep.useMutation({
    onSuccess: async (result) => {
      setRefreshResult(result);
      await utils.research.listRuns.invalidate();
    },
  });

  const prospectOptions = (prospects.data?.prospects ?? []) as ProspectOption[];
  const runItems = (runs.data ?? []) as ResearchRunRow[];

  const parsedManualUrls = useMemo(
    () =>
      manualUrls
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
    [manualUrls],
  );

  return (
    <div className="space-y-10">
      <h1 className="text-4xl font-black text-[#040026] tracking-tighter">
        Research Runs
      </h1>

      <div className="glass-card p-10 space-y-8 rounded-[2.5rem]">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
          Initialize Deep Environment Scan
        </h2>
        <div className="space-y-4">
          <select
            value={prospectId}
            onChange={(e) => setProspectId(e.target.value)}
            className="w-full px-6 py-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all appearance-none"
          >
            <option value="">Select Target Domain</option>
            {prospectOptions.map((prospect) => (
              <option key={prospect.id} value={prospect.id}>
                {prospect.companyName ?? prospect.domain}
              </option>
            ))}
          </select>
          <textarea
            value={manualUrls}
            onChange={(e) => setManualUrls(e.target.value)}
            rows={4}
            placeholder="Tactical URL propagation (one per line)..."
            className="w-full px-6 py-4 rounded-3xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all resize-none shadow-inner"
          />
          <button
            onClick={() => {
              if (!prospectId) return;
              startRun.mutate({
                prospectId,
                manualUrls: parsedManualUrls,
              });
            }}
            disabled={startRun.isPending || !prospectId}
            className="ui-tap inline-flex items-center gap-3 px-8 py-3.5 btn-pill-primary text-xs font-black uppercase tracking-widest disabled:opacity-50"
          >
            {startRun.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Analyzing
                Environment...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Start Research
              </>
            )}
          </button>
        </div>
      </div>

      <div className="glass-card p-10 space-y-8 rounded-[2.5rem]">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
          Bulk Environmental Refresh
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">
              Staleness Threshold (Days)
            </label>
            <input
              value={refreshStaleDays}
              onChange={(e) => setRefreshStaleDays(e.target.value)}
              type="number"
              min={1}
              max={365}
              className="w-full px-6 py-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">
              Propagation Limit
            </label>
            <input
              value={refreshLimit}
              onChange={(e) => setRefreshLimit(e.target.value)}
              type="number"
              min={1}
              max={200}
              className="w-full px-6 py-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => {
              runRefreshSweep.mutate({
                staleDays: Number(refreshStaleDays) || 14,
                limit: Number(refreshLimit) || 25,
                dryRun: true,
              });
            }}
            disabled={runRefreshSweep.isPending}
            className="ui-tap inline-flex items-center gap-3 px-8 py-3.5 btn-pill-secondary text-xs font-black uppercase tracking-widest disabled:opacity-50"
          >
            {runRefreshSweep.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Simulating Sweep...
              </>
            ) : (
              <>
                <Beaker className="w-4 h-4 opacity-50" /> Dry Run Simulation
              </>
            )}
          </button>
          <button
            onClick={() => {
              runRefreshSweep.mutate({
                staleDays: Number(refreshStaleDays) || 14,
                limit: Number(refreshLimit) || 25,
                dryRun: false,
              });
            }}
            disabled={runRefreshSweep.isPending}
            className="ui-tap inline-flex items-center gap-3 px-8 py-3.5 btn-pill-primary text-xs font-black uppercase tracking-widest disabled:opacity-50 shadow-xl shadow-[#040026]/10"
          >
            {runRefreshSweep.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Executing Sweep...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Execute Global Sweep
              </>
            )}
          </button>
        </div>
        {refreshResult ? (
          <pre className="bg-[#040026] rounded-2xl p-8 text-[10px] font-mono text-[#EBCB4B] overflow-auto whitespace-pre-wrap shadow-inner border border-white/5 mt-4">
            {JSON.stringify(refreshResult, null, 2)}
          </pre>
        ) : null}
      </div>

      <div className="space-y-4">
        {runItems.map((run) => (
          <div
            key={run.id}
            className="glass-card glass-card-hover p-8 rounded-[2.5rem] group transition-all"
          >
            {(() => {
              const gate = gateFromSummary(run.summary);
              if (!gate) return null;
              return (
                <div className="mb-6 flex items-center justify-between">
                  <span
                    className={cn(
                      'text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest border',
                      gate.passed
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        : 'bg-amber-50 text-amber-600 border-amber-100',
                    )}
                  >
                    Contextual Gate: {gate.passed ? 'PASSED' : 'REJECTED'}
                  </span>
                  {!gate.passed && gate.reasons.length > 0 ? (
                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-tight">
                      {gate.reasons.join(' · ')}
                    </span>
                  ) : null}
                </div>
              );
            })()}
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-[#FCFCFD] border border-slate-100 flex items-center justify-center shadow-inner group-hover:bg-[#040026] group-hover:border-[#040026] transition-all">
                  <Beaker className="w-6 h-6 text-[#040026] group-hover:text-[#EBCB4B] transition-colors" />
                </div>
                <div>
                  <p className="text-lg font-black text-[#040026] tracking-tight">
                    {run.prospect.companyName ?? run.prospect.domain}
                  </p>
                  <div className="flex items-center gap-4 mt-1">
                    <span
                      className={cn(
                        'text-[9px] font-black uppercase tracking-widest',
                        run.status === 'COMPLETED'
                          ? 'text-emerald-500'
                          : run.status === 'FAILED'
                            ? 'text-red-500'
                            : 'text-amber-500',
                      )}
                    >
                      {run.status}
                    </span>
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                      {run._count.evidenceItems} Signals /{' '}
                      {run._count.workflowHypotheses} Hypotheses
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest whitespace-nowrap">
                  {new Date(run.createdAt).toLocaleString()}
                </span>
                <button
                  onClick={() => retryRun.mutate({ runId: run.id })}
                  disabled={retryRun.isPending}
                  className="ui-tap inline-flex items-center gap-2.5 px-6 py-2.5 btn-pill-secondary text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                >
                  {retryRun.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5 opacity-50" />
                  )}
                  Re-Analyze
                </button>
              </div>
            </div>
            {run.status === 'FAILED' && run.error && (
              <p className="mt-6 p-4 bg-red-50 rounded-2xl border border-red-100 text-[10px] font-black text-red-600 uppercase tracking-widest">
                {run.error}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

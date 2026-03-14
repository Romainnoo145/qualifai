'use client';

import { api } from '@/components/providers';
import Link from 'next/link';
import {
  Globe,
  Building2,
  ExternalLink,
  FileText,
  Check,
  Trash2,
  Users,
  Search,
  Loader2,
  Plus,
  Briefcase,
  AlertTriangle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { QualityChip } from '@/components/features/prospects/quality-chip';
import { PipelineChip } from '@/components/features/prospects/pipeline-chip';
import { computePipelineStage, type PipelineStage } from '@/lib/pipeline-stage';
import { buildDiscoverPath } from '@/lib/prospect-url';
import { deepAnalysisStatus } from '@/lib/deep-analysis';
import { PageLoader } from '@/components/ui/page-loader';

type View = 'all' | 'search-companies' | 'search-contacts';
type SearchGuardrail = {
  code: string;
  title: string;
  message: string;
  recommendation?: string;
};

type StageFilterKey =
  | 'all'
  | 'to-research'
  | 'researched'
  | 'engaged'
  | 'booked';

const PIPELINE_FILTERS: Array<{
  key: StageFilterKey;
  label: string;
  stages?: PipelineStage[];
}> = [
  { key: 'all', label: 'Alles' },
  {
    key: 'to-research',
    label: 'Te onderzoeken',
    stages: ['Imported', 'Researching'],
  },
  {
    key: 'researched',
    label: 'Onderzocht',
    stages: ['Researched', 'Reviewed', 'Ready', 'Sending'],
  },
  { key: 'engaged', label: 'Engaged', stages: ['Engaged'] },
  { key: 'booked', label: 'Booked', stages: ['Booked'] },
];

const PIPELINE_SORT_PRIORITY: Record<PipelineStage, number> = {
  Booked: 0,
  Engaged: 1,
  Sending: 2,
  Ready: 3,
  Reviewed: 4,
  Researched: 5,
  Researching: 6,
  Imported: 7,
};

export default function ProspectList() {
  const [view, setView] = useState<View>('all');

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-4xl font-black text-[#040026] tracking-tighter">
          Prospects
        </h1>
        <Link href="/admin/prospects/new" className="admin-btn-primary">
          + New Prospect
        </Link>
      </div>

      {/* View toggle */}
      <div className="overflow-x-auto">
        <div className="admin-toggle-group w-max">
          <button
            onClick={() => setView('all')}
            className={cn(
              'ui-tap ui-focus admin-toggle-btn',
              view === 'all' && 'admin-toggle-btn-active',
            )}
          >
            <Building2 className="w-4 h-4" /> All Companies
          </button>
          <button
            onClick={() => setView('search-companies')}
            className={cn(
              'ui-tap ui-focus admin-toggle-btn',
              view === 'search-companies' && 'admin-toggle-btn-active',
            )}
          >
            <Search className="w-4 h-4" /> Search Companies
          </button>
          <button
            onClick={() => setView('search-contacts')}
            className={cn(
              'ui-tap ui-focus admin-toggle-btn',
              view === 'search-contacts' && 'admin-toggle-btn-active',
            )}
          >
            <Users className="w-4 h-4" /> Search Contacts
          </button>
        </div>
      </div>

      {view === 'all' && <AllCompanies />}
      {view === 'search-companies' && (
        <CompanySearch onImported={() => setView('all')} />
      )}
      {view === 'search-contacts' && <ContactSearch />}
    </div>
  );
}

function AllCompanies() {
  const prospects = api.admin.listProspects.useQuery();
  const deleteMutation = api.admin.deleteProspect.useMutation({
    onSuccess: () => prospects.refetch(),
  });
  const startResearchMutation = api.research.startRun.useMutation({
    onSuccess: () => prospects.refetch(),
    onSettled: () => setStartingResearch(null),
  });
  const [startingResearch, setStartingResearch] = useState<{
    id: string;
    mode: 'standard' | 'deep';
  } | null>(null);
  const [stageFilter, setStageFilter] = useState<StageFilterKey>('all');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stageOf = (prospect: any): PipelineStage =>
    computePipelineStage({
      status: prospect.status,
      researchRun: prospect.researchRuns?.[0]
        ? {
            status: prospect.researchRuns[0].status,
            qualityApproved: prospect.researchRuns[0].qualityApproved,
          }
        : null,
      hasCompletedResearch: (prospect.researchStats?.completedRuns ?? 0) > 0,
      hasActiveResearch: (prospect.researchStats?.activeRuns ?? 0) > 0,
      hasSession: (prospect._count?.sessions ?? 0) > 0,
      hasBookedSession: (prospect.sessions?.length ?? 0) > 0,
    });

  const stagedProspects = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = ((prospects.data?.prospects as any[]) ?? []).map(
      (prospect) => {
        const stage = stageOf(prospect);
        return { prospect, stage };
      },
    );

    rows.sort((a, b) => {
      const stageDelta =
        PIPELINE_SORT_PRIORITY[a.stage] - PIPELINE_SORT_PRIORITY[b.stage];
      if (stageDelta !== 0) return stageDelta;
      const nameA = (
        a.prospect.companyName ??
        a.prospect.domain ??
        ''
      ).toString();
      const nameB = (
        b.prospect.companyName ??
        b.prospect.domain ??
        ''
      ).toString();
      return nameA.localeCompare(nameB, 'nl', { sensitivity: 'base' });
    });

    return rows;
  }, [prospects.data?.prospects]);

  const stageFilterCounts = useMemo(() => {
    return Object.fromEntries(
      PIPELINE_FILTERS.map((filter) => {
        if (!filter.stages) return [filter.key, stagedProspects.length];
        const count = stagedProspects.filter((row) =>
          filter.stages!.includes(row.stage),
        ).length;
        return [filter.key, count];
      }),
    ) as Record<StageFilterKey, number>;
  }, [stagedProspects]);

  const visibleProspects = useMemo(() => {
    const activeFilter = PIPELINE_FILTERS.find(
      (filter) => filter.key === stageFilter,
    );
    if (!activeFilter?.stages) return stagedProspects;
    return stagedProspects.filter((row) =>
      activeFilter.stages!.includes(row.stage),
    );
  }, [stageFilter, stagedProspects]);

  if (prospects.isLoading) {
    return (
      <PageLoader
        label="Loading companies"
        description="Fetching the latest prospect list."
      />
    );
  }

  if (stagedProspects.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-sm font-black text-[#040026] uppercase tracking-widest mb-2">
          No prospects yet
        </p>
        <p className="admin-meta-text mb-4">
          Start met zoeken en importeer je eerste relevante company.
        </p>
        <Link href="/admin/prospects/new" className="admin-btn-primary">
          <Plus className="w-3.5 h-3.5" />
          Create your first prospect
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="admin-toggle-group flex-wrap w-fit max-w-full">
        {PIPELINE_FILTERS.map((filter) => {
          const count = stageFilterCounts[filter.key] ?? 0;
          return (
            <button
              key={filter.key}
              onClick={() => setStageFilter(filter.key)}
              className={cn(
                'ui-tap ui-focus admin-toggle-btn admin-toggle-btn-sm',
                stageFilter === filter.key && 'admin-toggle-btn-active',
              )}
            >
              <span>{filter.label}</span>
              <span className="admin-toggle-count">{count}</span>
            </button>
          );
        })}
      </div>

      {}
      {visibleProspects.map(({ prospect, stage }) => {
        const deepStatus = deepAnalysisStatus(prospect.latestDeepResearchRun);
        const hasCompletedResearch =
          (prospect.researchStats?.completedRuns ?? 0) > 0;
        const hasActiveResearch = (prospect.researchStats?.activeRuns ?? 0) > 0;
        const canStartResearch =
          !hasCompletedResearch &&
          !hasActiveResearch &&
          ['Imported', 'Ready'].includes(stage);
        const canStartDeepResearch =
          hasCompletedResearch &&
          !hasActiveResearch &&
          deepStatus !== 'completed';
        const isStarting =
          startResearchMutation.isPending &&
          startingResearch?.id === prospect.id;
        const isStartingDeep = isStarting && startingResearch?.mode === 'deep';
        const deepSubtitle =
          isStartingDeep || deepStatus === 'running'
            ? 'Running now...'
            : deepStatus === 'failed'
              ? 'Failed · retry'
              : 'Not run yet';
        const deepStatusToneClass =
          deepStatus === 'completed'
            ? 'text-emerald-600'
            : deepStatus === 'failed'
              ? 'text-red-600'
              : deepStatus === 'running'
                ? 'text-cyan-600'
                : 'text-slate-500';

        return (
          <div
            key={prospect.id}
            className="glass-card glass-card-hover p-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between group"
          >
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 rounded-2xl bg-[#FCFCFD] border border-slate-100 flex items-center justify-center shadow-inner overflow-hidden">
                {prospect.logoUrl ? (
                  <img
                    src={prospect.logoUrl}
                    alt=""
                    className="w-8 h-8 object-contain"
                  />
                ) : (
                  <Building2 className="w-6 h-6 text-slate-200" />
                )}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-4">
                  <Link
                    href={`/admin/prospects/${prospect.id}`}
                    className="text-xl font-black text-[#040026] tracking-tighter hover:text-[#007AFF] transition-all"
                  >
                    {prospect.companyName ?? prospect.domain}
                  </Link>
                  <PipelineChip stage={stage} />
                  {(() => {
                    const run = prospect.researchRuns?.[0];
                    return (
                      <QualityChip
                        runId={run?.id ?? null}
                        evidenceCount={run?._count.evidenceItems ?? 0}
                        hypothesisCount={run?._count.workflowHypotheses ?? 0}
                        qualityApproved={run?.qualityApproved ?? null}
                        qualityReviewedAt={run?.qualityReviewedAt ?? null}
                        summary={run?.summary}
                      />
                    );
                  })()}
                  {(prospect._count?.gateOverrideAudits ?? 0) > 0 && (
                    <span className="admin-state-pill admin-state-warning">
                      Bypassed
                    </span>
                  )}
                </div>
                <div className="admin-meta-text flex flex-wrap items-center gap-4 mt-2">
                  <span className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5" /> {prospect.domain}
                  </span>
                  {prospect.industry && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-slate-200" />
                      <span>{prospect.industry}</span>
                    </>
                  )}
                  {prospect._count.sessions > 0 && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-slate-200" />
                      <span className="text-[#007AFF]">
                        {prospect._count.sessions} sessions
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {canStartResearch && (
                <button
                  onClick={() => {
                    setStartingResearch({
                      id: prospect.id,
                      mode: 'standard',
                    });
                    startResearchMutation.mutate({
                      prospectId: prospect.id,
                      deepCrawl: false,
                    });
                  }}
                  disabled={isStarting || startResearchMutation.isPending}
                  className="ui-tap inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 disabled:opacity-50"
                >
                  {isStarting && !isStartingDeep ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  Start Research
                </button>
              )}
              {canStartDeepResearch && (
                <button
                  onClick={() => {
                    setStartingResearch({
                      id: prospect.id,
                      mode: 'deep',
                    });
                    startResearchMutation.mutate({
                      prospectId: prospect.id,
                      deepCrawl: true,
                    });
                  }}
                  disabled={isStarting || startResearchMutation.isPending}
                  className="ui-tap inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-[#040026] hover:text-white hover:border-[#040026] transition-all disabled:opacity-50"
                >
                  {isStartingDeep ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  <span className="flex flex-col items-start leading-tight text-left">
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      Deep Analysis
                    </span>
                    <span
                      className={cn(
                        'text-[10px] font-semibold',
                        deepStatusToneClass,
                      )}
                    >
                      {deepSubtitle}
                    </span>
                  </span>
                </button>
              )}
              <Link
                href={`/admin/prospects/${prospect.id}`}
                className="ui-tap flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#EBCB4B] text-[#040026] hover:bg-[#D4B43B] transition-all border border-[#EBCB4B]"
              >
                <FileText className="w-3.5 h-3.5" />
                Detail Card
              </Link>
              <button
                onClick={() => {
                  if (
                    confirm(
                      `Delete ${prospect.companyName ?? prospect.domain}?`,
                    )
                  )
                    deleteMutation.mutate({ id: prospect.id });
                }}
                className="ui-tap p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-100 transition-all"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <Link
                href={buildDiscoverPath(prospect)}
                target="_blank"
                aria-label="Open discover page"
                className="ui-tap p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-[#040026] hover:bg-slate-100 border border-slate-100 transition-all"
              >
                <ExternalLink className="w-5 h-5" />
              </Link>
            </div>
          </div>
        );
      })}

      {visibleProspects.length === 0 && (
        <div className="glass-card p-10 rounded-[2rem] text-center text-sm font-bold text-slate-400">
          Geen companies in deze filter.
        </div>
      )}
    </div>
  );
}

function CompanySearch({ onImported }: { onImported: () => void }) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [industry, setIndustry] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [results, setResults] = useState<any[] | null>(null);
  const [guardrail, setGuardrail] = useState<SearchGuardrail | null>(null);
  // Map<domain, companyName> — need both for importCompany mutation
  const [selectedDomains, setSelectedDomains] = useState<Map<string, string>>(
    new Map(),
  );
  const [batchPending, setBatchPending] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  const utils = api.useUtils();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const search = (api.search.companies as any).useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      setResults(data.results);
      setGuardrail((data.guardrail as SearchGuardrail | null) ?? null);
      setSelectedDomains(new Map());
      setImportSummary(null);
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const importCompany = (api.search.importCompany as any).useMutation();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    search.mutate({
      companyName: name || undefined,
      domain: domain || undefined,
      industries: industry ? [industry] : undefined,
      countries: country ? [country] : undefined,
      cities: city ? [city] : undefined,
    });
  };

  const handleBatchImport = async () => {
    setBatchPending(true);
    setImportSummary(null);
    try {
      const entries = Array.from(selectedDomains.entries());
      const batchResults = await Promise.allSettled(
        entries.map(([domain, companyName]) =>
          importCompany.mutateAsync({
            domain,
            companyName: companyName || undefined,
          }),
        ),
      );
      const fulfilled = batchResults.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled',
      );
      const imported = fulfilled.filter((r) => !r.value.alreadyExists).length;
      const skipped = fulfilled.filter((r) => r.value.alreadyExists).length;
      const failed = batchResults.length - fulfilled.length;
      let summary = `${imported} geïmporteerd`;
      if (skipped > 0) summary += `, ${skipped} al aanwezig`;
      if (failed > 0) summary += `, ${failed} mislukt`;
      setImportSummary(summary);
      setSelectedDomains(new Map());
      utils.admin.listProspects.invalidate();
      onImported();
    } finally {
      setBatchPending(false);
    }
  };

  return (
    <div className="space-y-10">
      <form
        onSubmit={handleSearch}
        className="glass-card p-10 rounded-[2.5rem] space-y-8"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="admin-eyebrow ml-1">Company Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Stripe, OpenAI"
              className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="admin-eyebrow ml-1">Domain</label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g. stripe.com"
              className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="admin-eyebrow ml-1">Sector</label>
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="b.v. marketingbureaus, webdesign"
              className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="admin-eyebrow ml-1">Land</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. Netherlands"
              className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="admin-eyebrow ml-1">Locatie</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="b.v. Amsterdam, Netherlands"
              className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={search.isPending}
          className="admin-btn-primary w-full sm:w-auto"
        >
          {search.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Searching...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" /> Search Companies
            </>
          )}
        </button>
      </form>

      {results !== null && (
        <div className="space-y-6">
          {guardrail && (
            <div className="rounded-3xl border border-amber-200 bg-amber-50/80 px-6 py-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-black text-amber-900 tracking-tight">
                    {guardrail.title}
                  </p>
                  <p className="text-xs font-bold text-amber-800 mt-1">
                    {guardrail.message}
                  </p>
                  {guardrail.recommendation && (
                    <p className="text-xs font-semibold text-amber-700 mt-2">
                      {guardrail.recommendation}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          <p className="admin-eyebrow ml-2">{results.length} results</p>

          {results.length > 0 && (
            <div className="flex items-center justify-between gap-4 p-4 glass-card rounded-2xl">
              <label className="flex items-center gap-3 text-xs font-black text-slate-500 uppercase tracking-widest cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedDomains.size === results.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const all = new Map<string, string>();
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      results.forEach((c: any) =>
                        all.set(c.domain, c.companyName ?? c.domain),
                      );
                      setSelectedDomains(all);
                    } else {
                      setSelectedDomains(new Map());
                    }
                  }}
                  className="w-4 h-4 rounded accent-[#040026]"
                />
                {selectedDomains.size} geselecteerd
              </label>
              {selectedDomains.size > 0 && (
                <button
                  onClick={handleBatchImport}
                  disabled={batchPending}
                  className="admin-btn-primary admin-btn-sm"
                >
                  {batchPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Importeer geselecteerd
                </button>
              )}
            </div>
          )}

          {importSummary && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
              <Check className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-sm font-bold text-emerald-800">
                {importSummary}
              </p>
            </div>
          )}

          {results.length === 0 ? (
            <div className="glass-card p-20 text-center rounded-[2.5rem]">
              <Search className="w-16 h-16 text-slate-100 mx-auto mb-6" />
              <p className="text-sm font-black text-[#040026] uppercase tracking-widest">
                No matching companies found
              </p>
              <p className="admin-meta-text mt-2">
                Try expanding your search parameters.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {results.map((company: any, i: number) => (
                <div
                  key={company.lushaCompanyId ?? i}
                  className="glass-card p-8 rounded-[2.5rem] flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between group transition-all"
                >
                  <div className="flex items-center gap-6">
                    <input
                      type="checkbox"
                      checked={selectedDomains.has(company.domain)}
                      onChange={(e) => {
                        const next = new Map(selectedDomains);
                        if (e.target.checked) {
                          next.set(
                            company.domain,
                            company.companyName ?? company.domain,
                          );
                        } else {
                          next.delete(company.domain);
                        }
                        setSelectedDomains(next);
                      }}
                      className="w-4 h-4 rounded accent-[#040026] shrink-0"
                    />
                    <div className="w-16 h-16 rounded-2xl bg-[#FCFCFD] border border-slate-100 flex items-center justify-center shadow-inner overflow-hidden">
                      {company.logoUrl ? (
                        <img
                          src={company.logoUrl}
                          alt=""
                          className="w-10 h-10 object-contain"
                        />
                      ) : (
                        <Globe className="w-6 h-6 text-slate-100" />
                      )}
                    </div>
                    <div>
                      <p className="text-lg font-black text-[#040026] tracking-tight">
                        {company.companyName ?? company.domain}
                      </p>
                      <div className="admin-eyebrow flex flex-wrap items-center gap-4 mt-1">
                        <span className="text-[#040026]">{company.domain}</span>
                        {company.industry && (
                          <span className="flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-slate-200" />
                            {company.industry}
                          </span>
                        )}
                        {company.employeeRange && (
                          <span className="flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-slate-200" />
                            {company.employeeRange} employees
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ContactSearch() {
  const [jobTitle, setJobTitle] = useState('');
  const [seniority, setSeniority] = useState('');
  const [department, setDepartment] = useState('');
  const [companyDomain, setCompanyDomain] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [results, setResults] = useState<any[] | null>(null);
  const [guardrail, setGuardrail] = useState<SearchGuardrail | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const search = (api.search.contacts as any).useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      setResults(data.results);
      setGuardrail((data.guardrail as SearchGuardrail | null) ?? null);
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    search.mutate({
      jobTitles: jobTitle ? [jobTitle] : undefined,
      seniorities: seniority ? [seniority] : undefined,
      departments: department ? [department] : undefined,
      companyDomains: companyDomain ? [companyDomain] : undefined,
    });
  };

  return (
    <div className="space-y-10">
      <form
        onSubmit={handleSearch}
        className="glass-card p-10 rounded-[2.5rem] space-y-8"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="admin-eyebrow ml-1">Job Title</label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Chief Technical Officer"
              className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="admin-eyebrow ml-1">Seniority</label>
            <select
              value={seniority}
              onChange={(e) => setSeniority(e.target.value)}
              className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all appearance-none"
            >
              <option value="">All Seniority Levels</option>
              <option value="C-Level">C-Level Executive</option>
              <option value="VP">Vice President</option>
              <option value="Director">Director Level</option>
              <option value="Manager">Management</option>
              <option value="Senior">Senior Contributor</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="admin-eyebrow ml-1">Department</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Engineering, Operations"
              className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="admin-eyebrow ml-1">Company Domain</label>
            <input
              type="text"
              value={companyDomain}
              onChange={(e) => setCompanyDomain(e.target.value)}
              placeholder="e.g. acme.com"
              className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={search.isPending}
          className="admin-btn-primary w-full sm:w-auto"
        >
          {search.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Searching...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" /> Search Contacts
            </>
          )}
        </button>
      </form>

      {results !== null && (
        <div className="space-y-6">
          {guardrail && (
            <div className="rounded-3xl border border-amber-200 bg-amber-50/80 px-6 py-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-black text-amber-900 tracking-tight">
                    {guardrail.title}
                  </p>
                  <p className="text-xs font-bold text-amber-800 mt-1">
                    {guardrail.message}
                  </p>
                  {guardrail.recommendation && (
                    <p className="text-xs font-semibold text-amber-700 mt-2">
                      {guardrail.recommendation}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          <p className="admin-eyebrow ml-2">{results.length} results</p>
          {results.length === 0 ? (
            <div className="glass-card p-20 text-center rounded-[2.5rem]">
              <Users className="w-16 h-16 text-slate-100 mx-auto mb-6" />
              <p className="text-sm font-black text-[#040026] uppercase tracking-widest">
                No matching contacts found
              </p>
              <p className="admin-meta-text mt-2">
                Try adjusting seniority or job title filters.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {results.map((contact: any, i: number) => (
                <div
                  key={contact.lushaPersonId ?? i}
                  className="glass-card p-8 rounded-[2.5rem] flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between group transition-all"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-[#FCFCFD] border border-slate-100 flex items-center justify-center shadow-inner group-hover:bg-[#040026] group-hover:border-[#040026] transition-all">
                      <span className="text-sm font-black text-[#040026] group-hover:text-[#EBCB4B] transition-colors">
                        {contact.firstName?.[0]}
                        {contact.lastName?.[0]}
                      </span>
                    </div>
                    <div>
                      <p className="text-lg font-black text-[#040026] tracking-tight transition-colors">
                        {contact.firstName} {contact.lastName}
                      </p>
                      <div className="admin-eyebrow flex flex-wrap items-center gap-4 mt-1">
                        {contact.jobTitle && (
                          <span className="flex items-center gap-2">
                            <Briefcase className="w-4 h-4 opacity-50" />
                            {contact.jobTitle}
                          </span>
                        )}
                        {contact.company?.companyName && (
                          <span className="flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-slate-200" />
                            {contact.company.companyName}
                          </span>
                        )}
                        {contact.seniority && (
                          <span className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[#040026]">
                            {contact.seniority}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

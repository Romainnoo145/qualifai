'use client';

import { api } from '@/components/providers';
import Link from 'next/link';
import {
  Building2,
  Check,
  Users,
  Search,
  Loader2,
  Plus,
  Briefcase,
  AlertTriangle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { computePipelineStage, type PipelineStage } from '@/lib/pipeline-stage';
import { PageLoader } from '@/components/ui/page-loader';
import { ProspectLogo } from '@/components/features/prospects/prospect-logo';
import { ResearchRunBadge } from '@/components/features/research/research-run-badge';
import { isActiveStatus } from '@/lib/research/status-labels';

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
    <div className="max-w-[1400px] space-y-10">
      {/* Header */}
      <div className="flex items-baseline justify-between pb-6 border-b border-[var(--color-border)]">
        <h1 className="text-[48px] font-bold text-[var(--color-ink)] tracking-[-0.025em] leading-[1.05]">
          Prospects<span className="text-[var(--color-gold)]">.</span>
        </h1>
        <Link
          href="/admin/prospects/new"
          className="inline-flex items-center gap-2 px-6 py-2.5 text-[11px] font-medium uppercase tracking-[0.1em] bg-gradient-to-b from-[#e4c33c] to-[#f4d95a] text-[var(--color-ink)] border border-[#e4c33c] rounded-full"
        >
          + New Prospect
        </Link>
      </div>

      {/* View toggle */}
      <div className="overflow-x-auto">
        <div className="flex gap-2 w-max">
          <button
            onClick={() => setView('all')}
            className={cn(
              'px-4 py-2 text-[10px] font-medium uppercase tracking-[0.08em] rounded-md border transition-all',
              view === 'all'
                ? 'bg-[var(--color-ink)] text-white border-[var(--color-ink)]'
                : 'bg-transparent text-[var(--color-muted)] border-[var(--color-border)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]',
            )}
          >
            <Building2 className="w-3.5 h-3.5 inline mr-1.5" /> All Companies
          </button>
          <button
            onClick={() => setView('search-companies')}
            className={cn(
              'px-4 py-2 text-[10px] font-medium uppercase tracking-[0.08em] rounded-md border transition-all',
              view === 'search-companies'
                ? 'bg-[var(--color-ink)] text-white border-[var(--color-ink)]'
                : 'bg-transparent text-[var(--color-muted)] border-[var(--color-border)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]',
            )}
          >
            <Search className="w-3.5 h-3.5 inline mr-1.5" /> Search Companies
          </button>
          <button
            onClick={() => setView('search-contacts')}
            className={cn(
              'px-4 py-2 text-[10px] font-medium uppercase tracking-[0.08em] rounded-md border transition-all',
              view === 'search-contacts'
                ? 'bg-[var(--color-ink)] text-white border-[var(--color-ink)]'
                : 'bg-transparent text-[var(--color-muted)] border-[var(--color-border)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]',
            )}
          >
            <Users className="w-3.5 h-3.5 inline mr-1.5" /> Search Contacts
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
  const prospects = api.admin.listProspects.useQuery(undefined, {
    // Poll every 10s while at least one row has an active research run.
    // Note: once this returns `false`, the interval only re-engages when the query
    // settles again (e.g., focus-refetch). Reruns started in another tab without
    // refocus will only show up on the next settle event.
    // TODO: tRPC v11 inference — q must be `any` to avoid TS2589 deep instantiation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    refetchInterval: (q: any) => {
      const data = q.state.data as
        | {
            prospects?: Array<{
              researchRuns?: Array<{ status?: string | null }>;
            }>;
          }
        | undefined;
      const rows = data?.prospects ?? [];
      const anyActive = rows.some((r) =>
        isActiveStatus(r.researchRuns?.[0]?.status),
      );
      return anyActive ? 10_000 : false;
    },
  });
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

  // Group prospects by stage for A3 Editorial layout
  const stageGroups = useMemo(() => {
    const groups: { label: string; rows: typeof visibleProspects }[] = [];
    const groupOrder = [
      'Engaged',
      'Booked',
      'Sending',
      'Ready',
      'Reviewed',
      'Researched',
      'Researching',
      'Imported',
    ] as const;
    for (const stage of groupOrder) {
      const rows = visibleProspects.filter((r) => r.stage === stage);
      if (rows.length > 0) {
        const labels: Record<string, string> = {
          Engaged: 'Engaged',
          Booked: 'Booked',
          Sending: 'Sending',
          Ready: 'Klaar voor outreach',
          Reviewed: 'Beoordeeld',
          Researched: 'Onderzocht',
          Researching: 'Bezig met onderzoek',
          Imported: 'Geïmporteerd',
        };
        groups.push({ label: labels[stage] ?? stage, rows });
      }
    }
    return groups;
  }, [visibleProspects]);

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
      <div className="py-20 text-center">
        <Building2 className="w-12 h-12 text-[var(--color-border-strong)] mx-auto mb-4" />
        <p className="text-[15px] font-medium text-[var(--color-ink)] mb-2">
          No prospects yet
        </p>
        <p className="text-[13px] font-light text-[var(--color-muted)] mb-6">
          Start met zoeken en importeer je eerste relevante company.
        </p>
        <Link
          href="/admin/prospects/new"
          className="inline-flex items-center gap-2 px-6 py-2.5 text-[11px] font-medium uppercase tracking-[0.1em] bg-gradient-to-b from-[#e4c33c] to-[#f4d95a] text-[var(--color-ink)] border border-[#e4c33c] rounded-full"
        >
          <Plus className="w-3.5 h-3.5" />
          Create your first prospect
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stage filter pills */}
      <div className="flex gap-2 flex-wrap">
        {PIPELINE_FILTERS.map((filter) => {
          const count = stageFilterCounts[filter.key] ?? 0;
          return (
            <button
              key={filter.key}
              onClick={() => setStageFilter(filter.key)}
              className={cn(
                'px-3.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.08em] rounded-md border transition-all',
                stageFilter === filter.key
                  ? 'bg-[var(--color-ink)] text-white border-[var(--color-ink)]'
                  : 'bg-transparent text-[var(--color-muted)] border-[var(--color-border)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]',
              )}
            >
              {filter.label} <span className="ml-1 opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Grouped by stage */}
      {stageGroups.map((group) => (
        <section key={group.label} className="space-y-0">
          {/* Section header with extending line */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)] whitespace-nowrap">
              {group.label}
            </span>
            <span className="flex-1 h-px bg-[var(--color-border)]" />
          </div>

          {/* Prospect rows */}
          {group.rows.map(({ prospect }) => {
            const run = prospect.researchRuns?.[0];
            const qualityLight = run
              ? (() => {
                  const summaryObj =
                    run.summary &&
                    typeof run.summary === 'object' &&
                    !Array.isArray(run.summary)
                      ? (run.summary as Record<string, unknown>)
                      : null;
                  const gate =
                    summaryObj?.gate &&
                    typeof summaryObj.gate === 'object' &&
                    !Array.isArray(summaryObj.gate)
                      ? (summaryObj.gate as Record<string, unknown>)
                      : null;
                  const conf =
                    typeof gate?.averageConfidence === 'number'
                      ? gate.averageConfidence
                      : 0.65;
                  const types =
                    typeof gate?.sourceTypeCount === 'number'
                      ? gate.sourceTypeCount
                      : 1;
                  if (
                    run._count.evidenceItems >= 5 &&
                    types >= 3 &&
                    conf >= 0.55
                  )
                    return 'solid';
                  if (run._count.evidenceItems >= 3) return 'limited';
                  return 'thin';
                })()
              : null;

            return (
              <Link
                key={prospect.id}
                href={`/admin/prospects/${prospect.id}`}
                className="flex items-center gap-6 py-5 border-b border-[var(--color-surface-2)] hover:pl-2 transition-all group"
              >
                <ProspectLogo
                  prospect={{
                    logoUrl: prospect.logoUrl ?? null,
                    domain: prospect.domain ?? null,
                    companyName: prospect.companyName ?? null,
                  }}
                  size={48}
                  shape="rounded"
                  className="border border-[var(--color-border)] bg-[var(--color-surface-2)]"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[17px] font-medium text-[var(--color-ink)] tracking-[-0.01em]">
                      {prospect.companyName ?? prospect.domain}
                    </span>
                    <ResearchRunBadge status={run?.status} />
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[12px] font-light text-[var(--color-muted)]">
                    <span>{prospect.domain}</span>
                    {prospect.industry && (
                      <>
                        <span className="w-[3px] h-[3px] rounded-full bg-[var(--color-border-strong)]" />
                        <span>{prospect.industry}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Quality as text */}
                {qualityLight && (
                  <span
                    className={cn(
                      'text-[12px] font-light min-w-[50px]',
                      qualityLight === 'solid' &&
                        'text-[var(--color-ink)] font-medium',
                      qualityLight === 'limited' && 'text-[#b45a3b]',
                      qualityLight === 'thin' &&
                        'text-[var(--color-muted)] italic',
                    )}
                  >
                    {qualityLight === 'solid'
                      ? 'Solid'
                      : qualityLight === 'limited'
                        ? 'Limited'
                        : 'Thin'}
                  </span>
                )}

                {/* Sessions count in gold */}
                {prospect._count.sessions > 0 && (
                  <span className="text-[11px] font-medium text-[var(--color-gold)] tracking-[0.05em]">
                    {prospect._count.sessions} sessions
                  </span>
                )}

                {/* Arrow button */}
                <span className="w-9 h-9 rounded-full border border-[var(--color-border)] flex items-center justify-center text-[var(--color-muted)] group-hover:bg-[var(--color-ink)] group-hover:text-[var(--color-gold)] group-hover:border-[var(--color-ink)] transition-all shrink-0">
                  →
                </span>
              </Link>
            );
          })}
        </section>
      ))}

      {visibleProspects.length === 0 && (
        <div className="py-16 text-center text-sm font-medium text-[var(--color-muted)]">
          Geen companies in deze filter.
        </div>
      )}
    </div>
  );
}

function CompanySearch({ onImported }: { onImported: () => void }) {
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [industry, setIndustry] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [teamSize, setTeamSize] = useState('');
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
    const q = query.trim();
    const isDomain = q.includes('.');
    const parsedSize = teamSize.match(/(\d+)\s*[-–]\s*(\d+)/);
    search.mutate({
      companyName: !isDomain && q ? q : undefined,
      domain: isDomain ? q : undefined,
      industries: industry ? [industry] : undefined,
      countries: country ? [country] : undefined,
      cities: city ? [city] : undefined,
      ...(parsedSize
        ? {
            employeesMin: parseInt(parsedSize[1] ?? '0'),
            employeesMax: parseInt(parsedSize[2] ?? '100'),
          }
        : {}),
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
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="space-y-4">
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 py-3 border border-[var(--color-border)] rounded-lg focus-within:border-[var(--color-ink)] transition-colors">
          <Search className="w-4 h-4 text-[var(--color-muted)] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Zoek op bedrijfsnaam of domein..."
            className="flex-1 text-[14px] font-light text-[var(--color-ink)] bg-transparent border-none outline-none placeholder:text-[var(--color-border-strong)]"
          />
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'text-[10px] font-medium uppercase tracking-[0.08em] px-3 py-1.5 rounded border transition-all',
              showFilters
                ? 'bg-[var(--color-ink)] text-white border-[var(--color-ink)]'
                : 'bg-transparent text-[var(--color-muted)] border-[var(--color-border)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]',
            )}
          >
            {showFilters ? '- Filters' : '+ Filters'}
          </button>
          <button
            type="submit"
            disabled={search.isPending}
            className="inline-flex items-center gap-2 px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] bg-[var(--color-ink)] text-white rounded-md"
          >
            {search.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              'Zoeken'
            )}
          </button>
        </div>

        {/* Expandable filters */}
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pb-4 border-b border-[var(--color-surface-2)]">
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
                Sector
              </label>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="b.v. marketingbureaus"
                className="input-minimal w-full px-3 py-2 rounded-md text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
                Locatie
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="b.v. Amsterdam"
                className="input-minimal w-full px-3 py-2 rounded-md text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
                Land
              </label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="b.v. Netherlands"
                className="input-minimal w-full px-3 py-2 rounded-md text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
                Team grootte
              </label>
              <input
                type="text"
                value={teamSize}
                onChange={(e) => setTeamSize(e.target.value)}
                placeholder="b.v. 5-50"
                className="input-minimal w-full px-3 py-2 rounded-md text-[13px]"
              />
            </div>
          </div>
        )}
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
                    <ProspectLogo
                      prospect={{
                        logoUrl: company.logoUrl ?? null,
                        domain: company.domain ?? null,
                        companyName: company.companyName ?? null,
                      }}
                      size={64}
                      shape="rounded"
                      className="border border-slate-100 bg-[#FCFCFD] shadow-inner"
                    />
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
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
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
      jobTitles: query.trim() ? [query.trim()] : undefined,
      seniorities: seniority ? [seniority] : undefined,
      departments: department ? [department] : undefined,
      companyDomains: companyDomain ? [companyDomain] : undefined,
    });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="space-y-4">
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 py-3 border border-[var(--color-border)] rounded-lg focus-within:border-[var(--color-ink)] transition-colors">
          <Users className="w-4 h-4 text-[var(--color-muted)] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Zoek op functietitel..."
            className="flex-1 text-[14px] font-light text-[var(--color-ink)] bg-transparent border-none outline-none placeholder:text-[var(--color-border-strong)]"
          />
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'text-[10px] font-medium uppercase tracking-[0.08em] px-3 py-1.5 rounded border transition-all',
              showFilters
                ? 'bg-[var(--color-ink)] text-white border-[var(--color-ink)]'
                : 'bg-transparent text-[var(--color-muted)] border-[var(--color-border)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]',
            )}
          >
            {showFilters ? '- Filters' : '+ Filters'}
          </button>
          <button
            type="submit"
            disabled={search.isPending}
            className="inline-flex items-center gap-2 px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] bg-[var(--color-ink)] text-white rounded-md"
          >
            {search.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              'Zoeken'
            )}
          </button>
        </div>

        {/* Expandable filters */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pb-4 border-b border-[var(--color-surface-2)]">
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
                Seniority
              </label>
              <select
                value={seniority}
                onChange={(e) => setSeniority(e.target.value)}
                className="input-minimal w-full px-3 py-2 rounded-md text-[13px] appearance-none"
              >
                <option value="">Alle niveaus</option>
                <option value="C-Level">C-Level</option>
                <option value="VP">VP</option>
                <option value="Director">Director</option>
                <option value="Manager">Manager</option>
                <option value="Senior">Senior</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
                Afdeling
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="b.v. Engineering"
                className="input-minimal w-full px-3 py-2 rounded-md text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
                Bedrijf domein
              </label>
              <input
                type="text"
                value={companyDomain}
                onChange={(e) => setCompanyDomain(e.target.value)}
                placeholder="b.v. acme.com"
                className="input-minimal w-full px-3 py-2 rounded-md text-[13px]"
              />
            </div>
          </div>
        )}
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

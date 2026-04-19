'use client';

import { api } from '@/components/providers';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Building2, Plus, X, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { deepAnalysisStatus } from '@/lib/deep-analysis';
import { PageLoader } from '@/components/ui/page-loader';

type FunnelStage =
  | 'imported'
  | 'researching'
  | 'researched'
  | 'approved'
  | 'emailed'
  | 'replied'
  | 'booked';

const STAGE_ORDER: FunnelStage[] = [
  'booked',
  'replied',
  'emailed',
  'approved',
  'researched',
  'researching',
  'imported',
];

const STAGE_LABELS: Record<FunnelStage, string> = {
  imported: 'Imported',
  researching: 'Researching',
  researched: 'Researched',
  approved: 'Approved',
  emailed: 'Emailed',
  replied: 'Replied',
  booked: 'Booked',
};

const FUNNEL_STAGES: Array<{ key: FunnelStage; barColor: string }> = [
  { key: 'imported', barColor: 'bg-slate-300' },
  { key: 'researching', barColor: 'bg-cyan-400' },
  { key: 'researched', barColor: 'bg-blue-400' },
  { key: 'approved', barColor: 'bg-indigo-400' },
  { key: 'emailed', barColor: 'bg-amber-400' },
  { key: 'replied', barColor: 'bg-orange-400' },
  { key: 'booked', barColor: 'bg-emerald-500' },
];

function FunnelBar({
  funnel,
  activeStage,
  onStageClick,
}: {
  funnel: Record<FunnelStage, number>;
  activeStage: FunnelStage | null;
  onStageClick: (stage: FunnelStage | null) => void;
}) {
  const max = funnel.imported || 1;
  return (
    <div className="grid w-full grid-cols-7 border-b border-[var(--color-ink)] mb-10">
      {FUNNEL_STAGES.map(({ key }) => {
        const count = funnel[key];
        const widthPct = Math.max((count / max) * 100, 10);
        const isActive = activeStage === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onStageClick(isActive ? null : key)}
            className={cn(
              'flex min-w-0 flex-col gap-2 py-4 px-3 text-left transition-all cursor-pointer',
              'first:pl-0 last:pr-0',
              '[&+&]:border-l [&+&]:border-[var(--color-border)]',
              isActive && 'bg-[var(--color-ink)]/[0.02]',
            )}
          >
            <p
              className={cn(
                'text-[9px] font-medium uppercase tracking-[0.12em]',
                isActive
                  ? 'text-[var(--color-ink)]'
                  : 'text-[var(--color-muted)]',
              )}
            >
              {STAGE_LABELS[key]}
            </p>
            <p className="text-[28px] font-bold text-[var(--color-ink)] leading-[1.1]">
              {count}
            </p>
            <div className="h-[3px] bg-[var(--color-border)] rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-[var(--color-ink)] rounded-full transition-all"
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ProspectRow({
  prospect,
  campaignId,
  onDetach,
}: {
  prospect: {
    id: string;
    companyName: string | null;
    domain: string;
    logoUrl: string | null;
    industry: string | null;
    funnelStage: FunnelStage;
    latestDeepResearchRun: {
      status: string;
      completedAt: string | Date | null;
      inputSnapshot: unknown;
    } | null;
  };
  campaignId: string;
  onDetach: () => void;
}) {
  const utils = api.useUtils();
  const detach = api.campaigns.detachProspect.useMutation({
    onSuccess: () => {
      utils.campaigns.getWithFunnelData.invalidate({ id: campaignId });
      onDetach();
    },
  });
  const startResearch = api.research.startRun.useMutation({
    onSuccess: () => {
      utils.campaigns.getWithFunnelData.invalidate({ id: campaignId });
    },
    onSettled: () => {
      setStartMode(null);
    },
  });
  const [startMode, setStartMode] = useState<'standard' | 'deep' | null>(null);

  const deepStatus = deepAnalysisStatus(prospect.latestDeepResearchRun);
  const canStartResearch = prospect.funnelStage === 'imported';
  const hasCompletedResearch = [
    'researched',
    'approved',
    'emailed',
    'replied',
    'booked',
  ].includes(prospect.funnelStage);
  const canStartDeepResearch =
    hasCompletedResearch && deepStatus !== 'completed';
  const deepSubtitle =
    (startResearch.isPending && startMode === 'deep') ||
    deepStatus === 'running'
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
    <div className="flex items-center justify-between gap-4 py-4 border-b border-[var(--color-surface-2)]">
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-10 h-10 rounded-[8px] bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center shrink-0 overflow-hidden">
          {prospect.logoUrl ? (
            <img
              src={prospect.logoUrl}
              alt=""
              className="w-6 h-6 object-contain"
            />
          ) : (
            <Building2 className="w-4 h-4 text-[var(--color-border-strong)]" />
          )}
        </div>
        <div className="min-w-0">
          <Link
            href={`/admin/prospects/${prospect.id}`}
            className="text-[14px] font-medium text-[var(--color-ink)] hover:text-[var(--color-gold)] transition-colors truncate block"
          >
            {prospect.companyName ?? prospect.domain}
          </Link>
          {prospect.industry && (
            <p className="text-[11px] font-light text-[var(--color-muted)] truncate">
              {prospect.industry}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--color-muted)]">
          {STAGE_LABELS[prospect.funnelStage]}
        </span>
        {canStartResearch && (
          <button
            onClick={() => {
              setStartMode('standard');
              startResearch.mutate({
                prospectId: prospect.id,
                campaignId,
                deepCrawl: false,
              });
            }}
            disabled={startResearch.isPending}
            className="ui-tap inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-all disabled:opacity-50 text-[9px] font-black uppercase tracking-widest"
          >
            {startResearch.isPending && startMode !== 'deep' ? (
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
              setStartMode('deep');
              startResearch.mutate({
                prospectId: prospect.id,
                campaignId,
                deepCrawl: true,
              });
            }}
            disabled={startResearch.isPending}
            className="ui-tap inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-[#040026] hover:text-white hover:border-[#040026] transition-all disabled:opacity-50"
          >
            {startResearch.isPending && startMode === 'deep' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            <span className="flex flex-col items-start leading-tight text-left">
              <span className="text-[9px] font-black uppercase tracking-widest">
                Deep Analysis
              </span>
              <span
                className={cn('text-[10px] font-semibold', deepStatusToneClass)}
              >
                {deepSubtitle}
              </span>
            </span>
          </button>
        )}
        {prospect.funnelStage === 'researching' && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-50 text-cyan-700 border border-cyan-200 text-[9px] font-black uppercase tracking-widest">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Running
          </span>
        )}
        <button
          onClick={() => {
            if (
              confirm(
                `Remove ${prospect.companyName ?? prospect.domain} from this campaign?`,
              )
            ) {
              detach.mutate({
                campaignId,
                prospectId: prospect.id,
              });
            }
          }}
          disabled={detach.isPending}
          className="ui-tap p-1.5 rounded-lg bg-slate-50 text-slate-300 hover:text-red-500 hover:bg-red-50 border border-slate-100 transition-all disabled:opacity-50"
        >
          {detach.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <X className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}

function AddProspectPanel({
  campaignId,
  onAdded,
}: {
  campaignId: string;
  onAdded: () => void;
}) {
  const [selectedId, setSelectedId] = useState('');
  const utils = api.useUtils();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allProspects = (api.admin.listProspects as any).useQuery() as {
    data?: {
      prospects: Array<{
        id: string;
        companyName: string | null;
        domain: string;
      }>;
    };
  };
  const attach = api.campaigns.attachProspect.useMutation({
    onSuccess: () => {
      utils.campaigns.getWithFunnelData.invalidate({ id: campaignId });
      setSelectedId('');
      onAdded();
    },
  });

  return (
    <div className="flex items-center gap-3 py-4">
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="input-minimal flex-1 px-3 py-2.5 rounded-md text-[13px] appearance-none"
      >
        <option value="">Selecteer een bedrijf...</option>
        {(allProspects.data?.prospects ?? []).map((p) => (
          <option key={p.id} value={p.id}>
            {p.companyName ?? p.domain}
          </option>
        ))}
      </select>
      <button
        onClick={() => {
          if (selectedId) attach.mutate({ campaignId, prospectId: selectedId });
        }}
        disabled={!selectedId || attach.isPending}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-[11px] font-medium uppercase tracking-[0.08em] bg-[var(--color-ink)] text-white disabled:opacity-50 shrink-0"
      >
        {attach.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <Plus className="w-4 h-4" /> Add
          </>
        )}
      </button>
    </div>
  );
}

export default function CampaignDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [showAdd, setShowAdd] = useState(false);
  const [stageFilter, setStageFilter] = useState<FunnelStage | null>(null);

  const query = api.campaigns.getWithFunnelData.useQuery({ id });

  if (query.isLoading) {
    return (
      <PageLoader
        label="Loading campaign"
        description="Preparing campaign performance."
      />
    );
  }

  if (query.error || !query.data) {
    return (
      <div className="py-20 text-center">
        <p className="text-[15px] font-medium text-[var(--color-ink)] mb-2">
          Campaign not found
        </p>
        <Link
          href="/admin/campaigns"
          className="text-[13px] font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
        >
          &larr; Terug naar Campaigns
        </Link>
      </div>
    );
  }

  const { campaign, prospects, funnel, metrics } = query.data;

  const sortedProspects = [...prospects]
    .filter((p) => !stageFilter || p.funnelStage === stageFilter)
    .sort((a, b) => {
      const aRank = STAGE_ORDER.indexOf(a.funnelStage as FunnelStage);
      const bRank = STAGE_ORDER.indexOf(b.funnelStage as FunnelStage);
      return aRank - bRank;
    });

  return (
    <div className="max-w-[1400px] space-y-10">
      {/* Back line */}
      <div className="flex items-center gap-2 pb-4 border-b border-[var(--color-border)]">
        <Link
          href="/admin/campaigns"
          className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Campaigns
        </Link>
        <span className="text-[10px] text-[var(--color-border-strong)]">/</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-ink)]">
          {campaign.name}
        </span>
      </div>

      {/* Header */}
      <div className="pb-6 border-b border-[var(--color-ink)]">
        <h1 className="text-[clamp(32px,5vw,48px)] font-bold text-[var(--color-ink)] tracking-[-0.025em] leading-[1.05]">
          {campaign.name}
          <span className="text-[var(--color-gold)]">.</span>
        </h1>
        {campaign.nicheKey && (
          <p className="text-[14px] font-light text-[var(--color-muted)] mt-2">
            {campaign.nicheKey}
          </p>
        )}
      </div>

      {/* Conversion Metrics — flat inline */}
      <div className="flex gap-6 mb-8">
        <div className="flex items-baseline gap-2">
          <span className="text-[18px] font-bold text-[var(--color-ink)]">
            {metrics.responseRate.toFixed(1)}%
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
            Response rate
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[18px] font-bold text-[var(--color-ink)]">
            {metrics.bookingRate.toFixed(1)}%
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
            Booking rate
          </span>
        </div>
      </div>

      {/* Funnel — clickable stages filter the prospect list */}
      <FunnelBar
        funnel={funnel as Record<FunnelStage, number>}
        activeStage={stageFilter}
        onStageClick={setStageFilter}
      />

      {/* Prospect Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)] whitespace-nowrap">
              {stageFilter
                ? `${STAGE_LABELS[stageFilter]} (${sortedProspects.length})`
                : `${prospects.length} companies`}
            </span>
            <span className="flex-1 h-px bg-[var(--color-border)]" />
          </div>
          <div className="flex items-center gap-2 ml-4">
            <Link
              href={`/admin/campaigns/new?campaignId=${id}`}
              className="inline-flex items-center gap-2 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.08em] bg-[var(--color-ink)] text-white rounded-md"
            >
              <Search className="w-3.5 h-3.5" />
              Search Prospects
            </Link>
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.06em] bg-transparent text-[var(--color-muted)] border border-[var(--color-border)] rounded-md hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] transition-all"
            >
              {showAdd ? (
                <>
                  <X className="w-4 h-4" /> Close
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Add Company
                </>
              )}
            </button>
          </div>
        </div>

        {showAdd && (
          <AddProspectPanel campaignId={id} onAdded={() => setShowAdd(false)} />
        )}

        {sortedProspects.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="w-10 h-10 text-[var(--color-border-strong)] mx-auto mb-3" />
            <p className="text-[13px] font-light text-[var(--color-muted)]">
              {stageFilter
                ? `Geen companies met stage "${STAGE_LABELS[stageFilter]}"`
                : 'Nog geen companies in deze campaign'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedProspects.map((prospect) => (
              <ProspectRow
                key={prospect.id}
                prospect={
                  prospect as Parameters<typeof ProspectRow>[0]['prospect']
                }
                campaignId={id}
                onDetach={() => {}}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

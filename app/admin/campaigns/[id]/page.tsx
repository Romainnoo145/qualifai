'use client';

import { api } from '@/components/providers';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Building2, Plus, X, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { deepAnalysisStatus } from '@/lib/deep-analysis';
import { PageLoader } from '@/components/ui/page-loader';
import { EmptyState } from '@/components/ui/empty-state';

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

const STAGE_BADGE: Record<FunnelStage, string> = {
  imported: 'admin-state-neutral',
  researching: 'admin-state-info',
  researched: 'admin-state-info',
  approved: 'admin-state-accent',
  emailed: 'admin-state-warning',
  replied: 'admin-state-warning',
  booked: 'admin-state-success',
};

const FUNNEL_STAGES: Array<{ key: FunnelStage; barColor: string }> = [
  { key: 'imported', barColor: 'bg-[var(--color-border-strong)]' },
  { key: 'researching', barColor: 'bg-cyan-400' },
  { key: 'researched', barColor: 'bg-blue-400' },
  { key: 'approved', barColor: 'bg-indigo-400' },
  { key: 'emailed', barColor: 'bg-amber-400' },
  { key: 'replied', barColor: 'bg-orange-400' },
  { key: 'booked', barColor: 'bg-emerald-500' },
];

function FunnelBar({ funnel }: { funnel: Record<FunnelStage, number> }) {
  const max = funnel.imported || 1;
  return (
    <div className="glass-card p-6 rounded-[2.5rem]">
      <p className="admin-eyebrow mb-6">Funnel</p>
      <div className="grid w-full grid-cols-7 gap-4">
        {FUNNEL_STAGES.map(({ key, barColor }) => {
          const count = funnel[key];
          const widthPct = Math.max((count / max) * 100, 10);
          return (
            <div key={key} className="flex min-w-0 flex-col gap-2">
              <p className="admin-eyebrow">{STAGE_LABELS[key]}</p>
              <p className="text-2xl font-bold text-[var(--color-ink)]">
                {count}
              </p>
              <div className="h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                <div
                  className={cn('h-full rounded-full', barColor)}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
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
          : 'text-[var(--color-muted)]';

  return (
    <div className="glass-card glass-card-hover p-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center shrink-0 overflow-hidden">
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
            className="text-sm font-bold text-[var(--color-ink)] tracking-tight hover:text-[#007AFF] transition-colors truncate block"
          >
            {prospect.companyName ?? prospect.domain}
          </Link>
          {prospect.industry && (
            <p className="text-xs text-[var(--color-muted)] font-medium truncate">
              {prospect.industry}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span
          className={cn(
            'admin-state-pill text-[9px]',
            STAGE_BADGE[prospect.funnelStage],
          )}
        >
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
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-sm)] admin-state-info hover:opacity-80 border border-transparent transition-all disabled:opacity-50 text-[9px] font-bold uppercase tracking-[0.14em]"
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
            className="inline-flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-muted-dark)] hover:bg-[var(--color-ink)] hover:text-[var(--color-surface)] hover:border-[var(--color-ink)] transition-all disabled:opacity-50"
          >
            {startResearch.isPending && startMode === 'deep' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            <span className="flex flex-col items-start leading-tight text-left">
              <span className="text-[9px] font-bold uppercase tracking-[0.14em]">
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] admin-state-info text-[9px] font-bold uppercase tracking-[0.14em]">
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
          className="p-1.5 rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] text-[var(--color-border-strong)] hover:text-[var(--color-brand-danger)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] transition-all disabled:opacity-50"
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
    <div className="glass-card p-5 rounded-[2rem] flex items-center gap-3">
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="flex-1 px-4 py-2.5 input-minimal text-sm font-bold"
      >
        <option value="">Select a company…</option>
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
        className="admin-btn-primary disabled:opacity-50 shrink-0"
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
      <div className="flex flex-col items-center justify-center py-32 gap-6">
        <p className="admin-eyebrow text-[var(--color-muted)]">
          Campaign not found
        </p>
        <Link
          href="/admin/campaigns"
          className="text-sm font-semibold text-[#007AFF] hover:underline"
        >
          Back to Campaigns
        </Link>
      </div>
    );
  }

  const { campaign, prospects, funnel, metrics } = query.data;

  const sortedProspects = [...prospects].sort((a, b) => {
    const aRank = STAGE_ORDER.indexOf(a.funnelStage as FunnelStage);
    const bRank = STAGE_ORDER.indexOf(b.funnelStage as FunnelStage);
    return aRank - bRank;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <Link
          href="/admin/campaigns"
          className="inline-flex items-center gap-2 admin-eyebrow text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Campaigns
        </Link>
        <h1 className="font-['Sora'] text-[32px] font-bold tracking-[-0.025em] text-[var(--color-ink)]">
          {campaign.name}
        </h1>
        {campaign.nicheKey && (
          <p className="text-sm font-bold text-[var(--color-muted)] mt-1">
            {campaign.nicheKey}
          </p>
        )}
      </div>

      {/* Conversion Metrics */}
      <div className="flex gap-4">
        <div className="glass-card p-6 flex flex-col gap-2 flex-1">
          <p className="admin-eyebrow">Response Rate</p>
          <p className="text-3xl font-bold text-[var(--color-tag-run-text)]">
            {metrics.responseRate.toFixed(1)}%
          </p>
        </div>
        <div className="glass-card p-6 flex flex-col gap-2 flex-1">
          <p className="admin-eyebrow">Booking Rate</p>
          <p className="text-3xl font-bold text-[var(--color-tag-enrich-text)]">
            {metrics.bookingRate.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Funnel Visualization */}
      <FunnelBar funnel={funnel as Record<FunnelStage, number>} />

      {/* Prospect Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="admin-eyebrow">Companies in Campaign</p>
            <span className="admin-state-pill admin-state-neutral text-[9px]">
              {prospects.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/campaigns/new?campaignId=${id}`}
              className="admin-btn-primary"
            >
              <Search className="w-4 h-4" />
              Search Prospects
            </Link>
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="admin-btn-secondary"
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
          <EmptyState
            icon={<Building2 className="w-10 h-10" />}
            title="No companies in this campaign yet"
          />
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

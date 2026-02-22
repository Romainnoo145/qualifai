'use client';

import { api } from '@/components/providers';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Building2, Plus, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type FunnelStage =
  | 'imported'
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
  'imported',
];

const STAGE_LABELS: Record<FunnelStage, string> = {
  imported: 'Imported',
  researched: 'Researched',
  approved: 'Approved',
  emailed: 'Emailed',
  replied: 'Replied',
  booked: 'Booked',
};

const STAGE_BADGE: Record<FunnelStage, string> = {
  imported: 'bg-slate-100 text-slate-600',
  researched: 'bg-blue-50 text-blue-600',
  approved: 'bg-indigo-50 text-indigo-600',
  emailed: 'bg-amber-50 text-amber-600',
  replied: 'bg-orange-50 text-orange-600',
  booked: 'bg-emerald-50 text-emerald-600',
};

const FUNNEL_STAGES: Array<{ key: FunnelStage; barColor: string }> = [
  { key: 'imported', barColor: 'bg-slate-300' },
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
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">
        Funnel
      </p>
      <div className="grid grid-cols-6 gap-4">
        {FUNNEL_STAGES.map(({ key, barColor }) => {
          const count = funnel[key];
          const widthPct = Math.max((count / max) * 100, 10);
          return (
            <div key={key} className="flex flex-col gap-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {STAGE_LABELS[key]}
              </p>
              <p className="text-2xl font-black text-[#040026]">{count}</p>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
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

  return (
    <div className="glass-card glass-card-hover p-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-[#FCFCFD] border border-slate-100 flex items-center justify-center shadow-inner shrink-0 overflow-hidden">
          {prospect.logoUrl ? (
            <img
              src={prospect.logoUrl}
              alt=""
              className="w-6 h-6 object-contain"
            />
          ) : (
            <Building2 className="w-4 h-4 text-slate-200" />
          )}
        </div>
        <div className="min-w-0">
          <Link
            href={`/admin/prospects/${prospect.id}`}
            className="text-sm font-black text-[#040026] tracking-tight hover:text-[#007AFF] transition-colors truncate block"
          >
            {prospect.companyName ?? prospect.domain}
          </Link>
          {prospect.industry && (
            <p className="text-xs text-slate-400 font-medium truncate">
              {prospect.industry}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span
          className={cn(
            'text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest',
            STAGE_BADGE[prospect.funnelStage],
          )}
        >
          {STAGE_LABELS[prospect.funnelStage]}
        </span>
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
    <div className="glass-card p-5 rounded-[2rem] flex items-center gap-3">
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all"
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
        className="ui-tap inline-flex items-center gap-2 px-6 py-2.5 btn-pill-primary text-xs font-black uppercase tracking-widest disabled:opacity-50 shrink-0"
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
      <div className="space-y-8">
        <div className="h-10 bg-slate-100 rounded-2xl animate-pulse w-64" />
        <div className="glass-card p-6 rounded-[2.5rem] animate-pulse h-32" />
        <div className="glass-card p-6 rounded-[2.5rem] animate-pulse h-48" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="glass-card p-5 animate-pulse h-16 rounded-2xl"
            />
          ))}
        </div>
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-6">
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">
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
          className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#040026] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Campaigns
        </Link>
        <h1 className="text-4xl font-black text-[#040026] tracking-tighter">
          {campaign.name}
        </h1>
        {campaign.nicheKey && (
          <p className="text-sm font-bold text-slate-400">
            {campaign.nicheKey}
          </p>
        )}
      </div>

      {/* Conversion Metrics */}
      <div className="flex gap-4">
        <div className="glass-card p-6 flex flex-col gap-2 flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Response Rate
          </p>
          <p className="text-3xl font-black text-blue-600">
            {metrics.responseRate.toFixed(1)}%
          </p>
        </div>
        <div className="glass-card p-6 flex flex-col gap-2 flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Booking Rate
          </p>
          <p className="text-3xl font-black text-emerald-600">
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
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Companies in Campaign
            </p>
            <span className="text-[9px] font-black px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 uppercase tracking-widest">
              {prospects.length}
            </span>
          </div>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="ui-tap inline-flex items-center gap-2 px-5 py-2.5 btn-pill-secondary text-[10px] font-black uppercase tracking-widest"
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

        {showAdd && (
          <AddProspectPanel campaignId={id} onAdded={() => setShowAdd(false)} />
        )}

        {sortedProspects.length === 0 ? (
          <div className="glass-card p-10 text-center rounded-[2.5rem]">
            <Building2 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-black text-slate-400">
              No companies in this campaign yet
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

'use client';

import { api } from '@/components/providers';
import Link from 'next/link';
import { FolderKanban, Plus, ChevronRight, Loader2 } from 'lucide-react';

export default function CampaignsPage() {
  const campaigns = api.campaigns.list.useQuery();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-black text-[#040026] tracking-tighter">
          Campaigns
        </h1>
        <Link
          href="/admin/campaigns/new"
          className="ui-tap inline-flex items-center gap-2 px-6 py-3 btn-pill-primary text-xs font-black uppercase tracking-widest"
        >
          <Plus className="w-4 h-4" /> Create Campaign
        </Link>
      </div>

      <div className="space-y-3">
        {campaigns.isLoading && (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {!campaigns.isLoading && (campaigns.data ?? []).length === 0 && (
          <div className="glass-card p-10 rounded-[2.5rem] text-center text-sm font-bold text-slate-400">
            No campaigns yet. Start with the campaign setup wizard.
            <div className="mt-4">
              <Link
                href="/admin/campaigns/new"
                className="ui-tap inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#040026] text-white hover:bg-[#1E1E4A] transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Start Wizard
              </Link>
            </div>
          </div>
        )}

        {(campaigns.data ?? []).map((campaign) => (
          <Link
            key={campaign.id}
            href={`/admin/campaigns/${campaign.id}`}
            className="glass-card glass-card-hover p-6 rounded-[2rem] group flex items-center justify-between gap-6"
          >
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 rounded-2xl bg-[#FCFCFD] border border-slate-100 flex items-center justify-center shadow-inner group-hover:bg-[#040026] group-hover:border-[#040026] transition-all shrink-0">
                <FolderKanban className="w-5 h-5 text-[#040026] group-hover:text-[#EBCB4B] transition-colors" />
              </div>
              <div>
                <p className="text-base font-black text-[#040026] tracking-tight">
                  {campaign.name}
                </p>
                {campaign.nicheKey && (
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                    {campaign.nicheKey}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-5 shrink-0">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                {campaign._count.campaignProspects}{' '}
                {campaign._count.campaignProspects === 1
                  ? 'company'
                  : 'companies'}
              </span>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#040026] transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

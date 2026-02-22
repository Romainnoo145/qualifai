'use client';

import { api } from '@/components/providers';
import { useState } from 'react';
import Link from 'next/link';
import { FolderKanban, Plus, ChevronRight, X, Loader2 } from 'lucide-react';

export default function CampaignsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [nicheKey, setNicheKey] = useState('');
  const utils = api.useUtils();

  const campaigns = api.campaigns.list.useQuery();

  const createCampaign = api.campaigns.create.useMutation({
    onSuccess: async () => {
      setName('');
      setNicheKey('');
      setShowCreate(false);
      await utils.campaigns.list.invalidate();
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-black text-[#040026] tracking-tighter">
          Campaigns
        </h1>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="ui-tap inline-flex items-center gap-2 px-6 py-3 btn-pill-primary text-xs font-black uppercase tracking-widest"
        >
          {showCreate ? (
            <>
              <X className="w-4 h-4" /> Close
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" /> Create Campaign
            </>
          )}
        </button>
      </div>

      {showCreate && (
        <div className="glass-card p-8 rounded-[2.5rem] space-y-6">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            New Campaign
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Campaign name"
              className="w-full px-6 py-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all"
            />
            <input
              value={nicheKey}
              onChange={(e) => setNicheKey(e.target.value)}
              placeholder="e.g. Bouw & Installatie NL"
              className="w-full px-6 py-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={() =>
                createCampaign.mutate({
                  name,
                  nicheKey: nicheKey || 'generic_b2b',
                  language: 'nl',
                  strictGate: true,
                })
              }
              disabled={createCampaign.isPending || name.trim().length < 2}
              className="ui-tap inline-flex items-center gap-2 px-8 py-3.5 btn-pill-primary text-xs font-black uppercase tracking-widest disabled:opacity-50"
            >
              {createCampaign.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Create
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {campaigns.isLoading && (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {!campaigns.isLoading && (campaigns.data ?? []).length === 0 && (
          <div className="glass-card p-10 rounded-[2.5rem] text-center text-sm font-bold text-slate-400">
            No campaigns yet. Create your first campaign above.
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

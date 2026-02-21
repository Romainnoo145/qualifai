'use client';

import { api } from '@/components/providers';
import { useState } from 'react';
import {
  Building2,
  FolderKanban,
  Loader2,
  Plus,
  Link2,
  Play,
} from 'lucide-react';

type CampaignOption = {
  id: string;
  name: string;
  nicheKey: string;
  strictGate: boolean;
  _count: {
    campaignProspects: number;
    researchRuns: number;
    workflowLossMaps: number;
  };
};

type ProspectOption = {
  id: string;
  companyName: string | null;
  domain: string;
};

export default function CampaignsPage() {
  const [name, setName] = useState('');
  const [nicheKey, setNicheKey] = useState('construction_nl_sme');
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [selectedProspect, setSelectedProspect] = useState('');
  const [autopilotLimit, setAutopilotLimit] = useState('25');
  const [autopilotResult, setAutopilotResult] = useState<unknown>(null);
  const utils = api.useUtils();

  const campaigns = api.campaigns.list.useQuery();
  const prospects = api.admin.listProspects.useQuery();

  const createCampaign = api.campaigns.create.useMutation({
    onSuccess: async () => {
      setName('');
      await utils.campaigns.list.invalidate();
    },
  });

  const attachProspect = api.campaigns.attachProspect.useMutation({
    onSuccess: async () => {
      setSelectedProspect('');
      await utils.campaigns.list.invalidate();
      if (selectedCampaign) {
        await utils.campaigns.get.invalidate({ id: selectedCampaign });
      }
    },
  });

  const runAutopilot = api.campaigns.runAutopilot.useMutation({
    onSuccess: async (result) => {
      setAutopilotResult(result);
      await utils.campaigns.list.invalidate();
      await utils.outreach.getDecisionInbox.invalidate();
      await utils.research.listRuns.invalidate();
      await utils.assets.list.invalidate();
    },
  });

  const selectedCampaignDetails = api.campaigns.get.useQuery(
    { id: selectedCampaign },
    { enabled: Boolean(selectedCampaign) },
  );

  const campaignOptions = (campaigns.data ?? []) as CampaignOption[];
  const prospectOptions = (prospects.data?.prospects ?? []) as ProspectOption[];

  return (
    <div className="space-y-10">
      <h1 className="text-4xl font-black text-[#040026] tracking-tighter">
        Campaigns
      </h1>

      <div className="glass-card p-10 space-y-8 rounded-[2.5rem]">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
          Create Campaign
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Enterprise Tier Expansion"
            className="w-full px-6 py-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all"
          />
          <select
            value={nicheKey}
            onChange={(e) => setNicheKey(e.target.value)}
            className="w-full px-6 py-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all appearance-none"
          >
            <option value="construction_nl_sme">construction_nl_sme</option>
            <option value="installation_nl_sme">installation_nl_sme</option>
            <option value="generic_b2b">generic_b2b</option>
          </select>
          <button
            onClick={() =>
              createCampaign.mutate({
                name,
                nicheKey,
                language: 'nl',
                strictGate: true,
              })
            }
            disabled={createCampaign.isPending || name.trim().length < 2}
            className="ui-tap flex items-center justify-center gap-3 px-8 py-3.5 btn-pill-primary text-xs font-black uppercase tracking-widest disabled:opacity-50"
          >
            {createCampaign.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Initializing...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" /> Create Campaign
              </>
            )}
          </button>
        </div>
      </div>

      <div className="glass-card p-10 space-y-8 rounded-[2.5rem]">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
          Add Companies to Campaign
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <select
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value)}
            className="w-full px-6 py-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all appearance-none"
          >
            <option value="">Select Campaign</option>
            {campaignOptions.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
          <select
            value={selectedProspect}
            onChange={(e) => setSelectedProspect(e.target.value)}
            className="w-full px-6 py-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all appearance-none"
          >
            <option value="">Select Company</option>
            {prospectOptions.map((prospect) => (
              <option key={prospect.id} value={prospect.id}>
                {prospect.companyName ?? prospect.domain}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              if (!selectedCampaign || !selectedProspect) return;
              attachProspect.mutate({
                campaignId: selectedCampaign,
                prospectId: selectedProspect,
              });
            }}
            disabled={
              attachProspect.isPending || !selectedCampaign || !selectedProspect
            }
            className="ui-tap flex items-center justify-center gap-3 px-8 py-3.5 btn-pill-secondary text-xs font-black uppercase tracking-widest disabled:opacity-50"
          >
            {attachProspect.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Linking...
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4 opacity-50" /> Link Company
              </>
            )}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {(campaigns.data ?? []).map((campaign) => (
          <div
            key={campaign.id}
            className="glass-card glass-card-hover p-8 rounded-[2.5rem] group"
          >
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-[#FCFCFD] border border-slate-100 flex items-center justify-center shadow-inner group-hover:bg-[#040026] group-hover:border-[#040026] transition-all">
                  <FolderKanban className="w-6 h-6 text-[#040026] group-hover:text-[#EBCB4B] transition-colors" />
                </div>
                <div>
                  <p className="text-lg font-black text-[#040026] tracking-tight">
                    {campaign.name}
                  </p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                    Niche: {campaign.nicheKey} / Logic Gate:{' '}
                    {campaign.strictGate ? 'Strict' : 'Standard'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-6 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                <span className="inline-flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 opacity-50" />{' '}
                  {campaign._count.campaignProspects} Companies
                </span>
                <span>{campaign._count.researchRuns} Analyses</span>
                <span>{campaign._count.workflowLossMaps} Briefs</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedCampaign && selectedCampaignDetails.data && (
        <div className="glass-card p-10 rounded-[2.5rem]">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between mb-8">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
              Campaign Processing
            </h2>
            <div className="flex flex-wrap items-center gap-4">
              <input
                value={autopilotLimit}
                onChange={(e) => setAutopilotLimit(e.target.value)}
                type="number"
                min={1}
                max={100}
                className="w-24 px-4 py-2 rounded-xl border border-slate-100 bg-slate-50/50 text-xs font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10"
              />
              <button
                onClick={() =>
                  runAutopilot.mutate({
                    campaignId: selectedCampaign,
                    limit: Number(autopilotLimit) || 25,
                    dryRun: false,
                    queueDrafts: true,
                  })
                }
                disabled={runAutopilot.isPending}
                className="ui-tap inline-flex items-center gap-3 px-6 py-2.5 btn-pill-primary text-[10px] font-black uppercase tracking-widest disabled:opacity-50 shadow-xl shadow-[#040026]/10"
              >
                {runAutopilot.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Autopilot
                    Active...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" /> Initialize Autopilot
                  </>
                )}
              </button>
            </div>
          </div>
          {selectedCampaignDetails.data.campaignProspects.length === 0 ? (
            <p className="text-sm font-bold text-slate-400 bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-200 text-center">
              No companies linked to this campaign.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {selectedCampaignDetails.data.campaignProspects.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-[#FCFCFD] rounded-2xl border border-slate-100 text-xs font-bold text-[#040026] flex items-center gap-3"
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/20" />
                  {item.prospect.companyName ?? item.prospect.domain}
                </div>
              ))}
            </div>
          )}
          {autopilotResult ? (
            <div className="mt-8">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3 ml-1">
                Autopilot Execution Log
              </p>
              <pre className="bg-[#040026] rounded-2xl p-6 text-[10px] font-mono text-[#EBCB4B] overflow-auto whitespace-pre-wrap shadow-inner border border-white/5">
                {JSON.stringify(autopilotResult, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

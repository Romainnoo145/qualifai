'use client';

import { api } from '@/components/providers';
import { useSearchParams } from 'next/navigation';
import { FileDown, FileText, Loader2, Sparkles, History } from 'lucide-react';
import { cn } from '@/lib/utils';

type BriefListItem = {
  id: string;
  title: string;
  version: number;
  prospect: {
    companyName: string | null;
    domain: string;
  };
};

type BriefDetail = BriefListItem & {
  markdown: string;
  researchRun: {
    id: string;
  };
};

export default function BriefsPage() {
  const params = useSearchParams();
  const selectedId = params.get('lossMapId') ?? '';
  const briefs = api.assets.list.useQuery();
  const selected = api.assets.getById.useQuery(
    { id: selectedId },
    { enabled: Boolean(selectedId) },
  );
  const briefItems = (briefs.data ?? []) as BriefListItem[];
  const selectedBrief = selected.data as BriefDetail | undefined;

  return (
    <div className="space-y-16">
      <div className="flex items-center gap-6">
        <h1 className="text-4xl font-black text-[#040026] tracking-tighter">
          Workflow Loss Maps
        </h1>
        <div className="px-4 py-1.5 rounded-full bg-[#EBCB4B]/10 text-[#040026] border border-[#EBCB4B]/20">
          <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-[#EBCB4B]" /> High Fidelity Assets
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
        <div className="lg:col-span-4 space-y-4">
          {briefItems.map((brief) => (
            <a
              key={brief.id}
              href={`/admin/briefs?lossMapId=${brief.id}`}
              className={cn(
                'block glass-card p-6 transition-all group',
                selectedId === brief.id
                  ? 'border-[#040026]/20 bg-[#F8F9FA] shadow-xl shadow-[#040026]/5'
                  : 'hover:border-slate-200',
              )}
            >
              <p
                className={cn(
                  'text-md font-black tracking-tight transition-colors',
                  selectedId === brief.id ? 'text-[#007AFF]' : 'text-[#040026]',
                )}
              >
                {brief.title}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  {brief.prospect.companyName ?? brief.prospect.domain}
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-200" />
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  v{brief.version}
                </span>
              </div>
            </a>
          ))}
        </div>

        <div className="lg:col-span-8">
          {!selectedId ? (
            <div className="bg-[#FCFCFD] border border-dashed border-slate-200 p-32 text-center rounded-[2.5rem]">
              <div className="w-20 h-20 rounded-[2rem] bg-slate-50 flex items-center justify-center mx-auto mb-8 shadow-inner">
                <FileText className="w-10 h-10 text-slate-200" />
              </div>
              <p className="font-black text-[#040026] text-xl tracking-tight">
                Select an intelligence asset
              </p>
              <p className="text-slate-400 text-sm mt-2 font-medium">
                Choose a loss map from the list to preview high-fidelity data.
              </p>
            </div>
          ) : selected.isLoading ? (
            <div className="glass-card p-32 text-center rounded-[2.5rem]">
              <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-[#040026]" />
              <p className="text-sm font-bold text-slate-400">
                Loading Intelligence...
              </p>
            </div>
          ) : selectedBrief ? (
            <div className="glass-card p-10 space-y-8 rounded-[2rem]">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-[#040026] tracking-tighter">
                    {selectedBrief.title}
                  </h2>
                  <div className="flex items-center gap-4 mt-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#007AFF]">
                      {selectedBrief.prospect.companyName ??
                        selectedBrief.prospect.domain}
                    </p>
                    <span className="w-1 h-1 rounded-full bg-slate-200" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Version {selectedBrief.version}
                    </p>
                  </div>
                </div>
                <a
                  href={`/api/export/loss-map/${selectedBrief.id}?format=pdf`}
                  target="_blank"
                  className="ui-tap inline-flex items-center justify-center gap-3 px-8 py-3 btn-pill-primary text-xs w-full sm:w-auto"
                >
                  <FileDown className="w-4 h-4" /> Export High-Res PDF
                </a>
              </div>

              <div className="p-8 bg-[#FCFCFD] rounded-3xl border border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-xl bg-[#040026]/5 flex items-center justify-center">
                    <History className="w-4 h-4 text-[#040026]" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Research Lineage: {selectedBrief.researchRun.id}
                  </p>
                </div>
                <pre className="text-sm text-slate-600 overflow-auto whitespace-pre-wrap font-medium leading-relaxed font-mono">
                  {selectedBrief.markdown}
                </pre>
              </div>
            </div>
          ) : (
            <div className="glass-card p-10 text-center text-slate-500 text-sm">
              Brief not found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

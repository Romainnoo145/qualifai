'use client';

import { api } from '@/components/providers';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Globe,
  Loader2,
  Check,
  Copy,
  ExternalLink,
  ArrowRight,
  Building2,
} from 'lucide-react';
import { buildDiscoverPath } from '@/lib/prospect-url';

type ProcessStage = 'idle' | 'creating' | 'enriching' | 'generating' | 'done';

export default function NewProspect() {
  const router = useRouter();
  const [domain, setDomain] = useState('');
  const [notes, setNotes] = useState('');
  const [enrichCompanyName, setEnrichCompanyName] = useState('');
  const [enrichIndustry, setEnrichIndustry] = useState('');
  const [enrichDescription, setEnrichDescription] = useState('');
  const [enrichEmployeeRange, setEnrichEmployeeRange] = useState('');
  const [enrichCity, setEnrichCity] = useState('');
  const [enrichCountry, setEnrichCountry] = useState('Nederland');
  const [stage, setStage] = useState<ProcessStage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    id: string;
    slug: string;
    readableSlug: string | null;
    companyName: string | null;
    logoUrl: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createAndProcess = (api.admin.createAndProcess as any).useMutation({
    onMutate: () => {
      setStage('creating');
      setError(null);
      // Simulate stage progression for UX
      setTimeout(() => setStage('enriching'), 1500);
      setTimeout(() => setStage('generating'), 4000);
    },
    onSuccess: (data: any) => {
      setStage('done');
      setResult({
        id: data.id,
        slug: data.slug,
        readableSlug: data.readableSlug ?? null,
        companyName: data.companyName,
        logoUrl: data.logoUrl ?? null,
      });
    },
    onError: (err: any) => {
      setError(err.message);
      setStage('idle');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) return;
    createAndProcess.mutate({
      domain: domain.trim(),
      internalNotes: notes.trim() || undefined,
      ...(enrichCompanyName.trim() && {
        companyName: enrichCompanyName.trim(),
      }),
      ...(enrichIndustry.trim() && { industry: enrichIndustry.trim() }),
      ...(enrichDescription.trim() && {
        description: enrichDescription.trim(),
      }),
      ...(enrichEmployeeRange && {
        employeeRange: enrichEmployeeRange as
          | '1-10'
          | '11-50'
          | '51-200'
          | '201-500'
          | '501-1000'
          | '1001-5000'
          | '5001+',
      }),
      ...(enrichCity.trim() && { city: enrichCity.trim() }),
      ...(enrichCountry.trim() && { country: enrichCountry.trim() }),
    });
  };

  const copyLink = () => {
    if (!result) return;
    const url = `${window.location.origin}${buildDiscoverPath(result)}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stageMessages: Record<ProcessStage, string> = {
    idle: '',
    creating: 'Creating prospect...',
    enriching: 'Enriching company data via Apollo...',
    generating: 'Generating personalized AI content...',
    done: 'Wizard ready!',
  };

  return (
    <div className="max-w-3xl mx-auto space-y-16 py-12">
      <div>
        <h1 className="text-4xl font-black text-[#040026] tracking-tighter">
          Intelligence Onloading
        </h1>
        <p className="text-sm font-bold text-slate-400 mt-4 leading-relaxed">
          Propagate your target domain to initialize deep environmental
          enrichment and generate absolute discovery workflows.
        </p>
      </div>

      {stage === 'done' && result ? (
        /* Success state */
        <div className="glass-card p-12 text-center space-y-10 rounded-[2.5rem]">
          <div className="w-20 h-20 rounded-3xl bg-emerald-50 flex items-center justify-center mx-auto shadow-inner">
            {result.logoUrl ? (
              <img
                src={result.logoUrl}
                alt={`${result.companyName ?? domain} logo`}
                className="w-11 h-11 object-contain"
              />
            ) : (
              <Building2 className="w-9 h-9 text-emerald-500" />
            )}
          </div>
          <div>
            <h2 className="text-3xl font-black text-[#040026] tracking-tighter">
              {result.companyName ?? domain}&apos;s Engine is Live
            </h2>
            <p className="text-sm font-bold text-slate-400 mt-2">
              High-fidelity discovery asset localized and ready for outreach.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-[#FCFCFD] rounded-2xl px-6 py-4 border border-slate-100">
            <code className="text-xs font-mono text-slate-500 flex-1 text-left truncate">
              {typeof window !== 'undefined' ? window.location.origin : ''}
              {buildDiscoverPath(result)}
            </code>
            <button
              onClick={copyLink}
              className="ui-tap flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white border border-slate-200 text-slate-500 hover:text-[#040026] hover:bg-slate-50 transition-all shadow-sm"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Share Asset
                </>
              )}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-4">
            <a
              href={buildDiscoverPath(result)}
              target="_blank"
              className="ui-tap flex items-center justify-center gap-3 px-10 py-4 btn-pill-yellow text-xs w-full sm:w-auto shadow-xl"
            >
              <ExternalLink className="w-4 h-4" />
              Preview Dashboard
            </a>
            <button
              onClick={() => router.push(`/admin/prospects/${result.id}`)}
              className="ui-tap flex items-center justify-center gap-3 px-10 py-4 btn-pill-secondary text-xs w-full sm:w-auto"
            >
              Edit Intelligence
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => {
              setStage('idle');
              setDomain('');
              setNotes('');
              setEnrichCompanyName('');
              setEnrichIndustry('');
              setEnrichDescription('');
              setEnrichEmployeeRange('');
              setEnrichCity('');
              setEnrichCountry('Nederland');
              setResult(null);
            }}
            className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 hover:text-[#040026] transition-all"
          >
            Deploy Another Engine
          </button>
        </div>
      ) : (
        /* Form state */
        <form onSubmit={handleSubmit} className="space-y-10">
          <div className="glass-card p-10 space-y-8 rounded-[2.5rem]">
            <div className="space-y-3">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
                Corporate Domain
              </label>
              <div className="relative">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 pointer-events-none" />
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="e.g. apple.com"
                  disabled={stage !== 'idle'}
                  className="w-full pl-12 pr-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
                Tactical Intelligence{' '}
                <span className="opacity-50 text-slate-300">(Optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Specific context or situational constraints..."
                disabled={stage !== 'idle'}
                rows={4}
                className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all resize-none placeholder:text-slate-300"
              />
            </div>

            <details className="border border-gray-200 rounded-lg mt-4">
              <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-gray-700 select-none hover:bg-gray-50">
                Optionele verrijking
              </summary>
              <div className="px-4 pb-4 pt-2 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bedrijfsnaam
                  </label>
                  <input
                    type="text"
                    value={enrichCompanyName}
                    onChange={(e) => setEnrichCompanyName(e.target.value)}
                    placeholder="bijv. Marfa Design Studio"
                    className="input-minimal w-full"
                    maxLength={200}
                    disabled={stage !== 'idle'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sector
                  </label>
                  <input
                    type="text"
                    value={enrichIndustry}
                    onChange={(e) => setEnrichIndustry(e.target.value)}
                    placeholder="bijv. Grafisch ontwerp"
                    className="input-minimal w-full"
                    maxLength={100}
                    disabled={stage !== 'idle'}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Omschrijving
                  </label>
                  <textarea
                    value={enrichDescription}
                    onChange={(e) => setEnrichDescription(e.target.value)}
                    placeholder="Korte omschrijving van het bedrijf..."
                    className="input-minimal w-full"
                    rows={3}
                    maxLength={500}
                    disabled={stage !== 'idle'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Medewerkers
                  </label>
                  <select
                    value={enrichEmployeeRange}
                    onChange={(e) => setEnrichEmployeeRange(e.target.value)}
                    className="input-minimal w-full"
                    disabled={stage !== 'idle'}
                  >
                    <option value="">— kies een range —</option>
                    <option value="1-10">1–10</option>
                    <option value="11-50">11–50</option>
                    <option value="51-200">51–200</option>
                    <option value="201-500">201–500</option>
                    <option value="501-1000">501–1.000</option>
                    <option value="1001-5000">1.001–5.000</option>
                    <option value="5001+">5.001+</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stad
                  </label>
                  <input
                    type="text"
                    value={enrichCity}
                    onChange={(e) => setEnrichCity(e.target.value)}
                    placeholder="bijv. Amsterdam"
                    className="input-minimal w-full"
                    maxLength={100}
                    disabled={stage !== 'idle'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Land
                  </label>
                  <input
                    type="text"
                    value={enrichCountry}
                    onChange={(e) => setEnrichCountry(e.target.value)}
                    className="input-minimal w-full"
                    maxLength={100}
                    disabled={stage !== 'idle'}
                  />
                </div>
              </div>
            </details>
          </div>

          {error && (
            <div className="glass-card p-6 border-red-100 bg-red-50/20 rounded-2xl">
              <p className="text-xs font-bold text-red-500">{error}</p>
            </div>
          )}

          {stage !== 'idle' && stage !== 'done' && (
            <div className="glass-card p-10 rounded-[2.5rem]">
              <div className="flex items-center gap-5">
                <Loader2 className="w-8 h-8 text-[#007AFF] animate-spin" />
                <div>
                  <p className="text-sm font-black text-[#040026]">
                    {stageMessages[stage]}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                    {stage === 'generating'
                      ? 'AI Construction in progress...'
                      : 'Syncing Environmental Data...'}
                  </p>
                </div>
              </div>
              <div className="mt-8 h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                <div
                  className="h-full bg-[#040026] transition-all duration-1000 shadow-xl shadow-[#040026]/10"
                  style={{
                    width:
                      stage === 'creating'
                        ? '20%'
                        : stage === 'enriching'
                          ? '40%'
                          : '85%',
                  }}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={stage !== 'idle' || !domain.trim()}
            className="w-full py-5 btn-pill-primary text-xs tracking-[0.1em] shadow-2xl shadow-[#040026]/10"
          >
            {stage === 'idle'
              ? 'Propagate Engine Deployment'
              : 'System Initializing...'}
          </button>
        </form>
      )}
    </div>
  );
}

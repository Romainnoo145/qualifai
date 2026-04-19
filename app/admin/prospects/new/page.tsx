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
  ArrowLeft,
} from 'lucide-react';
import { buildDiscoverPath } from '@/lib/prospect-url';
import Link from 'next/link';

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
  const [showExtra, setShowExtra] = useState(false);
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
      setTimeout(() => setStage('enriching'), 1500);
      setTimeout(() => setStage('generating'), 4000);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    creating: 'Prospect aanmaken...',
    enriching: 'Bedrijfsdata verrijken via Apollo...',
    generating: 'AI content genereren...',
    done: 'Klaar!',
  };

  const labelClass =
    'text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]';
  const inputClass = 'input-minimal w-full px-3 py-2.5 rounded-md text-[13px]';

  return (
    <div className="max-w-[1400px] space-y-10">
      {/* Back line */}
      <div className="flex items-center gap-2 pb-4 border-b border-[var(--color-border)]">
        <Link
          href="/admin/prospects"
          className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Prospects
        </Link>
        <span className="text-[10px] text-[var(--color-border-strong)]">/</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-ink)]">
          Nieuw
        </span>
      </div>

      <h1 className="text-[48px] font-bold text-[var(--color-ink)] tracking-[-0.025em] leading-[1.05]">
        Nieuwe prospect<span className="text-[var(--color-gold)]">.</span>
      </h1>

      {stage === 'done' && result ? (
        /* Success state */
        <div className="space-y-8 max-w-2xl">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-[12px] bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden">
              {result.logoUrl ? (
                <img
                  src={result.logoUrl}
                  alt=""
                  className="w-8 h-8 object-contain"
                />
              ) : (
                <Building2 className="w-6 h-6 text-[var(--color-border-strong)]" />
              )}
            </div>
            <div>
              <h2 className="text-[24px] font-bold text-[var(--color-ink)] tracking-[-0.02em]">
                {result.companyName ?? domain}
                <span className="text-[var(--color-gold)]">.</span>
              </h2>
              <p className="text-[13px] font-light text-[var(--color-muted)]">
                Prospect aangemaakt en verrijkt.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 px-4 py-3 border border-[var(--color-border)] rounded-lg">
            <code className="text-[12px] font-light text-[var(--color-muted)] flex-1 truncate">
              {typeof window !== 'undefined' ? window.location.origin : ''}
              {buildDiscoverPath(result)}
            </code>
            <button
              onClick={copyLink}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-medium uppercase tracking-[0.06em] bg-transparent text-[var(--color-ink)] border border-[var(--color-border)] hover:border-[var(--color-ink)] transition-all"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" /> Gekopieerd
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" /> Kopieer
                </>
              )}
            </button>
          </div>

          <div className="flex gap-3">
            <a
              href={buildDiscoverPath(result)}
              target="_blank"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-[11px] font-medium uppercase tracking-[0.08em] bg-transparent text-[var(--color-ink)] border border-[var(--color-border)] hover:border-[var(--color-ink)] transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Preview
            </a>
            <button
              onClick={() => router.push(`/admin/prospects/${result.id}`)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[11px] font-medium uppercase tracking-[0.08em] bg-gradient-to-b from-[#e4c33c] to-[#f4d95a] text-[var(--color-ink)] border border-[#e4c33c]"
            >
              Bekijk prospect
              <ArrowRight className="w-3.5 h-3.5" />
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
              setShowExtra(false);
              setResult(null);
            }}
            className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
          >
            Nog een prospect toevoegen
          </button>
        </div>
      ) : (
        /* Form state */
        <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className={labelClass}>Domein</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)] pointer-events-none" />
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="e.g. stripe.com"
                  disabled={stage !== 'idle'}
                  className={`${inputClass} pl-9`}
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className={labelClass}>
                Notities <span className="opacity-50">(optioneel)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Context, pijnpunten, specifieke situatie..."
                disabled={stage !== 'idle'}
                rows={3}
                className={`${inputClass} resize-none`}
              />
            </div>

            <button
              type="button"
              onClick={() => setShowExtra(!showExtra)}
              className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
            >
              {showExtra ? '- Minder velden' : '+ Optionele verrijking'}
            </button>

            {showExtra && (
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-[var(--color-surface-2)]">
                <div className="space-y-1.5">
                  <label className={labelClass}>Bedrijfsnaam</label>
                  <input
                    type="text"
                    value={enrichCompanyName}
                    onChange={(e) => setEnrichCompanyName(e.target.value)}
                    placeholder="bijv. Marfa Design"
                    className={inputClass}
                    disabled={stage !== 'idle'}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Sector</label>
                  <input
                    type="text"
                    value={enrichIndustry}
                    onChange={(e) => setEnrichIndustry(e.target.value)}
                    placeholder="bijv. Grafisch ontwerp"
                    className={inputClass}
                    disabled={stage !== 'idle'}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className={labelClass}>Omschrijving</label>
                  <textarea
                    value={enrichDescription}
                    onChange={(e) => setEnrichDescription(e.target.value)}
                    placeholder="Korte omschrijving..."
                    className={`${inputClass} resize-none`}
                    rows={2}
                    disabled={stage !== 'idle'}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Medewerkers</label>
                  <select
                    value={enrichEmployeeRange}
                    onChange={(e) => setEnrichEmployeeRange(e.target.value)}
                    className={`${inputClass} appearance-none`}
                    disabled={stage !== 'idle'}
                  >
                    <option value="">— kies —</option>
                    <option value="1-10">1-10</option>
                    <option value="11-50">11-50</option>
                    <option value="51-200">51-200</option>
                    <option value="201-500">201-500</option>
                    <option value="501-1000">501-1.000</option>
                    <option value="1001-5000">1.001-5.000</option>
                    <option value="5001+">5.001+</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Stad</label>
                  <input
                    type="text"
                    value={enrichCity}
                    onChange={(e) => setEnrichCity(e.target.value)}
                    placeholder="bijv. Amsterdam"
                    className={inputClass}
                    disabled={stage !== 'idle'}
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="text-[13px] font-medium text-[var(--color-brand-danger)]">
              {error}
            </p>
          )}

          {stage !== 'idle' && stage !== 'done' && (
            <div className="flex items-center gap-4 py-6 border-b border-[var(--color-surface-2)]">
              <Loader2 className="w-5 h-5 text-[var(--color-ink)] animate-spin" />
              <div>
                <p className="text-[14px] font-medium text-[var(--color-ink)]">
                  {stageMessages[stage]}
                </p>
                <div className="mt-2 h-1 w-48 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-ink)] transition-all duration-1000"
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
            </div>
          )}

          <button
            type="submit"
            disabled={stage !== 'idle' || !domain.trim()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-[11px] font-medium uppercase tracking-[0.1em] bg-gradient-to-b from-[#e4c33c] to-[#f4d95a] text-[var(--color-ink)] border border-[#e4c33c] disabled:opacity-50"
          >
            {stage === 'idle' ? 'Prospect aanmaken' : 'Bezig...'}
          </button>
        </form>
      )}
    </div>
  );
}

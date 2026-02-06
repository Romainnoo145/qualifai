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
  Sparkles,
} from 'lucide-react';

type ProcessStage = 'idle' | 'creating' | 'enriching' | 'generating' | 'done';

export default function NewProspect() {
  const router = useRouter();
  const [domain, setDomain] = useState('');
  const [notes, setNotes] = useState('');
  const [stage, setStage] = useState<ProcessStage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    id: string;
    slug: string;
    companyName: string | null;
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
        companyName: data.companyName,
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
    });
  };

  const copyLink = () => {
    if (!result) return;
    const url = `${window.location.origin}/discover/${result.slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stageMessages: Record<ProcessStage, string> = {
    idle: '',
    creating: 'Creating prospect...',
    enriching: 'Enriching company data via Lusha...',
    generating: 'Generating personalized AI content with Claude...',
    done: 'Wizard ready!',
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold font-heading text-slate-900">
          New Prospect
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Enter a company domain to auto-enrich and generate their AI discovery
          wizard.
        </p>
      </div>

      {stage === 'done' && result ? (
        /* Success state */
        <div className="glass-card p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-klarifai-emerald/10 flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8 text-klarifai-emerald" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {result.companyName ?? domain}&apos;s wizard is ready
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Share this link with your prospect
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-4 py-3">
            <code className="text-sm text-slate-700 flex-1 text-left truncate">
              {typeof window !== 'undefined' ? window.location.origin : ''}
              /discover/{result.slug}
            </code>
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" /> Copy
                </>
              )}
            </button>
          </div>

          <div className="flex items-center justify-center gap-3">
            <a
              href={`/discover/${result.slug}`}
              target="_blank"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-klarifai-midnight text-white hover:bg-klarifai-indigo transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Preview Wizard
            </a>
            <button
              onClick={() => router.push(`/admin/prospects/${result.id}`)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              View Details
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => {
              setStage('idle');
              setDomain('');
              setNotes('');
              setResult(null);
            }}
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            Create another
          </button>
        </div>
      ) : (
        /* Form state */
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="glass-card p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Company Domain
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="acme.com"
                  disabled={stage !== 'idle'}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 bg-white/80 text-sm focus:outline-none focus:ring-2 focus:ring-klarifai-yellow/50 focus:border-klarifai-yellow disabled:opacity-50"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Internal Notes{' '}
                <span className="text-slate-400">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Context about this prospect, how you found them, etc."
                disabled={stage !== 'idle'}
                rows={3}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white/80 text-sm focus:outline-none focus:ring-2 focus:ring-klarifai-yellow/50 focus:border-klarifai-yellow disabled:opacity-50 resize-none"
              />
            </div>
          </div>

          {error && (
            <div className="glass-card p-4 border-red-200 bg-red-50/50">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {stage !== 'idle' && stage !== 'done' && (
            <div className="glass-card p-6">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-klarifai-blue animate-spin" />
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {stageMessages[stage]}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {stage === 'generating'
                      ? 'This takes 30-60 seconds...'
                      : 'Please wait...'}
                  </p>
                </div>
              </div>
              <div className="mt-4 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-klarifai-blue to-klarifai-cyan rounded-full transition-all duration-1000"
                  style={{
                    width:
                      stage === 'creating'
                        ? '20%'
                        : stage === 'enriching'
                          ? '40%'
                          : '80%',
                  }}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={stage !== 'idle' || !domain.trim()}
            className="w-full py-3 rounded-lg text-sm font-semibold bg-klarifai-midnight text-white hover:bg-klarifai-indigo transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {stage === 'idle' ? 'Enrich & Generate Wizard' : 'Processing...'}
          </button>
        </form>
      )}
    </div>
  );
}

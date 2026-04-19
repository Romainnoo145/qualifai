'use client';

/**
 * Phase 61-03 / ADMIN-02 — Prospect-scoped new quote page.
 *
 * Mounts the shared QuoteForm from 61-02, prefills `nummer` via the
 * `quotes.suggestNextQuoteNumber` query (shipped 61-01), calls the
 * `quotes.create` mutation, and redirects to /admin/quotes/[newId] on
 * success. Never constructs a snapshot (Pitfall 1) — snapshot freeze
 * only happens on DRAFT→SENT via transitionQuote.
 */

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/components/providers';
import { PageLoader } from '@/components/ui/page-loader';
import {
  QuoteForm,
  type QuoteFormValues,
} from '@/components/features/quotes/quote-form';
import { DEFAULT_BTW_PERCENTAGE } from '@/lib/quotes/constants';

export default function NewQuoteForProspectPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  // TODO: tRPC v11 inference gap — admin.getProspect returns a deep payload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prospectQuery = (api.admin.getProspect as any).useQuery({ id });

  // TODO: tRPC v11 inference gap — quotes.suggestNextQuoteNumber
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const suggestQuery = (api.quotes.suggestNextQuoteNumber as any).useQuery(
    undefined,
  );

  // TODO: tRPC v11 inference gap — quotes.create input/output
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createMutation = (api.quotes.create as any).useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      router.push(`/admin/quotes/${data.id}`);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      setError(err?.message ?? 'Kon offerte niet opslaan.');
    },
  });

  if (suggestQuery.isLoading || !suggestQuery.data) {
    return (
      <PageLoader
        label="Nieuwe offerte voorbereiden"
        description="Volgnummer ophalen."
      />
    );
  }

  const today = new Date();
  const plus30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const initial: QuoteFormValues = {
    nummer: suggestQuery.data?.nummer ?? '',
    datum: today.toISOString().slice(0, 10),
    geldigTot: plus30.toISOString().slice(0, 10),
    onderwerp: '',
    tagline: '',
    introductie: '',
    uitdaging: '',
    aanpak: '',
    btwPercentage: DEFAULT_BTW_PERCENTAGE,
    scope: '',
    buitenScope: '',
    lines: [],
  };

  const handleSubmit = (values: QuoteFormValues) => {
    setError(null);
    createMutation.mutate({
      prospectId: id,
      nummer: values.nummer,
      datum: new Date(values.datum).toISOString(),
      geldigTot: new Date(values.geldigTot).toISOString(),
      onderwerp: values.onderwerp,
      tagline: values.tagline || undefined,
      introductie: values.introductie || undefined,
      uitdaging: values.uitdaging || undefined,
      aanpak: values.aanpak || undefined,
      btwPercentage: values.btwPercentage,
      scope: values.scope || undefined,
      buitenScope: values.buitenScope || undefined,
      lines: values.lines.map((l, idx) => ({
        fase: l.fase,
        omschrijving: l.omschrijving || undefined,
        oplevering: l.oplevering || undefined,
        uren: l.uren,
        tarief: l.tarief, // SIGNED — preserve negative discount lines
        position: idx,
      })),
    });
  };

  return (
    <div className="max-w-[1400px] space-y-8">
      <div className="flex items-center gap-2 pb-4 border-b border-[var(--color-border)]">
        <Link
          href={`/admin/prospects/${id}`}
          className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {prospectQuery.data?.companyName ?? 'Prospect'}
        </Link>
        <span className="text-[10px] text-[var(--color-border-strong)]">/</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-ink)]">
          Nieuwe offerte
        </span>
      </div>

      <h1 className="text-[32px] font-bold text-[var(--color-ink)] tracking-[-0.02em]">
        Nieuwe offerte<span className="text-[var(--color-gold)]">.</span>
      </h1>

      {error && (
        <div className="py-3 text-[13px] font-medium text-[var(--color-brand-danger)]">
          {error}
        </div>
      )}

      <QuoteForm
        initial={initial}
        mode="create"
        onSubmit={handleSubmit}
        isReadOnly={false}
        isSubmitting={createMutation.isPending}
        error={error}
      />
    </div>
  );
}

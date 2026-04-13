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
      setError(err?.message ?? 'Kon voorstel niet opslaan.');
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
    <div className="space-y-8 p-10">
      <header className="space-y-3">
        <Link
          href={`/admin/prospects/${id}`}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#040026]"
        >
          <ArrowLeft className="h-4 w-4" /> Terug naar prospect
        </Link>
        <h1 className="text-3xl font-black text-[#040026]">Nieuw voorstel</h1>
        <p className="text-sm text-slate-500">
          {prospectQuery.data?.companyName ?? 'Onbekende prospect'}
        </p>
      </header>

      {error && (
        <div className="glass-card border-l-4 border-red-500 p-6 text-sm text-red-700">
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

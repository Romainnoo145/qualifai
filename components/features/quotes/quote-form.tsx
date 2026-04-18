'use client';

/**
 * QuoteForm — shared create/edit form for a Quote.
 *
 * Field shape matches server/routers/quotes.ts create input exactly.
 * Read-only mode (Q9) disables every input and hides the save button.
 * Negative tarief values round-trip cleanly (Phase 60 Pitfall 5).
 * Plain useState + props callback — mirror app/admin/prospects/new/page.tsx.
 */

import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { QuoteLineList, type LineDraft } from './quote-line-list';
import { DEFAULT_BTW_PERCENTAGE } from '@/lib/quotes/constants';

export interface QuoteFormValues {
  nummer: string;
  datum: string; // ISO date (yyyy-mm-dd)
  geldigTot: string; // ISO date
  onderwerp: string;
  tagline: string;
  introductie: string;
  uitdaging: string;
  aanpak: string;
  btwPercentage: number;
  scope: string;
  buitenScope: string;
  lines: LineDraft[];
}

interface Props {
  initial: QuoteFormValues;
  mode: 'create' | 'edit';
  onSubmit: (values: QuoteFormValues) => void;
  isReadOnly: boolean;
  isSubmitting: boolean;
  error: string | null;
}

export function QuoteForm({
  initial,
  mode,
  onSubmit,
  isReadOnly,
  isSubmitting,
  error,
}: Props) {
  const [values, setValues] = useState<QuoteFormValues>(() =>
    mode === 'create' && initial.btwPercentage === 0
      ? { ...initial, btwPercentage: DEFAULT_BTW_PERCENTAGE }
      : initial,
  );
  const [isDirty, setIsDirty] = useState(false);

  // beforeunload warning when dirty (O7)
  useEffect(() => {
    if (isReadOnly) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty, isReadOnly]);

  function update<K extends keyof QuoteFormValues>(
    k: K,
    v: QuoteFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [k]: v }));
    setIsDirty(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isReadOnly || isSubmitting) return;
    onSubmit(values);
  }

  const submitLabel = isDirty
    ? 'Opslaan (niet opgeslagen wijzigingen)'
    : 'Opslaan';

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="quote-form"
      className="space-y-10"
    >
      {/* Header fields */}
      <div className="glass-card space-y-6 p-10">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="space-y-2">
            <span className="admin-eyebrow">Nummer</span>
            <input
              aria-label="Nummer"
              className="input-minimal"
              value={values.nummer}
              onChange={(e) => update('nummer', e.target.value)}
              disabled={isReadOnly}
            />
          </label>
          <label className="space-y-2">
            <span className="admin-eyebrow">Datum</span>
            <input
              aria-label="Datum"
              type="date"
              className="input-minimal"
              value={values.datum}
              onChange={(e) => update('datum', e.target.value)}
              disabled={isReadOnly}
            />
          </label>
          <label className="space-y-2">
            <span className="admin-eyebrow">Geldig tot</span>
            <input
              aria-label="Geldig tot"
              type="date"
              className="input-minimal"
              value={values.geldigTot}
              onChange={(e) => update('geldigTot', e.target.value)}
              disabled={isReadOnly}
            />
          </label>
        </div>

        <label className="block space-y-2">
          <span className="admin-eyebrow">Onderwerp</span>
          <input
            aria-label="Onderwerp"
            className="input-minimal"
            placeholder="bv. Klarifai x Marfa — Strategisch merkplatform"
            value={values.onderwerp}
            onChange={(e) => update('onderwerp', e.target.value)}
            disabled={isReadOnly}
          />
        </label>
      </div>

      {/* Narrative fields */}
      <div className="glass-card space-y-6 p-10">
        <label className="block space-y-2">
          <span className="admin-eyebrow">Tagline</span>
          <input
            aria-label="Tagline"
            className="input-minimal"
            placeholder="Korte one-liner die de kern vangt — bv. Van brand confusion naar een systeem dat doorwerkt."
            value={values.tagline}
            onChange={(e) => update('tagline', e.target.value)}
            disabled={isReadOnly}
          />
        </label>
        <label className="block space-y-2">
          <span className="admin-eyebrow">Introductie</span>
          <textarea
            aria-label="Introductie"
            rows={5}
            className="input-minimal"
            placeholder="Waarom we aan tafel zitten. Eén alinea."
            value={values.introductie}
            onChange={(e) => update('introductie', e.target.value)}
            disabled={isReadOnly}
          />
        </label>
        <label className="block space-y-2">
          <span className="admin-eyebrow">Uitdaging</span>
          <textarea
            aria-label="Uitdaging"
            rows={5}
            className="input-minimal"
            placeholder="Wat er precies stuk is. Feiten, niet gevoel."
            value={values.uitdaging}
            onChange={(e) => update('uitdaging', e.target.value)}
            disabled={isReadOnly}
          />
        </label>
        <label className="block space-y-2">
          <span className="admin-eyebrow">Aanpak</span>
          <textarea
            aria-label="Aanpak"
            rows={5}
            className="input-minimal"
            placeholder="Hoe we het oplossen. Concreet en gefaseerd."
            value={values.aanpak}
            onChange={(e) => update('aanpak', e.target.value)}
            disabled={isReadOnly}
          />
        </label>
      </div>

      {/* Line items */}
      <div className="glass-card space-y-6 p-10">
        <h2 className="text-sm font-bold text-[var(--color-ink)]">
          Investering
        </h2>
        <QuoteLineList
          lines={values.lines}
          onChange={(next) => update('lines', next)}
          disabled={isReadOnly}
        />
      </div>

      {/* Scope + BTW */}
      <div className="glass-card space-y-6 p-10">
        <label className="block space-y-2">
          <span className="admin-eyebrow">Scope</span>
          <textarea
            aria-label="Scope"
            rows={4}
            className="input-minimal"
            placeholder="Wat IS onderdeel van dit voorstel (één per regel)"
            value={values.scope}
            onChange={(e) => update('scope', e.target.value)}
            disabled={isReadOnly}
          />
        </label>
        <label className="block space-y-2">
          <span className="admin-eyebrow">Buiten scope</span>
          <textarea
            aria-label="Buiten scope"
            rows={4}
            className="input-minimal"
            placeholder="Wat is nadrukkelijk NIET onderdeel (één per regel)"
            value={values.buitenScope}
            onChange={(e) => update('buitenScope', e.target.value)}
            disabled={isReadOnly}
          />
        </label>
        <label className="block space-y-2">
          <span className="admin-eyebrow">BTW percentage</span>
          <input
            aria-label="BTW percentage"
            type="number"
            className="input-minimal"
            value={values.btwPercentage}
            onChange={(e) =>
              update(
                'btwPercentage',
                Number(e.target.value) || DEFAULT_BTW_PERCENTAGE,
              )
            }
            disabled={isReadOnly}
          />
        </label>
      </div>

      {error && (
        <div className="glass-card border-red-100 bg-red-50/20 p-6">
          <p className="text-xs font-bold text-red-500">{error}</p>
        </div>
      )}

      {/* Submit row or read-only message */}
      {isReadOnly ? (
        <p className="text-xs font-medium text-[var(--color-muted-dark)]">
          Deze offerte is verstuurd en kan niet meer bewerkt worden. Maak een
          nieuwe versie om aanpassingen door te voeren.
        </p>
      ) : (
        <button
          type="submit"
          disabled={isSubmitting}
          aria-label={submitLabel}
          className="btn-pill-primary inline-flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {isSubmitting ? 'Bezig met opslaan…' : submitLabel}
        </button>
      )}
    </form>
  );
}

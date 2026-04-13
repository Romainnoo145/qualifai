import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuoteForm, type QuoteFormValues } from './quote-form';

const base: QuoteFormValues = {
  nummer: '2026-OFF999',
  datum: '2026-04-13',
  geldigTot: '2026-05-13',
  onderwerp: 'Klarifai x Acme',
  tagline: '',
  introductie: '',
  uitdaging: '',
  aanpak: '',
  btwPercentage: 21,
  scope: '',
  buitenScope: '',
  lines: [
    {
      fase: 'Fase 1',
      omschrijving: '',
      oplevering: '',
      uren: 10,
      tarief: 95,
    },
  ],
};

function renderForm(overrides: {
  initial?: QuoteFormValues;
  mode?: 'create' | 'edit';
  onSubmit?: (v: QuoteFormValues) => void;
  isReadOnly?: boolean;
  isSubmitting?: boolean;
  error?: string | null;
}) {
  const props = {
    initial: overrides.initial ?? base,
    mode: overrides.mode ?? ('create' as const),
    onSubmit: overrides.onSubmit ?? vi.fn(),
    isReadOnly: overrides.isReadOnly ?? false,
    isSubmitting: overrides.isSubmitting ?? false,
    error: overrides.error ?? null,
  };
  return render(<QuoteForm {...props} />);
}

describe('QuoteForm', () => {
  it('renders all narrative fields', () => {
    renderForm({});
    expect(screen.getByLabelText(/nummer/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^datum$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/geldig tot/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/onderwerp/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tagline/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/introductie/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/uitdaging/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/aanpak/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^scope$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/buiten scope/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/btw percentage/i)).toBeInTheDocument();
  });

  it('calls onSubmit with the correct payload on save', () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit });
    fireEvent.submit(screen.getByTestId('quote-form'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        nummer: '2026-OFF999',
        onderwerp: 'Klarifai x Acme',
        btwPercentage: 21,
        lines: expect.arrayContaining([
          expect.objectContaining({ fase: 'Fase 1', uren: 10, tarief: 95 }),
        ]),
      }),
    );
  });

  it('preserves negative tarief on save', () => {
    const onSubmit = vi.fn();
    renderForm({
      initial: {
        ...base,
        lines: [
          {
            fase: 'Korting',
            omschrijving: '',
            oplevering: '',
            uren: 1,
            tarief: -800,
          },
        ],
      },
      onSubmit,
    });
    fireEvent.submit(screen.getByTestId('quote-form'));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: expect.arrayContaining([
          expect.objectContaining({ tarief: -800 }),
        ]),
      }),
    );
  });

  it('disables all inputs when read-only (and hides save button)', () => {
    renderForm({ isReadOnly: true, mode: 'edit' });
    const nummer = screen.getByLabelText(/nummer/i) as HTMLInputElement;
    const datum = screen.getByLabelText(/^datum$/i) as HTMLInputElement;
    const onderwerp = screen.getByLabelText(/onderwerp/i) as HTMLInputElement;
    const btw = screen.getByLabelText(/btw percentage/i) as HTMLInputElement;
    expect(nummer.disabled).toBe(true);
    expect(datum.disabled).toBe(true);
    expect(onderwerp.disabled).toBe(true);
    expect(btw.disabled).toBe(true);
    expect(screen.queryByRole('button', { name: /opslaan/i })).toBeNull();
  });

  it('shows the read-only message when isReadOnly', () => {
    renderForm({ isReadOnly: true, mode: 'edit' });
    expect(screen.getByText(/niet meer bewerkt/i)).toBeInTheDocument();
  });

  it('shows the error banner when error is non-null', () => {
    renderForm({ error: 'Nummer bestaat al' });
    expect(screen.getByText(/nummer bestaat al/i)).toBeInTheDocument();
  });

  it('dirty indicator appears after a field change', () => {
    renderForm({});
    const onderwerp = screen.getByLabelText(/onderwerp/i) as HTMLInputElement;
    fireEvent.change(onderwerp, { target: { value: 'Nieuwe onderwerp' } });
    // After a change, submit button label becomes dirty variant
    expect(
      screen.getByRole('button', {
        name: /niet opgeslagen wijzigingen/i,
      }),
    ).toBeInTheDocument();
  });
});

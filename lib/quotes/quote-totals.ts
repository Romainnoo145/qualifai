/**
 * Shared totals math for Quote line items.
 *
 * Mirrors buildSnapshotFromQuote() in lib/state-machines/quote.ts exactly —
 * do NOT drift. If one changes, both must change. This is the one place
 * the preview renderer, the snapshot freeze, and any future reporter all
 * agree on how to add up hours × rates.
 */

export interface LineForTotals {
  uren: number;
  tarief: number; // SIGNED — negative allowed for discount lines (OFF003 Pakketkorting -800)
}

export interface QuoteTotals {
  netto: number;
  btw: number;
  bruto: number;
}

export function computeQuoteTotals(
  lines: LineForTotals[],
  btwPercentage: number,
): QuoteTotals {
  const netto = lines.reduce((sum, l) => sum + l.uren * l.tarief, 0);
  const btw = netto * (btwPercentage / 100);
  const bruto = netto + btw;
  return { netto, btw, bruto };
}

const EURO_FORMATTER = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format a number as Dutch-locale euro string.
 *
 * Intl.NumberFormat('nl-NL') output uses a narrow no-break space (U+202F) or
 * regular no-break space (U+00A0) between the currency symbol and the amount.
 * We normalize to a regular ASCII space so tests and HTML diffs stay stable.
 *
 * Examples:
 *   formatEuro(7816.60)  -> '€ 7.816,60'
 *   formatEuro(-800)     -> '€ -800,00'
 */
export function formatEuro(amount: number): string {
  return EURO_FORMATTER.format(amount).replace(/\u00A0|\u202F/g, ' ');
}

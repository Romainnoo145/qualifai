/**
 * Phase 61-01 / ADMIN-04 — Shared totals helper regression.
 *
 * Covers all three Marfa quote fixtures (OFF001/OFF002/OFF003) using the
 * exact line data from klarifai-core/data/quotes/2026/*.yaml so any drift
 * between the YAML golden data and this helper fails loudly.
 */
import { describe, it, expect } from 'vitest';
import { computeQuoteTotals, formatEuro } from './quote-totals';

describe('computeQuoteTotals', () => {
  it('OFF001: (8+48+12)*95 @ 21% BTW -> bruto € 7.816,60', () => {
    const lines = [
      { uren: 8, tarief: 95 }, // Discovery & analyse
      { uren: 48, tarief: 95 }, // Rebuild & development
      { uren: 12, tarief: 95 }, // Testing & oplevering
    ];
    const totals = computeQuoteTotals(lines, 21);
    expect(totals.netto).toBe(6460);
    expect(Math.round(totals.btw * 100) / 100).toBe(1356.6);
    expect(Math.round(totals.bruto * 100) / 100).toBe(7816.6);
    expect(formatEuro(totals.bruto)).toBe('€ 7.816,60');
  });

  it('OFF002: (16+72+12)*95 @ 21% BTW -> bruto € 11.495,00', () => {
    const lines = [
      { uren: 16, tarief: 95 }, // Discovery & architectuur
      { uren: 72, tarief: 95 }, // Custom app development
      { uren: 12, tarief: 95 }, // Testing & oplevering
    ];
    const totals = computeQuoteTotals(lines, 21);
    expect(totals.netto).toBe(9500);
    expect(Math.round(totals.btw * 100) / 100).toBe(1995);
    expect(Math.round(totals.bruto * 100) / 100).toBe(11495);
    expect(formatEuro(totals.bruto)).toBe('€ 11.495,00');
  });

  it('OFF003: (16+72+20+16)*95 + 1*-800 @ 21% BTW -> bruto € 13.285,80 (negative tarief preserved)', () => {
    const lines = [
      { uren: 16, tarief: 95 }, // Discovery & architectuur
      { uren: 72, tarief: 95 }, // Custom app development
      { uren: 20, tarief: 95 }, // Website redesign & implementatie
      { uren: 16, tarief: 95 }, // Testing & oplevering
      { uren: 1, tarief: -800 }, // Pakketkorting — negative!
    ];
    const totals = computeQuoteTotals(lines, 21);
    expect(totals.netto).toBe(10980);
    expect(Math.round(totals.btw * 100) / 100).toBe(2305.8);
    expect(Math.round(totals.bruto * 100) / 100).toBe(13285.8);
    expect(formatEuro(totals.bruto)).toBe('€ 13.285,80');
  });

  it('empty line array returns zeroes', () => {
    const totals = computeQuoteTotals([], 21);
    expect(totals).toEqual({ netto: 0, btw: 0, bruto: 0 });
  });
});

describe('formatEuro', () => {
  it('positive thousands: 7816.60 -> "€ 7.816,60" (with regular space)', () => {
    const out = formatEuro(7816.6);
    expect(out).toBe('€ 7.816,60');
    // Guard against narrow no-break space sneaking back in
    expect(out).not.toMatch(/\u00A0|\u202F/);
  });

  it('negative discount line: -800 -> "€ -800,00"', () => {
    expect(formatEuro(-800)).toBe('€ -800,00');
  });

  it('zero: 0 -> "€ 0,00"', () => {
    expect(formatEuro(0)).toBe('€ 0,00');
  });
});

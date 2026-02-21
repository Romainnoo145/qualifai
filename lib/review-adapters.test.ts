import { describe, expect, it } from 'vitest';
import { extractReviewSignalsFromText } from '@/lib/review-adapters';

describe('review-adapters', () => {
  it('extracts planning, handoff, and billing review signals from page text', () => {
    const input = `
      <html><body>
      Klanten noemen vaak lange wachttijd voor een afspraak en vertraging in de planning.
      De communicatie is soms traag, met weinig status update vanuit de service-afdeling.
      Sommige reviews gaan over factuur verschillen ten opzichte van de offerte en extra kosten.
      </body></html>
    `;

    const signals = extractReviewSignalsFromText(input);
    const tags = new Set(signals.map((signal) => signal.workflowTag));

    expect(signals.length).toBeGreaterThan(0);
    expect(tags.has('planning')).toBe(true);
    expect(tags.has('handoff')).toBe(true);
    expect(tags.has('billing')).toBe(true);
  });
});

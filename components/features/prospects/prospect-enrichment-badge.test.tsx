/**
 * Tests for ProspectEnrichmentBadge — PARITY-12
 *
 * Covers: renders amber pill when any of companyName/industry/description is null,
 * returns null when all three are populated, tooltip contains correct Dutch field names.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProspectEnrichmentBadge } from './prospect-enrichment-badge';

describe('ProspectEnrichmentBadge', () => {
  it('renders amber pill when all three fields are null', () => {
    render(
      <ProspectEnrichmentBadge
        companyName={null}
        industry={null}
        description={null}
      />,
    );
    expect(screen.getByText('Verrijking onvolledig')).toBeDefined();
  });

  it('renders pill when only industry is null (companyName and description populated)', () => {
    render(
      <ProspectEnrichmentBadge
        companyName="Marfa"
        industry={null}
        description="desc"
      />,
    );
    expect(screen.getByText('Verrijking onvolledig')).toBeDefined();
  });

  it('returns null (no badge) when all three fields are populated', () => {
    const { container } = render(
      <ProspectEnrichmentBadge
        companyName="Marfa"
        industry="Design"
        description="desc"
      />,
    );
    expect(screen.queryByText('Verrijking onvolledig')).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it('tooltip contains only the missing Dutch field labels when companyName and description are null', () => {
    render(
      <ProspectEnrichmentBadge
        companyName={null}
        industry="Design"
        description={null}
      />,
    );
    const pill = screen.getByText('Verrijking onvolledig');
    const tooltip = pill.getAttribute('title');
    expect(tooltip).toContain('bedrijfsnaam');
    expect(tooltip).not.toContain('sector');
    expect(tooltip).toContain('omschrijving');
  });

  it('tooltip contains all three Dutch field labels when all are null', () => {
    render(
      <ProspectEnrichmentBadge
        companyName={null}
        industry={null}
        description={null}
      />,
    );
    const pill = screen.getByText('Verrijking onvolledig');
    const tooltip = pill.getAttribute('title');
    expect(tooltip).toBe(
      'Verrijking ontbreekt: bedrijfsnaam, sector, omschrijving',
    );
  });
});

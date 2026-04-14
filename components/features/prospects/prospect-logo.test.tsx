/**
 * Tests for ProspectLogo — POLISH-10 / POLISH-11
 *
 * Covers: 4-level fallback (Apollo → DuckDuckGo → Google → initial),
 * shape prop, size prop, and className passthrough.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProspectLogo } from './prospect-logo';

vi.mock('@/lib/enrichment/favicon', () => ({
  buildInlineDuckDuckGoFaviconUrl: vi.fn(
    (domain: string) => `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  ),
  buildInlineGoogleFaviconUrl: vi.fn(
    (domain: string) =>
      `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
  ),
}));

const mockProspect = (overrides: {
  logoUrl?: string | null;
  domain?: string | null;
  companyName?: string | null;
}) => ({
  logoUrl: overrides.logoUrl ?? null,
  domain: overrides.domain ?? null,
  companyName: overrides.companyName ?? null,
});

describe('ProspectLogo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial stage selection', () => {
    it('renders Apollo img when logoUrl is present', () => {
      render(
        <ProspectLogo
          prospect={mockProspect({
            logoUrl: 'https://apollo.example.com/logo.png',
            domain: 'example.com',
            companyName: 'Example',
          })}
        />,
      );
      const img = screen.getByTestId('prospect-logo-apollo');
      expect(img).toBeDefined();
      expect((img as HTMLImageElement).src).toContain('apollo.example.com');
    });

    it('renders DuckDuckGo img when logoUrl is null but domain is present', () => {
      render(
        <ProspectLogo
          prospect={mockProspect({
            logoUrl: null,
            domain: 'marfa.nl',
            companyName: 'Marfa',
          })}
        />,
      );
      const img = screen.getByTestId('prospect-logo-ddg');
      expect(img).toBeDefined();
      expect((img as HTMLImageElement).src).toContain(
        'icons.duckduckgo.com/ip3/marfa.nl.ico',
      );
    });

    it('renders initial letter when both logoUrl and domain are null', () => {
      render(
        <ProspectLogo
          prospect={mockProspect({
            logoUrl: null,
            domain: null,
            companyName: 'Acme Corp',
          })}
        />,
      );
      const initial = screen.getByTestId('prospect-logo-initial');
      expect(initial.textContent).toBe('A');
    });

    it('renders "?" when logoUrl, domain, and companyName are all null', () => {
      render(
        <ProspectLogo
          prospect={mockProspect({
            logoUrl: null,
            domain: null,
            companyName: null,
          })}
        />,
      );
      const initial = screen.getByTestId('prospect-logo-initial');
      expect(initial.textContent).toBe('?');
    });
  });

  describe('fallback cascade', () => {
    it('cascades apollo → ddg → google → initial', () => {
      render(
        <ProspectLogo
          prospect={mockProspect({
            logoUrl: 'https://apollo.example.com/logo.png',
            domain: 'marfa.nl',
            companyName: 'Marfa',
          })}
        />,
      );

      const apolloImg = screen.getByTestId('prospect-logo-apollo');
      fireEvent.error(apolloImg);

      const ddgImg = screen.getByTestId('prospect-logo-ddg');
      expect(ddgImg).toBeDefined();
      fireEvent.error(ddgImg);

      const googleImg = screen.getByTestId('prospect-logo-google');
      expect(googleImg).toBeDefined();
      expect((googleImg as HTMLImageElement).src).toContain(
        'google.com/s2/favicons',
      );
      fireEvent.error(googleImg);

      const initial = screen.getByTestId('prospect-logo-initial');
      expect(initial.textContent).toBe('M');
    });

    it('cascades from ddg to google on img error', () => {
      render(
        <ProspectLogo
          prospect={mockProspect({
            logoUrl: null,
            domain: 'marfa.nl',
            companyName: 'Marfa',
          })}
        />,
      );
      const ddgImg = screen.getByTestId('prospect-logo-ddg');
      fireEvent.error(ddgImg);
      const googleImg = screen.getByTestId('prospect-logo-google');
      expect(googleImg).toBeDefined();
      expect((googleImg as HTMLImageElement).src).toContain(
        'google.com/s2/favicons',
      );
    });

    it('cascades from apollo directly to initial when domain is null', () => {
      render(
        <ProspectLogo
          prospect={mockProspect({
            logoUrl: 'https://apollo.example.com/logo.png',
            domain: null,
            companyName: 'NoSlug',
          })}
        />,
      );
      const img = screen.getByTestId('prospect-logo-apollo');
      fireEvent.error(img);
      const initial = screen.getByTestId('prospect-logo-initial');
      expect(initial.textContent).toBe('N');
    });
  });

  describe('size prop', () => {
    it('defaults to 40px when size is not provided', () => {
      render(
        <ProspectLogo
          prospect={mockProspect({
            logoUrl: null,
            domain: 'marfa.nl',
            companyName: 'Marfa',
          })}
        />,
      );
      const img = screen.getByTestId('prospect-logo-ddg') as HTMLImageElement;
      expect(img.width).toBe(40);
      expect(img.height).toBe(40);
    });

    it('uses the provided size', () => {
      render(
        <ProspectLogo
          prospect={mockProspect({
            logoUrl: null,
            domain: 'marfa.nl',
            companyName: 'Marfa',
          })}
          size={64}
        />,
      );
      const img = screen.getByTestId('prospect-logo-ddg') as HTMLImageElement;
      expect(img.width).toBe(64);
      expect(img.height).toBe(64);
    });
  });

  describe('shape prop', () => {
    it('applies rounded-full when shape=circle (default)', () => {
      render(
        <ProspectLogo
          prospect={mockProspect({
            logoUrl: null,
            domain: 'marfa.nl',
            companyName: 'Marfa',
          })}
        />,
      );
      const img = screen.getByTestId('prospect-logo-ddg');
      expect(img.getAttribute('data-shape')).toBe('circle');
      expect(img.className).toContain('rounded-full');
    });

    it('applies rounded-2xl when shape=rounded', () => {
      render(
        <ProspectLogo
          prospect={mockProspect({
            logoUrl: null,
            domain: 'marfa.nl',
            companyName: 'Marfa',
          })}
          shape="rounded"
        />,
      );
      const img = screen.getByTestId('prospect-logo-ddg');
      expect(img.getAttribute('data-shape')).toBe('rounded');
      expect(img.className).toContain('rounded-2xl');
      expect(img.className).not.toContain('rounded-full');
    });
  });
});

/**
 * Tests for ProspectLogo — POLISH-10 / POLISH-11
 *
 * Covers: 3-level fallback (Apollo → favicon → initial), shape prop, size prop,
 * and className passthrough.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProspectLogo } from './prospect-logo';

// Mock buildInlineGoogleFaviconUrl so we can control what URL it returns
vi.mock('@/lib/enrichment/favicon', () => ({
  buildInlineGoogleFaviconUrl: vi.fn(
    (domain: string) =>
      `https://www.google.com/s2/favicons?domain=${domain}&sz=80`,
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

    it('renders favicon img when logoUrl is null but domain is present', () => {
      render(
        <ProspectLogo
          prospect={mockProspect({
            logoUrl: null,
            domain: 'marfa.nl',
            companyName: 'Marfa',
          })}
        />,
      );
      const img = screen.getByTestId('prospect-logo-favicon');
      expect(img).toBeDefined();
      expect((img as HTMLImageElement).src).toContain('google.com/s2/favicons');
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
    it('cascades from apollo to favicon on img error when domain present', () => {
      render(
        <ProspectLogo
          prospect={mockProspect({
            logoUrl: 'https://apollo.example.com/logo.png',
            domain: 'marfa.nl',
            companyName: 'Marfa',
          })}
        />,
      );
      const img = screen.getByTestId('prospect-logo-apollo');
      fireEvent.error(img);
      // Should now show favicon
      const faviconImg = screen.getByTestId('prospect-logo-favicon');
      expect(faviconImg).toBeDefined();
    });

    it('cascades from favicon to initial on img error', () => {
      render(
        <ProspectLogo
          prospect={mockProspect({
            logoUrl: null,
            domain: 'marfa.nl',
            companyName: 'Marfa',
          })}
        />,
      );
      const img = screen.getByTestId('prospect-logo-favicon');
      fireEvent.error(img);
      // Should now show initial letter
      const initial = screen.getByTestId('prospect-logo-initial');
      expect(initial.textContent).toBe('M');
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
      // No domain → skip favicon, go straight to initial
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
      const img = screen.getByTestId(
        'prospect-logo-favicon',
      ) as HTMLImageElement;
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
      const img = screen.getByTestId(
        'prospect-logo-favicon',
      ) as HTMLImageElement;
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
      const img = screen.getByTestId('prospect-logo-favicon');
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
      const img = screen.getByTestId('prospect-logo-favicon');
      expect(img.getAttribute('data-shape')).toBe('rounded');
      expect(img.className).toContain('rounded-2xl');
      expect(img.className).not.toContain('rounded-full');
    });
  });
});

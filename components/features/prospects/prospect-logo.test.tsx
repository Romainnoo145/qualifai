/**
 * Tests for ProspectLogo — Phase 61.3 simplified 2-stage renderer.
 *
 * Covers: DB logoUrl trust, img onError → initial-letter fallback,
 * shape prop, size prop, className passthrough.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProspectLogo } from './prospect-logo';

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

  describe('DB logoUrl rendering', () => {
    it('renders the DB logoUrl as an img when present', () => {
      render(
        <ProspectLogo
          prospect={mockProspect({
            logoUrl: 'https://cdn.example.com/logo.png',
            domain: 'example.com',
            companyName: 'Example',
          })}
        />,
      );
      const img = screen.getByTestId('prospect-logo-image') as HTMLImageElement;
      expect(img).toBeDefined();
      expect(img.src).toBe('https://cdn.example.com/logo.png');
      expect(img.alt).toBe('Example');
    });

    it('uses domain as alt when companyName is null', () => {
      render(
        <ProspectLogo
          prospect={mockProspect({
            logoUrl: 'https://cdn.example.com/logo.png',
            domain: 'example.com',
            companyName: null,
          })}
        />,
      );
      const img = screen.getByTestId('prospect-logo-image') as HTMLImageElement;
      expect(img.alt).toBe('example.com');
    });
  });

  describe('initial letter fallback', () => {
    it('renders initial letter when logoUrl is null', () => {
      render(
        <ProspectLogo
          prospect={mockProspect({
            logoUrl: null,
            domain: 'example.com',
            companyName: 'Acme Corp',
          })}
        />,
      );
      const initial = screen.getByTestId('prospect-logo-initial');
      expect(initial.textContent).toBe('A');
    });

    it('renders "?" when all three fields are null', () => {
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

    it('uses domain initial when companyName is null', () => {
      render(
        <ProspectLogo
          prospect={mockProspect({
            logoUrl: null,
            domain: 'marfa.nl',
            companyName: null,
          })}
        />,
      );
      const initial = screen.getByTestId('prospect-logo-initial');
      expect(initial.textContent).toBe('M');
    });

    it('cascades from img to initial letter on img error', () => {
      render(
        <ProspectLogo
          prospect={mockProspect({
            logoUrl: 'https://broken.example.com/logo.png',
            domain: 'example.com',
            companyName: 'Broken',
          })}
        />,
      );
      const img = screen.getByTestId('prospect-logo-image');
      fireEvent.error(img);
      const initial = screen.getByTestId('prospect-logo-initial');
      expect(initial.textContent).toBe('B');
    });
  });

  describe('size prop', () => {
    it('defaults to 40px when size is not provided', () => {
      render(
        <ProspectLogo
          prospect={mockProspect({
            logoUrl: 'https://cdn.example.com/logo.png',
            domain: 'example.com',
            companyName: 'Example',
          })}
        />,
      );
      const img = screen.getByTestId('prospect-logo-image') as HTMLImageElement;
      expect(img.width).toBe(40);
      expect(img.height).toBe(40);
    });

    it('uses the provided size', () => {
      render(
        <ProspectLogo
          prospect={mockProspect({
            logoUrl: 'https://cdn.example.com/logo.png',
            domain: 'example.com',
            companyName: 'Example',
          })}
          size={64}
        />,
      );
      const img = screen.getByTestId('prospect-logo-image') as HTMLImageElement;
      expect(img.width).toBe(64);
      expect(img.height).toBe(64);
    });
  });

  describe('shape prop', () => {
    it('applies rounded-full when shape=circle (default)', () => {
      render(
        <ProspectLogo
          prospect={mockProspect({
            logoUrl: 'https://cdn.example.com/logo.png',
            domain: 'example.com',
            companyName: 'Example',
          })}
        />,
      );
      const img = screen.getByTestId('prospect-logo-image');
      expect(img.getAttribute('data-shape')).toBe('circle');
      expect(img.className).toContain('rounded-full');
    });

    it('applies rounded-2xl when shape=rounded', () => {
      render(
        <ProspectLogo
          prospect={mockProspect({
            logoUrl: 'https://cdn.example.com/logo.png',
            domain: 'example.com',
            companyName: 'Example',
          })}
          shape="rounded"
        />,
      );
      const img = screen.getByTestId('prospect-logo-image');
      expect(img.getAttribute('data-shape')).toBe('rounded');
      expect(img.className).toContain('rounded-2xl');
      expect(img.className).not.toContain('rounded-full');
    });
  });
});

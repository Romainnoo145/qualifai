/**
 * Tests for ProspectLastRunStatus — POLISH-09 / SC #2
 *
 * Covers five visual states:
 *   1. null (no data)
 *   2. success (green — latestRun COMPLETED, lastAnalysisModelUsed=pro)
 *   3. fallback-used (amber — lastAnalysisModelUsed=flash, error=null)
 *   4. error (red — lastAnalysisError present)
 *   5. run-warning (amber — latestRun status !== COMPLETED)
 * Plus render priority test: error beats fallback when both conditions present.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProspectLastRunStatus } from './prospect-last-run-status';

const nullProspect = {
  lastAnalysisError: null,
  lastAnalysisAttemptedAt: null,
  lastAnalysisModelUsed: null,
};

describe('ProspectLastRunStatus', () => {
  it('renders nothing when both latestRun and prospect analysis data are absent', () => {
    const { container } = render(
      <ProspectLastRunStatus latestRun={null} prospect={nullProspect} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders green success when latestRun is COMPLETED and no analysis error', () => {
    render(
      <ProspectLastRunStatus
        latestRun={{
          finishedAt: new Date('2026-04-14T14:32:00'),
          completedAt: new Date('2026-04-14T14:32:00'),
          status: 'COMPLETED',
          _count: { evidenceItems: 53 },
        }}
        prospect={{
          lastAnalysisError: null,
          lastAnalysisAttemptedAt: null,
          lastAnalysisModelUsed: null,
        }}
      />,
    );
    const el = screen.getByTestId('last-run-status');
    expect(el.getAttribute('data-state')).toBe('success');
    expect(el.className).toContain('bg-emerald-50');
    expect(el.textContent).toContain('Laatste research');
    expect(el.textContent).toContain('Geslaagd');
    expect(el.textContent).toContain('53 evidence items');
  });

  it('renders run-warning (amber) when latestRun status is not COMPLETED', () => {
    render(
      <ProspectLastRunStatus
        latestRun={{
          finishedAt: new Date('2026-04-14T14:32:00'),
          completedAt: null,
          status: 'FAILED',
          _count: { evidenceItems: 0 },
        }}
        prospect={nullProspect}
      />,
    );
    const el = screen.getByTestId('last-run-status');
    expect(el.getAttribute('data-state')).toBe('warning');
    expect(el.className).toContain('bg-amber-50');
    expect(el.textContent).toContain('FAILED');
  });

  it('renders red error state when lastAnalysisError is present', () => {
    render(
      <ProspectLastRunStatus
        latestRun={null}
        prospect={{
          lastAnalysisError: '503 Service Unavailable',
          lastAnalysisAttemptedAt: new Date('2026-04-14T14:35:00'),
          lastAnalysisModelUsed: null,
        }}
      />,
    );
    const el = screen.getByTestId('last-run-status');
    expect(el.getAttribute('data-state')).toBe('error');
    expect(el.className).toContain('bg-red-50');
    expect(el.textContent).toContain('Laatste analyse');
    expect(el.textContent).toContain('Mislukt');
    // Must show friendly message, not raw error
    expect(el.textContent).toContain('AI tijdelijk niet beschikbaar');
  });

  it('renders fallback warning branch when lastAnalysisModelUsed is gemini-2.5-flash and error is null (SC #2)', () => {
    render(
      <ProspectLastRunStatus
        latestRun={null}
        prospect={{
          lastAnalysisError: null,
          lastAnalysisAttemptedAt: new Date('2026-04-14T14:35:00'),
          lastAnalysisModelUsed: 'gemini-2.5-flash',
        }}
      />,
    );
    const el = screen.getByTestId('last-run-status');
    expect(el.getAttribute('data-state')).toBe('fallback');
    expect(el.textContent).toContain('Laatste analyse');
    expect(el.textContent).toContain('⚠ Fallback gebruikt');
    expect(el.textContent).toContain('gemini-2.5-flash');

    // The tooltip uses FRIENDLY_ERROR_GEMINI_FALLBACK
    expect(el.getAttribute('title')).toContain('fallback model gebruikt');

    // Not an error red border
    expect(el.className).not.toContain('bg-red-50');
    // Is amber
    expect(el.className).toContain('bg-amber-50');
  });

  it('renders plain success (green) when lastAnalysisModelUsed is gemini-2.5-pro', () => {
    render(
      <ProspectLastRunStatus
        latestRun={{
          finishedAt: new Date('2026-04-14T14:32:00'),
          completedAt: new Date('2026-04-14T14:32:00'),
          status: 'COMPLETED',
          _count: { evidenceItems: 10 },
        }}
        prospect={{
          lastAnalysisError: null,
          lastAnalysisAttemptedAt: new Date('2026-04-14T14:32:00'),
          lastAnalysisModelUsed: 'gemini-2.5-pro',
        }}
      />,
    );
    const el = screen.getByTestId('last-run-status');
    expect(el.getAttribute('data-state')).toBe('success');
    expect(el.className).toContain('bg-emerald-50');
  });

  it('error state takes priority over fallback when both conditions are met', () => {
    // If somehow both lastAnalysisError is set AND lastAnalysisModelUsed is flash
    // The error branch must win (render priority: error → fallback → success → null)
    render(
      <ProspectLastRunStatus
        latestRun={null}
        prospect={{
          lastAnalysisError: '503 Service Unavailable',
          lastAnalysisAttemptedAt: new Date('2026-04-14T14:35:00'),
          lastAnalysisModelUsed: 'gemini-2.5-flash',
        }}
      />,
    );
    const el = screen.getByTestId('last-run-status');
    // Error (red) should win, not fallback (amber)
    expect(el.getAttribute('data-state')).toBe('error');
    expect(el.className).toContain('bg-red-50');
    expect(el.className).not.toContain('bg-amber-50');
  });
});

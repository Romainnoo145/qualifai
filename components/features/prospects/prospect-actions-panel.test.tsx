/**
 * Tests for ProspectActionsPanel — POLISH-07 / POLISH-08 / POLISH-14 / SC #2
 *
 * Covers: Dutch button labels, loading state, 503 error (friendly message),
 * quota error, success → idle reset, fallback toast on fallbackUsed=true,
 * plain green success on fallbackUsed=false, fallback → idle after 3s.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ProspectActionsPanel } from './prospect-actions-panel';
import {
  FRIENDLY_ERROR_GEMINI_503,
  FRIENDLY_ERROR_GEMINI_QUOTA,
  FRIENDLY_ERROR_GEMINI_FALLBACK,
} from './error-mapping';

// ---- Mock tRPC api ----
// Capture mutation callbacks so tests can trigger them directly
const captured: {
  enrich: {
    onMutate?: () => void;
    onSuccess?: (d: unknown) => void;
    onError?: (e: unknown) => void;
  };
  research: {
    onMutate?: () => void;
    onSuccess?: (d: unknown) => void;
    onError?: (e: unknown) => void;
  };
  analyse: {
    onMutate?: () => void;
    onSuccess?: (d: unknown) => void;
    onError?: (e: unknown) => void;
  };
} = { enrich: {}, research: {}, analyse: {} };

const mockMutate = {
  enrich: vi.fn(),
  research: vi.fn(),
  analyse: vi.fn(),
};

vi.mock('@/components/providers', () => ({
  api: {
    useUtils: () => ({
      admin: { getProspect: { invalidate: vi.fn() } },
      research: { listRuns: { invalidate: vi.fn() } },
    }),
    admin: {
      enrichProspect: {
        useMutation: (callbacks: {
          onMutate?: () => void;
          onSuccess?: (d: unknown) => void;
          onError?: (e: unknown) => void;
        }) => {
          captured.enrich = callbacks ?? {};
          return { mutate: mockMutate.enrich, isPending: false };
        },
      },
      runResearchRun: {
        useMutation: (callbacks: {
          onMutate?: () => void;
          onSuccess?: (d: unknown) => void;
          onError?: (e: unknown) => void;
        }) => {
          captured.research = callbacks ?? {};
          return { mutate: mockMutate.research, isPending: false };
        },
      },
      runMasterAnalysis: {
        useMutation: (callbacks: {
          onMutate?: () => void;
          onSuccess?: (d: unknown) => void;
          onError?: (e: unknown) => void;
        }) => {
          captured.analyse = callbacks ?? {};
          return { mutate: mockMutate.analyse, isPending: false };
        },
      },
    },
  },
}));

describe('ProspectActionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured.enrich = {};
    captured.research = {};
    captured.analyse = {};
  });

  it('renders the three Dutch action button labels', () => {
    render(<ProspectActionsPanel prospectId="p-1" />);
    expect(screen.getByText('Verrijk opnieuw')).toBeDefined();
    expect(screen.getByText('Run research')).toBeDefined();
    expect(screen.getByText('Run analyse')).toBeDefined();
  });

  it('shows loading state when a mutation is pending (onMutate fired)', () => {
    render(<ProspectActionsPanel prospectId="p-1" />);
    fireEvent.click(screen.getByTestId('action-enrich'));
    act(() => {
      captured.enrich.onMutate?.();
    });
    expect(screen.getByTestId('action-enrich').getAttribute('data-state')).toBe(
      'loading',
    );
    // Button should be disabled during loading
    expect(
      (screen.getByTestId('action-enrich') as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('shows Dutch friendly message on 503 error (no raw stack trace)', () => {
    render(<ProspectActionsPanel prospectId="p-1" />);
    fireEvent.click(screen.getByTestId('action-analyse'));
    act(() => {
      captured.analyse.onError?.(new Error('503 Service Unavailable'));
    });

    const errorEl = screen.getByTestId('action-error');
    expect(errorEl).toBeDefined();
    expect(errorEl.textContent).toBe(FRIENDLY_ERROR_GEMINI_503);
    // Raw error string must NOT appear
    expect(screen.queryByText('503 Service Unavailable')).toBeNull();
  });

  it('shows Dutch friendly quota error message', () => {
    render(<ProspectActionsPanel prospectId="p-1" />);
    fireEvent.click(screen.getByTestId('action-research'));
    act(() => {
      captured.research.onError?.(new Error('quota exceeded'));
    });

    const errorEl = screen.getByTestId('action-error');
    expect(errorEl.textContent).toBe(FRIENDLY_ERROR_GEMINI_QUOTA);
  });

  it('clears error when a new action is triggered', () => {
    render(<ProspectActionsPanel prospectId="p-1" />);
    // First trigger an error
    fireEvent.click(screen.getByTestId('action-analyse'));
    act(() => {
      captured.analyse.onError?.(new Error('503 Service Unavailable'));
    });
    expect(screen.getByTestId('action-error')).toBeDefined();

    // Now click another button — error should clear during onMutate
    fireEvent.click(screen.getByTestId('action-enrich'));
    act(() => {
      captured.enrich.onMutate?.();
    });
    expect(screen.queryByTestId('action-error')).toBeNull();
  });

  it('shows plain green success when mutation returns fallbackUsed=false', () => {
    render(<ProspectActionsPanel prospectId="p-1" />);
    fireEvent.click(screen.getByTestId('action-research'));
    act(() => {
      captured.research.onSuccess?.({ ok: true, fallbackUsed: false });
    });

    expect(
      screen.getByTestId('action-research').getAttribute('data-state'),
    ).toBe('success');
    expect(screen.queryByTestId('action-fallback')).toBeNull();
    expect(screen.queryByTestId('action-error')).toBeNull();
  });

  it('shows amber fallback toast when mutation returns fallbackUsed=true (SC #2)', () => {
    render(<ProspectActionsPanel prospectId="p-1" />);
    fireEvent.click(screen.getByTestId('action-research'));
    act(() => {
      captured.research.onSuccess?.({ ok: true, fallbackUsed: true });
    });

    // Button state is 'fallback', not 'success'
    expect(
      screen.getByTestId('action-research').getAttribute('data-state'),
    ).toBe('fallback');

    // Fallback toast is in the DOM with the verbatim Dutch copy
    const toast = screen.getByTestId('action-fallback');
    expect(toast).toBeDefined();
    expect(toast.textContent).toBe(FRIENDLY_ERROR_GEMINI_FALLBACK);

    // Error slot is NOT present
    expect(screen.queryByTestId('action-error')).toBeNull();
  });

  it('fallback state returns to idle after 3 seconds', () => {
    vi.useFakeTimers();
    render(<ProspectActionsPanel prospectId="p-1" />);
    fireEvent.click(screen.getByTestId('action-research'));
    act(() => {
      captured.research.onSuccess?.({ ok: true, fallbackUsed: true });
    });
    expect(
      screen.getByTestId('action-research').getAttribute('data-state'),
    ).toBe('fallback');
    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(
      screen.getByTestId('action-research').getAttribute('data-state'),
    ).toBe('idle');
    expect(screen.queryByTestId('action-fallback')).toBeNull();
    vi.useRealTimers();
  });

  it('success state returns to idle after 2 seconds', () => {
    vi.useFakeTimers();
    render(<ProspectActionsPanel prospectId="p-1" />);
    fireEvent.click(screen.getByTestId('action-enrich'));
    act(() => {
      captured.enrich.onSuccess?.({ ok: true, fallbackUsed: false });
    });
    expect(screen.getByTestId('action-enrich').getAttribute('data-state')).toBe(
      'success',
    );
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    expect(screen.getByTestId('action-enrich').getAttribute('data-state')).toBe(
      'idle',
    );
    vi.useRealTimers();
  });
});

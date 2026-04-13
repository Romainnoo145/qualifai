import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const transitionMutate = vi.fn();
const transitionState = { isPending: false };
let lastOnError: ((err: unknown) => void) | null = null;

vi.mock('@/components/providers', () => ({
  api: {
    quotes: {
      transition: {
        useMutation: (opts: {
          onSuccess?: () => void;
          onError?: (err: unknown) => void;
        }) => {
          lastOnError = opts?.onError ?? null;
          return {
            mutate: (input: unknown) => transitionMutate(input),
            isPending: transitionState.isPending,
          };
        },
      },
    },
    useUtils: () => ({
      quotes: {
        get: { invalidate: vi.fn() },
        list: { invalidate: vi.fn() },
      },
    }),
  },
}));

import { QuoteSendConfirm } from './quote-send-confirm';

const baseProps = {
  quoteId: 'q1',
  lines: [{ uren: 10, tarief: 95 }],
  btwPercentage: 21,
};

describe('QuoteSendConfirm', () => {
  beforeEach(() => {
    transitionMutate.mockReset();
    transitionState.isPending = false;
    lastOnError = null;
  });

  it('renders nothing when status is not DRAFT', () => {
    const { container } = render(
      <QuoteSendConfirm {...baseProps} status="SENT" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the Verstuur button on a DRAFT quote', () => {
    render(<QuoteSendConfirm {...baseProps} status="DRAFT" />);
    expect(screen.getByTestId('quote-send-button')).toBeInTheDocument();
  });

  it('opens the confirm modal on button click', () => {
    render(<QuoteSendConfirm {...baseProps} status="DRAFT" />);
    fireEvent.click(screen.getByTestId('quote-send-button'));
    expect(screen.getByText('Offerte versturen')).toBeInTheDocument();
    expect(
      screen.getByText(/Je staat op het punt deze offerte te versturen/),
    ).toBeInTheDocument();
  });

  it('shows the Dutch Euro total in the modal body', () => {
    render(<QuoteSendConfirm {...baseProps} status="DRAFT" />);
    fireEvent.click(screen.getByTestId('quote-send-button'));
    // 10 * 95 = 950 netto; bruto = 950 * 1.21 = 1149.5 → '€ 1.149,50'
    expect(screen.getByText(/€ 1\.149,50/)).toBeInTheDocument();
  });

  it('closes the modal on Annuleren without calling the mutation', () => {
    render(<QuoteSendConfirm {...baseProps} status="DRAFT" />);
    fireEvent.click(screen.getByTestId('quote-send-button'));
    fireEvent.click(screen.getByText('Annuleren'));
    expect(transitionMutate).not.toHaveBeenCalled();
    expect(screen.queryByText('Offerte versturen')).toBeNull();
  });

  it('calls quotes.transition with {id, newStatus: "SENT"} and NO snapshotData', () => {
    render(<QuoteSendConfirm {...baseProps} status="DRAFT" />);
    fireEvent.click(screen.getByTestId('quote-send-button'));
    fireEvent.click(screen.getByTestId('quote-send-confirm-button'));
    expect(transitionMutate).toHaveBeenCalledTimes(1);
    const payload = transitionMutate.mock.calls[0]![0] as Record<
      string,
      unknown
    >;
    expect(payload).toEqual({ id: 'q1', newStatus: 'SENT' });
    expect(payload).not.toHaveProperty('snapshotData');
    expect(payload).not.toHaveProperty('snapshotHtml');
    expect(payload).not.toHaveProperty('snapshotPdfUrl');
    expect(Object.keys(payload).sort()).toEqual(['id', 'newStatus']);
  });

  it('renders mutation error inside the modal', () => {
    render(<QuoteSendConfirm {...baseProps} status="DRAFT" />);
    fireEvent.click(screen.getByTestId('quote-send-button'));
    // Simulate a mutation error via the captured onError callback.
    act(() => {
      lastOnError?.({ message: 'Prospect mag niet naar QUOTE_SENT' });
    });
    expect(
      screen.getByText('Prospect mag niet naar QUOTE_SENT'),
    ).toBeInTheDocument();
  });
});

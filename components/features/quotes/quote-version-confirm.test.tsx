import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const createVersionMutate = vi.fn();
const pushMock = vi.fn();
let lastOnSuccess: ((data: { id: string }) => void) | null = null;
let lastOnError: ((err: unknown) => void) | null = null;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/components/providers', () => ({
  api: {
    quotes: {
      createVersion: {
        useMutation: (opts: {
          onSuccess?: (data: { id: string }) => void;
          onError?: (err: unknown) => void;
        }) => {
          lastOnSuccess = opts?.onSuccess ?? null;
          lastOnError = opts?.onError ?? null;
          return {
            mutate: (input: unknown) => createVersionMutate(input),
            isPending: false,
          };
        },
      },
    },
    useUtils: () => ({
      quotes: {
        list: { invalidate: vi.fn() },
        get: { invalidate: vi.fn() },
      },
    }),
  },
}));

import { QuoteVersionConfirm } from './quote-version-confirm';

describe('QuoteVersionConfirm visibility', () => {
  beforeEach(() => {
    createVersionMutate.mockReset();
    pushMock.mockReset();
    lastOnSuccess = null;
    lastOnError = null;
  });

  it.each(['DRAFT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'ARCHIVED'] as const)(
    'renders nothing for status %s',
    (status) => {
      const { container } = render(
        <QuoteVersionConfirm quoteId="q1" status={status} />,
      );
      expect(container.firstChild).toBeNull();
    },
  );

  it('renders the button for status SENT', () => {
    render(<QuoteVersionConfirm quoteId="q1" status="SENT" />);
    expect(screen.getByTestId('quote-version-button')).toBeInTheDocument();
  });

  it('renders the button for status VIEWED', () => {
    render(<QuoteVersionConfirm quoteId="q1" status="VIEWED" />);
    expect(screen.getByTestId('quote-version-button')).toBeInTheDocument();
  });
});

describe('QuoteVersionConfirm modal flow', () => {
  beforeEach(() => {
    createVersionMutate.mockReset();
    pushMock.mockReset();
    lastOnSuccess = null;
    lastOnError = null;
  });

  it('opens the modal on button click', () => {
    render(<QuoteVersionConfirm quoteId="q1" status="SENT" />);
    fireEvent.click(screen.getByTestId('quote-version-button'));
    // "Nieuwe versie maken" appears twice (title + primary button).
    expect(screen.getAllByText('Nieuwe versie maken').length).toBe(2);
    expect(
      screen.getByText(/Je maakt een nieuwe DRAFT op basis van deze offerte/),
    ).toBeInTheDocument();
  });

  it('closes on Annuleren without calling the mutation', () => {
    render(<QuoteVersionConfirm quoteId="q1" status="SENT" />);
    fireEvent.click(screen.getByTestId('quote-version-button'));
    fireEvent.click(screen.getByText('Annuleren'));
    expect(createVersionMutate).not.toHaveBeenCalled();
  });

  it('calls createVersion with {fromId} and navigates on success', () => {
    render(<QuoteVersionConfirm quoteId="q1" status="SENT" />);
    fireEvent.click(screen.getByTestId('quote-version-button'));
    fireEvent.click(screen.getByTestId('quote-version-confirm-button'));
    expect(createVersionMutate).toHaveBeenCalledTimes(1);
    expect(createVersionMutate.mock.calls[0]![0]).toEqual({ fromId: 'q1' });
    // Simulate server success with the new quote id via captured callback.
    act(() => {
      lastOnSuccess?.({ id: 'q2' });
    });
    expect(pushMock).toHaveBeenCalledWith('/admin/quotes/q2');
  });

  it('shows mutation error inline in the modal', () => {
    render(<QuoteVersionConfirm quoteId="q1" status="SENT" />);
    fireEvent.click(screen.getByTestId('quote-version-button'));
    act(() => {
      lastOnError?.({ message: 'Origineel is al gearchiveerd' });
    });
    expect(
      screen.getByText('Origineel is al gearchiveerd'),
    ).toBeInTheDocument();
  });
});

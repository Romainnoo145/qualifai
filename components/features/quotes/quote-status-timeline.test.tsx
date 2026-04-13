import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuoteStatusTimeline } from './quote-status-timeline';

describe('QuoteStatusTimeline', () => {
  const base = {
    createdAt: '2026-04-13T09:30:00Z',
    snapshotAt: '2026-04-14T10:00:00Z',
    viewedAt: '2026-04-15T11:00:00Z',
    acceptedAt: '2026-04-16T12:00:00Z',
  };

  it('renders all four slot labels', () => {
    render(<QuoteStatusTimeline {...base} />);
    expect(screen.getByText('Aangemaakt')).toBeInTheDocument();
    expect(screen.getByText('Verstuurd')).toBeInTheDocument();
    expect(screen.getByText('Bekeken')).toBeInTheDocument();
    expect(screen.getByText('Geaccepteerd')).toBeInTheDocument();
  });

  it('renders placeholders when snapshotAt/viewedAt/acceptedAt are null', () => {
    render(
      <QuoteStatusTimeline
        createdAt={base.createdAt}
        snapshotAt={null}
        viewedAt={null}
        acceptedAt={null}
      />,
    );
    const placeholders = screen.getAllByText('— nog niet');
    expect(placeholders.length).toBe(3);
  });

  it('formats dates with Dutch locale (nl-NL)', () => {
    render(<QuoteStatusTimeline {...base} />);
    // Intl nl-NL emits "13 april 2026 ..." — case-insensitive contains check.
    expect(screen.getByText(/13 april/i)).toBeInTheDocument();
  });

  it('defaults viewedAt/acceptedAt to null when omitted', () => {
    render(
      <QuoteStatusTimeline
        createdAt={base.createdAt}
        snapshotAt={base.snapshotAt}
      />,
    );
    // Aangemaakt + Verstuurd filled → only Bekeken + Geaccepteerd show placeholder.
    const placeholders = screen.getAllByText('— nog niet');
    expect(placeholders.length).toBe(2);
  });
});

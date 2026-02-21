import { describe, expect, it } from 'vitest';
import { triageReplyText } from '@/lib/outreach/reply-triage';

describe('reply triage', () => {
  it('classifies stop intent', () => {
    const result = triageReplyText({
      bodyText: 'Please unsubscribe me and do not contact again.',
    });
    expect(result.intent).toBe('stop');
    expect(result.suggestedAction).toBe('suppress_contact');
  });

  it('classifies later intent with defer days', () => {
    const result = triageReplyText({
      bodyText: 'Nu niet, kom hier volgende maand op terug.',
    });
    expect(result.intent).toBe('later');
    expect(result.deferDays).toBe(30);
  });

  it('classifies interested intent', () => {
    const result = triageReplyText({
      bodyText: 'Klinkt goed, laten we een korte call plannen voor een demo.',
    });
    expect(result.intent).toBe('interested');
    expect(result.suggestedAction).toBe('book_teardown');
  });

  it('classifies no-fit intent', () => {
    const result = triageReplyText({
      bodyText: 'Niet relevant voor ons en er is geen budget.',
    });
    expect(result.intent).toBe('not_fit');
    expect(result.suggestedAction).toBe('close_lost');
  });
});

import { describe, expect, it } from 'vitest';
import { normalizeInboundReplyPayload } from '@/lib/outreach/inbound-adapters';

describe('inbound adapters', () => {
  it('normalizes canonical payload', () => {
    const normalized = normalizeInboundReplyPayload({
      fromEmail: 'Lead <lead@company.com>',
      subject: 'Re: Workflow Loss Map',
      bodyText: 'Klinkt goed, laten we een call plannen.',
      source: 'manual',
      autoTriage: true,
    });

    expect(normalized?.provider).toBe('canonical');
    expect(normalized?.fromEmail).toBe('lead@company.com');
    expect(normalized?.bodyText.toLowerCase()).toContain('call');
  });

  it('normalizes resend-style payload', () => {
    const normalized = normalizeInboundReplyPayload({
      type: 'email.received',
      data: {
        from: 'Founder <owner@bedrijf.nl>',
        subject: 'Re: voorstel',
        text: 'Nu niet, volgende maand graag.',
        html: '<p>Nu niet, volgende maand graag.</p>',
      },
    });

    expect(normalized?.provider).toBe('resend');
    expect(normalized?.fromEmail).toBe('owner@bedrijf.nl');
    expect(normalized?.bodyText.toLowerCase()).toContain('volgende maand');
  });

  it('normalizes mailgun-style payload', () => {
    const normalized = normalizeInboundReplyPayload({
      sender: 'contact@voorbeeld.nl',
      subject: 'Re',
      'body-plain': 'Please unsubscribe me.',
      'body-html': '<p>Please unsubscribe me.</p>',
    });

    expect(normalized?.provider).toBe('mailgun');
    expect(normalized?.fromEmail).toBe('contact@voorbeeld.nl');
    expect(normalized?.bodyText.toLowerCase()).toContain('unsubscribe');
  });

  it('normalizes postmark/sendgrid style payload', () => {
    const normalized = normalizeInboundReplyPayload({
      From: 'Ops <ops@bedrijf.nl>',
      Subject: 'Re',
      TextBody: 'Niet relevant voor ons, geen budget.',
      headers: {
        'x-outreach-sequence-id': 'seq_123',
      },
    });

    expect(normalized?.provider).toBe('postmark_sendgrid');
    expect(normalized?.fromEmail).toBe('ops@bedrijf.nl');
    expect(normalized?.outreachSequenceId).toBe('seq_123');
  });
});

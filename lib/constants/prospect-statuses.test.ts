import { describe, it, expect } from 'vitest';
import {
  ALL_PROSPECT_STATUSES,
  PUBLIC_VISIBLE_STATUSES,
  POST_FIRST_VIEW_STATUSES,
  QUOTE_SENDABLE_STATUSES,
} from './prospect-statuses';

describe('prospect-statuses constants', () => {
  it('ALL_PROSPECT_STATUSES contains 10 values in defined order', () => {
    expect(ALL_PROSPECT_STATUSES).toEqual([
      'DRAFT',
      'ENRICHED',
      'GENERATING',
      'READY',
      'SENT',
      'VIEWED',
      'ENGAGED',
      'QUOTE_SENT',
      'CONVERTED',
      'ARCHIVED',
    ]);
  });

  it('QUOTE_SENT is positioned between ENGAGED and CONVERTED', () => {
    const idxEngaged = ALL_PROSPECT_STATUSES.indexOf('ENGAGED');
    const idxQuoteSent = ALL_PROSPECT_STATUSES.indexOf('QUOTE_SENT');
    const idxConverted = ALL_PROSPECT_STATUSES.indexOf('CONVERTED');
    expect(idxEngaged).toBeGreaterThanOrEqual(0);
    expect(idxQuoteSent).toBe(idxEngaged + 1);
    expect(idxConverted).toBe(idxQuoteSent + 1);
  });

  it('PUBLIC_VISIBLE_STATUSES does not contain DRAFT/ENRICHED/GENERATING/ARCHIVED', () => {
    expect(PUBLIC_VISIBLE_STATUSES).not.toContain('DRAFT');
    expect(PUBLIC_VISIBLE_STATUSES).not.toContain('ENRICHED');
    expect(PUBLIC_VISIBLE_STATUSES).not.toContain('GENERATING');
    expect(PUBLIC_VISIBLE_STATUSES).not.toContain('ARCHIVED');
    expect(PUBLIC_VISIBLE_STATUSES).toContain('QUOTE_SENT');
  });

  it('POST_FIRST_VIEW_STATUSES = VIEWED, ENGAGED, QUOTE_SENT, CONVERTED', () => {
    expect(POST_FIRST_VIEW_STATUSES).toEqual([
      'VIEWED',
      'ENGAGED',
      'QUOTE_SENT',
      'CONVERTED',
    ]);
  });

  it('QUOTE_SENDABLE_STATUSES = ENGAGED, QUOTE_SENT', () => {
    expect(QUOTE_SENDABLE_STATUSES).toEqual(['ENGAGED', 'QUOTE_SENT']);
  });
});

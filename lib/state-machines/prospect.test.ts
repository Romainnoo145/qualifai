import { describe, it, expect } from 'vitest';
import { TRPCError } from '@trpc/server';
import {
  VALID_PROSPECT_TRANSITIONS,
  assertValidProspectTransition,
} from './prospect';

describe('assertValidProspectTransition', () => {
  it('valid transition: DRAFT -> ENRICHED does not throw', () => {
    expect(() =>
      assertValidProspectTransition('DRAFT', 'ENRICHED'),
    ).not.toThrow();
  });

  it('valid transition: ENGAGED -> QUOTE_SENT does not throw', () => {
    expect(() =>
      assertValidProspectTransition('ENGAGED', 'QUOTE_SENT'),
    ).not.toThrow();
  });

  it('valid transition: QUOTE_SENT -> CONVERTED does not throw', () => {
    expect(() =>
      assertValidProspectTransition('QUOTE_SENT', 'CONVERTED'),
    ).not.toThrow();
  });

  it('invalid transition: CONVERTED -> DRAFT throws PRECONDITION_FAILED', () => {
    let caught: unknown = null;
    try {
      assertValidProspectTransition('CONVERTED', 'DRAFT');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(TRPCError);
    expect((caught as TRPCError).code).toBe('PRECONDITION_FAILED');
    expect((caught as TRPCError).message).toContain('CONVERTED');
    expect((caught as TRPCError).message).toContain('DRAFT');
  });

  it('terminal state: ARCHIVED -> CONVERTED throws', () => {
    expect(() =>
      assertValidProspectTransition('ARCHIVED', 'CONVERTED'),
    ).toThrow(TRPCError);
  });

  it('idempotent: DRAFT -> DRAFT does not throw', () => {
    expect(() => assertValidProspectTransition('DRAFT', 'DRAFT')).not.toThrow();
  });

  it('VALID_PROSPECT_TRANSITIONS has an entry for every status (10 keys)', () => {
    expect(Object.keys(VALID_PROSPECT_TRANSITIONS).sort()).toEqual([
      'ARCHIVED',
      'CONVERTED',
      'DRAFT',
      'ENGAGED',
      'ENRICHED',
      'GENERATING',
      'QUOTE_SENT',
      'READY',
      'SENT',
      'VIEWED',
    ]);
  });
});

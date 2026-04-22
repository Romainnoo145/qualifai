import { describe, expect, it } from 'vitest';
import {
  ACTIVE_RESEARCH_STATUSES,
  currentStepLabel,
  isActiveStatus,
  statusLabel,
} from './status-labels';

describe('statusLabel', () => {
  it('maps each ResearchStatus to a Dutch label', () => {
    expect(statusLabel('PENDING')).toBe('Onderzoek gestart');
    expect(statusLabel('CRAWLING')).toBe('Bronnen verzamelen');
    expect(statusLabel('EXTRACTING')).toBe('Data-extractie');
    expect(statusLabel('HYPOTHESIS')).toBe('Hypotheses opstellen');
    expect(statusLabel('BRIEFING')).toBe('Briefing opstellen');
    expect(statusLabel('COMPLETED')).toBe('Onderzoek afgerond');
    expect(statusLabel('FAILED')).toBe('Onderzoek update nodig');
  });

  it('returns null for unknown status', () => {
    expect(statusLabel(null)).toBeNull();
    expect(statusLabel(undefined)).toBeNull();
    expect(statusLabel('NOT_A_STATUS')).toBeNull();
  });
});

describe('isActiveStatus', () => {
  it('returns true for in-progress statuses', () => {
    for (const s of ACTIVE_RESEARCH_STATUSES) {
      expect(isActiveStatus(s)).toBe(true);
    }
  });

  it('returns false for end states', () => {
    expect(isActiveStatus('COMPLETED')).toBe(false);
    expect(isActiveStatus('FAILED')).toBe(false);
    expect(isActiveStatus(null)).toBe(false);
  });
});

describe('currentStepLabel', () => {
  it('returns the active-state label, or null for end states', () => {
    expect(currentStepLabel('CRAWLING')).toBe('Bronnen verzamelen');
    expect(currentStepLabel('BRIEFING')).toBe('Briefing opstellen');
    expect(currentStepLabel('COMPLETED')).toBeNull();
    expect(currentStepLabel('FAILED')).toBeNull();
    expect(currentStepLabel(null)).toBeNull();
  });
});

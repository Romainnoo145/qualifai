import { describe, expect, it } from 'vitest';
import { assessEmailForOutreach, scoreContactForOutreach } from './quality';

describe('assessEmailForOutreach', () => {
  it('blocks malformed and no-reply addresses', () => {
    const bad = assessEmailForOutreach('no-reply@invalid');
    expect(bad.status).toBe('blocked');
    expect(bad.reasons.length).toBeGreaterThan(0);
  });

  it('marks role mailboxes for review', () => {
    const role = assessEmailForOutreach('info@acme.nl');
    expect(role.status).toBe('review');
    expect(role.isRoleAddress).toBe(true);
  });

  it('accepts normal work email addresses', () => {
    const good = assessEmailForOutreach('jane.doe@acme.nl');
    expect(good.status).toBe('ready');
    expect(good.reasons).toHaveLength(0);
  });
});

describe('scoreContactForOutreach', () => {
  it('prioritizes complete senior decision-maker contacts', () => {
    const score = scoreContactForOutreach({
      firstName: 'Jane',
      lastName: 'Doe',
      jobTitle: 'Chief Operations Officer',
      seniority: 'C-Level',
      department: 'Operations',
      primaryEmail: 'jane.doe@acme.nl',
      primaryPhone: '+31 6 12345678',
      linkedinUrl: 'https://linkedin.com/in/jane-doe',
      outreachStatus: 'NONE',
    });

    expect(score.status).toBe('ready');
    expect(score.tier === 'P1' || score.tier === 'P2').toBe(true);
    expect(score.score).toBeGreaterThan(60);
  });

  it('recognizes Dutch MKB decision-maker titles', () => {
    const score = scoreContactForOutreach({
      firstName: 'Piet',
      lastName: 'Jansen',
      jobTitle: 'Operationeel Directeur',
      seniority: 'Directie',
      department: 'Planning',
      primaryEmail: 'piet.jansen@mkbbedrijf.nl',
      primaryPhone: '+31 6 11111111',
      outreachStatus: 'NONE',
    });

    expect(score.status).toBe('ready');
    expect(score.score).toBeGreaterThan(60);
  });

  it('keeps planning/service roles out of ready queue without authority signal', () => {
    const score = scoreContactForOutreach({
      firstName: 'Sam',
      lastName: 'Planner',
      jobTitle: 'Service Planner',
      seniority: 'Senior',
      department: 'Planning',
      primaryEmail: 'sam@mkbbedrijf.nl',
      primaryPhone: '+31 6 22222222',
      outreachStatus: 'NONE',
    });

    expect(score.status).toBe('review');
    expect(
      score.reasons.some((reason) =>
        reason.includes('No clear decision authority signal'),
      ),
    ).toBe(true);
  });

  it('sends incomplete contacts to manual review', () => {
    const score = scoreContactForOutreach({
      firstName: 'Alex',
      lastName: 'Tester',
      primaryEmail: 'alex@acme.nl',
      outreachStatus: 'NONE',
    });

    expect(score.status).toBe('review');
    expect(
      score.reasons.some((reason) => reason.includes('Missing job title')),
    ).toBe(true);
  });

  it('blocks opted-out contacts', () => {
    const score = scoreContactForOutreach({
      firstName: 'Pat',
      lastName: 'Optout',
      primaryEmail: 'pat@acme.nl',
      outreachStatus: 'OPTED_OUT',
    });

    expect(score.status).toBe('blocked');
    expect(score.reasons.some((reason) => reason.includes('opted out'))).toBe(
      true,
    );
  });
});

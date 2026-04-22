import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ResearchStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Hoisted mocks — must come BEFORE importing the router under test
// ---------------------------------------------------------------------------

vi.mock('@/env.mjs', () => ({
  env: {
    ADMIN_SECRET: 'test-secret',
    ATLANTIS_ADMIN_SECRET: 'atlantis-test-secret',
  },
}));

import { researchRouter } from './research';

// ---------------------------------------------------------------------------
// Shared types + factory
// ---------------------------------------------------------------------------

type Mock = ReturnType<typeof vi.fn>;

interface MockDb {
  researchRun: { findFirst: Mock };
  prospect: { findFirst: Mock };
}

function makeMockDb(): MockDb {
  return {
    researchRun: { findFirst: vi.fn().mockResolvedValue(null) },
    prospect: { findFirst: vi.fn().mockResolvedValue(null) },
  };
}

function callerForAdmin(db: MockDb) {
  return researchRouter.createCaller({
    db: db as never,
    adminToken: 'test-secret',
  });
}

function callerForPublic(db: MockDb) {
  return researchRouter.createCaller({
    db: db as never,
    adminToken: null,
  } as never);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => vi.clearAllMocks());

describe('research.getActiveStatusByProspectId', () => {
  it('returns isActive=true with currentStep label when latest run is CRAWLING', async () => {
    const db = makeMockDb();
    db.researchRun.findFirst.mockResolvedValueOnce({
      status: 'CRAWLING' as ResearchStatus,
      startedAt: new Date('2026-04-22T10:00:00Z'),
    });

    const result = await callerForAdmin(db).getActiveStatusByProspectId({
      prospectId: 'p1',
    });

    expect(result.isActive).toBe(true);
    expect(result.status).toBe('CRAWLING');
    expect(result.currentStep).toBe('Bronnen verzamelen');
    expect(result.startedAt).toEqual(new Date('2026-04-22T10:00:00Z'));
  });

  it('returns isActive=false when latest run is COMPLETED', async () => {
    const db = makeMockDb();
    db.researchRun.findFirst.mockResolvedValueOnce({
      status: 'COMPLETED' as ResearchStatus,
      startedAt: new Date('2026-04-22T10:00:00Z'),
    });

    const result = await callerForAdmin(db).getActiveStatusByProspectId({
      prospectId: 'p1',
    });

    expect(result.isActive).toBe(false);
    expect(result.status).toBe('COMPLETED');
    expect(result.currentStep).toBeNull();
  });

  it('returns nulls when no run exists', async () => {
    const db = makeMockDb();
    db.researchRun.findFirst.mockResolvedValueOnce(null);

    const result = await callerForAdmin(db).getActiveStatusByProspectId({
      prospectId: 'p1',
    });

    expect(result).toEqual({
      isActive: false,
      status: null,
      currentStep: null,
      startedAt: null,
    });
  });
});

describe('research.getActiveStatusBySlug', () => {
  it('looks up prospect by slug then returns its latest run status', async () => {
    const db = makeMockDb();
    db.prospect.findFirst.mockResolvedValueOnce({ id: 'p1' });
    db.researchRun.findFirst.mockResolvedValueOnce({
      status: 'BRIEFING' as ResearchStatus,
      startedAt: new Date('2026-04-22T10:00:00Z'),
    });

    const result = await callerForPublic(db).getActiveStatusBySlug({
      slug: 'marfa-abc12345',
    });

    expect(result.isActive).toBe(true);
    expect(result.status).toBe('BRIEFING');
    expect(result.currentStep).toBe('Briefing opstellen');
  });

  it('returns nulls when slug does not match a prospect', async () => {
    const db = makeMockDb();
    db.prospect.findFirst.mockResolvedValueOnce(null);

    const result = await callerForPublic(db).getActiveStatusBySlug({
      slug: 'unknown',
    });

    expect(result).toEqual({
      isActive: false,
      status: null,
      currentStep: null,
      startedAt: null,
    });
  });
});

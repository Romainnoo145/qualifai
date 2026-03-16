import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EvidenceItem } from '@prisma/client';
import { detectSignalsFromDiff } from './detect';

// =============================================================================
// HELPERS
// =============================================================================

let idCounter = 0;

function makeEvidence(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    id: `evidence-${++idCounter}`,
    sourceType: 'WEBSITE',
    title: 'Test',
    snippet: 'test snippet',
    sourceUrl: 'https://example.com',
    workflowTag: 'test',
    confidenceScore: 0.8,
    metadata: null,
    researchRunId: 'run-1',
    prospectId: 'prospect-1',
    isApproved: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeMockDb(options: {
  prevItems?: EvidenceItem[];
  newItems?: EvidenceItem[];
  existingSignal?: { id: string } | null;
  createdSignal?: { id: string };
}) {
  const {
    prevItems = [],
    newItems = [],
    existingSignal = null,
    createdSignal = { id: 'sig-1' },
  } = options;

  const findManyMock = vi
    .fn()
    .mockResolvedValueOnce(prevItems)
    .mockResolvedValueOnce(newItems);

  const findFirstMock = vi.fn().mockResolvedValue(existingSignal);
  const createMock = vi.fn().mockResolvedValue(createdSignal);

  return {
    evidenceItem: { findMany: findManyMock },
    signal: { findFirst: findFirstMock, create: createMock },
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('detectSignalsFromDiff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    idCounter = 0;
  });

  it('detects NEW_JOB_LISTING when new CAREERS items appear', async () => {
    const prevItems = [
      makeEvidence({
        sourceType: 'CAREERS',
        title: 'Software Engineer',
        researchRunId: 'run-1',
      }),
      makeEvidence({
        sourceType: 'CAREERS',
        title: 'Product Manager',
        researchRunId: 'run-1',
      }),
    ];
    const newItems = [
      makeEvidence({
        sourceType: 'CAREERS',
        title: 'Software Engineer',
        researchRunId: 'run-2',
      }),
      makeEvidence({
        sourceType: 'CAREERS',
        title: 'Product Manager',
        researchRunId: 'run-2',
      }),
      makeEvidence({
        sourceType: 'CAREERS',
        title: 'Data Scientist',
        researchRunId: 'run-2',
      }),
    ];

    const db = makeMockDb({ prevItems, newItems });

    const result = await detectSignalsFromDiff({
      previousRunId: 'run-1',
      newRunId: 'run-2',
      prospectId: 'prospect-1',
      db: db as never,
    });

    expect(result.signalsCreated).toBe(1);
    expect(result.signalIds).toContain('sig-1');
    expect(db.signal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          signalType: 'NEW_JOB_LISTING',
          metadata: expect.objectContaining({ count: 1 }),
        }),
      }),
    );
  });

  it('detects NEW_JOB_LISTING from JOB_BOARD source type', async () => {
    const prevItems: EvidenceItem[] = [];
    const newItems = [
      makeEvidence({
        sourceType: 'JOB_BOARD',
        title: 'Frontend Developer',
        researchRunId: 'run-2',
      }),
    ];

    const db = makeMockDb({ prevItems, newItems });

    const result = await detectSignalsFromDiff({
      previousRunId: 'run-1',
      newRunId: 'run-2',
      prospectId: 'prospect-1',
      db: db as never,
    });

    expect(result.signalsCreated).toBe(1);
    expect(db.signal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ signalType: 'NEW_JOB_LISTING' }),
      }),
    );
  });

  it('aggregates multiple new jobs into one signal', async () => {
    const prevItems: EvidenceItem[] = [];
    const newItems = [
      makeEvidence({
        sourceType: 'CAREERS',
        title: 'Engineer A',
        researchRunId: 'run-2',
      }),
      makeEvidence({
        sourceType: 'CAREERS',
        title: 'Engineer B',
        researchRunId: 'run-2',
      }),
      makeEvidence({
        sourceType: 'CAREERS',
        title: 'Engineer C',
        researchRunId: 'run-2',
      }),
      makeEvidence({
        sourceType: 'CAREERS',
        title: 'Engineer D',
        researchRunId: 'run-2',
      }),
    ];

    const db = makeMockDb({ prevItems, newItems });

    const result = await detectSignalsFromDiff({
      previousRunId: 'run-1',
      newRunId: 'run-2',
      prospectId: 'prospect-1',
      db: db as never,
    });

    expect(result.signalsCreated).toBe(1);
    expect(db.signal.create).toHaveBeenCalledTimes(1);
    expect(db.signal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ count: 4 }),
        }),
      }),
    );
  });

  it('skips NEW_JOB_LISTING when dedup lookback finds recent signal', async () => {
    const prevItems: EvidenceItem[] = [];
    const newItems = [
      makeEvidence({
        sourceType: 'CAREERS',
        title: 'New Role',
        researchRunId: 'run-2',
      }),
    ];

    const db = makeMockDb({
      prevItems,
      newItems,
      existingSignal: { id: 'existing-signal' },
    });

    const result = await detectSignalsFromDiff({
      previousRunId: 'run-1',
      newRunId: 'run-2',
      prospectId: 'prospect-1',
      db: db as never,
    });

    expect(result.signalsCreated).toBe(0);
    expect(result.skippedByDedup).toBe(1);
    expect(db.signal.create).not.toHaveBeenCalled();
  });

  it('detects HEADCOUNT_GROWTH when werkzamePersonen increases', async () => {
    const prevItems = [
      makeEvidence({
        sourceType: 'REGISTRY',
        metadata: { werkzamePersonen: 40 },
        researchRunId: 'run-1',
      }),
    ];
    const newItems = [
      makeEvidence({
        sourceType: 'REGISTRY',
        metadata: { werkzamePersonen: 50 },
        researchRunId: 'run-2',
      }),
    ];

    const db = makeMockDb({ prevItems, newItems });

    const result = await detectSignalsFromDiff({
      previousRunId: 'run-1',
      newRunId: 'run-2',
      prospectId: 'prospect-1',
      db: db as never,
    });

    expect(result.signalsCreated).toBe(1);
    expect(db.signal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          signalType: 'HEADCOUNT_GROWTH',
          metadata: expect.objectContaining({ delta: 10 }),
        }),
      }),
    );
  });

  it('skips HEADCOUNT_GROWTH when delta below threshold', async () => {
    const prevItems = [
      makeEvidence({
        sourceType: 'REGISTRY',
        metadata: { werkzamePersonen: 100 },
        researchRunId: 'run-1',
      }),
    ];
    // delta=2, <5 absolute and <10% (2%)
    const newItems = [
      makeEvidence({
        sourceType: 'REGISTRY',
        metadata: { werkzamePersonen: 102 },
        researchRunId: 'run-2',
      }),
    ];

    const db = makeMockDb({ prevItems, newItems });

    const result = await detectSignalsFromDiff({
      previousRunId: 'run-1',
      newRunId: 'run-2',
      prospectId: 'prospect-1',
      db: db as never,
    });

    expect(result.signalsCreated).toBe(0);
    expect(db.signal.create).not.toHaveBeenCalled();
  });

  it('fires HEADCOUNT_GROWTH for small company with >10% growth', async () => {
    const prevItems = [
      makeEvidence({
        sourceType: 'REGISTRY',
        metadata: { werkzamePersonen: 10 },
        researchRunId: 'run-1',
      }),
    ];
    // delta=2, <5 absolute but 20% growth — percentage threshold met
    const newItems = [
      makeEvidence({
        sourceType: 'REGISTRY',
        metadata: { werkzamePersonen: 12 },
        researchRunId: 'run-2',
      }),
    ];

    const db = makeMockDb({ prevItems, newItems });

    const result = await detectSignalsFromDiff({
      previousRunId: 'run-1',
      newRunId: 'run-2',
      prospectId: 'prospect-1',
      db: db as never,
    });

    expect(result.signalsCreated).toBe(1);
    expect(db.signal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ signalType: 'HEADCOUNT_GROWTH' }),
      }),
    );
  });

  it('returns zero signals when evidence is unchanged', async () => {
    const items = [
      makeEvidence({
        sourceType: 'CAREERS',
        title: 'Software Engineer',
        researchRunId: 'run-1',
      }),
      makeEvidence({
        sourceType: 'CAREERS',
        title: 'Product Manager',
        researchRunId: 'run-1',
      }),
    ];
    // Same titles in both runs — no novel jobs
    const newItems = items.map((i) => ({
      ...i,
      researchRunId: 'run-2',
      id: `${i.id}-new`,
    }));

    const db = makeMockDb({ prevItems: items, newItems });

    const result = await detectSignalsFromDiff({
      previousRunId: 'run-1',
      newRunId: 'run-2',
      prospectId: 'prospect-1',
      db: db as never,
    });

    expect(result.signalsCreated).toBe(0);
    expect(result.skippedByDedup).toBe(0);
    expect(db.signal.create).not.toHaveBeenCalled();
  });

  it('title normalization handles case and whitespace differences', async () => {
    const prevItems = [
      makeEvidence({
        sourceType: 'CAREERS',
        title: 'Software Engineer',
        researchRunId: 'run-1',
      }),
    ];
    // Same title but lowercase — should NOT be treated as novel
    const newItems = [
      makeEvidence({
        sourceType: 'CAREERS',
        title: 'software engineer',
        researchRunId: 'run-2',
      }),
    ];

    const db = makeMockDb({ prevItems, newItems });

    const result = await detectSignalsFromDiff({
      previousRunId: 'run-1',
      newRunId: 'run-2',
      prospectId: 'prospect-1',
      db: db as never,
    });

    expect(result.signalsCreated).toBe(0);
    expect(db.signal.create).not.toHaveBeenCalled();
  });

  it('no signals when both runs have zero evidence', async () => {
    const db = makeMockDb({ prevItems: [], newItems: [] });

    const result = await detectSignalsFromDiff({
      previousRunId: 'run-1',
      newRunId: 'run-2',
      prospectId: 'prospect-1',
      db: db as never,
    });

    expect(result.signalsCreated).toBe(0);
    expect(result.skippedByDedup).toBe(0);
    expect(db.signal.create).not.toHaveBeenCalled();
  });

  it('creates signals with isProcessed false', async () => {
    const prevItems: EvidenceItem[] = [];
    const newItems = [
      makeEvidence({
        sourceType: 'CAREERS',
        title: 'DevOps Engineer',
        researchRunId: 'run-2',
      }),
    ];

    const db = makeMockDb({ prevItems, newItems });

    await detectSignalsFromDiff({
      previousRunId: 'run-1',
      newRunId: 'run-2',
      prospectId: 'prospect-1',
      db: db as never,
    });

    expect(db.signal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isProcessed: false }),
      }),
    );
  });
});

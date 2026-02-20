import { describe, expect, it, vi } from 'vitest';
import {
  buildCadenceState,
  evaluateCadence,
  processDueCadenceSteps,
  DEFAULT_CADENCE_CONFIG,
} from './engine';
import type {
  CadenceConfig,
  ContactChannels,
  EngagementSignals,
} from './engine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_CHANNELS: ContactChannels = {
  primaryEmail: 'test@acme.nl',
  primaryPhone: '+31 6 12345678',
  linkedinUrl: 'https://linkedin.com/in/test',
};

const NO_PHONE_NO_LINKEDIN: ContactChannels = {
  primaryEmail: 'test@acme.nl',
  primaryPhone: null,
  linkedinUrl: null,
};

const NO_PHONE: ContactChannels = {
  primaryEmail: 'test@acme.nl',
  primaryPhone: null,
  linkedinUrl: 'https://linkedin.com/in/test',
};

const NORMAL_SIGNALS: EngagementSignals = {
  wizardMaxStep: 1,
  pdfDownloaded: false,
};

const HIGH_SIGNALS_WIZARD: EngagementSignals = {
  wizardMaxStep: 3,
  pdfDownloaded: false,
};

const HIGH_SIGNALS_PDF: EngagementSignals = {
  wizardMaxStep: 0,
  pdfDownloaded: true,
};

const completedTouch = (channel = 'email', daysAgo = 3) => ({
  completedAt: new Date(Date.now() - daysAgo * 86400000),
  channel,
  stepOrder: 1,
});

// ---------------------------------------------------------------------------
// buildCadenceState — pure function tests (no mocks needed)
// ---------------------------------------------------------------------------

describe('buildCadenceState', () => {
  it('Test 1: normal engagement, first touch completed — returns correct next channel, baseDelay, not exhausted', () => {
    const completed = [completedTouch('email', 3)];
    const state = buildCadenceState(
      completed,
      NORMAL_SIGNALS,
      ALL_CHANNELS,
      DEFAULT_CADENCE_CONFIG,
    );

    expect(state.engagementLevel).toBe('normal');
    expect(state.delayDays).toBe(DEFAULT_CADENCE_CONFIG.baseDelayDays); // 3
    expect(state.isExhausted).toBe(false);
    expect(state.touchCount).toBe(1);
    // After 1 touch, next channel should be index 1 in rotation (call)
    expect(state.nextChannel).toBe('call');
    expect(state.nextScheduledAt).not.toBeNull();
  });

  it('Test 2: high engagement (wizard step 3+) — returns engagedDelayDays, engagementLevel=high', () => {
    const completed = [completedTouch('email', 1)];
    const state = buildCadenceState(
      completed,
      HIGH_SIGNALS_WIZARD,
      ALL_CHANNELS,
      DEFAULT_CADENCE_CONFIG,
    );

    expect(state.engagementLevel).toBe('high');
    expect(state.delayDays).toBe(DEFAULT_CADENCE_CONFIG.engagedDelayDays); // 1
    expect(state.isExhausted).toBe(false);
  });

  it('Test 3: high engagement (PDF downloaded) — returns engagedDelayDays, engagementLevel=high', () => {
    const completed = [completedTouch('email', 1)];
    const state = buildCadenceState(
      completed,
      HIGH_SIGNALS_PDF,
      ALL_CHANNELS,
      DEFAULT_CADENCE_CONFIG,
    );

    expect(state.engagementLevel).toBe('high');
    expect(state.delayDays).toBe(DEFAULT_CADENCE_CONFIG.engagedDelayDays); // 1
  });

  it('Test 4: all touches completed (maxTouches reached) — isExhausted=true, nextChannel=null, nextScheduledAt=null', () => {
    const config: CadenceConfig = { ...DEFAULT_CADENCE_CONFIG, maxTouches: 2 };
    const completed = [completedTouch('email', 6), completedTouch('call', 3)];
    const state = buildCadenceState(
      completed,
      NORMAL_SIGNALS,
      ALL_CHANNELS,
      config,
    );

    expect(state.isExhausted).toBe(true);
    expect(state.nextChannel).toBeNull();
    expect(state.nextScheduledAt).toBeNull();
    expect(state.touchCount).toBe(2);
  });

  it('Test 5a: channel rotation skips linkedin when no linkedinUrl', () => {
    const completed = [completedTouch('email', 3)];
    const state = buildCadenceState(
      completed,
      NORMAL_SIGNALS,
      NO_PHONE,
      DEFAULT_CADENCE_CONFIG,
    );

    // No phone means call and whatsapp are skipped. Available: email, linkedin
    // touchCount=1, next = availableChannels[1 % 2] = linkedin
    expect(state.nextChannel).toBe('linkedin');
  });

  it('Test 5b: channel rotation skips call and whatsapp when no primaryPhone', () => {
    const completed = [completedTouch('email', 3)];
    const state = buildCadenceState(
      completed,
      NORMAL_SIGNALS,
      NO_PHONE_NO_LINKEDIN,
      DEFAULT_CADENCE_CONFIG,
    );

    // Only email available. touchCount=1, next = email[1 % 1] = email
    expect(state.nextChannel).toBe('email');
  });

  it('Test 6: empty completed touches — touchCount=0, first channel, lastTouchAt=null', () => {
    const state = buildCadenceState(
      [],
      NORMAL_SIGNALS,
      ALL_CHANNELS,
      DEFAULT_CADENCE_CONFIG,
    );

    expect(state.touchCount).toBe(0);
    expect(state.lastTouchAt).toBeNull();
    // touchCount=0, nextChannel = channels[0] = 'email'
    expect(state.nextChannel).toBe('email');
    // No lastTouchAt means nextScheduledAt is null
    expect(state.nextScheduledAt).toBeNull();
  });

  it('Test 7: email opens are NOT considered for engagement — returns normal with wizardMaxStep=0 pdfDownloaded=false', () => {
    // The interface has no openedAt field — passing wizardMaxStep=0, pdfDownloaded=false always = normal
    const signals: EngagementSignals = {
      wizardMaxStep: 0,
      pdfDownloaded: false,
    };
    const completed = [completedTouch('email', 3)];
    const state = buildCadenceState(
      completed,
      signals,
      ALL_CHANNELS,
      DEFAULT_CADENCE_CONFIG,
    );

    expect(state.engagementLevel).toBe('normal');
    expect(state.delayDays).toBe(DEFAULT_CADENCE_CONFIG.baseDelayDays);
  });
});

// ---------------------------------------------------------------------------
// evaluateCadence — DB tests (mocked PrismaClient)
// ---------------------------------------------------------------------------

describe('evaluateCadence', () => {
  const makeDb = () => ({
    outreachSequence: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    outreachStep: {
      create: vi.fn(),
    },
    wizardSession: {
      findFirst: vi.fn(),
    },
  });

  const makeSequence = (overrides = {}) => ({
    id: 'seq-1',
    prospectId: 'prospect-1',
    status: 'DRAFTED',
    contactId: 'contact-1',
    contact: {
      id: 'contact-1',
      primaryEmail: 'test@acme.nl',
      primaryPhone: '+31 6 12345678',
      linkedinUrl: 'https://linkedin.com/in/test',
    },
    steps: [],
    ...overrides,
  });

  it('Test 8: creates new OutreachStep when cadence is not exhausted', async () => {
    const db = makeDb();
    const sequence = makeSequence();

    db.outreachSequence.findFirst.mockResolvedValue(sequence);
    db.wizardSession.findFirst.mockResolvedValue({
      maxStepReached: 1,
      pdfDownloaded: false,
    });
    db.outreachStep.create.mockResolvedValue({
      id: 'step-new-1',
      sequenceId: 'seq-1',
      stepOrder: 1,
      status: 'DRAFTED',
      scheduledAt: new Date(),
    });

    const result = await evaluateCadence(
      db as never,
      'seq-1',
      DEFAULT_CADENCE_CONFIG,
    );

    expect(result.created).toBe(true);
    expect(result.stepId).toBe('step-new-1');
    expect(result.scheduledAt).not.toBeNull();

    // Verify OutreachStep.create was called with correct fields
    expect(db.outreachStep.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stepOrder: 1, // completedCount (0) + 1
          status: 'DRAFTED',
          triggeredBy: 'cadence',
          bodyText: '',
        }),
      }),
    );
  });

  it('Test 9: does NOT create step when exhausted — returns { created: false, stepId: null }', async () => {
    const db = makeDb();
    // 4 completed steps = maxTouches (4)
    const completedSteps = [1, 2, 3, 4].map((i) => ({
      id: `step-${i}`,
      stepOrder: i,
      status: 'SENT',
      sentAt: new Date(Date.now() - (5 - i) * 86400000),
      metadata: { channel: 'email' },
    }));
    const sequence = makeSequence({ steps: completedSteps });

    db.outreachSequence.findFirst.mockResolvedValue(sequence);
    db.wizardSession.findFirst.mockResolvedValue({
      maxStepReached: 1,
      pdfDownloaded: false,
    });
    db.outreachSequence.update.mockResolvedValue({});

    const result = await evaluateCadence(
      db as never,
      'seq-1',
      DEFAULT_CADENCE_CONFIG,
    );

    expect(result.created).toBe(false);
    expect(result.stepId).toBeNull();
    expect(db.outreachStep.create).not.toHaveBeenCalled();
  });

  it('Test 10: sets sequence status to CLOSED_LOST when exhausted', async () => {
    const db = makeDb();
    const completedSteps = [1, 2, 3, 4].map((i) => ({
      id: `step-${i}`,
      stepOrder: i,
      status: 'SENT',
      sentAt: new Date(Date.now() - (5 - i) * 86400000),
      metadata: { channel: 'email' },
    }));
    const sequence = makeSequence({ steps: completedSteps });

    db.outreachSequence.findFirst.mockResolvedValue(sequence);
    db.wizardSession.findFirst.mockResolvedValue({
      maxStepReached: 1,
      pdfDownloaded: false,
    });
    db.outreachSequence.update.mockResolvedValue({});

    await evaluateCadence(db as never, 'seq-1', DEFAULT_CADENCE_CONFIG);

    expect(db.outreachSequence.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'seq-1' },
        data: { status: 'CLOSED_LOST' },
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// processDueCadenceSteps — DB tests (mocked PrismaClient)
// ---------------------------------------------------------------------------

describe('processDueCadenceSteps', () => {
  const makeDb = () => ({
    outreachStep: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    outreachLog: {
      create: vi.fn(),
    },
  });

  const makeDueStep = (id: string, channel = 'email') => ({
    id,
    sequenceId: 'seq-1',
    metadata: { channel },
    nextStepReadyAt: new Date(Date.now() - 3600000), // 1 hour ago
    status: 'DRAFTED',
    sequence: {
      id: 'seq-1',
      contactId: 'contact-1',
      contact: {
        id: 'contact-1',
        primaryEmail: 'test@acme.nl',
      },
      prospect: {
        id: 'prospect-1',
        domain: 'acme.nl',
      },
    },
  });

  it('Test 11: promotes due steps — creates OutreachLog touch task and updates step status to QUEUED', async () => {
    const db = makeDb();
    const dueStep = makeDueStep('step-1', 'email');

    db.outreachStep.findMany.mockResolvedValue([dueStep]);
    db.outreachLog.create.mockResolvedValue({ id: 'log-1' });
    db.outreachStep.update.mockResolvedValue({});

    const result = await processDueCadenceSteps(db as never);

    expect(result.processed).toBe(1);
    expect(result.created).toBe(1);

    // Verify OutreachLog.create called with correct fields
    expect(db.outreachLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'FOLLOW_UP',
          channel: 'email',
          contactId: 'contact-1',
          status: 'touch_open',
          subject: 'Cadence follow-up: email',
        }),
      }),
    );

    // Verify OutreachStep.update called with QUEUED status
    expect(db.outreachStep.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'step-1' },
        data: expect.objectContaining({
          status: 'QUEUED',
          outreachLogId: 'log-1',
        }),
      }),
    );
  });

  it('Test 12: skips non-due steps — future nextStepReadyAt steps are not returned by query', async () => {
    const db = makeDb();
    // findMany returns empty — DB query filters out future steps
    db.outreachStep.findMany.mockResolvedValue([]);
    db.outreachLog.create.mockResolvedValue({ id: 'log-1' });

    const result = await processDueCadenceSteps(db as never);

    expect(result.processed).toBe(0);
    expect(result.created).toBe(0);
    expect(db.outreachLog.create).not.toHaveBeenCalled();
  });

  it('Test 13: limits batch size — queries with take: 50', async () => {
    const db = makeDb();
    db.outreachStep.findMany.mockResolvedValue([]);

    await processDueCadenceSteps(db as never);

    expect(db.outreachStep.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
      }),
    );
  });
});

/**
 * Cadence Engine — core functions for multi-touch outreach sequencing.
 *
 * Three functions:
 * - buildCadenceState: pure function computing next channel and timing
 * - evaluateCadence: creates next OutreachStep in DB
 * - processDueCadenceSteps: cron sweep that promotes due steps into touch tasks
 *
 * IMPORTANT: Email opens (openedAt) are NOT used for engagement detection.
 * Apple MPP causes 40-60% false positives — locked decision from Phase 9.
 *
 * TODO: Get product owner confirmation on these thresholds before production use.
 */

import type { PrismaClient } from '@prisma/client';

// =============================================================================
// Types
// =============================================================================

export interface CadenceConfig {
  baseDelayDays: number; // Default: 3
  engagedDelayDays: number; // Default: 1
  maxTouches: number; // Default: 4
  channels: readonly ('email' | 'call' | 'linkedin' | 'whatsapp')[];
}

export interface CadenceState {
  touchCount: number;
  lastTouchAt: Date | null;
  nextChannel: 'email' | 'call' | 'linkedin' | 'whatsapp' | null;
  nextScheduledAt: Date | null;
  isExhausted: boolean;
  engagementLevel: 'high' | 'normal';
  delayDays: number;
}

/** Contact channel availability for filtering channel rotation */
export interface ContactChannels {
  primaryEmail: string | null;
  primaryPhone: string | null;
  linkedinUrl: string | null;
}

/**
 * Engagement signals used to determine cadence speed.
 * NOTE: openedAt is intentionally absent — email opens are excluded
 * from engagement escalation per locked decision (Apple MPP false positives).
 */
export interface EngagementSignals {
  wizardMaxStep: number;
  pdfDownloaded: boolean;
}

// =============================================================================
// Default config — values pending product owner sign-off, easy to adjust
// TODO: Get product owner confirmation on these thresholds
// =============================================================================

export const DEFAULT_CADENCE_CONFIG: CadenceConfig = {
  baseDelayDays: 3,
  engagedDelayDays: 1,
  maxTouches: 4,
  channels: ['email', 'call', 'linkedin', 'whatsapp'],
};

// =============================================================================
// buildCadenceState — pure function, no side effects
// =============================================================================

type CompletedTouch = {
  completedAt: Date;
  channel: string;
  stepOrder: number;
};

export function buildCadenceState(
  completedTouches: CompletedTouch[],
  engagementSignals: EngagementSignals,
  contactChannels: ContactChannels,
  config: CadenceConfig,
): CadenceState {
  const touchCount = completedTouches.length;

  // Determine engagement level — email opens are NOT considered
  const engagementLevel: 'high' | 'normal' =
    engagementSignals.wizardMaxStep >= 3 || engagementSignals.pdfDownloaded
      ? 'high'
      : 'normal';

  const delayDays =
    engagementLevel === 'high' ? config.engagedDelayDays : config.baseDelayDays;

  // Exhaustion check
  const isExhausted = touchCount >= config.maxTouches;

  if (isExhausted) {
    return {
      touchCount,
      lastTouchAt:
        completedTouches.length > 0
          ? new Date(
              Math.max(...completedTouches.map((t) => t.completedAt.getTime())),
            )
          : null,
      nextChannel: null,
      nextScheduledAt: null,
      isExhausted: true,
      engagementLevel,
      delayDays,
    };
  }

  // Filter channels by contact availability
  const availableChannels = config.channels.filter((ch) => {
    if (ch === 'email') return Boolean(contactChannels.primaryEmail);
    if (ch === 'call') return Boolean(contactChannels.primaryPhone);
    if (ch === 'whatsapp') return Boolean(contactChannels.primaryPhone);
    if (ch === 'linkedin') return Boolean(contactChannels.linkedinUrl);
    return false;
  });

  // Fall back to email if no channels available (should not happen in practice)
  const nextChannel =
    availableChannels.length > 0
      ? availableChannels[touchCount % availableChannels.length]
      : null;

  // Calculate lastTouchAt
  const lastTouchAt =
    completedTouches.length > 0
      ? new Date(
          Math.max(...completedTouches.map((t) => t.completedAt.getTime())),
        )
      : null;

  // Calculate nextScheduledAt
  const nextScheduledAt =
    lastTouchAt !== null
      ? new Date(lastTouchAt.getTime() + delayDays * 86400000)
      : null;

  return {
    touchCount,
    lastTouchAt,
    nextChannel: nextChannel ?? null,
    nextScheduledAt,
    isExhausted: false,
    engagementLevel,
    delayDays,
  };
}

// =============================================================================
// evaluateCadence — DB function, creates next OutreachStep
// =============================================================================

export async function evaluateCadence(
  db: PrismaClient,
  sequenceId: string,
  config: CadenceConfig,
): Promise<{
  created: boolean;
  stepId: string | null;
  scheduledAt: Date | null;
}> {
  // Load sequence with completed steps, contact, and prospect's wizard session
  const sequence = await db.outreachSequence.findFirst({
    where: { id: sequenceId },
    include: {
      contact: {
        select: {
          id: true,
          primaryEmail: true,
          primaryPhone: true,
          linkedinUrl: true,
        },
      },
      steps: {
        where: { status: { in: ['SENT', 'QUEUED'] } },
        orderBy: { stepOrder: 'asc' },
        select: {
          id: true,
          stepOrder: true,
          status: true,
          sentAt: true,
          metadata: true,
        },
      },
    },
  });

  if (!sequence) {
    throw new Error(`OutreachSequence not found: ${sequenceId}`);
  }

  // Load prospect's latest wizard session for engagement signals
  const wizardSession = await db.wizardSession.findFirst({
    where: { prospectId: sequence.prospectId },
    orderBy: { updatedAt: 'desc' },
    select: {
      maxStepReached: true,
      pdfDownloaded: true,
    },
  });

  // Build engagement signals
  const engagementSignals: EngagementSignals = {
    wizardMaxStep: wizardSession?.maxStepReached ?? 0,
    pdfDownloaded: wizardSession?.pdfDownloaded ?? false,
  };

  // Build contact channels
  const contactChannels: ContactChannels = {
    primaryEmail: sequence.contact?.primaryEmail ?? null,
    primaryPhone: sequence.contact?.primaryPhone ?? null,
    linkedinUrl: sequence.contact?.linkedinUrl ?? null,
  };

  // Map completed steps to touch records
  const completedTouches = sequence.steps.map((step) => ({
    completedAt: step.sentAt ?? new Date(),
    channel: (step.metadata as { channel?: string } | null)?.channel ?? 'email',
    stepOrder: step.stepOrder,
  }));

  const state = buildCadenceState(
    completedTouches,
    engagementSignals,
    contactChannels,
    config,
  );

  if (state.isExhausted) {
    // Mark sequence as closed
    await db.outreachSequence.update({
      where: { id: sequenceId },
      data: { status: 'CLOSED_LOST' },
    });
    return { created: false, stepId: null, scheduledAt: null };
  }

  // Create the next OutreachStep
  const now = new Date();
  const newStep = await db.outreachStep.create({
    data: {
      sequenceId,
      stepOrder: state.touchCount + 1,
      bodyText: '', // Placeholder — cron or agent will fill actual copy
      status: 'DRAFTED',
      scheduledAt: now,
      triggeredBy: 'cadence',
      nextStepReadyAt: state.nextScheduledAt,
      metadata: { channel: state.nextChannel } as never,
    },
    select: { id: true, scheduledAt: true },
  });

  return {
    created: true,
    stepId: newStep.id,
    scheduledAt: newStep.scheduledAt,
  };
}

// =============================================================================
// processDueCadenceSteps — cron sweep, promotes due steps to touch tasks
// =============================================================================

export async function processDueCadenceSteps(db: PrismaClient): Promise<{
  processed: number;
  created: number;
}> {
  const now = new Date();

  // Find all due DRAFTED steps — these are ready to be worked
  const dueSteps = await db.outreachStep.findMany({
    where: {
      nextStepReadyAt: { lte: now },
      status: 'DRAFTED',
    },
    include: {
      sequence: {
        include: {
          contact: true,
          prospect: true,
        },
      },
    },
    take: 50,
    orderBy: { nextStepReadyAt: 'asc' },
  });

  let created = 0;

  for (const step of dueSteps) {
    const channel =
      (step.metadata as { channel?: string } | null)?.channel ?? 'email';
    const contactId = step.sequence.contactId;

    if (!contactId) {
      // No contact on sequence — skip this step
      continue;
    }

    // Create an OutreachLog touch task for the rep to action
    const newLog = await db.outreachLog.create({
      data: {
        contactId,
        type: 'FOLLOW_UP',
        channel,
        status: 'touch_open',
        subject: `Cadence follow-up: ${channel}`,
        metadata: {
          kind: 'touch_task',
          priority: 'medium',
          createdBy: 'cadence-engine',
          outreachSequenceId: step.sequenceId,
          outreachStepId: step.id,
        } as never,
      },
      select: { id: true },
    });

    // Promote step to QUEUED and link to the touch log
    await db.outreachStep.update({
      where: { id: step.id },
      data: {
        status: 'QUEUED',
        outreachLogId: newLog.id,
      },
    });

    created++;
  }

  return { processed: dueSteps.length, created };
}

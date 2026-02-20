import type { PrismaClient } from '@prisma/client';

export type TriggerSource =
  | 'wizard_step3'
  | 'pdf_download'
  | 'interested_reply';

const TRIGGER_SUBJECTS: Record<TriggerSource, string> = {
  wizard_step3: 'Follow-up: prospect engaged with wizard (step 3+)',
  pdf_download: 'Follow-up: prospect downloaded PDF report',
  interested_reply: 'Follow-up: prospect replied with interest',
};

async function resolveContactId(
  db: PrismaClient,
  prospectId: string,
): Promise<string | null> {
  // Priority 1: most recent OutreachSequence with non-null contactId for this prospect
  const sequence = await db.outreachSequence.findFirst({
    where: {
      prospectId,
      contactId: { not: null },
    },
    orderBy: { updatedAt: 'desc' },
    select: { contactId: true },
  });
  if (sequence?.contactId) return sequence.contactId;

  // Priority 2: earliest non-opted-out Contact for this prospect
  const contact = await db.contact.findFirst({
    where: {
      prospectId,
      outreachStatus: { not: 'OPTED_OUT' },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (contact?.id) return contact.id;

  return null;
}

export async function createEngagementCallTask(
  db: PrismaClient,
  prospectId: string,
  triggerSource: TriggerSource,
): Promise<{ created: boolean; taskId: string | null; reason?: string }> {
  // Dedup check: skip if an open call task for this (prospectId, triggerSource) already exists
  const existing = await db.outreachLog.findFirst({
    where: {
      channel: 'call',
      status: 'touch_open',
      contact: { prospectId },
      metadata: { path: ['triggerSource'], equals: triggerSource },
    },
    select: { id: true },
  });
  if (existing) {
    return { created: false, taskId: existing.id, reason: 'already_exists' };
  }

  // Resolve contact for this prospect
  const contactId = await resolveContactId(db, prospectId);
  if (!contactId) {
    console.warn(
      `[engagement-triggers] No contact found for prospectId=${prospectId}, triggerSource=${triggerSource} — skipping call task creation`,
    );
    return { created: false, taskId: null, reason: 'no_contact' };
  }

  // Create the call touch task
  const task = await db.outreachLog.create({
    data: {
      contactId,
      type: 'FOLLOW_UP',
      channel: 'call',
      status: 'touch_open',
      subject: TRIGGER_SUBJECTS[triggerSource],
      metadata: {
        kind: 'touch_task',
        priority: 'high',
        dueAt: null,
        notes: null,
        createdBy: 'engagement-trigger',
        triggerSource,
        prospectId,
      } as never,
    },
    select: { id: true },
  });

  return { created: true, taskId: task.id };
}

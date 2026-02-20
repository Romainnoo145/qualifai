import type { PrismaClient } from '@prisma/client';
import { triageReplyText, type ReplyIntent } from '@/lib/outreach/reply-triage';
import { createEngagementCallTask } from '@/lib/outreach/engagement-triggers';

function metadataAsObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function mergeMetadata(
  base: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...metadataAsObject(base),
    ...patch,
  };
}

function actionForIntent(
  intent: ReplyIntent,
):
  | 'book_teardown'
  | 'follow_up_later'
  | 'close_lost'
  | 'suppress_contact'
  | 'manual_review' {
  switch (intent) {
    case 'interested':
      return 'book_teardown';
    case 'later':
      return 'follow_up_later';
    case 'not_fit':
      return 'close_lost';
    case 'stop':
      return 'suppress_contact';
    default:
      return 'manual_review';
  }
}

async function resolveSequenceIdForReply(
  db: PrismaClient,
  contactId: string,
  metadata: unknown,
): Promise<string | null> {
  const meta = metadataAsObject(metadata);
  const explicitSequenceId = meta.outreachSequenceId;
  if (typeof explicitSequenceId === 'string' && explicitSequenceId)
    return explicitSequenceId;

  const latest = await db.outreachSequence.findFirst({
    where: { contactId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });
  return latest?.id ?? null;
}

export async function captureInboundReply(
  db: PrismaClient,
  input: {
    contactId: string;
    subject?: string;
    bodyText: string;
    bodyHtml?: string;
    source?: string;
    outreachSequenceId?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const contact = await db.contact.findUniqueOrThrow({
    where: { id: input.contactId },
  });
  const fallbackSequenceId = input.outreachSequenceId
    ? input.outreachSequenceId
    : (
        await db.outreachSequence.findFirst({
          where: { contactId: input.contactId },
          orderBy: { updatedAt: 'desc' },
          select: { id: true },
        })
      )?.id;

  const log = await db.outreachLog.create({
    data: {
      contactId: input.contactId,
      type: 'FOLLOW_UP',
      channel: input.source ?? 'email-inbound',
      status: 'received',
      subject: input.subject,
      bodyText: input.bodyText,
      bodyHtml: input.bodyHtml,
      metadata: {
        inbound: true,
        source: input.source ?? 'email-inbound',
        outreachSequenceId: fallbackSequenceId ?? null,
        capturedAt: new Date().toISOString(),
        ...(input.metadata ?? {}),
      } as never,
      sentAt: new Date(),
    },
  });

  await db.contact.update({
    where: { id: input.contactId },
    data: {
      outreachStatus: 'REPLIED',
      lastContactedAt: new Date(),
    },
  });

  if (fallbackSequenceId) {
    await db.outreachSequence.update({
      where: { id: fallbackSequenceId },
      data: { status: 'REPLIED' },
    });
  }

  return {
    replyLogId: log.id,
    contactId: contact.id,
    linkedSequenceId: fallbackSequenceId ?? null,
  };
}

export async function applyReplyTriage(
  db: PrismaClient,
  input: { replyLogId: string; categoryOverride?: ReplyIntent },
) {
  const reply = await db.outreachLog.findUniqueOrThrow({
    where: { id: input.replyLogId },
    include: {
      contact: {
        include: {
          prospect: {
            select: { id: true, companyName: true, domain: true },
          },
        },
      },
    },
  });

  const auto = triageReplyText({
    subject: reply.subject,
    bodyText: reply.bodyText,
  });
  const intent = input.categoryOverride ?? auto.intent;
  const suggestedAction = actionForIntent(intent);
  const deferDays = intent === 'later' ? (auto.deferDays ?? 14) : undefined;

  const sequenceId = await resolveSequenceIdForReply(
    db,
    reply.contactId,
    reply.metadata,
  );
  if (sequenceId) {
    const nextSequenceStatus =
      intent === 'stop' || intent === 'not_fit' ? 'CLOSED_LOST' : 'REPLIED';
    await db.outreachSequence.update({
      where: { id: sequenceId },
      data: { status: nextSequenceStatus },
    });
    await db.outreachStep.updateMany({
      where: {
        sequenceId,
        status: {
          in:
            nextSequenceStatus === 'CLOSED_LOST'
              ? ['DRAFTED', 'QUEUED', 'SENT', 'OPENED', 'REPLIED']
              : ['SENT', 'OPENED', 'REPLIED'],
        },
      },
      data: { status: nextSequenceStatus },
    });
  }

  await db.contact.update({
    where: { id: reply.contactId },
    data: {
      outreachStatus: intent === 'stop' ? 'OPTED_OUT' : 'REPLIED',
      lastContactedAt: new Date(),
    },
  });

  if (intent === 'interested') {
    await db.prospect.update({
      where: { id: reply.contact.prospectId },
      data: { status: 'ENGAGED' },
    });

    try {
      await createEngagementCallTask(
        db,
        reply.contact.prospectId,
        'interested_reply',
      );
    } catch (err) {
      console.error(
        'Failed to create engagement call task for interested reply:',
        err,
      );
    }
  }

  const triagePayload = {
    triage: {
      intent,
      confidence: input.categoryOverride ? 1 : auto.confidence,
      reasons: input.categoryOverride
        ? [...auto.reasons, `Manual override: ${input.categoryOverride}`]
        : auto.reasons,
      suggestedAction,
      deferDays: deferDays ?? null,
      processedAt: new Date().toISOString(),
      sequenceId,
    },
  };

  const updated = await db.outreachLog.update({
    where: { id: reply.id },
    data: {
      status: 'triaged',
      metadata: mergeMetadata(reply.metadata, triagePayload) as never,
    },
  });

  return {
    replyLogId: updated.id,
    contactId: reply.contactId,
    prospectId: reply.contact.prospectId,
    intent,
    suggestedAction,
    deferDays: deferDays ?? null,
    sequenceId,
  };
}

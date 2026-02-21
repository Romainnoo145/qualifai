import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { env } from '@/env.mjs';
import { createCallPrepDraft } from '@/lib/workflow-engine';

const bookingPayloadSchema = z
  .object({
    uid: z.union([z.string(), z.number()]).optional(),
    bookingUid: z.union([z.string(), z.number()]).optional(),
    id: z.union([z.string(), z.number()]).optional(),
    eventTypeId: z.union([z.string(), z.number()]).optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    attendees: z
      .array(
        z.object({
          email: z.string().email().optional(),
          name: z.string().optional(),
        }),
      )
      .optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    responses: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const webhookSchema = z
  .object({
    triggerEvent: z.string().optional(),
    type: z.string().optional(),
    payload: bookingPayloadSchema.optional(),
    data: bookingPayloadSchema.optional(),
  })
  .passthrough();

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeSignature(signature: string): string {
  return signature.startsWith('sha256=') ? signature.slice(7) : signature;
}

function isValidSignature(rawBody: string, signature: string): boolean {
  if (!env.CALCOM_WEBHOOK_SECRET) return false;
  const normalized = normalizeSignature(signature);
  const expected = createHmac('sha256', env.CALCOM_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  const expectedBuffer = Buffer.from(expected);
  const incomingBuffer = Buffer.from(normalized);
  if (expectedBuffer.length !== incomingBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, incomingBuffer);
}

function normalizeEventType(
  rawEvent: string,
): 'BOOKING_CREATED' | 'BOOKING_CANCELLED' | null {
  const event = rawEvent.toUpperCase();
  if (event.includes('BOOKING_CREATED') || event.includes('BOOKING.CREATED')) {
    return 'BOOKING_CREATED';
  }
  if (
    event.includes('BOOKING_CANCELLED') ||
    event.includes('BOOKING.CANCELLED')
  ) {
    return 'BOOKING_CANCELLED';
  }
  return null;
}

function bookingUidFromPayload(
  payload: z.infer<typeof bookingPayloadSchema>,
): string {
  const uid = payload.bookingUid ?? payload.uid ?? payload.id;
  return uid ? String(uid) : '';
}

function attendeeEmailsFromPayload(
  payload: z.infer<typeof bookingPayloadSchema>,
): string[] {
  const fromAttendees = (payload.attendees ?? [])
    .map((item) => item.email?.toLowerCase())
    .filter((email): email is string => Boolean(email));
  const fromResponses = Object.values(payload.responses ?? {})
    .filter(
      (value): value is string =>
        typeof value === 'string' && value.includes('@'),
    )
    .map((value) => value.toLowerCase());
  return Array.from(new Set([...fromAttendees, ...fromResponses]));
}

async function findSequence(
  payload: z.infer<typeof bookingPayloadSchema>,
  attendeeEmails: string[],
) {
  const metadata = toObject(payload.metadata);
  const metadataSequenceId =
    (metadata.outreachSequenceId as string | undefined) ??
    (metadata.sequenceId as string | undefined);
  if (metadataSequenceId) {
    return prisma.outreachSequence.findUnique({
      where: { id: metadataSequenceId },
    });
  }

  const metadataContactId = metadata.contactId as string | undefined;
  if (metadataContactId) {
    return prisma.outreachSequence.findFirst({
      where: { contactId: metadataContactId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  if (attendeeEmails.length === 0) return null;
  const contact = await prisma.contact.findFirst({
    where: { primaryEmail: { in: attendeeEmails } },
    select: { id: true },
  });
  if (!contact) return null;

  return prisma.outreachSequence.findFirst({
    where: { contactId: contact.id },
    orderBy: { updatedAt: 'desc' },
  });
}

async function alreadyProcessed(
  eventType: 'BOOKING_CREATED' | 'BOOKING_CANCELLED',
  bookingUid: string,
) {
  if (!bookingUid) return false;
  const status = eventType === 'BOOKING_CREATED' ? 'booked' : 'cancelled';
  const existing = await prisma.outreachLog.findFirst({
    where: {
      channel: 'calcom',
      status,
      metadata: {
        path: ['bookingUid'],
        equals: bookingUid,
      },
    },
    select: { id: true },
  });
  return Boolean(existing);
}

async function createCallPrepFromSequence(
  tx: Prisma.TransactionClient,
  sequence: {
    prospectId: string;
    campaignId: string | null;
    researchRunId: string | null;
    workflowLossMapId: string | null;
  },
) {
  const run =
    (sequence.researchRunId
      ? await tx.researchRun.findUnique({
          where: { id: sequence.researchRunId },
          include: {
            prospect: {
              select: {
                id: true,
                companyName: true,
                domain: true,
                industry: true,
                employeeRange: true,
                description: true,
                technologies: true,
                specialties: true,
              },
            },
            campaign: { select: { id: true } },
          },
        })
      : null) ??
    (await tx.researchRun.findFirst({
      where: { prospectId: sequence.prospectId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      include: {
        prospect: {
          select: {
            id: true,
            companyName: true,
            domain: true,
            industry: true,
            employeeRange: true,
            description: true,
            technologies: true,
            specialties: true,
          },
        },
        campaign: { select: { id: true } },
      },
    }));

  if (!run) return null;

  const [acceptedHypotheses, acceptedOpportunities] = await Promise.all([
    tx.workflowHypothesis.findMany({
      where: { researchRunId: run.id, status: 'ACCEPTED' },
      orderBy: { confidenceScore: 'desc' },
      take: 3,
    }),
    tx.automationOpportunity.findMany({
      where: { researchRunId: run.id, status: 'ACCEPTED' },
      orderBy: { confidenceScore: 'desc' },
      take: 2,
    }),
  ]);

  const [hypotheses, opportunities] = await Promise.all([
    acceptedHypotheses.length > 0
      ? Promise.resolve(acceptedHypotheses)
      : tx.workflowHypothesis.findMany({
          where: { researchRunId: run.id },
          orderBy: { confidenceScore: 'desc' },
          take: 3,
        }),
    acceptedOpportunities.length > 0
      ? Promise.resolve(acceptedOpportunities)
      : tx.automationOpportunity.findMany({
          where: { researchRunId: run.id },
          orderBy: { confidenceScore: 'desc' },
          take: 2,
        }),
  ]);

  if (hypotheses.length === 0 || opportunities.length === 0) return null;

  const latestMap =
    (sequence.workflowLossMapId
      ? await tx.workflowLossMap.findUnique({
          where: { id: sequence.workflowLossMapId },
          select: { id: true },
        })
      : null) ??
    (await tx.workflowLossMap.findFirst({
      where: { researchRunId: run.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    }));

  const draft = createCallPrepDraft(run.prospect, hypotheses, opportunities);
  const currentCount = await tx.callPrepPlan.count({
    where: { prospectId: run.prospectId },
  });
  return tx.callPrepPlan.create({
    data: {
      prospectId: run.prospectId,
      campaignId: run.campaign?.id ?? sequence.campaignId,
      researchRunId: run.id,
      workflowLossMapId: latestMap?.id,
      version: currentCount + 1,
      language: 'nl',
      summary: draft.summary,
      plan30: toJson(draft.plan30),
      plan60: toJson(draft.plan60),
      plan90: toJson(draft.plan90),
      stakeholderMap: toJson(draft.stakeholderMap),
      discoveryQuestions: toJson(draft.discoveryQuestions),
      riskList: toJson(draft.riskList),
      demoFlow: toJson(draft.demoFlow),
    },
    select: { id: true },
  });
}

export async function POST(req: NextRequest) {
  if (!env.CALCOM_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: 'CALCOM_WEBHOOK_SECRET is not configured' },
      { status: 500 },
    );
  }

  const rawBody = await req.text();
  const signature =
    req.headers.get('x-cal-signature-256') ??
    req.headers.get('x-cal-signature') ??
    req.headers.get('x-signature');
  if (!signature || !isValidSignature(rawBody, signature)) {
    return NextResponse.json(
      { error: 'Invalid Cal.com signature' },
      { status: 401 },
    );
  }

  try {
    const parsed = webhookSchema.parse(JSON.parse(rawBody));
    const rawEvent = parsed.triggerEvent ?? parsed.type ?? '';
    const eventType = normalizeEventType(rawEvent);
    if (!eventType) {
      return NextResponse.json({ ignored: true, reason: 'Unsupported event' });
    }

    const bookingPayload = parsed.payload ?? parsed.data;
    if (!bookingPayload) {
      return NextResponse.json({
        ignored: true,
        reason: 'Missing booking payload',
      });
    }

    const bookingUid = bookingUidFromPayload(bookingPayload);
    if (await alreadyProcessed(eventType, bookingUid)) {
      return NextResponse.json({ success: true, deduplicated: true });
    }

    const attendeeEmails = attendeeEmailsFromPayload(bookingPayload);
    const sequence = await findSequence(bookingPayload, attendeeEmails);
    if (!sequence) {
      return NextResponse.json({
        ignored: true,
        reason: 'No matching outreach sequence',
      });
    }

    const metadata = toObject(bookingPayload.metadata);
    const startTime = bookingPayload.startTime ?? null;
    const endTime = bookingPayload.endTime ?? null;
    const eventTypeId =
      bookingPayload.eventTypeId !== undefined
        ? String(bookingPayload.eventTypeId)
        : null;

    const result = await prisma.$transaction(async (tx) => {
      const currentSequenceMetadata = toObject(sequence.metadata);
      const mergedSequenceMetadata = {
        ...currentSequenceMetadata,
        calcom: {
          ...toObject(currentSequenceMetadata.calcom),
          bookingUid: bookingUid || null,
          eventTypeId,
          startTime,
          endTime,
          attendeeEmails,
          updatedAt: new Date().toISOString(),
        },
      };

      const nextSequenceStatus =
        eventType === 'BOOKING_CREATED' ? 'BOOKED' : 'REPLIED';
      await tx.outreachSequence.update({
        where: { id: sequence.id },
        data: {
          status: nextSequenceStatus,
          metadata: toJson(mergedSequenceMetadata),
        },
      });

      await tx.outreachStep.updateMany({
        where: {
          sequenceId: sequence.id,
          status: {
            in: ['DRAFTED', 'QUEUED', 'SENT', 'OPENED', 'REPLIED', 'BOOKED'],
          },
        },
        data: { status: nextSequenceStatus },
      });

      if (sequence.contactId) {
        await tx.contact.update({
          where: { id: sequence.contactId },
          data: {
            outreachStatus:
              eventType === 'BOOKING_CREATED' ? 'CONVERTED' : 'REPLIED',
            lastContactedAt: new Date(),
          },
        });
      }

      if (eventType === 'BOOKING_CREATED') {
        await tx.prospect.update({
          where: { id: sequence.prospectId },
          data: { status: 'ENGAGED' },
        });
      }

      if (sequence.contactId) {
        await tx.outreachLog.create({
          data: {
            contactId: sequence.contactId,
            type: 'FOLLOW_UP',
            channel: 'calcom',
            status: eventType === 'BOOKING_CREATED' ? 'booked' : 'cancelled',
            subject:
              eventType === 'BOOKING_CREATED'
                ? 'Cal.com booking confirmed'
                : 'Cal.com booking cancelled',
            bodyText:
              eventType === 'BOOKING_CREATED'
                ? 'Prospect booked a call through Cal.com.'
                : 'Prospect cancelled the Cal.com booking.',
            metadata: toJson({
              bookingUid: bookingUid || null,
              eventType,
              eventTypeId,
              startTime,
              endTime,
              attendeeEmails,
              outreachSequenceId: sequence.id,
              contactId: sequence.contactId,
              prospectId: sequence.prospectId,
              payloadMetadata: metadata,
            }),
            sentAt: new Date(),
          },
        });
      }

      const callPrep =
        eventType === 'BOOKING_CREATED'
          ? await createCallPrepFromSequence(tx, {
              prospectId: sequence.prospectId,
              campaignId: sequence.campaignId,
              researchRunId: sequence.researchRunId,
              workflowLossMapId: sequence.workflowLossMapId,
            })
          : null;

      return {
        sequenceId: sequence.id,
        callPrepId: callPrep?.id ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      eventType,
      bookingUid: bookingUid || null,
      ...result,
    });
  } catch (error) {
    console.error('cal.com webhook processing error', error);
    return NextResponse.json(
      { error: 'Invalid webhook payload' },
      { status: 400 },
    );
  }
}

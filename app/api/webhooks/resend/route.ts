import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { env } from '@/env.mjs';

const resend = new Resend(env.RESEND_API_KEY);

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function POST(req: NextRequest) {
  if (!env.RESEND_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: 'RESEND_WEBHOOK_SECRET is not configured' },
      { status: 500 },
    );
  }

  const rawBody = await req.text();

  let event;
  try {
    event = resend.webhooks.verify({
      payload: rawBody,
      headers: {
        id: req.headers.get('svix-id') ?? '',
        timestamp: req.headers.get('svix-timestamp') ?? '',
        signature: req.headers.get('svix-signature') ?? '',
      },
      webhookSecret: env.RESEND_WEBHOOK_SECRET,
    });
  } catch {
    return NextResponse.json(
      { error: 'Invalid webhook signature' },
      { status: 400 },
    );
  }

  try {
    if (event.type === 'email.opened') {
      const emailId = event.data.email_id;
      const log = await prisma.outreachLog.findFirst({
        where: {
          metadata: {
            path: ['resendMessageId'],
            equals: emailId,
          },
        },
        select: { id: true, openedAt: true },
      });
      if (log && log.openedAt === null) {
        await prisma.outreachLog.update({
          where: { id: log.id },
          data: { openedAt: new Date(event.created_at) },
        });
      }
      // ENGAG-05: Do NOT create any call task or trigger cadence escalation
    } else if (event.type === 'email.clicked') {
      const emailId = event.data.email_id;
      const log = await prisma.outreachLog.findFirst({
        where: {
          metadata: {
            path: ['resendMessageId'],
            equals: emailId,
          },
        },
        select: { id: true, metadata: true },
      });
      if (log) {
        const existingMetadata =
          log.metadata &&
          typeof log.metadata === 'object' &&
          !Array.isArray(log.metadata)
            ? (log.metadata as Record<string, unknown>)
            : {};
        const existingClicks = Array.isArray(existingMetadata.clicks)
          ? (existingMetadata.clicks as unknown[])
          : [];
        const clickData = event.data.click;
        await prisma.outreachLog.update({
          where: { id: log.id },
          data: {
            metadata: toJson({
              ...existingMetadata,
              clicks: [
                ...existingClicks,
                {
                  link: clickData.link,
                  timestamp: clickData.timestamp,
                  userAgent: clickData.userAgent,
                },
              ],
            }),
          },
        });
      }
      // ENGAG-05: Do NOT create any call task or trigger cadence escalation
    }
  } catch (error) {
    console.error('resend webhook processing error', error);
    return NextResponse.json({ error: 'Processing error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

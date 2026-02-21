import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { env } from '@/env.mjs';
import {
  applyReplyTriage,
  captureInboundReply,
} from '@/lib/outreach/reply-workflow';
import { normalizeInboundReplyPayload } from '@/lib/outreach/inbound-adapters';

function secretFromRequest(req: NextRequest): string {
  const direct = req.headers.get('x-inbound-secret');
  if (direct) return direct;

  const bearer = req.headers.get('authorization');
  if (bearer?.startsWith('Bearer ')) {
    return bearer.slice('Bearer '.length).trim();
  }

  return '';
}

function formDataToObject(formData: FormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    const normalizedValue = typeof value === 'string' ? value : value.name;
    const existing = payload[key];
    if (existing === undefined) {
      payload[key] = normalizedValue;
      continue;
    }
    if (Array.isArray(existing)) {
      payload[key] = [...existing, normalizedValue];
      continue;
    }
    payload[key] = [existing, normalizedValue];
  }
  return payload;
}

async function parseInboundPayload(req: NextRequest): Promise<unknown> {
  const contentType = req.headers.get('content-type')?.toLowerCase() ?? '';
  if (contentType.includes('application/json')) {
    return req.json();
  }
  if (
    contentType.includes('multipart/form-data') ||
    contentType.includes('application/x-www-form-urlencoded')
  ) {
    return formDataToObject(await req.formData());
  }

  const fallbackClone = req.clone();
  try {
    return await req.json();
  } catch {
    try {
      return formDataToObject(await fallbackClone.formData());
    } catch {
      return null;
    }
  }
}

function isAuthorized(req: NextRequest): boolean {
  const provided = secretFromRequest(req);
  const expected = env.INBOUND_REPLY_WEBHOOK_SECRET ?? env.ADMIN_SECRET;
  return Boolean(provided) && provided === expected;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: 'Invalid inbound webhook secret' },
      { status: 401 },
    );
  }

  try {
    const rawPayload = await parseInboundPayload(req);
    const payload = normalizeInboundReplyPayload(rawPayload);
    if (!payload) {
      return NextResponse.json(
        { error: 'Unsupported inbound webhook payload shape' },
        { status: 400 },
      );
    }

    const contact = await prisma.contact.findFirst({
      where: {
        primaryEmail: {
          equals: payload.fromEmail,
          mode: 'insensitive',
        },
      },
      select: { id: true },
    });

    if (!contact) {
      return NextResponse.json({
        success: true,
        ignored: true,
        reason: 'contact_not_found',
        fromEmail: payload.fromEmail,
      });
    }

    const captured = await captureInboundReply(prisma, {
      contactId: contact.id,
      subject: payload.subject,
      bodyText: payload.bodyText,
      bodyHtml: payload.bodyHtml,
      source: payload.source,
      outreachSequenceId: payload.outreachSequenceId,
      metadata: {
        fromEmail: payload.fromEmail,
        provider: payload.provider,
        ...(payload.metadata ?? {}),
      },
    });

    const triage = payload.autoTriage
      ? await applyReplyTriage(prisma, {
          replyLogId: captured.replyLogId,
        })
      : null;

    return NextResponse.json({
      success: true,
      captured,
      triage,
    });
  } catch (error) {
    console.error('inbound reply webhook processing error', error);
    return NextResponse.json(
      { error: 'Invalid inbound webhook payload' },
      { status: 400 },
    );
  }
}

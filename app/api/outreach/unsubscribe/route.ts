import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyUnsubscribeToken } from '@/lib/outreach/unsubscribe';

type UnsubscribeResult =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      status: number;
      message: string;
    };

async function processUnsubscribe(
  req: NextRequest,
): Promise<UnsubscribeResult> {
  const contactId = req.nextUrl.searchParams.get('contactId');
  const token = req.nextUrl.searchParams.get('token');
  if (!contactId || !token) {
    return {
      ok: false,
      status: 400,
      message: 'Missing unsubscribe parameters.',
    };
  }

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: {
      id: true,
      primaryEmail: true,
      firstName: true,
      outreachNotes: true,
    },
  });
  if (!contact?.primaryEmail) {
    return {
      ok: false,
      status: 404,
      message: 'Contact not found.',
    };
  }

  if (!verifyUnsubscribeToken(contact.id, contact.primaryEmail, token)) {
    return {
      ok: false,
      status: 401,
      message: 'Invalid unsubscribe token.',
    };
  }

  const note = `[${new Date().toISOString()}] Unsubscribed via one-click link.`;
  await prisma.$transaction([
    prisma.contact.update({
      where: { id: contact.id },
      data: {
        outreachStatus: 'OPTED_OUT',
        outreachNotes: contact.outreachNotes
          ? `${contact.outreachNotes}\n${note}`
          : note,
      },
    }),
    prisma.outreachLog.updateMany({
      where: { contactId: contact.id, status: 'draft' },
      data: { status: 'cancelled' },
    }),
    prisma.outreachSequence.updateMany({
      where: {
        contactId: contact.id,
        status: { in: ['DRAFTED', 'QUEUED'] },
      },
      data: { status: 'CLOSED_LOST' },
    }),
    prisma.outreachStep.updateMany({
      where: {
        sequence: {
          contactId: contact.id,
          status: { in: ['CLOSED_LOST'] },
        },
        status: { in: ['DRAFTED', 'QUEUED'] },
      },
      data: { status: 'CLOSED_LOST' },
    }),
  ]);

  return {
    ok: true,
    message: `You're unsubscribed, ${contact.firstName}.`,
  };
}

export async function POST(req: NextRequest) {
  const result = await processUnsubscribe(req);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json({ success: true });
}

export async function GET(req: NextRequest) {
  const result = await processUnsubscribe(req);
  if (!result.ok) {
    return new NextResponse(
      `<html><body style="font-family:system-ui;padding:24px;color:#111827;"><h1>Unsubscribe failed</h1><p>${result.message}</p></body></html>`,
      {
        status: result.status,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      },
    );
  }

  return new NextResponse(
    `<html><body style="font-family:system-ui;padding:24px;color:#111827;"><h1>Unsubscribed</h1><p>${result.message}</p></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

import { Resend } from 'resend';
import { env } from '@/env.mjs';
import prisma from '@/lib/prisma';
import type { OutreachType } from '@prisma/client';
import { createUnsubscribeToken } from '@/lib/outreach/unsubscribe';
import { assessEmailForOutreach } from '@/lib/outreach/quality';

const resend = new Resend(env.RESEND_API_KEY);

const FROM_EMAIL =
  process.env.OUTREACH_FROM_EMAIL ?? 'Romano Groenewoud <info@klarifai.nl>';
const REPLY_TO_EMAIL =
  process.env.OUTREACH_REPLY_TO_EMAIL ?? 'info@klarifai.nl';
const UNSUBSCRIBE_EMAIL =
  process.env.OUTREACH_UNSUBSCRIBE_EMAIL ?? REPLY_TO_EMAIL;
const APP_URL = env.NEXT_PUBLIC_APP_URL ?? 'https://qualifai.klarifai.nl';

interface SendOutreachOptions {
  contactId: string;
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  type: OutreachType;
  metadata?: Record<string, unknown>;
}

function buildUnsubscribeUrl(contactId: string, email: string): string {
  const url = new URL('/api/outreach/unsubscribe', APP_URL);
  url.searchParams.set('contactId', contactId);
  url.searchParams.set('token', createUnsubscribeToken(contactId, email));
  return url.toString();
}

function withComplianceFooter(
  bodyHtml: string,
  bodyText: string,
  unsubscribeUrl: string,
): { bodyHtml: string; bodyText: string } {
  const htmlFooter = `<p style="margin-top:24px;font-size:12px;color:#667085;">If you prefer no further outreach emails, you can <a href="${unsubscribeUrl}">unsubscribe instantly</a>.</p>`;
  const textFooter = `\n\nIf you prefer no further outreach emails, unsubscribe instantly: ${unsubscribeUrl}`;

  return {
    bodyHtml: `${bodyHtml}${htmlFooter}`,
    bodyText: `${bodyText}${textFooter}`,
  };
}

export async function sendOutreachEmail(
  options: SendOutreachOptions,
): Promise<{ success: boolean; logId: string }> {
  const { contactId, to, subject, bodyHtml, bodyText, type, metadata } =
    options;
  const emailAssessment = assessEmailForOutreach(to);
  if (emailAssessment.status === 'blocked') {
    throw new Error(
      `Email blocked by outreach quality checks: ${emailAssessment.reasons.join(', ')}`,
    );
  }
  if (!subject.trim()) {
    throw new Error('Email subject is required');
  }
  if (!bodyText.trim() && !bodyHtml.trim()) {
    throw new Error('Email content is empty');
  }

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: {
      id: true,
      primaryEmail: true,
      outreachStatus: true,
    },
  });
  if (!contact) {
    throw new Error('Contact not found');
  }
  if (contact.outreachStatus === 'OPTED_OUT') {
    throw new Error('Contact opted out from outreach');
  }

  const unsubscribeUrl = buildUnsubscribeUrl(contactId, to);
  const compliantContent = withComplianceFooter(
    bodyHtml,
    bodyText,
    unsubscribeUrl,
  );
  const messageMetadata = {
    ...(metadata ?? {}),
    unsubscribeUrl,
    resendMessageId: null as string | null,
    emailQuality: {
      status: emailAssessment.status,
      reasons: emailAssessment.reasons,
    },
  };

  let status = 'sent';
  let sentAt: Date | null = new Date();

  try {
    const { data: sendResult, error: sendError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html: compliantContent.bodyHtml,
      text: compliantContent.bodyText,
      replyTo: REPLY_TO_EMAIL,
      headers: {
        'List-Unsubscribe': `<mailto:${UNSUBSCRIBE_EMAIL}?subject=unsubscribe>, <${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
    if (sendError) {
      throw sendError;
    }
    messageMetadata.resendMessageId = sendResult?.id ?? null;
  } catch (error) {
    console.error('Failed to send outreach email:', error);
    status = 'failed';
    sentAt = null;
  }

  // Log the outreach
  const log = await prisma.outreachLog.create({
    data: {
      contactId,
      type,
      channel: 'email',
      status,
      subject,
      bodyHtml: compliantContent.bodyHtml,
      bodyText: compliantContent.bodyText,
      metadata: messageMetadata as never,
      sentAt,
    },
  });

  // Update contact status
  if (status === 'sent') {
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        outreachStatus: 'EMAIL_SENT',
        lastContactedAt: new Date(),
      },
    });
  }

  return { success: status === 'sent', logId: log.id };
}

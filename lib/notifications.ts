import { Resend } from 'resend';
import { env } from '@/env.mjs';
import prisma from '@/lib/prisma';

const resend = new Resend(env.RESEND_API_KEY);

interface NotifyOptions {
  prospectId: string;
  type: 'first_view' | 'pdf_download' | 'call_booked' | 'quote_request';
  companyName: string;
  slug: string;
  matchedUseCases?: string[];
}

export async function notifyAdmin({
  prospectId,
  type,
  companyName,
  slug,
  matchedUseCases,
}: NotifyOptions) {
  const appUrl = env.NEXT_PUBLIC_APP_URL || 'https://qualifai.klarifai.nl';

  const useCaseList =
    matchedUseCases && matchedUseCases.length > 0
      ? `<ul>${matchedUseCases.map((uc) => `<li>${uc}</li>`).join('')}</ul>`
      : '<p><em>Geen specifieke use cases gevonden.</em></p>';

  const subjects: Record<string, string> = {
    first_view: `${companyName} just opened their Qualifai walkthrough`,
    pdf_download: `${companyName} downloaded their AI report`,
    call_booked: `${companyName} booked a call!`,
    quote_request: `${companyName} vraagt een offerte aan`,
  };

  const bodies: Record<string, string> = {
    first_view: `<h2>${companyName} is viewing their Qualifai walkthrough</h2>
      <p>They just opened <a href="${appUrl}/discover/${slug}">their personalized flow</a>.</p>
      <p>Check the <a href="${appUrl}/admin/prospects/${prospectId}">admin panel</a> for live session tracking.</p>`,
    pdf_download: `<h2>${companyName} downloaded their AI report PDF</h2>
      <p>Strong engagement signal — they want to share it internally.</p>
      <p><a href="${appUrl}/admin/prospects/${prospectId}">View prospect details</a></p>`,
    call_booked: `<h2>${companyName} booked a discovery call!</h2>
      <p>This is a hot lead. They went through the full wizard and clicked book a call.</p>
      <p><a href="${appUrl}/admin/prospects/${prospectId}">View prospect details</a></p>`,
    quote_request: `<h2>${companyName} vraagt een offerte aan</h2>
      <p>Dit prospect heeft via het dashboard een offerte aangevraagd.</p>
      <h3>Gematchte use cases</h3>
      ${useCaseList}
      <p><a href="${appUrl}/admin/prospects/${prospectId}">Bekijk prospect in het admin panel</a></p>`,
  };

  let status = 'sent';

  try {
    await resend.emails.send({
      from: 'Qualifai <notifications@klarifai.nl>',
      to: [env.ADMIN_EMAIL],
      subject: subjects[type] ?? `Prospect activity: ${type}`,
      html: bodies[type] ?? `<p>Activity: ${type} for ${companyName}</p>`,
    });
  } catch (error) {
    console.error('Failed to send notification:', error);
    status = 'failed';
  }

  await prisma.notificationLog.create({
    data: {
      prospectId,
      type,
      channel: 'email',
      status,
      metadata: { companyName, slug },
    },
  });

  return status;
}

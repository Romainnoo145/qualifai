/**
 * Polished kickoff-reminder email template — extracted from lib/email/kickoff-reminder.ts
 * so cron route and one-off send share identical HTML/text.
 *
 * Design constraints (per DESIGN.md + memory):
 * - Solid gold (#E4C33C) rectangle CTA — NOT the brochure pill gradient
 * - Navy (#0a0a2e) body text, Sora font stack
 * - Romano's email signature via getEmailSignature('klarifai')
 */

import { getEmailSignature } from '@/components/clients/klarifai/email-signature';
import { KLARIFAI_BUSINESS } from '@/lib/klarifai-business';

const NAVY = '#0a0a2e';
const GOLD = '#E4C33C';
const BG = '#f7f5ef';
const SURFACE = '#ffffff';
const BORDER = 'rgba(10, 10, 46, 0.08)';
const MUTED = '#6b6f8a';
const FONT_STACK =
  "'Sora', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export interface KickoffReminderInput {
  prospectName: string;
  quoteNumber: string;
  kickoffUrl: string;
  /** ISO string or Date — formatted nl-NL in the email body */
  acceptedAt?: Date | string | null;
}

export const KICKOFF_REMINDER_SUBJECT = (quoteNumber: string) =>
  `Kickoff inplannen — offerte ${quoteNumber}`;

export function buildKickoffReminderHtml(input: KickoffReminderInput): string {
  const { prospectName, quoteNumber, kickoffUrl, acceptedAt } = input;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://qualifai.klarifai.nl';
  const logoUrl = `${appUrl}/klarifai-logo-full.svg`;
  const sig = getEmailSignature('klarifai').html;

  const acceptedLine =
    acceptedAt != null
      ? `Je hebt offerte <strong>${quoteNumber}</strong> getekend op ${new Date(acceptedAt).toLocaleDateString('nl-NL')} — de volgende stap is het kickoff-gesprek.`
      : `Je hebt offerte <strong>${quoteNumber}</strong> getekend — de volgende stap is het kickoff-gesprek.`;

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Kickoff inplannen — ${quoteNumber}</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:${FONT_STACK};-webkit-font-smoothing:antialiased;">
  <div style="max-width:560px;margin:0 auto;padding:48px 24px 64px;">

    <!-- Logo -->
    <div style="text-align:center;margin-bottom:48px;">
      <img src="${logoUrl}" alt="Klarifai" width="120" height="32" style="display:block;margin:0 auto;width:120px;height:auto;" />
    </div>

    <!-- Card -->
    <div style="background:${SURFACE};border:1px solid ${BORDER};border-radius:16px;padding:40px 36px;">

      <!-- Section label -->
      <p style="margin:0 0 18px;font-family:${FONT_STACK};font-size:11px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:${MUTED};">
        KICKOFF INPLANNEN
      </p>

      <!-- Heading -->
      <h1 style="margin:0 0 16px;font-family:${FONT_STACK};font-size:26px;font-weight:700;line-height:1.2;letter-spacing:-0.015em;color:${NAVY};">
        Plan je kickoff-gesprek<span style="color:${GOLD};">.</span>
      </h1>

      <!-- Intro -->
      <p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:15px;font-weight:400;line-height:1.55;color:${NAVY};">
        Beste ${prospectName},
      </p>

      <p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:15px;font-weight:400;line-height:1.55;color:${NAVY};">
        ${acceptedLine}
        We lopen de aanpak door, beantwoorden vragen en leggen de planning vast.
      </p>

      <p style="margin:0 0 32px;font-family:${FONT_STACK};font-size:15px;font-weight:400;line-height:1.55;color:${NAVY};">
        Plan op een moment dat je schikt:
      </p>

      <!-- CTA -->
      <div style="text-align:center;margin:0 0 32px;">
        <a href="${kickoffUrl}"
           style="display:inline-block;padding:12px 28px;background:${GOLD};color:${NAVY};text-decoration:none;font-family:${FONT_STACK};font-size:14px;font-weight:600;letter-spacing:-0.005em;border-radius:6px;">
          Plan kickoff
        </a>
      </div>

      <!-- Fallback -->
      <p style="margin:0;font-family:${FONT_STACK};font-size:13px;font-weight:400;line-height:1.55;color:${MUTED};text-align:center;">
        Of mail naar
        <a href="mailto:${KLARIFAI_BUSINESS.email}" style="color:${NAVY};text-decoration:none;">${KLARIFAI_BUSINESS.email}</a>
        als bellen beter past — dan plannen we het samen in.
      </p>

    </div>

    <!-- Signature -->
    <div style="padding:0 4px;">
      ${sig}
    </div>

  </div>
</body>
</html>`;
}

export function buildKickoffReminderText(input: KickoffReminderInput): string {
  const { prospectName, quoteNumber, kickoffUrl, acceptedAt } = input;
  const sig = getEmailSignature('klarifai').text;

  const acceptedLine =
    acceptedAt != null
      ? `Je hebt offerte ${quoteNumber} getekend op ${new Date(acceptedAt).toLocaleDateString('nl-NL')}.`
      : `Je hebt offerte ${quoteNumber} getekend.`;

  return `Beste ${prospectName},

${acceptedLine} De volgende stap is het kickoff-gesprek.

Plan op een moment dat je schikt:
${kickoffUrl}

Of mail naar ${KLARIFAI_BUSINESS.email} als bellen beter past.

${sig}`;
}

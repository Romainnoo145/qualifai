/**
 * Transactional acceptance confirmation email sent to the customer immediately
 * after they sign an offerte.
 *
 * Includes a persistent Cal.com kickoff booking link with the engagement ID
 * embedded as metadata so the webhook can update kickoffBookedAt automatically.
 *
 * Design constraints (per DESIGN.md + memory):
 * - Solid gold (#E4C33C) rectangle CTA — NOT the brochure pill gradient
 * - Navy (#0a0a2e) body text, Sora font stack
 * - Romano's email signature via getEmailSignature('klarifai')
 * - Trust signals: Klarifai logo, from info@klarifai.nl, KVK present in signature
 */

import { Resend } from 'resend';
import { getEmailSignature } from '@/components/clients/klarifai/email-signature';

const NAVY = '#0a0a2e';
const GOLD = '#E4C33C';
const BG = '#f7f5ef';
const SURFACE = '#ffffff';
const BORDER = 'rgba(10, 10, 46, 0.08)';
const MUTED = '#6b6f8a';
const FONT_STACK =
  "'Sora', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

interface AcceptanceEmailArgs {
  /** Customer-facing display name — company name or signer name */
  prospectName: string;
  /** Offerte nummer (e.g. "KLF-2026-001") */
  quoteNumber: string;
  /** Cal.com URL with ?metadata[engagementId]=<id> appended */
  kickoffUrl: string;
}

function buildAcceptanceEmailHtml(args: AcceptanceEmailArgs): string {
  const { prospectName, quoteNumber, kickoffUrl } = args;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://qualifai.klarifai.nl';
  const logoUrl = `${appUrl}/klarifai-logo-full.svg`;
  const sig = getEmailSignature('klarifai').html;

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Bevestiging offerte ${quoteNumber}</title>
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
        OFFERTE GEACCEPTEERD
      </p>

      <!-- Heading -->
      <h1 style="margin:0 0 16px;font-family:${FONT_STACK};font-size:26px;font-weight:700;line-height:1.2;letter-spacing:-0.015em;color:${NAVY};">
        Bedankt voor je vertrouwen<span style="color:${GOLD};">.</span>
      </h1>

      <!-- Intro -->
      <p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:15px;font-weight:400;line-height:1.55;color:${NAVY};">
        Beste ${prospectName},
      </p>

      <p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:15px;font-weight:400;line-height:1.55;color:${NAVY};">
        Je akkoord op offerte <strong>${quoteNumber}</strong> is binnen.
        De volgende stap is een kickoff-gesprek — we lopen de aanpak door,
        beantwoorden vragen en leggen de planning vast.
      </p>

      <p style="margin:0 0 32px;font-family:${FONT_STACK};font-size:15px;font-weight:400;line-height:1.55;color:${NAVY};">
        Plan op een moment dat schikt — geen haast, de link blijft werken:
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
        <a href="mailto:info@klarifai.nl" style="color:${NAVY};text-decoration:none;">info@klarifai.nl</a>
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

function buildAcceptanceEmailText(args: AcceptanceEmailArgs): string {
  const { prospectName, quoteNumber, kickoffUrl } = args;
  const sig = getEmailSignature('klarifai').text;

  return `Beste ${prospectName},

Je akkoord op offerte ${quoteNumber} is binnen. Bedankt voor je vertrouwen.

De volgende stap is een kickoff-gesprek. Plan op een moment dat schikt:
${kickoffUrl}

Of mail naar info@klarifai.nl als bellen beter past.

${sig}`;
}

export interface SendAcceptanceEmailOptions {
  to: string;
  prospectName: string;
  quoteNumber: string;
  kickoffUrl: string;
}

export async function sendAcceptanceEmail(
  options: SendAcceptanceEmailOptions,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[acceptance-email] RESEND_API_KEY not set — skipping email');
    return;
  }

  const { to, prospectName, quoteNumber, kickoffUrl } = options;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from =
    process.env.OUTREACH_FROM_EMAIL ?? 'Romano Kanters <info@klarifai.nl>';
  const replyTo = process.env.OUTREACH_REPLY_TO_EMAIL ?? 'info@klarifai.nl';

  const args: AcceptanceEmailArgs = { prospectName, quoteNumber, kickoffUrl };

  await resend.emails.send({
    from,
    to: [to],
    subject: `Bevestiging offerte ${quoteNumber} — plan je kickoff`,
    html: buildAcceptanceEmailHtml(args),
    text: buildAcceptanceEmailText(args),
    replyTo,
  });
}

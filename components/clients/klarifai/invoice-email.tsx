/**
 * Invoice email template with anti-phishing trust signals.
 *
 * Strategy: PDF carries the actual factuur. Email body is the trust-bridge —
 * it reassures the recipient this is legitimate by summarizing key fields
 * (factuurnummer, totaal, IBAN, KVK) so klant can sanity-check at a glance
 * before opening the attachment. If intercepted/spoofed, body fields wouldn't
 * match the PDF — that's a phishing-detection mechanism we get for free.
 *
 * Trust signals included:
 * - From info@klarifai.nl (Resend verified domain)
 * - Klarifai logo/wordmark in header
 * - Explicit reference to original offerte
 * - KVK + BTW in footer (redundancy is intentional)
 * - IBAN clearly shown so klant can cross-reference with PDF
 * - Romano's signature appended
 */

import type { Invoice, Engagement, Quote, Prospect } from '@prisma/client';
import { getEmailSignature } from '@/components/clients/klarifai/email-signature';
import { KLARIFAI_BUSINESS } from '@/lib/klarifai-business';

interface InvoiceEmailInput {
  invoice: Invoice;
  engagement: Engagement & { quote: Quote; prospect: Prospect };
}

const formatEur = (cents: number) =>
  (cents / 100).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' });

export function buildInvoiceEmailSubject(input: InvoiceEmailInput): string {
  const { invoice, engagement } = input;
  const klant =
    engagement.prospect.companyName ?? engagement.prospect.domain ?? '';
  return `Factuur ${invoice.invoiceNumber} — ${invoice.termijnLabel} — ${klant}`;
}

export function buildInvoiceEmailHtml(input: InvoiceEmailInput): string {
  const { invoice, engagement } = input;
  const subtotalCents = invoice.amountCents;
  const vatCents = Math.round(subtotalCents * (invoice.vatPercentage / 100));
  const totalCents = subtotalCents + vatCents;
  const klant = engagement.prospect.companyName ?? 'lezer';
  const sig = getEmailSignature('klarifai').html;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://qualifai.klarifai.nl';
  const logoUrl = `${appUrl}/klarifai-logo-full.svg`;

  const NAVY = '#0a0a2e';
  const GOLD = '#E4C33C';
  const MUTED = '#6b6f8a';
  const BG_LIGHT = '#FFF9E5';
  const BORDER_GOLD = '#E4C33C';
  const FONT_STACK =
    "'Sora', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Factuur ${invoice.invoiceNumber}</title>
</head>
<body style="font-family: ${FONT_STACK}; color: ${NAVY}; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9f8f6;">
  <div style="background: white; border-radius: 8px; padding: 32px 24px;">

    <!-- Logo header with gold underline -->
    <div style="border-bottom: 2px solid ${GOLD}; padding-bottom: 16px; margin-bottom: 24px;">
      <img src="${logoUrl}" alt="Klarifai" width="120" height="32" style="display: block; height: 32px; width: auto;" />
    </div>

    <!-- Greeting -->
    <p style="margin: 0 0 16px; font-size: 15px; font-weight: 400; line-height: 1.55;">
      Beste ${klant},
    </p>

    <!-- Intro paragraph -->
    <p style="margin: 0 0 24px; font-size: 15px; font-weight: 400; line-height: 1.55;">
      Naar aanleiding van onze offerte${engagement.quote.nummer ? ` <strong>${engagement.quote.nummer}</strong>` : ''} —
      bij deze de termijnfactuur <strong>${invoice.invoiceNumber}</strong> voor
      <strong>${invoice.termijnLabel.toLowerCase()}</strong>.
    </p>

    <!-- Invoice details box -->
    <div style="background: ${BG_LIGHT}; border: 1px solid ${BORDER_GOLD}; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <table style="width: 100%; font-size: 14px; line-height: 1.8; border-collapse: collapse;">
        <tr>
          <td style="color: ${MUTED}; padding: 6px 0;">Factuurnummer:</td>
          <td style="text-align: right; padding: 6px 0;"><strong>${invoice.invoiceNumber}</strong></td>
        </tr>
        ${
          engagement.quote.nummer
            ? `
        <tr>
          <td style="color: ${MUTED}; padding: 6px 0;">Conform offerte:</td>
          <td style="text-align: right; padding: 6px 0;">${engagement.quote.nummer}</td>
        </tr>
        `
            : ''
        }
        <tr>
          <td style="color: ${MUTED}; padding: 6px 0;">Termijn:</td>
          <td style="text-align: right; padding: 6px 0;">${invoice.termijnLabel}</td>
        </tr>
        <tr style="border-top: 1px solid rgba(228, 195, 60, 0.3);">
          <td style="color: ${MUTED}; padding: 6px 0;">Subtotaal:</td>
          <td style="text-align: right; padding: 6px 0;">${formatEur(subtotalCents)}</td>
        </tr>
        <tr>
          <td style="color: ${MUTED}; padding: 6px 0;">BTW ${invoice.vatPercentage}%:</td>
          <td style="text-align: right; padding: 6px 0;">${formatEur(vatCents)}</td>
        </tr>
        <tr>
          <td style="color: ${NAVY}; padding: 6px 0; font-weight: 600;">Totaal incl. BTW:</td>
          <td style="text-align: right; padding: 6px 0; font-weight: 600; color: ${NAVY};">${formatEur(totalCents)}</td>
        </tr>
      </table>
    </div>

    <!-- Payment instructions -->
    <p style="margin: 24px 0 12px; font-size: 15px; font-weight: 400; line-height: 1.55;">
      De volledige factuur zit als PDF bijgevoegd. Gelieve binnen 30 dagen over te maken naar:
    </p>

    <div style="background: #f8f9fb; padding: 16px; border-radius: 6px; margin: 16px 0; font-size: 14px; line-height: 1.7;">
      <strong>IBAN:</strong> ${KLARIFAI_BUSINESS.iban}<br/>
      <strong>T.n.v.:</strong> ${KLARIFAI_BUSINESS.name}<br/>
      <strong>O.v.v.:</strong> ${invoice.invoiceNumber}
    </div>

    <!-- Contact info -->
    <p style="margin: 24px 0 0; font-size: 13px; color: ${MUTED}; line-height: 1.6;">
      Vragen over de factuur? Mail naar
      <a href="mailto:${KLARIFAI_BUSINESS.email}" style="color: ${NAVY}; text-decoration: none;">${KLARIFAI_BUSINESS.email}</a>
      of bel ${KLARIFAI_BUSINESS.phone}.
    </p>

    <!-- Footer: Business identifiers -->
    <p style="font-size: 11px; color: ${MUTED}; margin-top: 32px; padding-top: 16px; border-top: 1px solid rgba(107, 111, 138, 0.2);">
      KVK ${KLARIFAI_BUSINESS.kvk} &nbsp;·&nbsp; BTW ${KLARIFAI_BUSINESS.btw}
    </p>

    <!-- Signature -->
    <div style="padding: 0 4px;">
      ${sig}
    </div>

  </div>
</body>
</html>`;
}

export function buildInvoiceEmailText(input: InvoiceEmailInput): string {
  const { invoice, engagement } = input;
  const subtotalCents = invoice.amountCents;
  const vatCents = Math.round(subtotalCents * (invoice.vatPercentage / 100));
  const totalCents = subtotalCents + vatCents;
  const klant = engagement.prospect.companyName ?? 'lezer';
  const sig = getEmailSignature('klarifai').text;

  let text = `Beste ${klant},

Naar aanleiding van onze offerte${engagement.quote.nummer ? ` ${engagement.quote.nummer}` : ''} —
bij deze de termijnfactuur ${invoice.invoiceNumber} voor ${invoice.termijnLabel.toLowerCase()}.

FACTUURDETAILS
Factuurnummer: ${invoice.invoiceNumber}`;

  if (engagement.quote.nummer) {
    text += `\nOfferte: ${engagement.quote.nummer}`;
  }

  text += `
Termijn: ${invoice.termijnLabel}
Subtotaal: ${formatEur(subtotalCents)}
BTW ${invoice.vatPercentage}%: ${formatEur(vatCents)}
TOTAAL INCL. BTW: ${formatEur(totalCents)}

BETALING
IBAN: ${KLARIFAI_BUSINESS.iban}
T.n.v.: ${KLARIFAI_BUSINESS.name}
O.v.v.: ${invoice.invoiceNumber}

De volledige factuur zit als PDF bijgevoegd. Gelieve binnen 30 dagen over te maken.

Vragen? Mail naar ${KLARIFAI_BUSINESS.email} of bel ${KLARIFAI_BUSINESS.phone}.

KVK ${KLARIFAI_BUSINESS.kvk} · BTW ${KLARIFAI_BUSINESS.btw}

${sig}`;

  return text;
}

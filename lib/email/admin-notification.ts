/**
 * Klarifai-branded HTML template for admin notification emails (offerte
 * viewed / accepted). Email-client safe: inline styles only, web-safe font
 * fallback chain, table-free layout that renders cleanly in Gmail / Outlook
 * / Apple Mail.
 */

interface BaseInput {
  companyName: string;
  quoteNummer: string;
  timestamp: Date;
  adminUrl: string;
  logoUrl: string;
}

type Input =
  | (BaseInput & { type: 'viewed' })
  | (BaseInput & { type: 'accepted'; total: string });

const NAVY = '#040026';
const NAVY_SOFT = '#0a0a2e';
const GOLD_MID = '#e1c33c';
const GOLD_LIGHT = '#fdf97b';
const BG = '#f7f5ef';
const SURFACE = '#ffffff';
const BORDER = 'rgba(10, 10, 46, 0.08)';
const MUTED = '#6b6f8a';
const FONT_STACK =
  "'Sora', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

function formatTimestamp(d: Date): string {
  return d.toLocaleString('nl-NL', {
    timeZone: 'Europe/Amsterdam',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function detailRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid ${BORDER};font-family:${FONT_STACK};font-size:11px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:${MUTED};width:38%;vertical-align:top;">${label}</td>
      <td style="padding:14px 0;border-bottom:1px solid ${BORDER};font-family:${FONT_STACK};font-size:15px;font-weight:500;color:${NAVY};text-align:right;vertical-align:top;">${value}</td>
    </tr>
  `;
}

export function renderAdminNotificationEmail(input: Input): string {
  const isViewed = input.type === 'viewed';
  const sectionNumber = isViewed ? '01' : '02';
  const sectionLabel = isViewed ? 'OFFERTE GEOPEND' : 'OFFERTE GEACCEPTEERD';
  const heading = isViewed
    ? `${input.companyName} heeft je voorstel geopend`
    : `${input.companyName} heeft getekend`;
  const intro = isViewed
    ? 'Eerste signal dat de prospect bezig is met je voorstel. Volg op binnen 24 uur — een snelle reactie verhoogt de kans op akkoord aanzienlijk.'
    : 'Akkoord binnen. Tijd om de eerste factuur (30%) te versturen en de kick-off te plannen. Alle handtekening- en akkoord-data staat in admin.';
  const ctaLabel = isViewed ? 'Bekijk in admin' : 'Open offerte in admin';

  const detailRows = [
    detailRow('Bedrijf', input.companyName),
    detailRow('Offerte', input.quoteNummer),
    detailRow(
      isViewed ? 'Geopend op' : 'Geaccepteerd op',
      formatTimestamp(input.timestamp),
    ),
    !isViewed && 'total' in input
      ? detailRow('Totaal incl. BTW', input.total)
      : '',
  ].join('');

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${sectionLabel}</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:${FONT_STACK};-webkit-font-smoothing:antialiased;">
  <div style="max-width:560px;margin:0 auto;padding:48px 24px 64px;">

    <!-- Logo -->
    <div style="text-align:center;margin-bottom:48px;">
      <img src="${input.logoUrl}" alt="Klarifai" width="40" height="40" style="display:inline-block;width:40px;height:40px;" />
    </div>

    <!-- Card -->
    <div style="background:${SURFACE};border:1px solid ${BORDER};border-radius:16px;padding:40px 36px;">

      <!-- Section label -->
      <p style="margin:0 0 18px;font-family:${FONT_STACK};font-size:11px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:${MUTED};">
        <span style="color:${GOLD_MID};">[ ${sectionNumber} ]</span>
        <span style="margin-left:10px;">${sectionLabel}</span>
      </p>

      <!-- Heading -->
      <h1 style="margin:0 0 16px;font-family:${FONT_STACK};font-size:26px;font-weight:700;line-height:1.2;letter-spacing:-0.015em;color:${NAVY};">
        ${heading}<span style="color:${GOLD_MID};">.</span>
      </h1>

      <!-- Intro -->
      <p style="margin:0 0 32px;font-family:${FONT_STACK};font-size:15px;font-weight:400;line-height:1.55;color:${MUTED};">
        ${intro}
      </p>

      <!-- Details table -->
      <table style="width:100%;border-collapse:collapse;margin:0 0 32px;">
        <tbody>
          ${detailRows}
        </tbody>
      </table>

      <!-- CTA -->
      <a href="${input.adminUrl}" style="display:block;text-align:center;background:linear-gradient(180deg, ${GOLD_MID} 0%, ${GOLD_LIGHT} 100%);color:${NAVY};text-decoration:none;font-family:${FONT_STACK};font-size:14px;font-weight:700;letter-spacing:-0.005em;padding:16px 24px;border-radius:9999px;box-shadow:0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(225, 195, 60, 0.25);">
        ${ctaLabel} →
      </a>

    </div>

    <!-- Footer -->
    <p style="margin:32px 0 0;text-align:center;font-family:${FONT_STACK};font-size:12px;font-weight:400;color:${MUTED};line-height:1.6;">
      Automatische notificatie van Qualifai<br/>
      <span style="color:${NAVY_SOFT};opacity:0.6;">klarifai.nl</span>
    </p>

  </div>
</body>
</html>`;
}

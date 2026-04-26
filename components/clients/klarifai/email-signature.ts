/**
 * Per-project email signatures appended to outbound mails.
 * HTML version mirrors Romano's actual Gmail signature for visual parity
 * (recipients can't tell the email isn't sent from Gmail).
 *
 * Plain-text version is rendered as a fallback for clients that strip HTML.
 */

export type SignatureProject = 'klarifai';

interface Signature {
  html: string;
  text: string;
}

function klarifaiSignature(appUrl: string): Signature {
  const logoUrl = `${appUrl}/klarifai-logo-full.svg`;
  const linkColor = '#0a0a2e';
  const muted = '#6b6f8a';
  const fontStack =
    "'Sora', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  const html = `
<table cellspacing="0" cellpadding="0" border="0" style="margin-top:32px;border-top:1px solid #e5e7eb;padding-top:20px;font-family:${fontStack};color:${linkColor};">
  <tr>
    <td style="padding-right:20px;vertical-align:top;">
      <img src="${logoUrl}" alt="Klarifai" width="120" height="32" style="display:block;height:32px;width:auto;" />
    </td>
    <td style="vertical-align:top;border-left:1px solid #e5e7eb;padding-left:20px;font-size:13px;line-height:1.55;">
      <div style="font-weight:600;color:${linkColor};">Romano Kanters</div>
      <div style="color:${muted};font-weight:400;">Owner | Workflow Consultant</div>
      <div style="margin-top:10px;color:${muted};font-weight:400;">
        Klarifai | Copifai | Propdex<br/>
        Le Mairekade 77 | 1013 CB | Amsterdam<br/>
        <a href="tel:+31682326128" style="color:${linkColor};text-decoration:none;">(+31) 6 823 26 128</a>
      </div>
      <div style="margin-top:10px;">
        <a href="https://klarifai.nl" style="color:${linkColor};text-decoration:none;">klarifai.nl</a>
        <span style="color:${muted};">|</span>
        <a href="https://copifai.nl" style="color:${linkColor};text-decoration:none;">copifai.nl</a>
        <span style="color:${muted};">|</span>
        <a href="https://propdex.nl" style="color:${linkColor};text-decoration:none;">propdex.nl</a>
        <span style="color:${muted};">|</span>
        <a href="https://www.linkedin.com/in/romanokanters/" style="color:${linkColor};text-decoration:none;">LinkedIn</a>
      </div>
    </td>
  </tr>
</table>`.trim();

  const text = `
--
Romano Kanters
Owner | Workflow Consultant

Klarifai | Copifai | Propdex
Le Mairekade 77 | 1013 CB | Amsterdam
(+31) 6 823 26 128

klarifai.nl | copifai.nl | propdex.nl
linkedin.com/in/romanokanters/`.trim();

  return { html, text };
}

export function getEmailSignature(
  project: SignatureProject = 'klarifai',
): Signature {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://qualifai.klarifai.nl';
  switch (project) {
    case 'klarifai':
      return klarifaiSignature(appUrl);
  }
}

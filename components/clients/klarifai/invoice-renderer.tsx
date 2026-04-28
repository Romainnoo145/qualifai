import type {
  Engagement,
  Invoice,
  Prospect,
  Quote,
  QuoteLine,
} from '@prisma/client';
import { KLARIFAI_BUSINESS } from '@/lib/klarifai-business';

export interface InvoiceRenderInput {
  invoice: Invoice;
  engagement: Engagement & {
    quote: Quote & { lines: QuoteLine[] };
    prospect: Prospect;
  };
}

const formatEur = (cents: number) =>
  (cents / 100).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' });

const formatDateNl = (d: Date | string) =>
  new Date(d).toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

export function InvoiceRenderer({ invoice, engagement }: InvoiceRenderInput) {
  const subtotalCents = invoice.amountCents;
  const vatCents = Math.round(subtotalCents * (invoice.vatPercentage / 100));
  const totalCents = subtotalCents + vatCents;
  const factuurDatum = invoice.sentAt ?? invoice.createdAt;
  const vervalDatum = invoice.dueAt;

  // Klant naam — prefer companyName, fall back to domain
  const klantNaam =
    engagement.prospect.companyName ?? engagement.prospect.domain ?? '';

  return (
    <html lang="nl">
      <head>
        <meta charSet="utf-8" />
        <title>{`Factuur ${invoice.invoiceNumber}`}</title>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;500;700&display=swap');
          @page { size: A4; margin: 0; }
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Sora', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #0a0a2e;
            padding: 24mm;
            font-size: 11px;
            line-height: 1.6;
            background: #fff;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .logo {
            font-size: 24px;
            font-weight: 700;
            color: #0a0a2e;
            letter-spacing: -0.5px;
          }
          .logo .gold { color: #E4C33C; }
          .business-info {
            font-size: 10px;
            line-height: 1.7;
            text-align: right;
            color: #6b6f8a;
          }
          .doc-title {
            font-size: 36px;
            font-weight: 700;
            margin-top: 36px;
            color: #0a0a2e;
          }
          .doc-title .gold { color: #E4C33C; }
          .divider {
            border: none;
            border-top: 1px solid #e5e7eb;
            margin: 20px 0;
          }
          .meta {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            font-size: 11px;
          }
          .meta-label {
            font-size: 9px;
            font-weight: 500;
            color: #6b6f8a;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 4px;
          }
          .meta-value { font-weight: 500; color: #0a0a2e; }
          .meta-row { display: flex; gap: 8px; margin-bottom: 2px; }
          .meta-key { color: #6b6f8a; min-width: 120px; }
          table.lines {
            width: 100%;
            border-collapse: collapse;
            margin-top: 32px;
            font-size: 11px;
          }
          table.lines thead tr {
            border-bottom: 2px solid #0a0a2e;
          }
          table.lines th {
            padding: 8px 10px;
            text-align: left;
            font-weight: 500;
            font-size: 9px;
            color: #6b6f8a;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }
          table.lines td {
            padding: 12px 10px;
            border-bottom: 1px solid #f0f0f4;
          }
          .totals-wrapper {
            display: flex;
            justify-content: flex-end;
            margin-top: 20px;
          }
          .totals {
            width: 280px;
          }
          .totals .row {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            font-size: 11px;
            color: #6b6f8a;
          }
          .totals .row.grand {
            border-top: 2px solid #0a0a2e;
            padding-top: 10px;
            margin-top: 6px;
            font-weight: 700;
            font-size: 14px;
            color: #0a0a2e;
          }
          .payment-box {
            margin-top: 40px;
            padding: 16px 20px;
            border: 1px solid #E4C33C;
            border-radius: 8px;
            background: #fffbeb;
            font-size: 11px;
          }
          .payment-box strong { color: #0a0a2e; font-weight: 600; }
          .payment-box p { margin-top: 8px; color: #3a3a5c; line-height: 1.6; }
          footer {
            margin-top: 48px;
            font-size: 9px;
            color: #6b6f8a;
            border-top: 1px solid #e5e7eb;
            padding-top: 12px;
            display: flex;
            gap: 16px;
          }
          footer span::before { content: '·'; margin-right: 16px; }
          footer span:first-child::before { content: ''; margin-right: 0; }
        `}</style>
      </head>
      <body>
        {/* Header: logo + business info */}
        <div className="header">
          <div className="logo">
            {KLARIFAI_BUSINESS.name}
            <span className="gold">.</span>
          </div>
          <div className="business-info">
            {KLARIFAI_BUSINESS.street}
            <br />
            {KLARIFAI_BUSINESS.postal} {KLARIFAI_BUSINESS.city}
            <br />
            KVK {KLARIFAI_BUSINESS.kvk}
            <br />
            BTW {KLARIFAI_BUSINESS.btw}
            <br />
            {KLARIFAI_BUSINESS.email}
          </div>
        </div>

        {/* Document title */}
        <h1 className="doc-title">
          Factuur
          <span className="gold">.</span>
        </h1>

        <hr className="divider" />

        {/* Meta grid: aan / factuurdetails */}
        <div className="meta">
          <div>
            <div className="meta-label">Aan</div>
            <div className="meta-value">{klantNaam}</div>
          </div>
          <div>
            <div className="meta-row">
              <span className="meta-key">Factuurnummer</span>
              <span>{invoice.invoiceNumber}</span>
            </div>
            <div className="meta-row">
              <span className="meta-key">Factuurdatum</span>
              <span>{formatDateNl(factuurDatum)}</span>
            </div>
            {vervalDatum && (
              <div className="meta-row">
                <span className="meta-key">Vervaldatum</span>
                <span>{formatDateNl(vervalDatum)}</span>
              </div>
            )}
            {engagement.quote.nummer && (
              <div className="meta-row">
                <span className="meta-key">Conform offerte</span>
                <span>{engagement.quote.nummer}</span>
              </div>
            )}
          </div>
        </div>

        {/* Line items */}
        <table className="lines">
          <thead>
            <tr>
              <th>Omschrijving</th>
              <th style={{ textAlign: 'right' }}>Bedrag (excl. BTW)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{invoice.termijnLabel}</td>
              <td style={{ textAlign: 'right' }}>{formatEur(subtotalCents)}</td>
            </tr>
          </tbody>
        </table>

        {/* Totals */}
        <div className="totals-wrapper">
          <div className="totals">
            <div className="row">
              <span>Subtotaal</span>
              <span>{formatEur(subtotalCents)}</span>
            </div>
            <div className="row">
              <span>BTW {invoice.vatPercentage}%</span>
              <span>{formatEur(vatCents)}</span>
            </div>
            <div className="row grand">
              <span>Totaal</span>
              <span>{formatEur(totalCents)}</span>
            </div>
          </div>
        </div>

        {/* Payment instructions */}
        <div className="payment-box">
          <strong>Betaalinstructie</strong>
          <p>
            Gelieve {formatEur(totalCents)} binnen 30 dagen over te maken naar{' '}
            <strong>{KLARIFAI_BUSINESS.iban}</strong> t.n.v.{' '}
            {KLARIFAI_BUSINESS.name}, o.v.v. factuurnummer{' '}
            <strong>{invoice.invoiceNumber}</strong>.
          </p>
        </div>

        {/* Footer */}
        <footer>
          <span>{KLARIFAI_BUSINESS.email}</span>
          <span>KVK {KLARIFAI_BUSINESS.kvk}</span>
          <span>BTW {KLARIFAI_BUSINESS.btw}</span>
          <span>IBAN {KLARIFAI_BUSINESS.iban}</span>
        </footer>
      </body>
    </html>
  );
}

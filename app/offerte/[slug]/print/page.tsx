// NOTE: For fully clean PDF export (no browser header/footer showing date + URL),
// instruct the user to uncheck "Headers and footers" in the Chrome print dialog
// (More settings → uncheck "Headers and footers"). The title override below
// ensures that when headers ARE shown they display a clean document name like
// "Offerte 2026-OFF002" instead of the layout's generic "Klarifai — Voorstel".

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import prisma from '@/lib/prisma';
import { prettifyDomainToName } from '@/lib/enrichment/company-name';
import { PrintTrigger } from './print-trigger';
import type { PaymentInstallment } from '@/lib/quote-defaults';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const prospect = await prisma.prospect.findFirst({
    where: { readableSlug: slug },
    select: {
      id: true,
      quotes: {
        where: { isActiveProposal: true },
        select: { nummer: true },
        take: 1,
      },
    },
  });
  const nummer = prospect?.quotes[0]?.nummer ?? slug;
  return { title: `Offerte ${nummer}` };
}

// ─── brand tokens (hardcoded — CSS vars don't survive print stylesheets reliably)
const NAVY = '#0a0a2e';
const GOLD = '#E4C33C';
const GREY = '#E5E5EA';
const MUTED = '#5A6878';
const LIGHT_BORDER = '#D1D5DB';

// ─── formatting helpers
function formatEuroNL(amount: number): string {
  return new Intl.NumberFormat('nl-NL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDateNL(date: Date): string {
  return date.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateShortNL(date: Date): string {
  return date.toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ─── signature field — used in the two-column signature block
function SignatureField({
  label,
  prefilled,
  signatureHeight = false,
}: {
  label: string;
  prefilled?: string;
  signatureHeight?: boolean;
}) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div
        style={{
          fontSize: '9px',
          fontWeight: 500,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: MUTED,
          marginBottom: '6px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          minHeight: signatureHeight ? '48px' : '24px',
          fontSize: '14px',
          fontWeight: 500,
          color: NAVY,
          paddingBottom: '4px',
        }}
      >
        {prefilled ?? ''}
      </div>
      <div style={{ borderBottom: `1px solid ${NAVY}`, width: '100%' }} />
    </div>
  );
}

// ─── main page

export default async function PrintPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const prospect = await prisma.prospect.findFirst({
    where: { readableSlug: slug },
    select: {
      id: true,
      companyName: true,
      domain: true,
      contacts: {
        select: {
          firstName: true,
          lastName: true,
        },
        orderBy: { firstName: 'asc' },
        take: 1,
      },
    },
  });

  if (!prospect) {
    notFound();
  }

  const activeQuote = await prisma.quote.findFirst({
    where: {
      prospectId: prospect.id,
      isActiveProposal: true,
    },
    include: {
      lines: { orderBy: { position: 'asc' } },
    },
  });

  if (!activeQuote) {
    notFound();
  }

  const displayName =
    (prospect.companyName && prospect.companyName.trim()) ||
    prettifyDomainToName(prospect.domain) ||
    slug;

  // ─── Totals
  const subtotal = activeQuote.lines.reduce(
    (acc, l) => acc + l.uren * l.tarief,
    0,
  );
  const btwAmount = subtotal * (activeQuote.btwPercentage / 100);
  const total = subtotal + btwAmount;

  // ─── Recipient address block
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recipientAddress = (activeQuote as any).recipientAddress as
    | string
    | null
    | undefined;

  let recipientLines: string[];
  if (recipientAddress && recipientAddress.trim()) {
    recipientLines = recipientAddress.split('\n');
  } else {
    // Fallback: company name + primary contact
    const contact = prospect.contacts[0];
    recipientLines = [
      displayName,
      ...(contact
        ? [`T.a.v. ${contact.firstName} ${contact.lastName}`.trim()]
        : []),
    ];
  }

  // ─── Payment schedule
  const hasSchedule =
    Array.isArray(activeQuote.paymentSchedule) &&
    (activeQuote.paymentSchedule as PaymentInstallment[]).length > 0;
  const schedule = hasSchedule
    ? (activeQuote.paymentSchedule as PaymentInstallment[])
    : [];

  // ─── Klant bedrijfsnaam for signature block
  const klantBedrijf =
    (recipientLines[0] && recipientLines[0].trim()) || displayName;

  return (
    <>
      <PrintTrigger />

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');

            @page {
              size: A4;
              margin: 18mm;
            }

            * {
              box-sizing: border-box;
            }

            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: ${NAVY};
              font-family: 'Sora', 'Helvetica Neue', Arial, sans-serif;
              font-size: 13px;
              line-height: 1.5;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .print-page {
              max-width: 720px;
              margin: 0 auto;
              padding: 0;
            }

            @media screen {
              .print-page {
                padding: 40px 24px 80px;
              }
            }

            @media print {
              body { background: white; }

              .print-section-voorwaarden {
                break-before: page;
                page-break-before: always;
              }

              .print-section-handtekening {
                break-inside: avoid;
                page-break-inside: avoid;
              }
            }

            /* typography */
            h1, h2, h3 { font-family: 'Sora', sans-serif; color: ${NAVY}; }

            /* table */
            table { width: 100%; border-collapse: collapse; }
            td, th { padding: 0; }
          `,
        }}
      />

      <div className="print-page">
        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* PAGE 1                                                            */}
        {/* ══════════════════════════════════════════════════════════════════ */}

        {/* ── TOP ROW: Logo left · Klarifai company info right ──────────── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '64px',
          }}
        >
          {/* Logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/klarifai-logo-full.png"
            alt="Klarifai"
            width={140}
            style={{ display: 'block' }}
          />

          {/* Company info block */}
          <div style={{ textAlign: 'right', lineHeight: 1.65 }}>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: NAVY,
                marginBottom: '4px',
              }}
            >
              Klarifai
            </div>
            <div style={{ fontSize: '11px', color: MUTED }}>
              Le Mairekade 77
            </div>
            <div
              style={{ fontSize: '11px', color: MUTED, marginBottom: '8px' }}
            >
              1013 CB Amsterdam
            </div>
            <div style={{ fontSize: '11px', color: MUTED }}>
              Btw-nummer: NL005136262B35
            </div>
            <div style={{ fontSize: '11px', color: MUTED }}>
              KVK-nummer: 95189335
            </div>
            <div style={{ fontSize: '11px', color: MUTED }}>
              Tel.: +31 (0)6 823 26128
            </div>
            <div style={{ fontSize: '11px', color: MUTED }}>
              Website: klarifai.nl
            </div>
            <div style={{ fontSize: '11px', color: MUTED }}>
              IBAN: NL54 FNOM 0541 6127 33
            </div>
            <div style={{ fontSize: '11px', color: MUTED }}>BIC: FNOMNL22</div>
          </div>
        </div>

        {/* ── RECIPIENT BLOCK ─────────────────────────────────────────────── */}
        <div style={{ marginBottom: '40px', width: '55%' }}>
          {recipientLines.map((line, i) => (
            <div
              key={i}
              style={{
                fontSize: '13px',
                fontWeight: i === 0 ? 600 : 400,
                color: NAVY,
                lineHeight: 1.65,
                whiteSpace: 'pre-wrap',
              }}
            >
              {line}
            </div>
          ))}
        </div>

        {/* ── OFFERTE META: Nummer left · Datums right ────────────────────── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: '12px',
            paddingBottom: '12px',
            borderBottom: `1px solid ${LIGHT_BORDER}`,
          }}
        >
          {/* Offerte nummer */}
          <div>
            <div
              style={{
                fontSize: '20px',
                fontWeight: 700,
                color: NAVY,
                letterSpacing: '-0.01em',
              }}
            >
              Offerte: {activeQuote.nummer}
              <span style={{ color: GOLD }}>.</span>
            </div>
          </div>

          {/* Datums right-aligned */}
          <div style={{ textAlign: 'right', lineHeight: 1.7 }}>
            <div style={{ fontSize: '11px', color: NAVY }}>
              <span style={{ color: MUTED }}>Offertedatum:</span>{' '}
              {formatDateShortNL(activeQuote.datum)}
            </div>
            <div style={{ fontSize: '11px', color: NAVY }}>
              <span style={{ color: MUTED }}>Vervaldatum:</span>{' '}
              {formatDateShortNL(activeQuote.geldigTot)}
            </div>
          </div>
        </div>

        {/* ── BETREFT ──────────────────────────────────────────────────────── */}
        {activeQuote.onderwerp && (
          <div style={{ fontSize: '12px', color: MUTED, marginBottom: '40px' }}>
            <span style={{ color: NAVY, fontWeight: 500 }}>Betreft:</span>{' '}
            {activeQuote.onderwerp}
          </div>
        )}

        {/* ── LINE ITEMS TABLE ──────────────────────────────────────────────── */}
        <table style={{ marginBottom: '20px' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${LIGHT_BORDER}` }}>
              <th
                style={{
                  width: '56px',
                  textAlign: 'left',
                  fontSize: '9px',
                  fontWeight: 500,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: MUTED,
                  paddingBottom: '8px',
                }}
              >
                Aantal
              </th>
              <th
                style={{
                  textAlign: 'left',
                  fontSize: '9px',
                  fontWeight: 500,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: MUTED,
                  paddingBottom: '8px',
                }}
              >
                Beschrijving
              </th>
              <th
                style={{
                  width: '130px',
                  textAlign: 'right',
                  fontSize: '9px',
                  fontWeight: 500,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: MUTED,
                  paddingBottom: '8px',
                }}
              >
                Bedrag excl. btw
              </th>
              <th
                style={{
                  width: '130px',
                  textAlign: 'right',
                  fontSize: '9px',
                  fontWeight: 500,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: MUTED,
                  paddingBottom: '8px',
                }}
              >
                Bedrag incl. btw
              </th>
            </tr>
          </thead>
          <tbody>
            {activeQuote.lines.map((line) => {
              const lineExcl = line.uren * line.tarief;
              const lineIncl = lineExcl * (1 + activeQuote.btwPercentage / 100);
              return (
                <tr key={line.id} style={{ borderBottom: `1px solid ${GREY}` }}>
                  {/* Aantal */}
                  <td
                    style={{
                      paddingTop: '12px',
                      paddingBottom: '12px',
                      paddingRight: '12px',
                      verticalAlign: 'top',
                      fontSize: '13px',
                      color: NAVY,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {line.uren}
                  </td>
                  {/* Beschrijving */}
                  <td
                    style={{
                      paddingTop: '12px',
                      paddingBottom: '12px',
                      paddingRight: '16px',
                      verticalAlign: 'top',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: NAVY,
                        marginBottom: line.omschrijving ? '3px' : 0,
                      }}
                    >
                      {line.fase}
                    </div>
                    {line.omschrijving && (
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 300,
                          color: MUTED,
                          lineHeight: 1.5,
                        }}
                      >
                        {line.omschrijving}
                      </div>
                    )}
                  </td>
                  {/* Bedrag excl. btw */}
                  <td
                    style={{
                      paddingTop: '12px',
                      paddingBottom: '12px',
                      textAlign: 'right',
                      verticalAlign: 'top',
                      fontSize: '13px',
                      color: NAVY,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    € {formatEuroNL(lineExcl)}
                  </td>
                  {/* Bedrag incl. btw */}
                  <td
                    style={{
                      paddingTop: '12px',
                      paddingBottom: '12px',
                      textAlign: 'right',
                      verticalAlign: 'top',
                      fontSize: '13px',
                      color: NAVY,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    € {formatEuroNL(lineIncl)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ── TOTALS BLOCK (right-aligned) ──────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '6px',
            marginBottom: '40px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              width: '300px',
              gap: '16px',
            }}
          >
            <span style={{ fontSize: '12px', color: MUTED }}>
              Totaalbedrag excl. btw
            </span>
            <span
              style={{
                fontSize: '12px',
                color: NAVY,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              € {formatEuroNL(subtotal)}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              width: '300px',
              gap: '16px',
            }}
          >
            <span style={{ fontSize: '12px', color: MUTED }}>
              Btw hoog ({activeQuote.btwPercentage}%)
            </span>
            <span
              style={{
                fontSize: '12px',
                color: NAVY,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              € {formatEuroNL(btwAmount)}
            </span>
          </div>
          {/* Separator */}
          <div style={{ width: '300px', height: '1px', background: NAVY }} />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              width: '300px',
              gap: '16px',
              alignItems: 'baseline',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 700, color: NAVY }}>
              Totaalbedrag incl. btw
            </span>
            <span
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: NAVY,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              € <span style={{ color: GOLD }}>{formatEuroNL(total)}</span>
            </span>
          </div>
        </div>

        {/* ── CLOSING LINE ─────────────────────────────────────────────────── */}
        <div
          style={{
            fontSize: '12px',
            fontWeight: 300,
            color: NAVY,
            lineHeight: 1.6,
            marginBottom: '48px',
          }}
        >
          Deze offerte is geldig tot {formatDateNL(activeQuote.geldigTot)},
          indien je akkoord gaat met deze offerte kun je deze getekend
          terugsturen of digitaal ondertekenen.
        </div>

        {/* ── PAGE 1 FOOTER ────────────────────────────────────────────────── */}
        <div
          style={{
            textAlign: 'center',
            fontSize: '10px',
            color: MUTED,
            paddingTop: '16px',
            borderTop: `1px solid ${GREY}`,
          }}
        >
          Pagina 1 / 2
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* PAGE 2 — forced page break                                        */}
        {/* ══════════════════════════════════════════════════════════════════ */}

        <div className="print-section-voorwaarden" style={{ paddingTop: '0' }}>
          {/* ── VOORWAARDEN ─────────────────────────────────────────────────── */}
          <div style={{ marginBottom: '40px' }}>
            <div
              style={{
                fontSize: '9px',
                fontWeight: 500,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: MUTED,
                marginBottom: '16px',
              }}
            >
              Voorwaarden
            </div>

            {/* Betalingsschema — compact, only when set */}
            {hasSchedule &&
              (() => {
                const scheduleTotal = schedule.reduce(
                  (acc, r) => acc + r.percentage,
                  0,
                );
                const fmtCurrency = (n: number) =>
                  new Intl.NumberFormat('nl-NL', {
                    style: 'currency',
                    currency: 'EUR',
                  }).format(n);
                return (
                  <div style={{ marginBottom: '20px' }}>
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 500,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: MUTED,
                        marginBottom: '8px',
                      }}
                    >
                      Betalingsschema
                    </div>
                    <table style={{ marginBottom: '4px' }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${GREY}` }}>
                          <th
                            style={{
                              textAlign: 'left',
                              fontSize: '9px',
                              fontWeight: 500,
                              letterSpacing: '0.1em',
                              textTransform: 'uppercase',
                              color: MUTED,
                              paddingBottom: '6px',
                              paddingRight: '16px',
                            }}
                          >
                            Termijn
                          </th>
                          <th
                            style={{
                              textAlign: 'right',
                              fontSize: '9px',
                              fontWeight: 500,
                              letterSpacing: '0.1em',
                              textTransform: 'uppercase',
                              color: MUTED,
                              paddingBottom: '6px',
                              paddingRight: '16px',
                              width: '40px',
                            }}
                          >
                            %
                          </th>
                          <th
                            style={{
                              textAlign: 'right',
                              fontSize: '9px',
                              fontWeight: 500,
                              letterSpacing: '0.1em',
                              textTransform: 'uppercase',
                              color: MUTED,
                              paddingBottom: '6px',
                              width: '110px',
                            }}
                          >
                            Bedrag
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {schedule.map((item, idx) => {
                          const bedrag = total * (item.percentage / 100);
                          const num = String(idx + 1).padStart(2, '0');
                          const termijnText = item.dueOn
                            ? `${item.label} · ${item.dueOn}`
                            : item.label;
                          return (
                            <tr
                              key={idx}
                              style={{ borderBottom: `1px solid ${GREY}` }}
                            >
                              <td
                                style={{
                                  paddingTop: '6px',
                                  paddingBottom: '6px',
                                  paddingRight: '16px',
                                  verticalAlign: 'middle',
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    color: GOLD,
                                    marginRight: '6px',
                                  }}
                                >
                                  {num}·
                                </span>
                                <span
                                  style={{
                                    fontSize: '12px',
                                    fontWeight: 300,
                                    color: NAVY,
                                  }}
                                >
                                  {termijnText}
                                </span>
                              </td>
                              <td
                                style={{
                                  paddingTop: '6px',
                                  paddingBottom: '6px',
                                  paddingRight: '16px',
                                  textAlign: 'right',
                                  fontSize: '12px',
                                  color: NAVY,
                                  fontVariantNumeric: 'tabular-nums',
                                  verticalAlign: 'middle',
                                }}
                              >
                                {item.percentage}%
                              </td>
                              <td
                                style={{
                                  paddingTop: '6px',
                                  paddingBottom: '6px',
                                  textAlign: 'right',
                                  fontSize: '12px',
                                  fontWeight: 500,
                                  color: NAVY,
                                  fontVariantNumeric: 'tabular-nums',
                                  verticalAlign: 'middle',
                                }}
                              >
                                {fmtCurrency(bedrag)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: `1px solid ${GREY}` }}>
                          <td
                            style={{
                              paddingTop: '6px',
                              fontSize: '12px',
                              fontWeight: 700,
                              color: NAVY,
                            }}
                          >
                            Totaal
                          </td>
                          <td
                            style={{
                              paddingTop: '6px',
                              textAlign: 'right',
                              fontSize: '12px',
                              fontWeight: 700,
                              color: NAVY,
                              fontVariantNumeric: 'tabular-nums',
                              paddingRight: '16px',
                            }}
                          >
                            {scheduleTotal}%
                          </td>
                          <td
                            style={{
                              paddingTop: '6px',
                              textAlign: 'right',
                              fontSize: '12px',
                              fontWeight: 700,
                              color: NAVY,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {fmtCurrency(total)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })()}

            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '9px',
              }}
            >
              {[
                hasSchedule
                  ? 'Betaling in termijnen volgens bovenstaand schema.'
                  : 'Betaaltermijn 14 dagen na factuurdatum.',
                `Intellectueel eigendom gaat over naar ${displayName} na volledige betaling.`,
                '60 dagen garantie op opgeleverd werk.',
                'Een op maat gemaakte verwerkersovereenkomst volgt samen met het contract, binnen 5 werkdagen na akkoord.',
                'Algemene voorwaarden zijn van toepassing. Zie klarifai.nl/legal/terms-and-conditions.',
              ].map((term) => (
                <li
                  key={term}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    fontSize: '12px',
                    fontWeight: 300,
                    color: NAVY,
                    lineHeight: 1.55,
                  }}
                >
                  <span style={{ color: GOLD, fontWeight: 700, flexShrink: 0 }}>
                    —
                  </span>
                  <span>{term}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* ── VOOR AKKOORD: 2-column signature block ───────────────────────── */}
          <div
            className="print-section-handtekening"
            style={{ marginBottom: '56px' }}
          >
            <div
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: NAVY,
                marginBottom: '24px',
              }}
            >
              Voor akkoord:
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                columnGap: '48px',
              }}
            >
              {/* Left: Klarifai */}
              <div>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: NAVY,
                    marginBottom: '16px',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Klarifai
                </div>
                <SignatureField label="Naam" prefilled="Romano Kanters" />
                <SignatureField label="Bedrijf" prefilled="Klarifai" />
                <SignatureField label="Datum" />
                <SignatureField label="Plaats" />
                <SignatureField label="Handtekening" signatureHeight />
              </div>

              {/* Right: Klant */}
              <div>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: NAVY,
                    marginBottom: '16px',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Klant
                </div>
                <SignatureField label="Naam" />
                <SignatureField label="Bedrijf" prefilled={klantBedrijf} />
                <SignatureField label="Datum" />
                <SignatureField label="Plaats" />
                <SignatureField label="Handtekening" signatureHeight />
              </div>
            </div>
          </div>

          {/* ── PAGE 2 FOOTER ────────────────────────────────────────────────── */}
          <div
            style={{
              textAlign: 'center',
              fontSize: '10px',
              color: MUTED,
              paddingTop: '16px',
              borderTop: `1px solid ${GREY}`,
            }}
          >
            Pagina 2 / 2
          </div>
        </div>
      </div>
    </>
  );
}

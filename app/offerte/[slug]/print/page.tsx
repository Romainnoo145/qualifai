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

  // ─── Recipient block — 4 structured fields (may all be null → fallback)
  const recipientCompany = activeQuote.recipientCompany ?? null;
  const recipientContact = activeQuote.recipientContact ?? null;
  const recipientStreet = activeQuote.recipientStreet ?? null;
  const recipientCity = activeQuote.recipientCity ?? null;

  const hasAnyRecipientField = !!(
    recipientCompany ||
    recipientContact ||
    recipientStreet ||
    recipientCity
  );

  // Fallback when all 4 fields are empty
  const fallbackContact = prospect.contacts[0];
  const fallbackName = displayName;
  const fallbackContactLine = fallbackContact
    ? `T.a.v. ${fallbackContact.firstName} ${fallbackContact.lastName}`.trim()
    : null;

  // ─── Payment schedule
  const hasSchedule =
    Array.isArray(activeQuote.paymentSchedule) &&
    (activeQuote.paymentSchedule as PaymentInstallment[]).length > 0;
  const schedule = hasSchedule
    ? (activeQuote.paymentSchedule as PaymentInstallment[])
    : [];

  // ─── Klant bedrijfsnaam for signature block
  const klantBedrijf =
    (hasAnyRecipientField ? recipientCompany : null) ?? displayName;

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
          {hasAnyRecipientField ? (
            <>
              {recipientCompany && (
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: NAVY,
                    lineHeight: 1.65,
                  }}
                >
                  {recipientCompany}
                </div>
              )}
              {recipientContact && (
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 400,
                    color: NAVY,
                    lineHeight: 1.65,
                  }}
                >
                  T.a.v. {recipientContact}
                </div>
              )}
              {recipientStreet && (
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 400,
                    color: NAVY,
                    lineHeight: 1.65,
                  }}
                >
                  {recipientStreet}
                </div>
              )}
              {recipientCity && (
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 400,
                    color: NAVY,
                    lineHeight: 1.65,
                  }}
                >
                  {recipientCity}
                </div>
              )}
            </>
          ) : (
            <>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: NAVY,
                  lineHeight: 1.65,
                }}
              >
                {fallbackName}
              </div>
              {fallbackContactLine && (
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 400,
                    color: NAVY,
                    lineHeight: 1.65,
                  }}
                >
                  {fallbackContactLine}
                </div>
              )}
            </>
          )}
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
              € {formatEuroNL(total)}
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
            {/* Betalingsschema — compact table, only when set */}
            {hasSchedule && (
              <div style={{ marginBottom: '24px' }}>
                <div
                  style={{
                    fontSize: '9px',
                    fontWeight: 500,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: MUTED,
                    marginBottom: '10px',
                  }}
                >
                  Betalingsschema
                </div>

                <table style={{ marginBottom: 0 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${LIGHT_BORDER}` }}>
                      <th
                        style={{
                          textAlign: 'left',
                          fontSize: '9px',
                          fontWeight: 500,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          color: MUTED,
                          paddingBottom: '6px',
                        }}
                      >
                        Moment
                      </th>
                      <th
                        style={{
                          width: '48px',
                          textAlign: 'right',
                          fontSize: '9px',
                          fontWeight: 500,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          color: MUTED,
                          paddingBottom: '6px',
                        }}
                      >
                        %
                      </th>
                      <th
                        style={{
                          width: '120px',
                          textAlign: 'right',
                          fontSize: '9px',
                          fontWeight: 500,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          color: MUTED,
                          paddingBottom: '6px',
                        }}
                      >
                        Bedrag
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((item, idx) => {
                      const bedrag = total * (item.percentage / 100);
                      return (
                        <tr
                          key={idx}
                          style={{ borderBottom: `1px solid ${LIGHT_BORDER}` }}
                        >
                          <td
                            style={{
                              paddingTop: '6px',
                              paddingBottom: '6px',
                              paddingRight: '16px',
                              verticalAlign: 'top',
                            }}
                          >
                            <div
                              style={{
                                fontSize: '12px',
                                fontWeight: 500,
                                color: NAVY,
                                lineHeight: 1.4,
                              }}
                            >
                              {item.label}
                            </div>
                            {item.dueOn && (
                              <div
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 300,
                                  color: MUTED,
                                  lineHeight: 1.4,
                                  marginTop: '1px',
                                }}
                              >
                                {item.dueOn}
                              </div>
                            )}
                          </td>
                          <td
                            style={{
                              paddingTop: '6px',
                              paddingBottom: '6px',
                              textAlign: 'right',
                              verticalAlign: 'top',
                              fontSize: '12px',
                              fontWeight: 400,
                              color: NAVY,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {item.percentage}%
                          </td>
                          <td
                            style={{
                              paddingTop: '6px',
                              paddingBottom: '6px',
                              textAlign: 'right',
                              verticalAlign: 'top',
                              fontSize: '12px',
                              fontWeight: 400,
                              color: NAVY,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            € {formatEuroNL(bedrag)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

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

            <ol
              style={{
                margin: 0,
                padding: 0,
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '9px',
              }}
            >
              {(
                [
                  hasSchedule
                    ? {
                        keyword: 'Betaling:',
                        body: 'in termijnen volgens bovenstaand schema.',
                      }
                    : {
                        keyword: 'Betaaltermijn:',
                        body: '14 dagen na factuurdatum.',
                      },
                  {
                    keyword: 'Eigendom:',
                    body: `intellectueel eigendom gaat over naar ${displayName} na volledige betaling.`,
                  },
                  {
                    keyword: 'Garantie:',
                    body: '60 dagen op opgeleverd werk.',
                  },
                  {
                    keyword: 'Verwerkersovereenkomst:',
                    body: 'binnen 5 werkdagen na akkoord, samen met het contract.',
                  },
                  {
                    keyword: 'Algemene voorwaarden:',
                    body: null, // rendered with link below
                  },
                ] as { keyword: string; body: string | null }[]
              ).map((term, idx) => (
                <li
                  key={term.keyword}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    fontSize: '12px',
                    fontWeight: 300,
                    color: NAVY,
                    lineHeight: 1.55,
                  }}
                >
                  <span
                    style={{
                      color: GOLD,
                      fontWeight: 700,
                      flexShrink: 0,
                      fontVariantNumeric: 'tabular-nums',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      minWidth: '20px',
                      paddingTop: '1px',
                    }}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span>
                    <span style={{ fontWeight: 600 }}>{term.keyword}</span>{' '}
                    {term.body !== null ? (
                      term.body
                    ) : (
                      <>
                        zie{' '}
                        <a
                          href="https://klarifai.nl/legal/terms-and-conditions"
                          style={{ color: NAVY }}
                        >
                          klarifai.nl/legal/terms-and-conditions
                        </a>
                        .
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ol>
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

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

// ─── sub-components

function SectionLabel({ num, label }: { num: string; label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '10px',
        fontWeight: 500,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        marginBottom: '18px',
      }}
    >
      <span style={{ color: GOLD }}>[{num}]</span>
      <span style={{ color: NAVY }}>{label}</span>
    </div>
  );
}

function GoldPeriodHeading({
  children,
  size = 28,
}: {
  children: React.ReactNode;
  size?: number;
}) {
  return (
    <h2
      style={{
        fontSize: `${size}px`,
        fontWeight: 700,
        letterSpacing: '-0.02em',
        color: NAVY,
        margin: '0 0 20px',
        lineHeight: 1.1,
      }}
    >
      {children}
      <span style={{ color: GOLD }}>.</span>
    </h2>
  );
}

// ─── signature field — used in the grid-aligned signature block
// Each field has a fixed-height pre-filled slot so empty and filled cells
// take identical vertical space, keeping rows aligned across columns.

function SignatureField({
  label,
  prefilled,
}: {
  label: string;
  prefilled?: string;
}) {
  return (
    <div style={{ paddingBottom: '24px' }}>
      {/* Eyebrow label */}
      <div
        style={{
          fontSize: '9px',
          fontWeight: 500,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: MUTED,
          marginBottom: '8px',
        }}
      >
        {label}
      </div>
      {/* Pre-filled text slot — minHeight reserves space even when empty */}
      <div
        style={{
          minHeight: '24px',
          fontSize: '15px',
          fontWeight: 500,
          color: NAVY,
          marginBottom: '8px',
        }}
      >
        {prefilled ?? ''}
      </div>
      {/* Underline */}
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

  const subtotal = activeQuote.lines.reduce(
    (acc, l) => acc + l.uren * l.tarief,
    0,
  );
  const btwAmount = subtotal * (activeQuote.btwPercentage / 100);
  const total = subtotal + btwAmount;

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
              font-size: 14px;
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
            }

            /* typography */
            h1, h2, h3 { font-family: 'Sora', sans-serif; color: ${NAVY}; }

            /* table */
            table { width: 100%; border-collapse: collapse; }
            td, th { padding: 0; }

            /* utilities */
            .text-muted { color: ${MUTED}; }
            .text-gold  { color: ${GOLD}; }
            .font-mono  { font-family: 'Courier New', Courier, monospace; }
          `,
        }}
      />

      <div className="print-page">
        {/* ── HEADER ───────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '40px',
            paddingBottom: '24px',
            borderBottom: `1px solid ${GREY}`,
          }}
        >
          {/* Left: logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/klarifai-logo-full.png"
            alt="Klarifai"
            width={150}
            height="auto"
            style={{ marginTop: '4px' }}
          />

          {/* Right: quote nummer */}
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: '9px',
                fontWeight: 500,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: GOLD,
                marginBottom: '4px',
              }}
            >
              Offertenummer
            </div>
            <div
              className="font-mono"
              style={{ fontSize: '15px', fontWeight: 600, color: NAVY }}
            >
              #{activeQuote.nummer}
            </div>
          </div>
        </div>

        {/* ── TITLE BLOCK ──────────────────────────────────────────────── */}
        <div style={{ marginBottom: '36px' }}>
          <h1
            style={{
              fontSize: '48px',
              fontWeight: 700,
              letterSpacing: '-0.028em',
              color: NAVY,
              margin: '0 0 10px',
              lineHeight: 1.05,
            }}
          >
            Offerte<span style={{ color: GOLD }}>.</span>
          </h1>
          <div
            style={{
              width: '80px',
              height: '1px',
              background: GOLD,
            }}
          />
        </div>

        {/* ── META ROW ─────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '24px',
            marginBottom: '44px',
            paddingBottom: '28px',
            borderBottom: `1px solid ${GREY}`,
          }}
        >
          {[
            { label: 'Datum', value: formatDateNL(activeQuote.datum) },
            { label: 'Geldig tot', value: formatDateNL(activeQuote.geldigTot) },
            { label: 'Status', value: activeQuote.status },
          ].map(({ label, value }) => (
            <div key={label}>
              <div
                style={{
                  fontSize: '9px',
                  fontWeight: 500,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: GOLD,
                  marginBottom: '6px',
                }}
              >
                {label}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: NAVY }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* ── INTRODUCTIE ──────────────────────────────────────────────── */}
        {activeQuote.introductie && activeQuote.introductie.trim() && (
          <div style={{ marginBottom: '44px' }}>
            <p
              style={{
                fontSize: '16px',
                fontWeight: 300,
                lineHeight: 1.6,
                color: NAVY,
                margin: 0,
              }}
            >
              {activeQuote.introductie}
            </p>
          </div>
        )}

        {/* ── INVESTERING ──────────────────────────────────────────────── */}
        <div style={{ marginBottom: '48px' }}>
          <SectionLabel num="01" label="Investering" />
          <GoldPeriodHeading size={28}>Het prijsvoorstel</GoldPeriodHeading>

          {/* Line items */}
          <table style={{ marginBottom: '24px' }}>
            <thead>
              <tr
                style={{
                  borderBottom: `1px solid ${GREY}`,
                  paddingBottom: '10px',
                }}
              >
                <th
                  style={{
                    width: '32px',
                    textAlign: 'left',
                    fontSize: '9px',
                    fontWeight: 500,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: MUTED,
                    paddingBottom: '10px',
                  }}
                >
                  #
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    fontSize: '9px',
                    fontWeight: 500,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: MUTED,
                    paddingBottom: '10px',
                  }}
                >
                  Fase
                </th>
                <th
                  style={{
                    width: '60px',
                    textAlign: 'right',
                    fontSize: '9px',
                    fontWeight: 500,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: MUTED,
                    paddingBottom: '10px',
                  }}
                >
                  Uren
                </th>
                <th
                  style={{
                    width: '100px',
                    textAlign: 'right',
                    fontSize: '9px',
                    fontWeight: 500,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: MUTED,
                    paddingBottom: '10px',
                  }}
                >
                  Bedrag
                </th>
              </tr>
            </thead>
            <tbody>
              {activeQuote.lines.map((line, i) => {
                const lineTotal = line.uren * line.tarief;
                return (
                  <tr
                    key={line.id}
                    style={{ borderBottom: `1px solid ${GREY}` }}
                  >
                    <td
                      style={{
                        paddingTop: '14px',
                        paddingBottom: '14px',
                        verticalAlign: 'top',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 700,
                          color: GOLD,
                        }}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </td>
                    <td
                      style={{
                        paddingTop: '14px',
                        paddingBottom: '14px',
                        paddingRight: '16px',
                        verticalAlign: 'top',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 600,
                          color: NAVY,
                          marginBottom: '4px',
                        }}
                      >
                        {line.fase}
                      </div>
                      {line.omschrijving && (
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: 300,
                            color: MUTED,
                            lineHeight: 1.5,
                          }}
                        >
                          {line.omschrijving}
                        </div>
                      )}
                    </td>
                    <td
                      style={{
                        paddingTop: '14px',
                        paddingBottom: '14px',
                        textAlign: 'right',
                        verticalAlign: 'top',
                        fontSize: '14px',
                        color: NAVY,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {line.uren}
                    </td>
                    <td
                      style={{
                        paddingTop: '14px',
                        paddingBottom: '14px',
                        textAlign: 'right',
                        verticalAlign: 'top',
                        fontSize: '14px',
                        color: NAVY,
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 500,
                      }}
                    >
                      € {formatEuroNL(lineTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totals block */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: '8px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                width: '280px',
              }}
            >
              <span style={{ fontSize: '13px', color: MUTED }}>
                Subtotaal excl. BTW
              </span>
              <span
                style={{
                  fontSize: '13px',
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
                width: '280px',
              }}
            >
              <span style={{ fontSize: '13px', color: MUTED }}>
                BTW ({activeQuote.btwPercentage}%)
              </span>
              <span
                style={{
                  fontSize: '13px',
                  color: NAVY,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                € {formatEuroNL(btwAmount)}
              </span>
            </div>
            {/* Separator */}
            <div style={{ width: '280px', height: '2px', background: NAVY }} />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                width: '280px',
                alignItems: 'baseline',
              }}
            >
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: NAVY,
                  letterSpacing: '-0.01em',
                }}
              >
                Totaal incl. BTW
              </span>
              <span
                style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  color: NAVY,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.02em',
                }}
              >
                <span style={{ color: NAVY }}>€</span> {formatEuroNL(total)}
              </span>
            </div>
          </div>
        </div>

        {/* ── AKKOORD / VOORWAARDEN ─────────────────────────────────────── */}
        <div
          style={{
            marginBottom: '48px',
            paddingTop: '32px',
            borderTop: `1px solid ${GREY}`,
          }}
        >
          <SectionLabel num="02" label="Akkoord" />
          <GoldPeriodHeading size={22}>Voorwaarden</GoldPeriodHeading>

          {/* Betalingsschema — only shown when schedule is set */}
          {Array.isArray(activeQuote.paymentSchedule) &&
            (activeQuote.paymentSchedule as PaymentInstallment[]).length > 0 &&
            (() => {
              const schedule =
                activeQuote.paymentSchedule as PaymentInstallment[];
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
                <div style={{ marginBottom: '24px' }}>
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 500,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: GOLD,
                      marginBottom: '12px',
                    }}
                  >
                    Betalingsschema
                  </div>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      marginBottom: '4px',
                    }}
                  >
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${GREY}` }}>
                        <th
                          style={{
                            textAlign: 'left',
                            fontSize: '10px',
                            fontWeight: 500,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            color: MUTED,
                            paddingBottom: '8px',
                            paddingRight: '16px',
                          }}
                        >
                          Termijn
                        </th>
                        <th
                          style={{
                            textAlign: 'right',
                            fontSize: '10px',
                            fontWeight: 500,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            color: MUTED,
                            paddingBottom: '8px',
                            paddingRight: '16px',
                            width: '48px',
                          }}
                        >
                          %
                        </th>
                        <th
                          style={{
                            textAlign: 'right',
                            fontSize: '10px',
                            fontWeight: 500,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            color: MUTED,
                            paddingBottom: '8px',
                            width: '120px',
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
                            style={{ borderBottom: `1px solid ${GREY}` }}
                          >
                            <td
                              style={{
                                paddingTop: '10px',
                                paddingBottom: '10px',
                                paddingRight: '16px',
                                verticalAlign: 'top',
                              }}
                            >
                              <div
                                style={{
                                  fontSize: '13px',
                                  fontWeight: 500,
                                  color: NAVY,
                                }}
                              >
                                {item.label}
                              </div>
                              <div
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 300,
                                  color: MUTED,
                                  marginTop: '2px',
                                }}
                              >
                                {item.dueOn}
                              </div>
                            </td>
                            <td
                              style={{
                                paddingTop: '10px',
                                paddingBottom: '10px',
                                paddingRight: '16px',
                                textAlign: 'right',
                                fontSize: '13px',
                                color: NAVY,
                                fontVariantNumeric: 'tabular-nums',
                                verticalAlign: 'top',
                              }}
                            >
                              {item.percentage}%
                            </td>
                            <td
                              style={{
                                paddingTop: '10px',
                                paddingBottom: '10px',
                                textAlign: 'right',
                                fontSize: '13px',
                                fontWeight: 500,
                                color: NAVY,
                                fontVariantNumeric: 'tabular-nums',
                                verticalAlign: 'top',
                              }}
                            >
                              {fmtCurrency(bedrag)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td
                          style={{
                            paddingTop: '10px',
                            fontSize: '13px',
                            fontWeight: 700,
                            color: NAVY,
                          }}
                        >
                          Totaal
                        </td>
                        <td
                          style={{
                            paddingTop: '10px',
                            textAlign: 'right',
                            fontSize: '13px',
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
                            paddingTop: '10px',
                            textAlign: 'right',
                            fontSize: '13px',
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
              gap: '10px',
            }}
          >
            {[
              Array.isArray(activeQuote.paymentSchedule) &&
              (activeQuote.paymentSchedule as PaymentInstallment[]).length > 0
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
                  fontSize: '13px',
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

        {/* ── HANDTEKENING ─────────────────────────────────────────────── */}
        <div
          style={{
            marginBottom: '56px',
            paddingTop: '32px',
            borderTop: `1px solid ${GREY}`,
          }}
        >
          <SectionLabel num="03" label="Handtekening" />
          <GoldPeriodHeading size={22}>Voor akkoord</GoldPeriodHeading>

          {/* Sub-labels: one per column, side by side */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              columnGap: '48px',
              marginBottom: '20px',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 300, color: MUTED }}>
              Voor akkoord namens{' '}
              <strong style={{ color: NAVY }}>{displayName}</strong>
            </div>
            <div style={{ fontSize: '12px', fontWeight: 300, color: MUTED }}>
              Voor akkoord namens{' '}
              <strong style={{ color: NAVY }}>Klarifai</strong>
            </div>
          </div>

          {/*
           * Signature grid: 2 columns × 3 rows.
           * Items flow left-to-right: [NAAM left] [NAAM right] [HANDTEKENING left] …
           * Every row is sized to its tallest cell — the minHeight on the pre-filled
           * slot in SignatureField ensures the empty left cell matches the filled
           * right cell (Romano Kanters), keeping underlines perfectly aligned.
           */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              columnGap: '48px',
              rowGap: '0',
            }}
          >
            {/* Row 1: NAAM */}
            <SignatureField label="Naam" />
            <SignatureField label="Naam" prefilled="Romano Kanters" />

            {/* Row 2: HANDTEKENING */}
            <SignatureField label="Handtekening" />
            <SignatureField label="Handtekening" />

            {/* Row 3: DATUM */}
            <SignatureField label="Datum" />
            <SignatureField label="Datum" />
          </div>
        </div>

        {/* ── FOOTER ───────────────────────────────────────────────────── */}
        <div
          style={{
            paddingTop: '20px',
            borderTop: `1px solid ${GREY}`,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '20px',
          }}
        >
          {/* Column 1 — Klarifai (Address + Contact) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div
              style={{
                fontSize: '9px',
                fontWeight: 500,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: GOLD,
                marginBottom: '4px',
              }}
            >
              Klarifai
            </div>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}
            >
              <span style={{ fontSize: '10px', color: MUTED }}>
                Le Mairekade 77
              </span>
              <span style={{ fontSize: '10px', color: MUTED }}>
                1013 CB Amsterdam
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                marginTop: '8px',
              }}
            >
              <span style={{ fontSize: '10px', color: MUTED }}>
                +31 (0)6 823 26128
              </span>
              <span style={{ fontSize: '10px', color: MUTED }}>
                info@klarifai.nl
              </span>
              <span style={{ fontSize: '10px', color: MUTED }}>
                klarifai.nl
              </span>
            </div>
          </div>

          {/* Column 2 — Fiscaal (KvK + BTW) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div
              style={{
                fontSize: '9px',
                fontWeight: 500,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: GOLD,
                marginBottom: '4px',
              }}
            >
              Fiscaal
            </div>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}
            >
              <span style={{ fontSize: '10px', color: MUTED }}>
                KvK 95189335
              </span>
              <span style={{ fontSize: '10px', color: MUTED }}>
                BTW NL005136262B35
              </span>
            </div>
          </div>

          {/* Column 3 — Bank (IBAN + BIC) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div
              style={{
                fontSize: '9px',
                fontWeight: 500,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: GOLD,
                marginBottom: '4px',
              }}
            >
              Bank
            </div>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}
            >
              <span style={{ fontSize: '10px', color: MUTED }}>
                IBAN NL54 FNOM 0541 6127 33
              </span>
              <span style={{ fontSize: '10px', color: MUTED }}>
                BIC FNOMNL22
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

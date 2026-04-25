'use client';

import type React from 'react';
import { useRef, useEffect, useState, useCallback } from 'react';

import {
  NAVY,
  CONTAINER_GRADIENT,
  CONTAINER_BORDER,
  GOLD_GRADIENT,
  GOLD_LIGHT,
  GOLD_MID,
  TEXT_ON_NAVY,
  TEXT_MUTED_ON_NAVY,
  pageBase,
} from '@/lib/brochure-tokens';
import {
  BrandChrome,
  ProgressIndicator,
  GeometricBackdrop,
  NextArrow,
  BackArrow,
} from '@/components/shared/brochure-chrome';

/**
 * Client-facing offerte brochure (7-page click-through).
 *
 * Per DESIGN.md §3.1 + §4:
 * - Cover (page 1) = the Klarifai intro video, play-once, freeze on last frame
 * - Page 2+ = content pages against the Klarifai brand (navy + gold + Sora)
 * - All pages share: top-right progress indicator, gold next-arrow bottom-right,
 *   grey back-arrow bottom-left, keyboard ← → navigation
 * - Visual continuity with the video: dark navy backgrounds, same gold gradient,
 *   subtle geometric backdrop echoing the video's motion graphics
 */

// Page identifiers — order within each mode array determines navigation order
type PageId =
  | 'cover'
  | 'uitdaging'
  | 'aanpak'
  | 'investering'
  | 'scope'
  | 'signing'
  | 'bevestigd';

const VOORSTEL_PAGES: PageId[] = ['cover', 'uitdaging', 'aanpak', 'scope'];
const OFFERTE_PAGES: PageId[] = ['investering', 'signing', 'bevestigd'];

interface BrochureProspect {
  id: string;
  companyName: string;
  logoUrl: string | null;
  domain: string | null;
}

export type BrochureQuote = {
  nummer: string;
  onderwerp: string;
  btwPercentage: number;
  introductie: string | null;
  uitdaging: string | null;
  aanpak: string | null;
  lines: {
    fase: string;
    omschrijving: string;
    uren: number;
    tarief: number;
  }[];
} | null;

export function BrochureCover({
  slug,
  prospect,
  quote,
  mode,
}: {
  slug: string;
  prospect: BrochureProspect;
  quote?: BrochureQuote;
  mode: 'voorstel' | 'offerte';
}) {
  const visiblePages: PageId[] =
    mode === 'offerte' ? OFFERTE_PAGES : VOORSTEL_PAGES;
  const totalPages = visiblePages.length;

  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const handleNext = useCallback(() => {
    setCurrentPage((p) => Math.min(p + 1, totalPages - 1));
  }, [totalPages]);

  const handleBack = useCallback(() => {
    setCurrentPage((p) => Math.max(p - 1, 0));
  }, []);

  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion && videoRef.current) {
      videoRef.current.removeAttribute('autoplay');
      videoRef.current.pause();
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handleBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleNext, handleBack]);

  useEffect(() => {
    if (!prospect?.id) return;
    fetch('/api/offerte/viewed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospectId: prospect.id }),
    }).catch(() => {});
  }, [prospect?.id]);

  const progressLabel = `${String(currentPage + 1).padStart(2, '0')} / ${String(totalPages).padStart(2, '0')}`;

  // visiblePages is always non-empty (VOORSTEL_PAGES / OFFERTE_PAGES both have ≥1 item)
  const pageId = (visiblePages[currentPage] ?? visiblePages[0]) as PageId;

  // Section numbering: computed from position within visiblePages (cover has no label).
  const visibleIndex = visiblePages.indexOf(pageId);
  const sectionLabel =
    visibleIndex >= 0 && pageId !== 'cover' ? `[ 0${visibleIndex + 1} ]` : '';

  if (pageId === 'cover') {
    return (
      <main style={pageBase}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          preload="auto"
          poster="/video/klarifai-intro-poster.jpg"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        >
          <source src="/video/klarifai-intro.mp4" type="video/mp4" />
        </video>
        <BrandChrome companyName={prospect.companyName} />
        <ProgressIndicator label={progressLabel} />
        <NextArrow onClick={handleNext} />
      </main>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: OFFERTE_RESPONSIVE_STYLES }} />
      {pageId === 'uitdaging' && (
        <Uitdaging
          onNext={handleNext}
          onBack={handleBack}
          progressLabel={progressLabel}
          sectionLabel={sectionLabel}
          prospect={prospect}
          quote={quote ?? null}
        />
      )}

      {pageId === 'aanpak' && (
        <Aanpak
          onNext={handleNext}
          onBack={handleBack}
          progressLabel={progressLabel}
          sectionLabel={sectionLabel}
          prospect={prospect}
          quote={quote ?? null}
        />
      )}

      {pageId === 'investering' && (
        <Investering
          onNext={handleNext}
          onBack={currentPage === 0 ? undefined : handleBack}
          progressLabel={progressLabel}
          sectionLabel={sectionLabel}
          prospect={prospect}
          quote={quote ?? null}
        />
      )}

      {pageId === 'scope' && (
        <Scope
          onNext={handleNext}
          onBack={handleBack}
          progressLabel={progressLabel}
          sectionLabel={sectionLabel}
          prospect={prospect}
        />
      )}

      {pageId === 'signing' && (
        <Signing
          onBack={handleBack}
          onNext={handleNext}
          progressLabel={progressLabel}
          sectionLabel={sectionLabel}
          prospect={prospect}
          quote={quote ?? null}
        />
      )}

      {pageId === 'bevestigd' && (
        <Bevestigd
          onBack={handleBack}
          progressLabel={progressLabel}
          sectionLabel={sectionLabel}
          prospect={prospect}
          slug={slug}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page 2 — De Uitdaging
// ─────────────────────────────────────────────────────────────────────────────

function Uitdaging({
  onNext,
  onBack,
  progressLabel,
  sectionLabel,
  prospect,
  quote,
}: {
  onNext: () => void;
  onBack: () => void;
  progressLabel: string;
  sectionLabel: string;
  prospect: BrochureProspect;
  quote: BrochureQuote;
}) {
  const pillars = [
    {
      num: '01',
      title: 'De rebuild',
      desc: 'Bestaande functionaliteit herbouwen op een architectuur die wél is ontworpen om mee te groeien.',
    },
    {
      num: '02',
      title: 'De aansluiting',
      desc: 'Website en platform als één samenhangend geheel — dezelfde taal, dezelfde look.',
    },
    {
      num: '03',
      title: 'De volgende stap',
      desc: 'Een basis waarop jullie team straks zelf nieuwe features kan uitrollen.',
    },
  ];

  return (
    <main
      className="offerte-main"
      style={{ ...pageBase, backgroundColor: NAVY }}
    >
      <GeometricBackdrop />
      <BrandChrome companyName={prospect.companyName} />
      <ProgressIndicator label={progressLabel} />

      {/* Viewport-fit content — hero statement top, 3 cards below */}
      <div
        className="offerte-page-content"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          padding: '120px 72px 128px',
          fontFamily: 'var(--font-sora), sans-serif',
          color: TEXT_ON_NAVY,
          zIndex: 1,
        }}
      >
        {/* Section label */}
        <div
          style={{
            fontWeight: 500,
            fontSize: '12px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <span
            style={{
              background: GOLD_GRADIENT,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 500,
            }}
          >
            {sectionLabel}
          </span>
          <span style={{ color: TEXT_ON_NAVY }}>De uitdaging</span>
        </div>

        {/* Hero statement — fills available space, vertically centered */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            maxWidth: '1200px',
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(36px, 5vw, 80px)',
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: '-0.03em',
              margin: 0,
              maxWidth: '1100px',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
            }}
          >
            {quote?.onderwerp || `${prospect.companyName} — De Uitdaging`}
            <span
              style={{
                background: GOLD_GRADIENT,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              .
            </span>
          </h1>
        </div>

        {/* Pillar cards — 3-column horizontal grid, or narrative text if quote provides it */}
        {quote?.uitdaging ? (
          <div
            style={{
              fontSize: '17px',
              fontWeight: 300,
              lineHeight: 1.6,
              color: TEXT_MUTED_ON_NAVY,
              maxWidth: '680px',
              whiteSpace: 'pre-wrap',
            }}
          >
            {quote.uitdaging}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '24px',
              maxWidth: '1280px',
            }}
          >
            {pillars.map((p) => (
              <div
                key={p.num}
                style={{
                  border: `1px solid ${CONTAINER_BORDER}`,
                  background: CONTAINER_GRADIENT,
                  borderRadius: '16px',
                  padding: '32px 32px 36px',
                  display: 'grid',
                  // Fixed row rhythm: number (auto), title (reserve 2 lines),
                  // description (starts at the same Y on every card, grows to
                  // the bottom). This guarantees the description baselines line
                  // up across cards even when titles wrap differently.
                  gridTemplateRows: 'auto 2.5em 1fr',
                  rowGap: '16px',
                  minHeight: '180px',
                }}
              >
                <div
                  style={{
                    fontSize: '44px',
                    fontWeight: 700,
                    lineHeight: 1,
                    background: GOLD_GRADIENT,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {p.num}
                </div>
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: 500,
                    color: TEXT_ON_NAVY,
                    letterSpacing: '-0.01em',
                    lineHeight: 1.25,
                    alignSelf: 'start',
                  }}
                >
                  {p.title}
                </div>
                <div
                  style={{
                    fontSize: '15px',
                    fontWeight: 300,
                    lineHeight: 1.55,
                    color: TEXT_MUTED_ON_NAVY,
                    alignSelf: 'start',
                  }}
                >
                  {p.desc}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BackArrow onClick={onBack} />
      <NextArrow onClick={onNext} />
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page 3 — Onze Aanpak (horizontal timeline)
// ─────────────────────────────────────────────────────────────────────────────

function Aanpak({
  onNext,
  onBack,
  progressLabel,
  sectionLabel,
  prospect,
  quote,
}: {
  onNext: () => void;
  onBack: () => void;
  progressLabel: string;
  sectionLabel: string;
  prospect: BrochureProspect;
  quote: BrochureQuote;
}) {
  const phases = [
    {
      num: '01',
      title: 'Discovery',
      subtitle: '& architectuur',
      desc: 'Requirements, wireframes, product brief. De basis waar de rest op rust.',
    },
    {
      num: '02',
      title: 'Design',
      subtitle: '& prototypes',
      desc: 'Visuele richting, interaction design, clickable prototypes voor feedback.',
    },
    {
      num: '03',
      title: 'Build',
      subtitle: '& iteratie',
      desc: 'Sprint-based development met wekelijkse demos en tussentijdse oplevering.',
    },
    {
      num: '04',
      title: 'Launch',
      subtitle: '& overdracht',
      desc: 'Polish, QA, documentatie, training en een schone overdracht aan het team.',
    },
  ];

  return (
    <main
      className="offerte-main"
      style={{ ...pageBase, backgroundColor: NAVY }}
    >
      <GeometricBackdrop />
      <BrandChrome companyName={prospect.companyName} />
      <ProgressIndicator label={progressLabel} />

      <div
        className="offerte-page-content"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          gridTemplateRows: 'auto auto 1fr',
          padding: '120px 72px 160px',
          fontFamily: 'var(--font-sora), sans-serif',
          color: TEXT_ON_NAVY,
          zIndex: 1,
          gap: '32px',
        }}
      >
        {/* Section label */}
        <div
          style={{
            fontWeight: 500,
            fontSize: '12px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <span
            style={{
              background: GOLD_GRADIENT,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 500,
            }}
          >
            {sectionLabel}
          </span>
          <span style={{ color: TEXT_ON_NAVY }}>Onze aanpak</span>
        </div>

        {/* Hero statement — smaller than page 2, timeline takes the rest */}
        <h1
          style={{
            fontSize: 'clamp(40px, 4.5vw, 68px)',
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '-0.025em',
            margin: 0,
            maxWidth: '1000px',
          }}
        >
          In vier stappen naar
          <br />
          een schaalbaar platform
          <span
            style={{
              background: GOLD_GRADIENT,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            .
          </span>
        </h1>

        {/* Timeline — 4 phases connected by a gold gradient line, or narrative text if quote provides it */}
        {quote?.aanpak ? (
          <div
            style={{
              fontSize: '17px',
              fontWeight: 300,
              lineHeight: 1.6,
              color: TEXT_MUTED_ON_NAVY,
              maxWidth: '680px',
              whiteSpace: 'pre-wrap',
            }}
          >
            {quote.aanpak}
          </div>
        ) : (
          <div
            style={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '24px',
              alignItems: 'start',
              paddingTop: '40px',
            }}
          >
            {/* Connecting line behind the numbered markers */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: '72px',
                left: 'calc(12.5% + 32px)',
                right: 'calc(12.5% + 32px)',
                height: '1px',
                background:
                  'linear-gradient(90deg, rgba(225,195,60,0) 0%, rgba(225,195,60,0.7) 20%, rgba(253,249,123,0.9) 50%, rgba(225,195,60,0.7) 80%, rgba(225,195,60,0) 100%)',
                zIndex: 0,
              }}
            />

            {phases.map((phase) => (
              <div
                key={phase.num}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '24px',
                  zIndex: 1,
                }}
              >
                {/* Numbered marker — Klarifai container gradient with gold number */}
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '9999px',
                    background: CONTAINER_GRADIENT,
                    border: `1px solid ${CONTAINER_BORDER}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: '-8px',
                    boxShadow: `0 0 0 6px ${NAVY}`,
                  }}
                >
                  <span
                    style={{
                      fontSize: '22px',
                      fontWeight: 700,
                      background: GOLD_GRADIENT,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {phase.num}
                  </span>
                </div>

                {/* Phase title + subtitle */}
                <div
                  style={{
                    fontSize: '22px',
                    fontWeight: 500,
                    lineHeight: 1.2,
                    letterSpacing: '-0.01em',
                    color: TEXT_ON_NAVY,
                  }}
                >
                  {phase.title}
                  <br />
                  <span style={{ color: TEXT_MUTED_ON_NAVY, fontWeight: 300 }}>
                    {phase.subtitle}
                  </span>
                </div>

                {/* Phase description */}
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 300,
                    lineHeight: 1.55,
                    color: TEXT_MUTED_ON_NAVY,
                    maxWidth: '260px',
                  }}
                >
                  {phase.desc}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BackArrow onClick={onBack} />
      <NextArrow onClick={onNext} />
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page 4 — Investering (split: phase breakdown + summary card)
// ─────────────────────────────────────────────────────────────────────────────

const OFFERTE_RESPONSIVE_STYLES = `
  /* Mobile scroll — overrides pageBase position:fixed on small viewports */
  @media (max-width: 768px) {
    .offerte-main {
      position: relative !important;
      overflow-y: auto !important;
      height: auto !important;
      min-height: 100vh !important;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none; /* Firefox */
    }
    .offerte-main::-webkit-scrollbar {
      display: none; /* WebKit / Chromium */
    }
  }

  /* Page content wrappers — release absolute positioning on mobile for natural flow */
  .offerte-page-content {
    position: absolute;
    inset: 0;
  }
  @media (max-width: 768px) {
    .offerte-page-content {
      position: relative !important;
      inset: auto !important;
      width: 100% !important;
      height: auto !important;
    }
  }

  .offerte-page-4 { padding: 120px 72px 160px; }
  @media (max-width: 1024px) {
    .offerte-page-4 { padding: 28px 40px !important; }
  }
  @media (max-width: 768px) {
    .offerte-page-4 { padding: 90px 24px 180px !important; }
  }

  .offerte-page-6 { padding: 120px 72px 160px; }
  @media (max-width: 1024px) {
    .offerte-page-6 { padding: 28px 40px !important; }
  }
  @media (max-width: 768px) {
    .offerte-page-6 { padding: 90px 24px 180px !important; }
  }

  .offerte-page-7 { padding: 120px 72px 160px; }
  @media (max-width: 1024px) {
    .offerte-page-7 { padding: 28px 40px !important; }
  }
  @media (max-width: 768px) {
    .offerte-page-7 { padding: 90px 24px 180px !important; }
  }

  .offerte-line-header {
    display: grid;
    grid-template-columns: 32px 1fr 64px 120px;
    gap: 16px;
  }
  .offerte-line-row {
    display: grid;
    grid-template-columns: 32px 1fr 64px 120px;
    gap: 16px;
    align-items: baseline;
  }
  .col-uren-bedrag { display: contents; }
  .col-uren-bedrag > div { text-align: right; }

  .offerte-investering-split {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
    gap: 48px;
  }

  .offerte-signing-split {
    display: grid;
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
    gap: 48px;
    align-items: start;
  }

  /* Bevestigd — 3-card grid */
  .offerte-bevestigd-steps {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
    max-width: 1000px;
    width: 100%;
    margin-top: 16px;
  }

  /* Bevestigd — action buttons */
  .offerte-bevestigd-actions {
    display: flex;
    gap: 16px;
    margin-top: 8px;
  }

  @media (max-width: 768px) {
    .offerte-signing-split {
      grid-template-columns: 1fr !important;
      gap: 24px !important;
    }
    .offerte-page-4 { padding: 90px 24px 180px !important; }
    .offerte-line-header { display: none !important; }
    .offerte-line-row {
      grid-template-columns: 1fr !important;
      gap: 8px !important;
      padding: 16px 0;
      border-bottom: 1px solid rgba(53, 59, 102, 0.55);
    }
    .offerte-line-row .col-omschrijving { font-weight: 600; }
    /* Issue 1: prevent description text from touching the right edge on mobile */
    .offerte-line-row .col-omschrijving .description-text {
      max-width: 85%;
    }
    .col-uren-bedrag {
      display: flex !important;
      justify-content: space-between;
      color: #898999;
      font-size: 13px;
    }
    .offerte-investering-split {
      grid-template-columns: 1fr !important;
      gap: 24px !important;
    }
    /* Issue 3: 3-card grid collapses to 1 column on mobile */
    .offerte-bevestigd-steps {
      grid-template-columns: 1fr !important;
      gap: 12px !important;
    }
    /* Issue 3: action buttons stack on mobile */
    .offerte-bevestigd-actions {
      flex-direction: column !important;
      align-items: stretch !important;
      gap: 12px !important;
    }
    .offerte-bevestigd-actions a {
      justify-content: center;
    }
  }
`;

function Investering({
  onNext,
  onBack,
  progressLabel,
  sectionLabel,
  prospect,
  quote,
}: {
  onNext: () => void;
  onBack?: () => void;
  progressLabel: string;
  sectionLabel: string;
  prospect: BrochureProspect;
  quote: BrochureQuote;
}) {
  const hasQuote = quote && quote.lines.length > 0;

  const lines = hasQuote
    ? quote.lines.map((l, i) => ({
        num: String(i + 1).padStart(2, '0'),
        fase: l.fase,
        desc: l.omschrijving,
        uren: l.uren,
        rate: l.tarief,
      }))
    : [
        {
          num: '—',
          fase: 'Voorstel in voorbereiding',
          desc: 'De offerte voor dit project wordt momenteel samengesteld.',
          uren: 0,
          rate: 0,
        },
      ];

  const btwPct = hasQuote ? quote.btwPercentage / 100 : 0.21;

  const fmt = (n: number) =>
    new Intl.NumberFormat('nl-NL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  const subtotal = lines.reduce((acc, l) => acc + l.uren * l.rate, 0);
  const vat = subtotal * btwPct;
  const total = subtotal + vat;
  const phase1 = total * 0.25;
  const phase2 = total * 0.5;
  const phase3 = total * 0.25;

  return (
    <main
      className="offerte-main"
      style={{ ...pageBase, backgroundColor: NAVY }}
    >
      <GeometricBackdrop />
      <BrandChrome companyName={prospect.companyName} />
      <ProgressIndicator label={progressLabel} />

      <div
        className="offerte-page-4 offerte-page-content"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          gridTemplateRows: 'auto auto 1fr',
          fontFamily: 'var(--font-sora), sans-serif',
          color: TEXT_ON_NAVY,
          zIndex: 1,
          gap: '32px',
        }}
      >
        {/* Section label */}
        <div
          style={{
            fontWeight: 500,
            fontSize: '12px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <span
            style={{
              background: GOLD_GRADIENT,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 500,
            }}
          >
            {sectionLabel}
          </span>
          <span style={{ color: TEXT_ON_NAVY }}>Investering</span>
        </div>

        {/* Hero statement */}
        <h1
          style={{
            fontSize: 'clamp(36px, 5vw, 64px)',
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '-0.025em',
            margin: 0,
            maxWidth: '900px',
          }}
        >
          Het prijsvoorstel
          <span
            style={{
              background: GOLD_GRADIENT,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            .
          </span>
        </h1>

        {/* Split: phase breakdown (left) + summary card (right) */}
        <div
          className="offerte-investering-split"
          style={{
            alignItems: 'start',
            paddingTop: '16px',
          }}
        >
          {/* LEFT — phase line items */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
            }}
          >
            <div
              className="offerte-line-header"
              style={{
                padding: '0 0 12px',
                fontSize: '10px',
                fontWeight: 500,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: TEXT_MUTED_ON_NAVY,
                borderBottom: `1px solid ${CONTAINER_BORDER}`,
              }}
            >
              <span />
              <span>Fase</span>
              <span style={{ textAlign: 'right' }}>Uren</span>
              <span style={{ textAlign: 'right' }}>Bedrag</span>
            </div>

            {lines.map((l) => (
              <div
                key={l.num}
                className="offerte-line-row"
                style={{
                  padding: '20px 0',
                  borderBottom: `1px solid ${CONTAINER_BORDER}`,
                }}
              >
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    background: GOLD_GRADIENT,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    letterSpacing: '0.02em',
                  }}
                >
                  {l.num}
                </span>
                <div className="col-omschrijving">
                  <div
                    style={{
                      fontSize: '17px',
                      fontWeight: 500,
                      color: TEXT_ON_NAVY,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {l.fase}
                  </div>
                  <div
                    className="description-text"
                    style={{
                      fontSize: '13px',
                      fontWeight: 300,
                      color: TEXT_MUTED_ON_NAVY,
                      marginTop: '4px',
                    }}
                  >
                    {l.desc}
                  </div>
                </div>
                <div className="col-uren-bedrag">
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 500,
                      color: TEXT_ON_NAVY,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {l.uren > 0 ? `${l.uren}u × €${l.rate}` : '—'}
                  </div>
                  <div
                    style={{
                      fontSize: '17px',
                      fontWeight: 500,
                      color: TEXT_ON_NAVY,
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {l.uren > 0 ? `€\u00a0${fmt(l.uren * l.rate)}` : '—'}
                  </div>
                </div>
              </div>
            ))}

            {/* Dagtarief note */}
            <div
              style={{
                fontSize: '12px',
                fontWeight: 300,
                color: TEXT_MUTED_ON_NAVY,
                marginTop: '20px',
                letterSpacing: '0.02em',
              }}
            >
              {hasQuote
                ? `Bedragen excl. BTW (${Math.round(quote.btwPercentage)}% BTW)`
                : 'Bedragen excl. BTW'}
            </div>
          </div>

          {/* RIGHT — summary card with totals + payment schedule */}
          <div
            style={{
              background: CONTAINER_GRADIENT,
              border: `1px solid ${CONTAINER_BORDER}`,
              borderRadius: '20px',
              padding: '32px 32px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            <div
              style={{
                fontSize: '10px',
                fontWeight: 500,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: TEXT_MUTED_ON_NAVY,
              }}
            >
              Samenvatting
            </div>

            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
            >
              <Row label="Subtotaal" value={`€ ${fmt(subtotal)}`} muted />
              <Row
                label={`BTW ${Math.round(btwPct * 100)}%`}
                value={`€ ${fmt(vat)}`}
                muted
              />
            </div>

            <div
              style={{
                borderTop: `1px solid ${CONTAINER_BORDER}`,
                paddingTop: '20px',
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 500,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: TEXT_MUTED_ON_NAVY,
                  marginBottom: '10px',
                }}
              >
                Totaal incl. BTW
              </div>
              <div
                style={{
                  fontSize: '40px',
                  fontWeight: 700,
                  lineHeight: 1,
                  letterSpacing: '-0.025em',
                  color: TEXT_ON_NAVY,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                €&nbsp;{fmt(total)}
              </div>
              <div
                style={{
                  height: '2px',
                  width: '72px',
                  background: GOLD_GRADIENT,
                  marginTop: '14px',
                  borderRadius: '2px',
                }}
              />
            </div>

            <div
              style={{
                borderTop: `1px solid ${CONTAINER_BORDER}`,
                paddingTop: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 500,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: TEXT_MUTED_ON_NAVY,
                  marginBottom: '4px',
                }}
              >
                Betaalschema
              </div>
              <Row label="25% bij start" value={`€ ${fmt(phase1)}`} />
              <Row label="50% bij oplevering" value={`€ ${fmt(phase2)}`} />
              <Row label="25% na acceptatie" value={`€ ${fmt(phase3)}`} />
            </div>
          </div>
        </div>
      </div>

      {onBack && <BackArrow onClick={onBack} />}
      <NextArrow onClick={onNext} />
    </main>
  );
}

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: '16px',
      }}
    >
      <span
        style={{
          fontSize: '14px',
          fontWeight: 300,
          color: muted ? TEXT_MUTED_ON_NAVY : TEXT_ON_NAVY,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: '15px',
          fontWeight: 500,
          color: muted ? TEXT_MUTED_ON_NAVY : TEXT_ON_NAVY,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.01em',
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page 5 — Scope & Afsluiting (in vs out, two-column compare)
// ─────────────────────────────────────────────────────────────────────────────

function Scope({
  onNext,
  onBack,
  progressLabel,
  sectionLabel,
  prospect,
}: {
  onNext: () => void;
  onBack: () => void;
  progressLabel: string;
  sectionLabel: string;
  prospect: BrochureProspect;
}) {
  const inScope = [
    'Custom platform architectuur + database design',
    'Multi-user dashboard met role-based access',
    'Integratie met bestaande ERP / accounting',
    'Design system + component library',
    'Staging + productie deployment',
    'Documentatie en team training',
    '30 dagen bug support na oplevering',
  ];

  const outScope = [
    'Hardware aanpassingen of nieuwe infrastructuur',
    'Native mobile apps (iOS / Android)',
    'SEO / content marketing',
    'Doorlopend onderhoud na 30 dagen support',
    'Data migratie van legacy systemen buiten scope',
  ];

  return (
    <main
      className="offerte-main"
      style={{ ...pageBase, backgroundColor: NAVY }}
    >
      <GeometricBackdrop />
      <BrandChrome companyName={prospect.companyName} />
      <ProgressIndicator label={progressLabel} />

      <div
        className="offerte-page-content"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          gridTemplateRows: 'auto auto 1fr auto',
          padding: '120px 72px 160px',
          fontFamily: 'var(--font-sora), sans-serif',
          color: TEXT_ON_NAVY,
          zIndex: 1,
          gap: '32px',
        }}
      >
        {/* Section label */}
        <div
          style={{
            fontWeight: 500,
            fontSize: '12px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <span
            style={{
              background: GOLD_GRADIENT,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 500,
            }}
          >
            {sectionLabel}
          </span>
          <span style={{ color: TEXT_ON_NAVY }}>Scope & afsluiting</span>
        </div>

        {/* Hero — two-line heading, each with a gold period */}
        <h1
          style={{
            fontSize: 'clamp(40px, 4.5vw, 68px)',
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '-0.025em',
            margin: 0,
            maxWidth: '900px',
          }}
        >
          Wat zit erin
          <span
            style={{
              background: GOLD_GRADIENT,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            .
          </span>
          <br />
          Wat niet
          <span
            style={{
              background: GOLD_GRADIENT,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            .
          </span>
        </h1>

        {/* Two columns — In scope / Buiten scope */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '32px',
            alignItems: 'stretch',
          }}
        >
          {/* LEFT — In scope card */}
          <div
            style={{
              background: CONTAINER_GRADIENT,
              border: `1px solid ${CONTAINER_BORDER}`,
              borderRadius: '20px',
              padding: '32px 36px 36px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            <div
              style={{
                fontSize: '10px',
                fontWeight: 500,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                background: GOLD_GRADIENT,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              In scope
            </div>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              {inScope.map((item) => (
                <li
                  key={item}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '14px',
                    fontSize: '15px',
                    fontWeight: 400,
                    color: TEXT_ON_NAVY,
                    lineHeight: 1.55,
                  }}
                >
                  <CheckIcon />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* RIGHT — Buiten scope */}
          <div
            style={{
              border: `1px solid ${CONTAINER_BORDER}`,
              borderRadius: '20px',
              padding: '32px 36px 36px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              background: 'transparent',
            }}
          >
            <div
              style={{
                fontSize: '10px',
                fontWeight: 500,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: TEXT_MUTED_ON_NAVY,
              }}
            >
              Buiten scope
            </div>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              {outScope.map((item) => (
                <li
                  key={item}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '14px',
                    fontSize: '15px',
                    fontWeight: 300,
                    color: TEXT_MUTED_ON_NAVY,
                    lineHeight: 1.55,
                  }}
                >
                  <CrossIcon />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Change request note */}
        <div
          style={{
            fontSize: '13px',
            fontWeight: 300,
            fontStyle: 'italic',
            color: TEXT_MUTED_ON_NAVY,
            textAlign: 'center',
            letterSpacing: '0.005em',
          }}
        >
          Change requests buiten scope worden per wijziging begroot.
        </div>
      </div>

      <BackArrow onClick={onBack} />
      <NextArrow onClick={onNext} />
    </main>
  );
}

function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="url(#check-gold)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, marginTop: '2px' }}
    >
      <defs>
        <linearGradient id="check-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e1c33c" />
          <stop offset="100%" stopColor="#fdf97b" />
        </linearGradient>
      </defs>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#898999"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, marginTop: '2px' }}
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="6" y1="18" x2="18" y2="6" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page 6 — Akkoord & ondertekening
// ─────────────────────────────────────────────────────────────────────────────

function Signing({
  onBack,
  onNext,
  progressLabel,
  sectionLabel,
  prospect,
  quote,
}: {
  onBack: () => void;
  onNext: () => void;
  progressLabel: string;
  sectionLabel: string;
  prospect: BrochureProspect;
  quote: BrochureQuote;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasSignature, setHasSignature] = useState(false);

  // Client-side computed — rendered inside a suppressHydrationWarning span
  // below. Safe because the date is a display-only string, never part of
  // business logic or form submission value.
  const todayLabel =
    typeof window === 'undefined'
      ? ''
      : new Date().toLocaleDateString('nl-NL', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });

  // Signature canvas: native event listeners (no React synthetic pointer events,
  // which have known quirks with setPointerCapture on canvas elements).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const applyCtxStyle = (ctx: CanvasRenderingContext2D) => {
      const rect = canvas.getBoundingClientRect();
      // Gold gradient stroke — matches the rest of the brochure accent language
      const grad = ctx.createLinearGradient(0, 0, 0, rect.height || 120);
      grad.addColorStop(0, '#e1c33c');
      grad.addColorStop(1, '#fdf97b');
      ctx.strokeStyle = grad;
      ctx.fillStyle = '#fdf97b';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };

    // Track the last measured size so we only reset the canvas when the
    // CSS box actually changes (not on every ResizeObserver tick).
    let lastW = 0;
    let lastH = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      // Only re-initialise when the visible size has actually changed.
      if (Math.round(rect.width) === lastW && Math.round(rect.height) === lastH)
        return;
      lastW = Math.round(rect.width);
      lastH = Math.round(rect.height);
      const dpr = window.devicePixelRatio || 1;
      // Resizing the canvas attribute clears its content — reset signature state.
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      setHasSignature(false);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      applyCtxStyle(ctx);
    };

    resize();

    // ResizeObserver catches devtools panel open/close and orientation changes
    // that don't fire a window resize event.
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    // Keep window resize as a fallback for browsers without ResizeObserver.
    window.addEventListener('resize', resize);

    let drawing = false;
    let lastX = 0;
    let lastY = 0;

    const pointFromEvent = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      if ('touches' in e) {
        const t = e.touches[0] ?? e.changedTouches[0];
        if (!t) return null;
        return { x: t.clientX - rect.left, y: t.clientY - rect.top };
      }
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const start = (e: MouseEvent | TouchEvent) => {
      const p = pointFromEvent(e);
      if (!p) return;
      e.preventDefault();
      drawing = true;
      lastX = p.x;
      lastY = p.y;
      // Single-click dot
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      applyCtxStyle(ctx);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2);
      ctx.fill();
      setHasSignature(true);
    };

    const move = (e: MouseEvent | TouchEvent) => {
      if (!drawing) return;
      const p = pointFromEvent(e);
      if (!p) return;
      e.preventDefault();
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      applyCtxStyle(ctx);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastX = p.x;
      lastY = p.y;
    };

    const end = () => {
      drawing = false;
    };

    canvas.addEventListener('mousedown', start);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);
    canvas.addEventListener('touchcancel', end);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousedown', start);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', end);
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove', move);
      canvas.removeEventListener('touchend', end);
      canvas.removeEventListener('touchcancel', end);
    };
  }, []);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasSignature(false);
  };

  // Numbers mirror Investering page
  const hasQuote = quote && quote.lines.length > 0;
  const subtotal = hasQuote
    ? quote.lines.reduce((acc, l) => acc + l.uren * l.tarief, 0)
    : 0;
  const total = hasQuote ? subtotal * (1 + quote.btwPercentage / 100) : 0;
  const fmt = (n: number) =>
    new Intl.NumberFormat('nl-NL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  return (
    <main
      className="offerte-main"
      style={{ ...pageBase, backgroundColor: NAVY }}
    >
      <GeometricBackdrop />
      <BrandChrome companyName={prospect.companyName} />
      <ProgressIndicator label={progressLabel} />

      <div
        className="offerte-page-6 offerte-page-content"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          gridTemplateRows: 'auto auto 1fr',
          fontFamily: 'var(--font-sora), sans-serif',
          color: TEXT_ON_NAVY,
          zIndex: 1,
          gap: '32px',
        }}
      >
        {/* Section label */}
        <div
          style={{
            fontWeight: 500,
            fontSize: '12px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <span
            style={{
              background: GOLD_GRADIENT,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 500,
            }}
          >
            {sectionLabel}
          </span>
          <span style={{ color: TEXT_ON_NAVY }}>Akkoord</span>
        </div>

        {/* Hero */}
        <h1
          style={{
            fontSize: 'clamp(40px, 4.5vw, 68px)',
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '-0.025em',
            margin: 0,
            maxWidth: '900px',
          }}
        >
          Teken het voorstel
          <span
            style={{
              background: GOLD_GRADIENT,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            .
          </span>
        </h1>

        {/* Split: summary (left) + signing form (right) */}
        <div className="offerte-signing-split">
          {/* LEFT — Summary card */}
          <div
            style={{
              background: CONTAINER_GRADIENT,
              border: `1px solid ${CONTAINER_BORDER}`,
              borderRadius: '20px',
              padding: '32px 36px 36px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            <div
              style={{
                fontSize: '10px',
                fontWeight: 500,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: TEXT_MUTED_ON_NAVY,
              }}
            >
              Voorstel
            </div>
            <div>
              <div
                style={{
                  fontSize: '22px',
                  fontWeight: 500,
                  color: TEXT_ON_NAVY,
                  lineHeight: 1.2,
                  letterSpacing: '-0.01em',
                  marginBottom: '6px',
                }}
              >
                Custom platform rebuild
              </div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 300,
                  color: TEXT_MUTED_ON_NAVY,
                }}
              >
                Klarifai{' '}
                <span
                  style={{
                    background: GOLD_GRADIENT,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontSize: '13px',
                    margin: '0 4px',
                  }}
                >
                  ✕
                </span>{' '}
                {prospect.companyName ?? prospect.domain ?? '—'}
              </div>
            </div>

            <div
              style={{
                borderTop: `1px solid ${CONTAINER_BORDER}`,
                paddingTop: '20px',
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 500,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: TEXT_MUTED_ON_NAVY,
                  marginBottom: '10px',
                }}
              >
                Totaal incl. BTW
              </div>
              <div
                style={{
                  fontSize: '40px',
                  fontWeight: 700,
                  lineHeight: 1,
                  letterSpacing: '-0.025em',
                  color: TEXT_ON_NAVY,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {hasQuote ? `€\u00a0${fmt(total)}` : '—'}
              </div>
              <div
                style={{
                  height: '2px',
                  width: '72px',
                  background: GOLD_GRADIENT,
                  marginTop: '14px',
                  borderRadius: '2px',
                }}
              />
            </div>
          </div>

          {/* RIGHT — Signing form */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              maxWidth: '560px',
            }}
          >
            {/* Name input */}
            <Field label="Naam" placeholder="Volledige naam" />

            {/* Signature canvas */}
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                }}
              >
                <label
                  style={{
                    fontSize: '10px',
                    fontWeight: 500,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: TEXT_MUTED_ON_NAVY,
                  }}
                >
                  Handtekening
                </label>
                <button
                  type="button"
                  onClick={clearSignature}
                  disabled={!hasSignature}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: hasSignature ? GOLD_LIGHT : TEXT_MUTED_ON_NAVY,
                    fontFamily: 'var(--font-sora), sans-serif',
                    fontSize: '10px',
                    fontWeight: 500,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    cursor: hasSignature ? 'pointer' : 'default',
                    padding: 0,
                    opacity: hasSignature ? 1 : 0.5,
                    transition: 'opacity 150ms, color 150ms',
                  }}
                >
                  Wissen
                </button>
              </div>
              <canvas
                ref={canvasRef}
                style={{
                  width: '100%',
                  height: '120px',
                  borderBottom: `1px solid ${CONTAINER_BORDER}`,
                  cursor: 'crosshair',
                  touchAction: 'none',
                  display: 'block',
                }}
              />
            </div>

            {/* Date — readonly display, client-only to avoid hydration mismatch */}
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              <label
                style={{
                  fontSize: '10px',
                  fontWeight: 500,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: TEXT_MUTED_ON_NAVY,
                }}
              >
                Datum
              </label>
              <div
                suppressHydrationWarning
                style={{
                  padding: '12px 0',
                  fontFamily: 'var(--font-sora), sans-serif',
                  fontSize: '18px',
                  fontWeight: 500,
                  color: TEXT_ON_NAVY,
                  letterSpacing: '-0.005em',
                  borderBottom: `1px solid ${CONTAINER_BORDER}`,
                }}
              >
                {todayLabel}
              </div>
            </div>

            {/* Legal disclaimer — key terms + link to Klarifai terms page */}
            <p
              style={{
                fontSize: '13px',
                fontWeight: 300,
                lineHeight: 1.6,
                color: TEXT_MUTED_ON_NAVY,
                margin: '8px 0 0',
              }}
            >
              Door te ondertekenen ga je akkoord met onze{' '}
              <TermsLink href="https://klarifai.nl/legal/terms-and-conditions">
                algemene voorwaarden
              </TermsLink>
              . Betaaltermijn 14 dagen, intellectueel eigendom gaat over naar{' '}
              {prospect.companyName ?? 'de klant'} na volledige betaling, 30
              dagen garantie op opgeleverd werk. Een op maat gemaakte
              verwerkersovereenkomst volgt samen met het contract, binnen 5
              werkdagen na akkoord.
            </p>

            {/* Gold pill CTA — full width, gated on signature being drawn */}
            <button
              type="button"
              onClick={onNext}
              disabled={!hasSignature}
              style={{
                marginTop: '8px',
                padding: '20px 32px',
                borderRadius: '9999px',
                border: 'none',
                background: hasSignature
                  ? GOLD_GRADIENT
                  : 'rgba(53, 59, 102, 0.4)',
                color: hasSignature ? NAVY : TEXT_MUTED_ON_NAVY,
                fontFamily: 'var(--font-sora), sans-serif',
                fontSize: '16px',
                fontWeight: 700,
                letterSpacing: '-0.01em',
                cursor: hasSignature ? 'pointer' : 'not-allowed',
                boxShadow: hasSignature
                  ? '0 1px 2px rgba(0,0,0,0.2), 0 8px 24px rgba(225, 195, 60, 0.35)'
                  : 'none',
                transition:
                  'transform 150ms ease-out, box-shadow 150ms ease-out, background 200ms, color 200ms',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
              }}
              onMouseEnter={(e) => {
                if (!hasSignature) return;
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow =
                  '0 2px 4px rgba(0,0,0,0.2), 0 12px 32px rgba(225, 195, 60, 0.5)';
              }}
              onMouseLeave={(e) => {
                if (!hasSignature) return;
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow =
                  '0 1px 2px rgba(0,0,0,0.2), 0 8px 24px rgba(225, 195, 60, 0.35)';
              }}
            >
              <CheckIconSolid />
              Bevestig en teken
            </button>
          </div>
        </div>
      </div>

      <BackArrow onClick={onBack} />
      {/* No next arrow — signing button IS the forward action */}
    </main>
  );
}

function Field({
  label,
  placeholder,
  defaultValue,
  readOnly,
}: {
  label: string;
  placeholder?: string;
  defaultValue?: string;
  readOnly?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label
        style={{
          fontSize: '10px',
          fontWeight: 500,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: TEXT_MUTED_ON_NAVY,
        }}
      >
        {label}
      </label>
      <input
        type="text"
        placeholder={placeholder}
        defaultValue={defaultValue}
        readOnly={readOnly}
        style={{
          background: 'transparent',
          border: 'none',
          borderBottom: `1px solid ${CONTAINER_BORDER}`,
          padding: '12px 0',
          fontFamily: 'var(--font-sora), sans-serif',
          fontSize: '18px',
          fontWeight: 500,
          color: TEXT_ON_NAVY,
          outline: 'none',
          letterSpacing: '-0.005em',
        }}
      />
    </div>
  );
}

function TermsLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: TEXT_ON_NAVY,
        textDecoration: 'underline',
        textDecorationColor: 'rgba(225, 195, 60, 0.5)',
        textUnderlineOffset: '3px',
        textDecorationThickness: '1px',
      }}
    >
      {children}
    </a>
  );
}

function CheckIconSolid() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page 7 — Bevestigd (terminal thank-you page)
// ─────────────────────────────────────────────────────────────────────────────

function Bevestigd({
  onBack,
  progressLabel,
  sectionLabel: _sectionLabel,
  prospect,
  slug,
}: {
  onBack: () => void;
  progressLabel: string;
  sectionLabel: string;
  prospect: BrochureProspect;
  slug: string;
}) {
  // Client-side computed — rendered inside a suppressHydrationWarning span
  // below. Safe because the date is a display-only label, never part of
  // business logic or form submission value.
  const todayLabel =
    typeof window === 'undefined'
      ? ''
      : new Date()
          .toLocaleDateString('nl-NL', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
          .toUpperCase();

  const steps = [
    {
      num: '01',
      title: 'Contract in je inbox',
      desc: 'Binnen 24 uur ontvang je een bevestiging met het ondertekende voorstel en het contract.',
    },
    {
      num: '02',
      title: 'Kick-off call',
      desc: 'Deze week plannen we een kick-off waarin we scope, planning en communicatie finetunen.',
    },
    {
      num: '03',
      title: 'Sprint 01 start',
      desc: 'Binnen twee weken staat de eerste sprint live. Discovery & architectuur trappen het af.',
    },
  ];

  return (
    <main
      className="offerte-main"
      style={{ ...pageBase, backgroundColor: NAVY }}
    >
      <GeometricBackdrop />
      <BrandChrome companyName={prospect.companyName} />
      <ProgressIndicator label={progressLabel} />

      <div
        className="offerte-page-7 offerte-page-content"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-sora), sans-serif',
          color: TEXT_ON_NAVY,
          zIndex: 1,
          gap: '40px',
        }}
      >
        {/* Confirmation eyebrow — gold, with today's date */}
        <div
          style={{
            fontWeight: 500,
            fontSize: '11px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            background: GOLD_GRADIENT,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <CheckInlineIcon />
          <span suppressHydrationWarning>
            Voorstel getekend{todayLabel ? ` · ${todayLabel}` : ''}
          </span>
        </div>

        {/* Hero — two lines, gold periods */}
        <h1
          style={{
            fontSize: 'clamp(52px, 6vw, 84px)',
            fontWeight: 700,
            lineHeight: 1.04,
            letterSpacing: '-0.028em',
            margin: 0,
            textAlign: 'center',
            maxWidth: '1100px',
          }}
        >
          Bedankt, {prospect.companyName ?? prospect.domain ?? 'team'}
          <span
            style={{
              background: GOLD_GRADIENT,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            .
          </span>
          <br />
          Tot snel
          <span
            style={{
              background: GOLD_GRADIENT,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            .
          </span>
        </h1>

        {/* Lead */}
        <p
          style={{
            fontSize: 'clamp(15px, 2.2vw, 20px)',
            fontWeight: 500,
            lineHeight: 1.45,
            letterSpacing: '-0.005em',
            color: TEXT_ON_NAVY,
            textAlign: 'center',
            maxWidth: '680px',
            margin: 0,
          }}
        >
          Je ontvangt binnen 24 uur een bevestigingsmail met het ondertekende
          voorstel en het contract. Daarna plannen we de kick-off.
        </p>

        {/* Next steps — 3 columns (collapses to 1 on mobile via .offerte-bevestigd-steps) */}
        <div className="offerte-bevestigd-steps">
          {steps.map((s) => (
            <div
              key={s.num}
              style={{
                background: CONTAINER_GRADIENT,
                border: `1px solid ${CONTAINER_BORDER}`,
                borderRadius: '16px',
                padding: '24px 26px 28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  background: GOLD_GRADIENT,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {s.num}
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 500,
                  color: TEXT_ON_NAVY,
                  letterSpacing: '-0.01em',
                  lineHeight: 1.25,
                }}
              >
                {s.title}
              </div>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 300,
                  lineHeight: 1.55,
                  color: TEXT_MUTED_ON_NAVY,
                }}
              >
                {s.desc}
              </div>
            </div>
          ))}
        </div>

        {/* Action buttons (stacks on mobile via .offerte-bevestigd-actions) */}
        <div className="offerte-bevestigd-actions">
          <a
            href={`/offerte/${slug}/print`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 26px',
              borderRadius: '9999px',
              border: `1px solid ${CONTAINER_BORDER}`,
              background: 'transparent',
              color: TEXT_ON_NAVY,
              fontFamily: 'var(--font-sora), sans-serif',
              fontSize: '14px',
              fontWeight: 500,
              letterSpacing: '-0.005em',
              textDecoration: 'none',
              transition: 'background 150ms ease-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <DownloadIcon />
            Download voorstel (PDF)
          </a>
          <a
            href="https://cal.com/romano-kanters-klarifai/kick-off"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 26px',
              borderRadius: '9999px',
              border: 'none',
              background: GOLD_GRADIENT,
              color: NAVY,
              fontFamily: 'var(--font-sora), sans-serif',
              fontSize: '14px',
              fontWeight: 700,
              letterSpacing: '-0.005em',
              textDecoration: 'none',
              boxShadow:
                '0 1px 2px rgba(0,0,0,0.2), 0 8px 24px rgba(225, 195, 60, 0.35)',
              transition: 'transform 150ms ease-out, box-shadow 150ms ease-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow =
                '0 2px 4px rgba(0,0,0,0.2), 0 12px 32px rgba(225, 195, 60, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow =
                '0 1px 2px rgba(0,0,0,0.2), 0 8px 24px rgba(225, 195, 60, 0.35)';
            }}
          >
            <CalendarIcon />
            Plan kick-off in
          </a>
        </div>
      </div>

      <BackArrow onClick={onBack} />
      {/* No next arrow — this is the terminal page */}
    </main>
  );
}

function CheckInlineIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="url(#confirm-gold)"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="confirm-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e1c33c" />
          <stop offset="100%" stopColor="#fdf97b" />
        </linearGradient>
      </defs>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared pieces
// ─────────────────────────────────────────────────────────────────────────────

// Export secondary name for future refactor
export { BrochureCover as Brochure };
// Prevent unused warning for GOLD_MID (available for future use on page 2 borders)
void GOLD_MID;

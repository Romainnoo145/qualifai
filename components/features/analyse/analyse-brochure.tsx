'use client';

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
  goldGradientText,
  sectionLabelStyle,
} from '@/lib/brochure-tokens';
import {
  BrandChrome,
  ProgressIndicator,
  GeometricBackdrop,
  NextArrow,
  BackArrow,
} from '@/components/shared/brochure-chrome';
import type {
  NarrativeSection,
  SPVRecommendation,
  UseCaseRecommendation,
} from '@/lib/analysis/types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AnalyseBrochureProps {
  slug: string;
  prospect: { id: string; companyName: string; domain: string | null };
  sections: NarrativeSection[];
  recommendations: SPVRecommendation[] | UseCaseRecommendation[];
  recommendationType: 'spv' | 'usecase';
  researchStats: { bronnen: number; signalen: number; inzichten: number };
  bookingUrl: string | null;
  contactEmail: string | null;
  phoneNumber: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

const RESPONSIVE_STYLES = `
  @media (max-width: 1024px) {
    .analyse-page { padding: 100px 48px 110px !important; }
    .analyse-split { grid-template-columns: 1fr 1fr !important; gap: 36px !important; }
    .analyse-pillars-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .analyse-kansen-grid { grid-template-columns: 1fr 1fr !important; }
  }
  @media (max-width: 768px) {
    .analyse-main {
      position: relative !important;
      overflow-y: auto !important;
      min-height: 100vh !important;
    }
    .analyse-page { padding: 88px 24px 120px !important; }
    .analyse-split { grid-template-columns: 1fr !important; gap: 24px !important; }
    .analyse-pillars-grid { grid-template-columns: 1fr !important; }
    .analyse-kansen-grid { grid-template-columns: 1fr !important; }
    .analyse-hero { font-size: 28px !important; }
    .analyse-hero-mega { font-size: 36px !important; }
    .analyse-cta-row { flex-direction: column !important; }
  }
`;

export function AnalyseBrochure({
  slug: _slug,
  prospect,
  sections,
  recommendations,
  recommendationType,
  researchStats,
  bookingUrl,
  contactEmail,
  phoneNumber,
}: AnalyseBrochureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [overlayVisible, setOverlayVisible] = useState(false);

  const totalPages = 1 + sections.length + 1 + 1; // cover + sections + kansen + contact

  const handleNext = useCallback(() => {
    setCurrentPage((p) => Math.min(p + 1, totalPages - 1));
  }, [totalPages]);

  const handleBack = useCallback(() => {
    setCurrentPage((p) => Math.max(p - 1, 0));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handleBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleNext, handleBack]);

  // Track page view
  useEffect(() => {
    if (!prospect?.id) return;
    fetch('/api/offerte/viewed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospectId: prospect.id }),
    }).catch(() => {});
  }, [prospect?.id]);

  // Reduced motion + overlay timer
  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      if (videoRef.current) {
        videoRef.current.removeAttribute('autoplay');
        videoRef.current.pause();
      }
      // Use a microtask to avoid synchronous setState in effect body
      const t = setTimeout(() => setOverlayVisible(true), 0);
      return () => clearTimeout(t);
    }

    const timer = setTimeout(() => setOverlayVisible(true), 12000);
    return () => clearTimeout(timer);
  }, []);

  // Video end → show overlay
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onEnded = () => setOverlayVisible(true);
    video.addEventListener('ended', onEnded);
    return () => video.removeEventListener('ended', onEnded);
  }, []);

  const progressLabel = `${String(currentPage + 1).padStart(2, '0')} / ${String(totalPages).padStart(2, '0')}`;

  // ── Page 0: Cover ──
  if (currentPage === 0) {
    return (
      <main className="analyse-main" style={pageBase}>
        <style dangerouslySetInnerHTML={{ __html: RESPONSIVE_STYLES }} />
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          preload="auto"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        >
          <source src="/video/klarifai-analyse.mp4" type="video/mp4" />
        </video>

        <BrandChrome />
        <ProgressIndicator label={progressLabel} />

        {/* Dynamic overlay — fades in after 12s or video end */}
        <div
          style={{
            position: 'absolute',
            right: '72px',
            bottom: '160px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            fontFamily: 'var(--font-sora), sans-serif',
            zIndex: 10,
            opacity: overlayVisible ? 1 : 0,
            transform: overlayVisible ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 800ms ease-out, transform 800ms ease-out',
            pointerEvents: overlayVisible ? 'auto' : 'none',
          }}
        >
          {/* Research stats */}
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <StatRow
              value={researchStats.bronnen}
              label="bronnen geanalyseerd"
            />
            <StatRow
              value={researchStats.signalen}
              label="signalen gedetecteerd"
            />
            <StatRow
              value={researchStats.inzichten}
              label="inzichten gegenereerd"
            />
          </div>

          {/* Separator */}
          <div
            style={{
              width: '100%',
              height: '1px',
              background: `linear-gradient(90deg, ${GOLD_MID}, transparent)`,
            }}
          />

          {/* Company name */}
          <div
            style={{
              fontSize: '16px',
              fontWeight: 500,
              color: TEXT_ON_NAVY,
              letterSpacing: '-0.01em',
            }}
          >
            {prospect.companyName}
          </div>
        </div>

        <NextArrow onClick={handleNext} />
      </main>
    );
  }

  // ── Section pages (1 .. sections.length) ──
  if (currentPage >= 1 && currentPage <= sections.length) {
    const sectionIndex = currentPage - 1;
    const section = sections[sectionIndex]!;
    const layout = selectLayout(section, sectionIndex);
    const pageNum = String(currentPage + 1).padStart(2, '0');

    return (
      <main
        className="analyse-main"
        style={{ ...pageBase, backgroundColor: NAVY }}
      >
        <style dangerouslySetInnerHTML={{ __html: RESPONSIVE_STYLES }} />
        <GeometricBackdrop />
        <BrandChrome />
        <ProgressIndicator label={progressLabel} />

        <div
          className="analyse-page"
          style={{
            position: 'absolute',
            inset: 0,
            padding: '120px 72px 128px',
            fontFamily: 'var(--font-sora), sans-serif',
            color: TEXT_ON_NAVY,
            zIndex: 1,
            overflow: 'hidden',
          }}
        >
          {layout === 'split' && (
            <SectionSplit section={section} pageNum={pageNum} />
          )}
          {layout === 'pillars' && (
            <SectionPillars section={section} pageNum={pageNum} />
          )}
          {layout === 'quote' && (
            <SectionQuote section={section} pageNum={pageNum} />
          )}
        </div>

        <BackArrow onClick={handleBack} />
        {currentPage < totalPages - 1 && <NextArrow onClick={handleNext} />}
      </main>
    );
  }

  // ── Kansen page ──
  if (currentPage === sections.length + 1) {
    const pageNum = String(currentPage + 1).padStart(2, '0');

    return (
      <main
        className="analyse-main"
        style={{ ...pageBase, backgroundColor: NAVY }}
      >
        <style dangerouslySetInnerHTML={{ __html: RESPONSIVE_STYLES }} />
        <GeometricBackdrop />
        <BrandChrome />
        <ProgressIndicator label={progressLabel} />

        <div
          className="analyse-page"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            gridTemplateRows: 'auto auto 1fr',
            padding: '120px 72px 128px',
            fontFamily: 'var(--font-sora), sans-serif',
            color: TEXT_ON_NAVY,
            zIndex: 1,
            gap: '32px',
          }}
        >
          <SectionLabel num={pageNum} title="Kansen" />

          <HeroHeading
            title={`Concrete mogelijkheden voor ${prospect.companyName}`}
          />

          <div
            className="analyse-kansen-grid"
            style={{
              display: 'grid',
              gridTemplateColumns:
                recommendations.length === 1 ? '1fr' : '1fr 1fr',
              gap: '24px',
              alignItems: 'start',
              alignContent: 'start',
              overflow: 'auto',
            }}
          >
            {recommendations.map((rec, i) => (
              <RecommendationCard
                key={i}
                rec={rec}
                index={i}
                type={recommendationType}
              />
            ))}
          </div>
        </div>

        <BackArrow onClick={handleBack} />
        <NextArrow onClick={handleNext} />
      </main>
    );
  }

  // ── Contact page (terminal) ──
  return (
    <main
      className="analyse-main"
      style={{ ...pageBase, backgroundColor: NAVY }}
    >
      <style dangerouslySetInnerHTML={{ __html: RESPONSIVE_STYLES }} />
      <GeometricBackdrop />
      <BrandChrome />
      <ProgressIndicator label={progressLabel} />

      <div
        className="analyse-page"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '120px 72px 160px',
          fontFamily: 'var(--font-sora), sans-serif',
          color: TEXT_ON_NAVY,
          zIndex: 1,
          gap: '32px',
        }}
      >
        {/* Gold eyebrow */}
        <div
          style={{
            fontWeight: 500,
            fontSize: '11px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            ...goldGradientText,
          }}
        >
          Analyse compleet &middot; {prospect.companyName}
        </div>

        {/* Hero */}
        <h1
          style={{
            fontSize: 'clamp(44px, 5.5vw, 76px)',
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '-0.028em',
            margin: 0,
            textAlign: 'center',
            maxWidth: '900px',
          }}
        >
          Laten we in gesprek gaan
          <GoldDot />
        </h1>

        {/* Lead */}
        <p
          style={{
            fontSize: '18px',
            fontWeight: 300,
            lineHeight: 1.6,
            color: TEXT_MUTED_ON_NAVY,
            textAlign: 'center',
            maxWidth: '640px',
            margin: 0,
          }}
        >
          Wij hebben de analyse gedaan. Nu is het aan u om te beslissen of deze
          kansen het waard zijn om te verkennen. Geen verplichtingen, geen druk.
        </p>

        {/* Action buttons */}
        <div
          className="analyse-cta-row"
          style={{
            display: 'flex',
            gap: '16px',
            marginTop: '16px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {bookingUrl && (
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '16px 28px',
                borderRadius: '9999px',
                border: 'none',
                background: GOLD_GRADIENT,
                color: NAVY,
                fontFamily: 'var(--font-sora), sans-serif',
                fontSize: '15px',
                fontWeight: 700,
                letterSpacing: '-0.005em',
                textDecoration: 'none',
                boxShadow:
                  '0 1px 2px rgba(0,0,0,0.2), 0 8px 24px rgba(225, 195, 60, 0.35)',
                transition:
                  'transform 150ms ease-out, box-shadow 150ms ease-out',
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
              Plan een gesprek
            </a>
          )}

          {contactEmail && (
            <a
              href={`mailto:${contactEmail}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '16px 28px',
                borderRadius: '9999px',
                border: `1px solid ${CONTAINER_BORDER}`,
                background: 'transparent',
                color: TEXT_ON_NAVY,
                fontFamily: 'var(--font-sora), sans-serif',
                fontSize: '15px',
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
              <MailIcon />
              {contactEmail}
            </a>
          )}

          {phoneNumber && (
            <a
              href={`tel:${phoneNumber}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '16px 28px',
                borderRadius: '9999px',
                border: `1px solid ${CONTAINER_BORDER}`,
                background: 'transparent',
                color: TEXT_ON_NAVY,
                fontFamily: 'var(--font-sora), sans-serif',
                fontSize: '15px',
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
              <PhoneIcon />
              {phoneNumber}
            </a>
          )}
        </div>

        {/* Subtle klarifai.nl link */}
        <a
          href="https://klarifai.nl"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: '24px',
            fontSize: '12px',
            fontWeight: 300,
            color: TEXT_MUTED_ON_NAVY,
            textDecoration: 'underline',
            textDecorationColor: 'rgba(225, 195, 60, 0.5)',
            textUnderlineOffset: '3px',
            textDecorationThickness: '1px',
            letterSpacing: '0.02em',
          }}
        >
          klarifai.nl
        </a>
      </div>

      <BackArrow onClick={handleBack} />
      {/* No next arrow — terminal page */}
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout selection
// ─────────────────────────────────────────────────────────────────────────────

function selectLayout(
  section: NarrativeSection,
  index: number,
): 'split' | 'pillars' | 'quote' {
  const hasNewsCitation = section.citations.some((c) =>
    c.toUpperCase().includes('NEWS'),
  );
  if (hasNewsCitation) return 'quote';
  if (index % 2 === 1) return 'pillars';
  return 'split';
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SectionLabel({ num, title }: { num: string; title: string }) {
  return (
    <div
      style={{
        ...sectionLabelStyle,
        gap: '14px',
      }}
    >
      <span style={goldGradientText}>[ {num} ]</span>
      <span style={{ color: TEXT_ON_NAVY }}>{title}</span>
    </div>
  );
}

function HeroHeading({ title }: { title: string }) {
  return (
    <h1
      style={{
        fontSize: 'clamp(36px, 4.5vw, 60px)',
        fontWeight: 700,
        lineHeight: 1.05,
        letterSpacing: '-0.025em',
        margin: 0,
        maxWidth: '1000px',
        color: TEXT_ON_NAVY,
      }}
    >
      {title}
      <GoldDot />
    </h1>
  );
}

function GoldDot() {
  return (
    <span
      style={{
        background: GOLD_GRADIENT,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}
    >
      .
    </span>
  );
}

function Narrative({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {paragraphs.map((p, i) => (
        <p
          key={i}
          style={{
            fontSize: '17px',
            fontWeight: 300,
            lineHeight: 1.6,
            color: TEXT_MUTED_ON_NAVY,
            margin: 0,
          }}
        >
          {p}
        </p>
      ))}
    </div>
  );
}

function CitationsBar({ citations }: { citations: string[] }) {
  if (citations.length === 0) return null;
  return (
    <div
      style={{
        fontSize: '11px',
        fontWeight: 300,
        color: 'rgba(137, 137, 153, 0.6)',
        letterSpacing: '0.02em',
        lineHeight: 1.5,
        borderTop: `1px solid ${CONTAINER_BORDER}`,
        paddingTop: '16px',
        marginTop: 'auto',
      }}
    >
      {citations.join(' · ')}
    </div>
  );
}

function StatRow({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
      <span
        style={{
          fontSize: '22px',
          fontWeight: 700,
          ...goldGradientText,
          letterSpacing: '-0.01em',
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: '12px',
          fontWeight: 500,
          color: TEXT_ON_NAVY,
          letterSpacing: '0.18em',
          textTransform: 'uppercase' as const,
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section layouts
// ─────────────────────────────────────────────────────────────────────────────

/** Derive insight cards from body paragraphs */
function deriveInsights(body: string): { title: string; desc: string }[] {
  const paragraphs = body.split('\n\n').filter(Boolean);
  return paragraphs.slice(0, 3).map((p) => {
    const firstDot = p.indexOf('. ');
    if (firstDot > 0 && firstDot < 120) {
      return { title: p.slice(0, firstDot + 1), desc: p.slice(firstDot + 2) };
    }
    return { title: p.slice(0, 60) + '...', desc: p };
  });
}

/** Derive pillars from body paragraphs */
function derivePillars(body: string): { title: string; desc: string }[] {
  const paragraphs = body.split('\n\n').filter(Boolean);
  return paragraphs.slice(0, 3).map((p) => {
    const words = p.split(' ');
    const titleWords = words.slice(0, 5).join(' ');
    const descWords = words.slice(5).join(' ');
    return { title: titleWords, desc: descWords || p };
  });
}

/** Extract a pull quote from the body */
function extractQuote(body: string): { text: string; source: string } {
  // Find a sentence enclosed in quotes
  const quoteMatch = body.match(/"([^"]{20,200})"/);
  if (quoteMatch) {
    return { text: quoteMatch[1]!, source: '' };
  }
  // Fallback: first sentence
  const firstDot = body.indexOf('. ');
  const text = firstDot > 0 ? body.slice(0, firstDot + 1) : body.slice(0, 150);
  return { text, source: '' };
}

/** Extract news source from citations */
function extractNewsSource(citations: string[]): string {
  const news = citations.find((c) => c.toUpperCase().includes('NEWS'));
  return news || '';
}

// ── SectionSplit ──

function SectionSplit({
  section,
  pageNum,
}: {
  section: NarrativeSection;
  pageNum: string;
}) {
  const paragraphs = section.body.split('\n\n').filter(Boolean);
  const insights = deriveInsights(section.body);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'auto auto 1fr auto',
        height: '100%',
        gap: '28px',
      }}
    >
      <SectionLabel num={pageNum} title={section.title} />
      <HeroHeading title={section.title} />

      <div
        className="analyse-split"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr',
          gap: '48px',
          alignItems: 'start',
          overflow: 'hidden',
        }}
      >
        {/* Left — narrative */}
        <Narrative paragraphs={paragraphs} />

        {/* Right — insight cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {insights.map((insight, i) => (
            <div
              key={i}
              style={{
                background: CONTAINER_GRADIENT,
                border: `1px solid ${CONTAINER_BORDER}`,
                borderRadius: '16px',
                padding: '24px 24px 28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 700,
                  lineHeight: 1,
                  ...goldGradientText,
                  letterSpacing: '-0.02em',
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </div>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 500,
                  color: TEXT_ON_NAVY,
                  letterSpacing: '-0.01em',
                  lineHeight: 1.3,
                }}
              >
                {insight.title}
              </div>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 300,
                  lineHeight: 1.55,
                  color: TEXT_MUTED_ON_NAVY,
                }}
              >
                {insight.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      <CitationsBar citations={section.citations} />
    </div>
  );
}

// ── SectionPillars ──

function SectionPillars({
  section,
  pageNum,
}: {
  section: NarrativeSection;
  pageNum: string;
}) {
  const pillars = derivePillars(section.body);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto auto',
        height: '100%',
        gap: '24px',
      }}
    >
      <SectionLabel num={pageNum} title={section.title} />

      {/* MEGA hero heading */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}
      >
        <h1
          style={{
            fontSize: 'clamp(48px, 6vw, 88px)',
            fontWeight: 700,
            lineHeight: 1.02,
            letterSpacing: '-0.03em',
            margin: 0,
            maxWidth: '1100px',
            color: TEXT_ON_NAVY,
          }}
        >
          {section.title}
          <GoldDot />
        </h1>
      </div>

      {/* Gold gradient connecting line */}
      <div
        style={{
          height: '2px',
          width: '120px',
          background: GOLD_GRADIENT,
          borderRadius: '2px',
        }}
      />

      {/* 3 pillar cards */}
      <div
        className="analyse-pillars-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '24px',
        }}
      >
        {pillars.map((p, i) => (
          <PillarCard
            key={i}
            num={String(i + 1).padStart(2, '0')}
            title={p.title}
            desc={p.desc}
          />
        ))}
      </div>
    </div>
  );
}

function PillarCard({
  num,
  title,
  desc,
}: {
  num: string;
  title: string;
  desc: string;
}) {
  return (
    <div
      style={{
        background: CONTAINER_GRADIENT,
        border: `1px solid ${CONTAINER_BORDER}`,
        borderRadius: '16px',
        padding: '28px 28px 32px',
        display: 'grid',
        gridTemplateRows: 'auto auto 1fr',
        rowGap: '12px',
      }}
    >
      <div
        style={{
          fontSize: '40px',
          fontWeight: 700,
          lineHeight: 1,
          ...goldGradientText,
          letterSpacing: '-0.02em',
        }}
      >
        {num}
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
        {title}
      </div>
      <div
        style={{
          fontSize: '14px',
          fontWeight: 300,
          lineHeight: 1.55,
          color: TEXT_MUTED_ON_NAVY,
        }}
      >
        {desc}
      </div>
    </div>
  );
}

// ── SectionQuote ──

function SectionQuote({
  section,
  pageNum,
}: {
  section: NarrativeSection;
  pageNum: string;
}) {
  const paragraphs = section.body.split('\n\n').filter(Boolean);
  const { text: quoteText } = extractQuote(section.body);
  const newsSource = extractNewsSource(section.citations);

  // Extract 2 evidence points from paragraphs
  const evidencePoints = paragraphs.slice(0, 2).map((p) => {
    const firstDot = p.indexOf('. ');
    return firstDot > 0 ? p.slice(0, firstDot + 1) : p.slice(0, 120);
  });

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'auto auto 1fr auto',
        height: '100%',
        gap: '28px',
      }}
    >
      <SectionLabel num={pageNum} title={section.title} />
      <HeroHeading title={section.title} />

      <div
        className="analyse-split"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr',
          gap: '48px',
          alignItems: 'start',
          overflow: 'hidden',
        }}
      >
        {/* Left — pull quote + narrative */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <PullQuote text={quoteText} source={newsSource} />
          <Narrative paragraphs={paragraphs.slice(0, 2)} />
        </div>

        {/* Right — evidence cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {evidencePoints.map((point, i) => (
            <div
              key={i}
              style={{
                background: CONTAINER_GRADIENT,
                border: `1px solid ${CONTAINER_BORDER}`,
                borderRadius: '16px',
                padding: '24px 24px 28px',
                display: 'flex',
                gap: '16px',
                alignItems: 'flex-start',
              }}
            >
              {/* Gold-tinted icon badge */}
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(225, 195, 60, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <EvidenceIcon />
              </div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 300,
                  lineHeight: 1.55,
                  color: TEXT_MUTED_ON_NAVY,
                }}
              >
                {point}
              </div>
            </div>
          ))}
        </div>
      </div>

      <CitationsBar citations={section.citations} />
    </div>
  );
}

function PullQuote({ text, source }: { text: string; source: string }) {
  return (
    <div
      style={{
        borderLeft: `3px solid ${GOLD_MID}`,
        paddingLeft: '20px',
      }}
    >
      <p
        style={{
          fontSize: '20px',
          fontWeight: 500,
          lineHeight: 1.45,
          color: TEXT_ON_NAVY,
          fontStyle: 'italic',
          margin: 0,
        }}
      >
        &ldquo;{text}&rdquo;
      </p>
      {source && (
        <p
          style={{
            fontSize: '12px',
            fontWeight: 300,
            color: TEXT_MUTED_ON_NAVY,
            marginTop: '10px',
            letterSpacing: '0.02em',
          }}
        >
          {source}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recommendation card
// ─────────────────────────────────────────────────────────────────────────────

function RecommendationCard({
  rec,
  index,
  type,
}: {
  rec: SPVRecommendation | UseCaseRecommendation;
  index: number;
  type: 'spv' | 'usecase';
}) {
  const num = String(index + 1).padStart(2, '0');

  if (type === 'spv') {
    const spv = rec as SPVRecommendation;
    const firstDot = spv.relevanceNarrative.indexOf('. ');
    const title =
      firstDot > 0
        ? spv.relevanceNarrative.slice(0, firstDot + 1)
        : spv.relevanceNarrative.slice(0, 80);
    const narrative = spv.relevanceNarrative;

    return (
      <div
        style={{
          background: CONTAINER_GRADIENT,
          border: `1px solid ${CONTAINER_BORDER}`,
          borderRadius: '16px',
          padding: '28px 28px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div
          style={{
            fontSize: '44px',
            fontWeight: 700,
            lineHeight: 1,
            ...goldGradientText,
            letterSpacing: '-0.02em',
          }}
        >
          {num}
        </div>
        <div
          style={{
            fontSize: '10px',
            fontWeight: 500,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: TEXT_MUTED_ON_NAVY,
          }}
        >
          {spv.spvName} Partnership
        </div>
        <div
          style={{
            fontSize: '20px',
            fontWeight: 500,
            color: TEXT_ON_NAVY,
            letterSpacing: '-0.01em',
            lineHeight: 1.25,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: '15px',
            fontWeight: 300,
            lineHeight: 1.55,
            color: TEXT_MUTED_ON_NAVY,
          }}
        >
          {narrative}
        </div>
        {spv.strategicTags.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              marginTop: '4px',
            }}
          >
            {spv.strategicTags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: '10px',
                  fontWeight: 500,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: TEXT_MUTED_ON_NAVY,
                  border: `1px solid ${CONTAINER_BORDER}`,
                  borderRadius: '9999px',
                  padding: '4px 12px',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // UseCase type
  const uc = rec as UseCaseRecommendation;
  return (
    <div
      style={{
        background: CONTAINER_GRADIENT,
        border: `1px solid ${CONTAINER_BORDER}`,
        borderRadius: '16px',
        padding: '28px 28px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      <div
        style={{
          fontSize: '44px',
          fontWeight: 700,
          lineHeight: 1,
          ...goldGradientText,
          letterSpacing: '-0.02em',
        }}
      >
        {num}
      </div>
      <div
        style={{
          fontSize: '10px',
          fontWeight: 500,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: TEXT_MUTED_ON_NAVY,
        }}
      >
        {uc.category}
      </div>
      <div
        style={{
          fontSize: '20px',
          fontWeight: 500,
          color: TEXT_ON_NAVY,
          letterSpacing: '-0.01em',
          lineHeight: 1.25,
        }}
      >
        {uc.useCaseTitle}
      </div>
      <div
        style={{
          fontSize: '15px',
          fontWeight: 300,
          lineHeight: 1.55,
          color: TEXT_MUTED_ON_NAVY,
        }}
      >
        {uc.relevanceNarrative}
      </div>
      {uc.applicableOutcomes.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            marginTop: '4px',
          }}
        >
          {uc.applicableOutcomes.map((outcome) => (
            <span
              key={outcome}
              style={{
                fontSize: '10px',
                fontWeight: 500,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: TEXT_MUTED_ON_NAVY,
                border: `1px solid ${CONTAINER_BORDER}`,
                borderRadius: '9999px',
                padding: '4px 12px',
              }}
            >
              {outcome}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

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

function MailIcon() {
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
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 7l-10 7L2 7" />
    </svg>
  );
}

function PhoneIcon() {
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
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function EvidenceIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={GOLD_LIGHT}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

// Prevent unused lint warning
void GOLD_MID;

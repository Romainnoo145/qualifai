# Analyse Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/analyse/[slug]` as a dark-navy click-through brochure (offerte-style) with dynamic pages driven by AI analysis data.

**Architecture:** Extract shared brochure primitives (backdrop, arrows, chrome, tokens) from `brochure-cover.tsx` into shared modules. Build a new `AnalyseBrochure` client component that renders: video cover with research stats overlay → narrative section pages (3 layout variants) → kansen page → contact page. Keep existing server-side data fetching, session tracking, and Cal.com integration.

**Tech Stack:** Next.js 15, React 19, TypeScript, Sora font (Google Fonts), inline styles (matching offerte pattern), tRPC for session tracking, Cal.com embed SDK.

**Design spec:** `docs/superpowers/specs/2026-04-19-analyse-page-redesign.md`
**Mockups:** `.superpowers/brainstorm/806393-1776618955/content/`

---

### Task 1: Extract shared brochure tokens and primitives

**Files:**

- Create: `lib/brochure-tokens.ts`
- Create: `components/shared/brochure-chrome.tsx`
- Modify: `components/features/offerte/brochure-cover.tsx` (import from shared)

- [ ] **Step 1: Create brand token constants**

Create `lib/brochure-tokens.ts`:

```typescript
// Klarifai brochure brand tokens — extracted from klarifai.nl CSS (2026-04-15)
// Used by both /offerte and /analyse brochure surfaces.

export const NAVY = '#040026';
export const NAVY_DEEP = '#000319';
export const CONTAINER_GRADIENT =
  'linear-gradient(180deg, #040026 0%, #080054 100%)';
export const CONTAINER_BORDER = 'rgba(53, 59, 102, 0.55)';
export const GOLD_GRADIENT =
  'linear-gradient(180deg, #e1c33c 0%, #fdf97b 100%)';
export const GOLD_LIGHT = '#fdf97b';
export const GOLD_MID = '#e1c33c';
export const TEXT_ON_NAVY = '#fefefe';
export const TEXT_MUTED_ON_NAVY = '#898999';

export const pageBase: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: NAVY,
  overflow: 'hidden',
  fontFamily: 'var(--font-sora), sans-serif',
};

export const sectionLabelStyle: React.CSSProperties = {
  fontWeight: 500,
  fontSize: '12px',
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  display: 'flex',
  alignItems: 'center',
};

export const goldGradientText: React.CSSProperties = {
  background: GOLD_GRADIENT,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
};
```

- [ ] **Step 2: Create shared chrome components**

Create `components/shared/brochure-chrome.tsx`. Extract these components from `brochure-cover.tsx` (lines 2377–2609) with identical logic:

```typescript
'use client';

import { NAVY, GOLD_GRADIENT, GOLD_LIGHT, TEXT_ON_NAVY } from '@/lib/brochure-tokens';

export function BrandChrome() {
  return (
    <div style={{ position: 'fixed', top: '32px', left: '48px', display: 'flex', alignItems: 'center', gap: '14px', fontFamily: 'var(--font-sora), sans-serif', zIndex: 20, pointerEvents: 'none', userSelect: 'none' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/klarifai-icon.svg" alt="Klarifai" width={36} height={36} style={{ width: '36px', height: '36px', display: 'block' }} />
    </div>
  );
}

export function ProgressIndicator({ label }: { label: string }) {
  // Copy exact implementation from brochure-cover.tsx lines 2405-2426
  // Uses GOLD_LIGHT for color, fixed top-right position
}

export function GeometricBackdrop() {
  // Copy exact implementation from brochure-cover.tsx lines 2433-2494
  // Pure SVG, no props, uses NAVY_DEEP
}

export function NextArrow({ onClick }: { onClick: () => void }) {
  // Copy exact implementation from brochure-cover.tsx lines 2496-2535
  // 64px gold gradient circle, right arrow
}

export function BackArrow({ onClick }: { onClick: () => void }) {
  // Copy exact implementation from brochure-cover.tsx lines 2537-2572
  // 64px ghost circle, left arrow
}

function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  // Copy exact implementation from brochure-cover.tsx lines 2574-2609
}
```

Copy each function body exactly from `brochure-cover.tsx`, replacing hardcoded color constants with imports from `brochure-tokens.ts`.

- [ ] **Step 3: Update offerte brochure-cover.tsx to use shared components**

In `components/features/offerte/brochure-cover.tsx`:

- Add imports: `import { BrandChrome, ProgressIndicator, GeometricBackdrop, NextArrow, BackArrow } from '@/components/shared/brochure-chrome';`
- Add imports: `import { NAVY, NAVY_DEEP, ... } from '@/lib/brochure-tokens';`
- Remove the local definitions of all extracted components and constants
- Keep all page-specific components (Uitdaging, Aanpak, Investering, etc.) as-is

- [ ] **Step 4: Verify offerte still works**

Run: `npx tsc --noEmit 2>&1 | grep -v "tmp-\|sitemap.test"`
Expected: No new errors.

Open `http://localhost:9200/offerte/marfa` in browser, click through all 7 pages. Everything must look identical.

- [ ] **Step 5: Commit**

```bash
git add lib/brochure-tokens.ts components/shared/brochure-chrome.tsx components/features/offerte/brochure-cover.tsx
git commit -m "refactor: extract shared brochure tokens and chrome components"
```

---

### Task 2: Create analyse layout and video cover page

**Files:**

- Create: `app/analyse/[slug]/layout.tsx`
- Create: `components/features/analyse/analyse-brochure.tsx`

- [ ] **Step 1: Create analyse layout**

Create `app/analyse/[slug]/layout.tsx`:

```typescript
import type { Metadata } from 'next';
import { Sora } from 'next/font/google';

const sora = Sora({
  variable: '--font-sora',
  weight: ['300', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Klarifai — Analyse',
  description: 'Een gepersonaliseerde analyse van Klarifai.',
  robots: { index: false, follow: false },
};

export default function AnalyseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={sora.variable} style={{ fontFamily: 'var(--font-sora)' }}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create the AnalyseBrochure component shell**

Create `components/features/analyse/analyse-brochure.tsx` with the cover page and basic navigation:

```typescript
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { BrandChrome, ProgressIndicator, GeometricBackdrop, NextArrow, BackArrow } from '@/components/shared/brochure-chrome';
import { pageBase, NAVY, GOLD_GRADIENT, GOLD_LIGHT, TEXT_ON_NAVY, TEXT_MUTED_ON_NAVY, goldGradientText } from '@/lib/brochure-tokens';
import type { NarrativeSection, SPVRecommendation, UseCaseRecommendation } from '@/lib/analysis/types';

interface AnalyseProspect {
  id: string;
  companyName: string;
  domain: string | null;
}

interface AnalyseBrochureProps {
  slug: string;
  prospect: AnalyseProspect;
  sections: NarrativeSection[];
  recommendations: SPVRecommendation[] | UseCaseRecommendation[];
  recommendationType: 'spv' | 'usecase';
  researchStats: {
    bronnen: number;
    signalen: number;
    inzichten: number;
  };
  bookingUrl: string | null;
  contactEmail: string | null;
  phoneNumber: string | null;
}

export function AnalyseBrochure({
  slug,
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
  const [showOverlay, setShowOverlay] = useState(false);

  // Total pages: cover + sections + kansen + contact
  const totalPages = 1 + sections.length + 1 + 1;

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

  // Reduced motion
  useEffect(() => {
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion && videoRef.current) {
      videoRef.current.removeAttribute('autoplay');
      videoRef.current.pause();
      setShowOverlay(true);
    }
  }, []);

  // Show overlay after video or timeout
  useEffect(() => {
    if (currentPage !== 0) return;
    const timer = setTimeout(() => setShowOverlay(true), 12000);
    const video = videoRef.current;
    const onEnded = () => setShowOverlay(true);
    video?.addEventListener('ended', onEnded);
    return () => {
      clearTimeout(timer);
      video?.removeEventListener('ended', onEnded);
    };
  }, [currentPage]);

  // Track page view
  useEffect(() => {
    if (!prospect?.id) return;
    fetch('/api/offerte/viewed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospectId: prospect.id }),
    }).catch(() => {});
  }, [prospect?.id]);

  const progressLabel = `${String(currentPage + 1).padStart(2, '0')} / ${String(totalPages).padStart(2, '0')}`;

  // Cover page (page 0)
  if (currentPage === 0) {
    return (
      <main style={pageBase}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          preload="auto"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        >
          <source src="/video/klarifai-analyse.mp4" type="video/mp4" />
        </video>
        <BrandChrome />
        <ProgressIndicator label={progressLabel} />

        {/* Research stats overlay — fades in after video */}
        <div
          style={{
            position: 'absolute',
            right: '72px',
            bottom: '140px',
            zIndex: 10,
            opacity: showOverlay ? 1 : 0,
            transition: 'opacity 600ms ease-in-out',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontFamily: 'var(--font-sora), sans-serif',
          }}
        >
          <StatLine value={researchStats.bronnen} label="BRONNEN" />
          <StatLine value={researchStats.signalen} label="SIGNALEN" />
          <StatLine value={researchStats.inzichten} label="INZICHTEN" />
          <div style={{ height: '1px', background: 'rgba(225,195,60,0.4)', margin: '4px 0' }} />
          <div style={{
            fontSize: '11px', fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: TEXT_ON_NAVY, textAlign: 'right',
          }}>
            {prospect.companyName}
          </div>
        </div>

        <NextArrow onClick={handleNext} />
      </main>
    );
  }

  // Section pages (pages 1 to sections.length)
  const sectionIndex = currentPage - 1;
  if (sectionIndex >= 0 && sectionIndex < sections.length) {
    const section = sections[sectionIndex];
    const layout = selectLayout(section, sectionIndex);
    return (
      <main style={pageBase}>
        <GeometricBackdrop />
        <BrandChrome />
        <ProgressIndicator label={progressLabel} />
        {layout === 'split' && <SectionSplit section={section} pageNum={currentPage + 1} />}
        {layout === 'pillars' && <SectionPillars section={section} pageNum={currentPage + 1} />}
        {layout === 'quote' && <SectionQuote section={section} pageNum={currentPage + 1} />}
        <BackArrow onClick={handleBack} />
        <NextArrow onClick={handleNext} />
      </main>
    );
  }

  // Kansen page
  if (currentPage === sections.length + 1) {
    return (
      <main style={pageBase}>
        <GeometricBackdrop />
        <BrandChrome />
        <ProgressIndicator label={progressLabel} />
        <KansenPage
          companyName={prospect.companyName}
          recommendations={recommendations}
          recommendationType={recommendationType}
          pageNum={currentPage + 1}
        />
        <BackArrow onClick={handleBack} />
        <NextArrow onClick={handleNext} />
      </main>
    );
  }

  // Contact page (terminal)
  if (currentPage === totalPages - 1) {
    return (
      <main style={pageBase}>
        <GeometricBackdrop />
        <BrandChrome />
        <ProgressIndicator label={progressLabel} />
        <ContactPage
          companyName={prospect.companyName}
          bookingUrl={bookingUrl}
          contactEmail={contactEmail}
          phoneNumber={phoneNumber}
        />
        <BackArrow onClick={handleBack} />
        {/* No next arrow — terminal page */}
      </main>
    );
  }

  return null;
}

// --- Helpers ---

function StatLine({ value, label }: { value: number; label: string }) {
  const formatted = String(value).padStart(2, ' ');
  const spaced = label.split('').join(' ');
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: '16px' }}>
      <span style={{ ...goldGradientText, fontSize: '22px', fontWeight: 700, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{formatted}</span>
      <span style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.18em', color: TEXT_ON_NAVY }}>{spaced}</span>
    </div>
  );
}

function selectLayout(section: NarrativeSection, index: number): 'split' | 'pillars' | 'quote' {
  const hasNewsCitation = section.citations.some((c) => c.toUpperCase().includes('NEWS'));
  if (hasNewsCitation) return 'quote';
  // Use pillars for every 2nd section (index 1, 3, 5...) to alternate layouts
  if (index % 2 === 1) return 'pillars';
  return 'split';
}
```

Note: `SectionSplit`, `SectionPillars`, `SectionQuote`, `KansenPage`, and `ContactPage` are stub references — built in Tasks 3, 4, and 5.

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | grep -v "tmp-\|sitemap.test"`
Expected: No new errors (stubs will be added in next tasks).

- [ ] **Step 4: Commit**

```bash
git add app/analyse/[slug]/layout.tsx components/features/analyse/analyse-brochure.tsx
git commit -m "feat(analyse): add layout and brochure shell with video cover"
```

---

### Task 3: Build section page layouts (Split, Pillars, Quote)

**Files:**

- Modify: `components/features/analyse/analyse-brochure.tsx` (add section components)

All three section layouts are added to the same file, below the `AnalyseBrochure` component. Each matches the approved mockups in `.superpowers/brainstorm/806393-1776618955/content/section-variations.html`.

- [ ] **Step 1: Build SectionSplit component**

Add to `analyse-brochure.tsx`. Layout: section label + hero heading full-width, then 2-column grid (1.4fr narrative left, 1fr insight cards right), citations bar full-width at bottom.

Key insights are extracted from the narrative body: split on double-newline, take up to 3 paragraphs, derive a title from the first 5 words of each.

```typescript
function SectionSplit({ section, pageNum }: { section: NarrativeSection; pageNum: number }) {
  const paragraphs = section.body.split('\n\n').filter(Boolean);
  const insights = deriveInsights(paragraphs);
  const num = String(pageNum).padStart(2, '0');

  return (
    <div style={{ position: 'relative', zIndex: 1, padding: '120px 72px 120px', display: 'grid', gridTemplateRows: 'auto auto 1fr auto', gap: '20px', minHeight: '100vh', maxWidth: '1400px', margin: '0 auto' }}>
      <SectionLabel num={num} title={section.title} />
      <HeroHeading title={section.title} />
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '56px', alignItems: 'start' }}>
        <Narrative paragraphs={paragraphs} />
        <InsightCards insights={insights} />
      </div>
      <CitationsBar citations={section.citations} />
    </div>
  );
}
```

- [ ] **Step 2: Build SectionPillars component**

Layout: section label + mega hero heading (fills vertical space) + gold connecting line + 3 pillar cards horizontal. Extract 3 key points from narrative paragraphs.

```typescript
function SectionPillars({ section, pageNum }: { section: NarrativeSection; pageNum: number }) {
  const paragraphs = section.body.split('\n\n').filter(Boolean);
  const pillars = derivePillars(paragraphs);
  const num = String(pageNum).padStart(2, '0');

  return (
    <div style={{ position: 'relative', zIndex: 1, padding: '120px 72px 120px', display: 'grid', gridTemplateRows: 'auto 1fr auto auto', gap: '0', minHeight: '100vh', maxWidth: '1400px', margin: '0 auto' }}>
      <SectionLabel num={num} title={section.title} style={{ marginBottom: '24px' }} />
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <h1 style={{ fontSize: 'clamp(48px, 6vw, 88px)', fontWeight: 700, lineHeight: 1.04, letterSpacing: '-0.03em', maxWidth: '1000px' }}>
          {extractHeadline(section.title)}<GoldDot />
        </h1>
      </div>
      <div style={{ height: '1px', background: 'linear-gradient(90deg, rgba(225,195,60,0) 0%, rgba(225,195,60,0.7) 20%, rgba(253,249,123,0.9) 50%, rgba(225,195,60,0.7) 80%, rgba(225,195,60,0) 100%)', margin: '24px 0' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
        {pillars.map((p, i) => (
          <PillarCard key={i} num={String(i + 1).padStart(2, '0')} title={p.title} desc={p.desc} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build SectionQuote component**

Layout: section label + hero heading, then 2-column: left = gold-bordered pull quote + narrative, right = evidence cards. Only used when a NEWS citation exists.

```typescript
function SectionQuote({ section, pageNum }: { section: NarrativeSection; pageNum: number }) {
  const paragraphs = section.body.split('\n\n').filter(Boolean);
  const newsCitation = section.citations.find((c) => c.toUpperCase().includes('NEWS'));
  const quoteText = extractQuoteFromParagraphs(paragraphs);
  const evidencePoints = deriveEvidencePoints(paragraphs);
  const num = String(pageNum).padStart(2, '0');

  return (
    <div style={{ position: 'relative', zIndex: 1, padding: '120px 72px 120px', display: 'grid', gridTemplateRows: 'auto auto 1fr auto', gap: '24px', minHeight: '100vh', maxWidth: '1400px', margin: '0 auto' }}>
      <SectionLabel num={num} title={section.title} />
      <HeroHeading title={section.title} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'start' }}>
        <div>
          <PullQuote text={quoteText} source={newsCitation ?? ''} />
          <Narrative paragraphs={paragraphs.slice(1)} style={{ marginTop: '28px' }} />
        </div>
        <EvidenceCards points={evidencePoints} />
      </div>
      <CitationsBar citations={section.citations} />
    </div>
  );
}
```

- [ ] **Step 4: Build shared sub-components**

Add these helper components to the same file:

- `SectionLabel({ num, title })` — `[ 02 ] TITLE` pattern with gold number
- `HeroHeading({ title })` — `clamp(36px, 4.5vw, 60px)` heading with gold period
- `GoldDot()` — the `.` in gold gradient
- `Narrative({ paragraphs })` — renders paragraphs in Sora 300 17px muted
- `InsightCards({ insights })` — stacked container-gradient cards with gold numbers
- `PillarCard({ num, title, desc })` — container-gradient card for pillars layout
- `PullQuote({ text, source })` — gold left-border quote with source attribution
- `EvidenceCards({ points })` — stacked cards with gold-tinted icon + title + desc
- `CitationsBar({ citations })` — full-width subtle bar, joins citations with `·`
- `deriveInsights(paragraphs)` — extracts 3 insights from paragraphs (first sentence of each as title, rest as desc)
- `derivePillars(paragraphs)` — similar but structured as 3 pillar objects
- `extractHeadline(title)` — turns section title into a 2-line heading (split on natural break)
- `extractQuoteFromParagraphs(paragraphs)` — extracts a quotable sentence (one with quotes or most impactful)
- `deriveEvidencePoints(paragraphs)` — extracts 2 evidence points

Each helper function should handle edge cases: fewer than 3 paragraphs, no quotes found, etc. Default to the split layout data when derivation fails.

- [ ] **Step 5: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | grep -v "tmp-\|sitemap.test"`
Expected: No new errors.

- [ ] **Step 6: Commit**

```bash
git add components/features/analyse/analyse-brochure.tsx
git commit -m "feat(analyse): add three section page layouts (split, pillars, quote)"
```

---

### Task 4: Build Kansen and Contact pages

**Files:**

- Modify: `components/features/analyse/analyse-brochure.tsx` (add KansenPage + ContactPage)

- [ ] **Step 1: Build KansenPage component**

Add to `analyse-brochure.tsx`. Matches mockup `kansen-refined.html`.

```typescript
function KansenPage({
  companyName,
  recommendations,
  recommendationType,
  pageNum,
}: {
  companyName: string;
  recommendations: SPVRecommendation[] | UseCaseRecommendation[];
  recommendationType: 'spv' | 'usecase';
  pageNum: number;
}) {
  const num = String(pageNum).padStart(2, '0');

  return (
    <div style={{ position: 'relative', zIndex: 1, padding: '120px 72px 140px', display: 'grid', gridTemplateRows: 'auto auto 1fr', gap: '28px', minHeight: '100vh', maxWidth: '1400px', margin: '0 auto' }}>
      <SectionLabel num={num} title="Kansen" />
      <h1 style={{ fontSize: 'clamp(36px, 4.5vw, 60px)', fontWeight: 700, lineHeight: 1.06, letterSpacing: '-0.025em', maxWidth: '800px' }}>
        Concrete mogelijkheden<br />voor {companyName}<GoldDot />
      </h1>
      <div style={{ display: 'grid', gridTemplateColumns: recommendations.length === 1 ? '1fr' : '1fr 1fr', gap: '24px', alignContent: 'start', paddingTop: '8px' }}>
        {recommendations.map((rec, i) => (
          <RecommendationCard key={i} rec={rec} num={String(i + 1).padStart(2, '0')} type={recommendationType} />
        ))}
      </div>
    </div>
  );
}
```

`RecommendationCard` renders differently based on `type`:

- **spv**: shows `spvName` as eyebrow label, title derived from relevanceNarrative, `strategicTags` as pill badges
- **usecase**: shows `category` as eyebrow label, `useCaseTitle` as title, `applicableOutcomes` as tags

- [ ] **Step 2: Build ContactPage component**

Add to `analyse-brochure.tsx`. Matches approved mockup (option A — centered + buttons).

```typescript
function ContactPage({
  companyName,
  bookingUrl,
  contactEmail,
  phoneNumber,
}: {
  companyName: string;
  bookingUrl: string | null;
  contactEmail: string | null;
  phoneNumber: string | null;
}) {
  return (
    <div style={{ position: 'relative', zIndex: 1, padding: '120px 72px 140px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', gap: '28px' }}>
      {/* Gold eyebrow */}
      <div style={{ ...goldGradientText, fontSize: '11px', fontWeight: 500, letterSpacing: '0.22em', textTransform: 'uppercase' }}>
        Analyse compleet · {companyName}
      </div>

      {/* Hero */}
      <h1 style={{ fontSize: 'clamp(44px, 5.5vw, 76px)', fontWeight: 700, lineHeight: 1.06, letterSpacing: '-0.028em', maxWidth: '900px' }}>
        Laten we<br />in gesprek gaan<GoldDot />
      </h1>

      {/* Lead */}
      <p style={{ fontSize: '18px', fontWeight: 300, lineHeight: 1.55, color: TEXT_MUTED_ON_NAVY, maxWidth: '560px' }}>
        Wij hebben de analyse gedaan. Nu is het aan u om te beslissen of deze kansen het waard zijn om te verkennen. Geen verplichtingen, geen druk.
      </p>

      {/* CTA buttons */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '8px' }}>
        {bookingUrl && <GoldPillButton icon="calendar" label="Plan een gesprek" href={bookingUrl} />}
        {contactEmail && <GhostPillButton icon="mail" label={contactEmail} href={`mailto:${contactEmail}`} />}
        {phoneNumber && <GhostPillButton icon="phone" label={phoneNumber} href={`tel:${phoneNumber}`} />}
      </div>

      {/* Website link */}
      <a href="https://klarifai.nl" target="_blank" rel="noopener noreferrer"
        style={{ fontSize: '12px', fontWeight: 300, color: 'rgba(137,137,153,0.5)', textDecoration: 'underline', textDecorationColor: 'rgba(225,195,60,0.3)', textUnderlineOffset: '3px' }}>
        klarifai.nl
      </a>
    </div>
  );
}
```

Add `GoldPillButton` and `GhostPillButton` helpers with calendar/mail/phone SVG icons (copy icon patterns from offerte `Bevestigd` page).

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | grep -v "tmp-\|sitemap.test"`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add components/features/analyse/analyse-brochure.tsx
git commit -m "feat(analyse): add kansen and contact pages"
```

---

### Task 5: Wire server component to new AnalyseBrochure

**Files:**

- Modify: `app/analyse/[slug]/page.tsx`

- [ ] **Step 1: Update page.tsx to render AnalyseBrochure**

Replace the current `DashboardClient` / `WizardClient` rendering with the new `AnalyseBrochure` component. Keep all existing server-side data fetching. Add the `researchStats` calculation.

In `app/analyse/[slug]/page.tsx`, after the existing data fetching (around line 286), add:

```typescript
import { AnalyseBrochure } from '@/components/features/analyse/analyse-brochure';
```

Replace the return block (lines 399-475) with:

```typescript
// Compute research stats for cover overlay
const researchStats = {
  bronnen: evidenceItemsForDiscover.length,
  signalen: evidenceItemsForDiscover.filter((item) => {
    // Items that passed quality gate (appeared in the analysis)
    return true; // All evidence items that made it through filtering
  }).length,
  inzichten: (narrativeAnalysis?.sections ?? klarifaiNarrativeAnalysis?.sections ?? []).length,
};

const analysis = narrativeAnalysis ?? klarifaiNarrativeAnalysis;

if (analysis) {
  const isAtlantis = prospect.project.projectType === 'ATLANTIS';
  const recommendations = isAtlantis && narrativeAnalysis
    ? narrativeAnalysis.spvRecommendations
    : klarifaiNarrativeAnalysis?.useCaseRecommendations ?? [];

  return (
    <AnalyseBrochure
      slug={prospect.slug}
      prospect={{
        id: prospect.id,
        companyName: dashboardProps.companyName,
        domain: prospect.domain,
      }}
      sections={analysis.sections}
      recommendations={recommendations}
      recommendationType={isAtlantis ? 'spv' : 'usecase'}
      researchStats={researchStats}
      bookingUrl={dashboardProps.bookingUrl}
      contactEmail={dashboardProps.contactEmail}
      phoneNumber={dashboardProps.phoneNumber}
    />
  );
}

// Fallback: prospects without analysis-v2 get the old DashboardClient
return (
  <DashboardClient
    {...dashboardProps}
    narrativeAnalysis={narrativeAnalysis}
    klarifaiNarrativeAnalysis={klarifaiNarrativeAnalysis}
    analysisDate={analysisDateLabel}
  />
);
```

- [ ] **Step 2: Keep DashboardClient as fallback**

Do NOT delete the old `DashboardClient` import or `WizardClient`. Prospects without analysis-v2 data still need the old UI. The new brochure only renders when `narrativeAnalysis` or `klarifaiNarrativeAnalysis` exists.

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | grep -v "tmp-\|sitemap.test"`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add app/analyse/[slug]/page.tsx
git commit -m "feat(analyse): wire server component to new brochure UI"
```

---

### Task 6: Test in browser and fix visual issues

**Files:**

- Modify: `components/features/analyse/analyse-brochure.tsx` (fixes)

- [ ] **Step 1: Open the analyse page**

Navigate to `http://localhost:9200/analyse/nedri-spanstaal-bv-LQNrv57B`.
Expected: Video cover plays, overlay fades in with research stats + "Nedri Spanstaal BV".

- [ ] **Step 2: Click through all pages**

Verify each page:

1. Cover: video plays, stats overlay fades in, gold next arrow works
2. Section pages: each section renders with correct layout variant, hero headings, narrative text
3. Kansen page: recommendation cards display correctly
4. Contact page: hero, buttons, contact info visible
5. Arrow navigation works, keyboard ← → works
6. Progress indicator updates correctly

- [ ] **Step 3: Fix any visual issues**

Compare each page against the approved mockups in `.superpowers/brainstorm/806393-1776618955/content/`. Fix spacing, font sizes, colors, alignment issues.

- [ ] **Step 4: Test with Marfa prospect**

Navigate to `http://localhost:9200/analyse/marfa-_JHTy2L6`.
Verify the page works with different data (different section count, different recommendations).

- [ ] **Step 5: Commit fixes**

```bash
git add components/features/analyse/analyse-brochure.tsx
git commit -m "fix(analyse): visual polish after browser testing"
```

---

### Task 7: Add responsive breakpoints

**Files:**

- Modify: `components/features/analyse/analyse-brochure.tsx`

- [ ] **Step 1: Add CSS media queries via a style tag**

Since the component uses inline styles, add a `<style>` tag in the cover page (page 0) that provides responsive overrides. Reference the breakpoints from `section-c-refined.html` mockup:

```typescript
// Add this inside the AnalyseBrochure component, rendered once
<style>{`
  @media (max-width: 1024px) {
    .analyse-content { padding: 100px 48px 110px !important; }
    .analyse-split { grid-template-columns: 1fr 1fr !important; gap: 36px !important; }
    .analyse-pillars { grid-template-columns: repeat(2, 1fr) !important; }
  }
  @media (max-width: 768px) {
    .analyse-content { padding: 88px 24px 120px !important; }
    .analyse-split { grid-template-columns: 1fr !important; }
    .analyse-pillars { grid-template-columns: 1fr !important; }
    .analyse-kansen-grid { grid-template-columns: 1fr !important; }
  }
`}</style>
```

Add corresponding `className` props to the grid containers in each section layout.

- [ ] **Step 2: Test responsive at 1024px and 768px**

Use browser DevTools to resize. Verify:

- Tablet: 2-column layouts compress, padding reduces
- Mobile: single column, pages become scrollable

- [ ] **Step 3: Commit**

```bash
git add components/features/analyse/analyse-brochure.tsx
git commit -m "feat(analyse): add responsive breakpoints for tablet and mobile"
```

---

### Task 8: Session tracking integration

**Files:**

- Modify: `components/features/analyse/analyse-brochure.tsx`

- [ ] **Step 1: Add session tracking hooks**

Reuse the existing `api.wizard.startSession`, `trackProgress`, and `trackCallBooked` mutations from `wizard-client.tsx`. Add to `AnalyseBrochure`:

```typescript
import { api } from '@/components/providers';

// Inside AnalyseBrochure:
const startSession = api.wizard.startSession.useMutation();
const trackProgress = api.wizard.trackProgress.useMutation();
const [sessionId, setSessionId] = useState<string | null>(null);
const stepTimesRef = useRef<Record<string, number>>({});
const stepStartRef = useRef<number>(performance.now());

// Start session on mount
useEffect(() => {
  startSession.mutate(
    { slug, userAgent: navigator.userAgent },
    {
      onSuccess: (data) => {
        if (data) setSessionId(data.sessionId);
      },
    },
  );
}, []);

// Track on page change
useEffect(() => {
  const elapsedMs = Math.max(0, performance.now() - stepStartRef.current);
  stepTimesRef.current[String(currentPage)] = Math.floor(elapsedMs / 1000);
  stepStartRef.current = performance.now();

  if (sessionId) {
    trackProgress.mutate({
      sessionId,
      currentStep: currentPage,
      stepTimes: stepTimesRef.current,
    });
  }
}, [currentPage]);
```

- [ ] **Step 2: Verify session is created**

Open `http://localhost:9200/analyse/nedri-spanstaal-bv-LQNrv57B`, check browser Network tab for the `startSession` tRPC call. Click through pages and verify `trackProgress` calls fire.

- [ ] **Step 3: Commit**

```bash
git add components/features/analyse/analyse-brochure.tsx
git commit -m "feat(analyse): add session tracking for page navigation"
```

---

### Task 9: Final typecheck and cleanup

**Files:**

- All modified files

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -v "tmp-\|sitemap.test"`
Expected: No new errors.

- [ ] **Step 2: Lint**

Run: `npx eslint components/features/analyse/ lib/brochure-tokens.ts components/shared/brochure-chrome.tsx --fix`
Expected: No errors.

- [ ] **Step 3: Verify offerte still works**

Open `http://localhost:9200/offerte/marfa` — click through all 7 pages. Must be identical to before refactor.

- [ ] **Step 4: Verify analyse with both project types**

- Nedri (Atlantis): `http://localhost:9200/analyse/nedri-spanstaal-bv-LQNrv57B` — SPV recommendations
- Marfa (Klarifai): `http://localhost:9200/analyse/marfa-_JHTy2L6` — use case recommendations

- [ ] **Step 5: Verify redirect**

Open `http://localhost:9200/discover/nedri-spanstaal-bv-LQNrv57B` — should 301 redirect to `/analyse/`.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(analyse): complete brochure-style analyse page redesign"
```

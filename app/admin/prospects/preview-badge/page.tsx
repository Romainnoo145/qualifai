'use client';

import Link from 'next/link';
import { ProspectLogo } from '@/components/features/prospects/prospect-logo';
import { ResearchRunBadge } from '@/components/features/research/research-run-badge';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Mock data — Marfa prospect with an active CRAWLING research run
// ---------------------------------------------------------------------------

const mockProspect = {
  id: 'preview-marfa',
  companyName: 'Marfa',
  domain: 'marfa.nl',
  industry: 'Hospitality',
  logoUrl: null as string | null,
};

const mockRunStatus = 'CRAWLING' as const;
const mockQualityLight: 'solid' | 'limited' | 'thin' = 'limited';
const mockSessions = 3;

// ---------------------------------------------------------------------------
// Shared sub-components (identical across all rows)
// ---------------------------------------------------------------------------

function Logo() {
  return (
    <ProspectLogo
      prospect={{
        logoUrl: mockProspect.logoUrl,
        domain: mockProspect.domain,
        companyName: mockProspect.companyName,
      }}
      size={48}
      shape="rounded"
      className="border border-[var(--color-border)] bg-[var(--color-surface-2)]"
    />
  );
}

function QualityText() {
  return (
    <span
      className={cn(
        'text-[12px] font-light min-w-[50px]',
        mockQualityLight === 'solid' && 'text-[var(--color-ink)] font-medium',
        mockQualityLight === 'limited' && 'text-[#b45a3b]',
        mockQualityLight === 'thin' && 'text-[var(--color-muted)] italic',
      )}
    >
      {mockQualityLight === 'solid'
        ? 'Solid'
        : mockQualityLight === 'limited'
          ? 'Limited'
          : 'Thin'}
    </span>
  );
}

function SessionsText() {
  return (
    <span className="text-[11px] font-medium text-[var(--color-gold)] tracking-[0.05em]">
      {mockSessions} sessions
    </span>
  );
}

function ArrowButton() {
  return (
    <span className="w-9 h-9 rounded-full border border-[var(--color-border)] flex items-center justify-center text-[var(--color-muted)] shrink-0">
      →
    </span>
  );
}

// ---------------------------------------------------------------------------
// Section label + separator
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-muted)] font-medium mb-3">
      {children}
    </p>
  );
}

function Separator() {
  return <div className="border-t border-[var(--color-surface-2)] my-8" />;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PreviewBadgePage() {
  return (
    <div className="px-8 py-12 max-w-[920px] mx-auto">
      {/* Heading */}
      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-gold)] font-medium mb-2">
        Compare
      </p>
      <h1 className="text-[28px] font-semibold text-[var(--color-ink)] tracking-[-0.02em] mb-10">
        Badge layout preview
      </h1>

      {/* ------------------------------------------------------------------ */}
      {/* Section 1 — Huidig (controle)                                       */}
      {/* ------------------------------------------------------------------ */}
      <SectionLabel>Huidig (controle)</SectionLabel>

      {/* Badge sits INSIDE the name cluster, next to the company name */}
      <Link
        href="#"
        onClick={(e) => e.preventDefault()}
        className="flex items-center gap-6 py-5 border-b border-[var(--color-surface-2)] hover:pl-2 transition-all group"
      >
        <Logo />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[17px] font-medium text-[var(--color-ink)] tracking-[-0.01em]">
              {mockProspect.companyName}
            </span>
            {/* Badge is inline with the name */}
            <ResearchRunBadge status={mockRunStatus} />
          </div>
          <div className="flex items-center gap-2 mt-1 text-[12px] font-light text-[var(--color-muted)]">
            <span>{mockProspect.domain}</span>
            <span className="w-[3px] h-[3px] rounded-full bg-[var(--color-border-strong)]" />
            <span>{mockProspect.industry}</span>
          </div>
        </div>

        <QualityText />
        <SessionsText />
        <ArrowButton />
      </Link>

      <Separator />

      {/* ------------------------------------------------------------------ */}
      {/* Section 2 — Optie A: badge rechts                                   */}
      {/* ------------------------------------------------------------------ */}
      <SectionLabel>Optie A — badge rechts</SectionLabel>

      {/* Badge moves OUT of the name cluster → sits between min-w-0 div and QualityText */}
      <Link
        href="#"
        onClick={(e) => e.preventDefault()}
        className="flex items-center gap-6 py-5 border-b border-[var(--color-surface-2)] hover:pl-2 transition-all group"
      >
        <Logo />

        <div className="flex-1 min-w-0">
          {/* Name cluster has NO badge — just the name */}
          <div className="flex items-center gap-2">
            <span className="text-[17px] font-medium text-[var(--color-ink)] tracking-[-0.01em]">
              {mockProspect.companyName}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-[12px] font-light text-[var(--color-muted)]">
            <span>{mockProspect.domain}</span>
            <span className="w-[3px] h-[3px] rounded-full bg-[var(--color-border-strong)]" />
            <span>{mockProspect.industry}</span>
          </div>
        </div>

        {/* Badge is now a right-side row element, before quality */}
        <ResearchRunBadge status={mockRunStatus} />
        <QualityText />
        <SessionsText />
        <ArrowButton />
      </Link>

      <Separator />

      {/* ------------------------------------------------------------------ */}
      {/* Section 3 — Optie B: left-border accent + badge rechts              */}
      {/* ------------------------------------------------------------------ */}
      <SectionLabel>Optie B — left-border accent + badge rechts</SectionLabel>

      {/* Same as A, plus gold left-border + pl-3 offset to clear the border */}
      <Link
        href="#"
        onClick={(e) => e.preventDefault()}
        className="flex items-center gap-6 py-5 border-b border-[var(--color-surface-2)] hover:pl-2 transition-all group border-l-2 border-l-[var(--color-gold)] pl-3"
      >
        <Logo />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[17px] font-medium text-[var(--color-ink)] tracking-[-0.01em]">
              {mockProspect.companyName}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-[12px] font-light text-[var(--color-muted)]">
            <span>{mockProspect.domain}</span>
            <span className="w-[3px] h-[3px] rounded-full bg-[var(--color-border-strong)]" />
            <span>{mockProspect.industry}</span>
          </div>
        </div>

        {/* Badge right-side, same as Optie A */}
        <ResearchRunBadge status={mockRunStatus} />
        <QualityText />
        <SessionsText />
        <ArrowButton />
      </Link>
    </div>
  );
}

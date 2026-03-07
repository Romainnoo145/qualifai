'use client';

import {
  Calendar,
  Compass,
  Download,
  ExternalLink,
  Gauge,
  Microscope,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { PartnershipDiscoverSnapshot } from '@/lib/partnership/discover';
import { DashboardClient } from './prospect-dashboard-client';

type PartnershipDiscoverClientProps = React.ComponentProps<
  typeof DashboardClient
> & {
  projectName: string;
  spvName: string | null;
  partnership: PartnershipDiscoverSnapshot | null;
};

type ReadinessTier = 'high' | 'medium' | 'low';

function toReadinessTier(readinessScore: number): ReadinessTier {
  if (readinessScore >= 70) return 'high';
  if (readinessScore >= 45) return 'medium';
  return 'low';
}

function formatSourceLabel(value: string): string {
  return value.replace(/_/g, ' ').toLowerCase();
}

function tierClasses(tier: ReadinessTier): string {
  if (tier === 'high') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (tier === 'medium') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function urgencyClasses(urgency: 'high' | 'medium' | 'low'): string {
  if (urgency === 'high') return 'bg-rose-100 text-rose-700 border-rose-200';
  if (urgency === 'medium')
    return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

function CtaButton(props: {
  label: string;
  href: string | null;
  icon: ComponentType<{ className?: string }>;
  tone?: 'primary' | 'secondary';
}) {
  const Icon = props.icon;
  const baseClass =
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] transition-all';
  const toneClass =
    props.tone === 'secondary'
      ? 'border border-[#040026]/15 text-[#040026] hover:bg-[#040026]/5'
      : 'bg-[#040026] text-white hover:bg-[#1E1E4A]';

  if (!props.href) {
    return (
      <span
        className={`${baseClass} ${toneClass} cursor-not-allowed opacity-40`}
      >
        <Icon className="h-3.5 w-3.5" />
        {props.label}
      </span>
    );
  }

  const isExternal =
    props.href.startsWith('http://') ||
    props.href.startsWith('https://') ||
    props.href.startsWith('mailto:');
  return (
    <a
      href={props.href}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className={`${baseClass} ${toneClass}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {props.label}
    </a>
  );
}

export function PartnershipDiscoverClient({
  projectName,
  spvName,
  partnership,
  bookingUrl,
  lossMapId,
  contactEmail,
  companyName,
  ...dashboardProps
}: PartnershipDiscoverClientProps) {
  const readinessScore = partnership?.readinessScore ?? 0;
  const tier = toReadinessTier(readinessScore);
  const topTriggers = partnership?.triggers.slice(0, 2) ?? [];
  const whyNowBullets = topTriggers
    .map((trigger) => trigger.whyNow.trim())
    .filter((value) => value.length > 0)
    .slice(0, 3);
  const strategyVersion = partnership?.strategyVersion ?? 'partnership-v1';
  const sourceMix = partnership?.signalCounts;
  const contextPackHref = lossMapId
    ? `/api/export/loss-map/${lossMapId}?format=pdf`
    : null;
  const fallbackMailHref = contactEmail
    ? `mailto:${contactEmail}?subject=${encodeURIComponent(`Partnership intake - ${companyName}`)}`
    : null;

  const ctaPrimary =
    tier === 'high'
      ? {
          label: 'Plan Partnership Session',
          href: bookingUrl ?? fallbackMailHref,
          icon: Calendar,
          tone: 'primary' as const,
        }
      : tier === 'medium'
        ? {
            label: 'Open Context Pack',
            href: contextPackHref,
            icon: Download,
            tone: 'primary' as const,
          }
        : {
            label: 'Plan Validation Call',
            href: bookingUrl ?? fallbackMailHref,
            icon: Microscope,
            tone: 'primary' as const,
          };

  const ctaSecondary =
    tier === 'high'
      ? {
          label: 'Open Context Pack',
          href: contextPackHref,
          icon: Download,
          tone: 'secondary' as const,
        }
      : {
          label: 'Plan Session',
          href: bookingUrl ?? fallbackMailHref,
          icon: Calendar,
          tone: 'secondary' as const,
        };

  return (
    <div className="space-y-4">
      <section className="mx-auto max-w-6xl rounded-2xl border border-[#040026]/10 bg-[#040026] px-5 py-4 text-white shadow-xl shadow-[#040026]/10 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#EBCB4B]">
          Partnership Discover
        </p>
        <h2 className="mt-1 text-lg font-black tracking-tight">
          {projectName}
        </h2>
        <p className="mt-1 text-sm text-white/80">
          Evidence bridge mode is active
          {spvName ? ` • SPV: ${spvName}` : ''}
        </p>
      </section>

      <section className="mx-auto max-w-6xl rounded-2xl border border-[#040026]/10 bg-white px-5 py-5 shadow-sm shadow-[#040026]/5 sm:px-6">
        {partnership ? (
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <article className="rounded-2xl border border-[#040026]/10 bg-[#F8F9FA] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                    Partnership Readiness
                  </p>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${tierClasses(tier)}`}
                  >
                    {tier}
                  </span>
                </div>
                <div className="mt-3 flex items-end gap-2">
                  <Gauge className="h-4 w-4 text-[#040026]" />
                  <span className="text-2xl font-black text-[#040026]">
                    {readinessScore}
                  </span>
                  <span className="pb-0.5 text-xs font-bold text-slate-500">
                    / 100
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-[#040026] transition-all"
                    style={{ width: `${Math.max(6, readinessScore)}%` }}
                  />
                </div>
                <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                  <p className="font-semibold text-slate-700">
                    {partnership.triggerCount} trigger
                    {partnership.triggerCount === 1 ? '' : 's'} gedetecteerd
                  </p>
                  <p className="font-semibold text-slate-700">
                    Strategy: {strategyVersion}
                  </p>
                  {sourceMix && (
                    <>
                      <p>External signals: {sourceMix.external}</p>
                      <p>RAG citations: {sourceMix.rag}</p>
                    </>
                  )}
                </div>
                {Array.isArray(partnership.gaps) && partnership.gaps.length > 0 && (
                  <p className="mt-3 text-xs text-amber-700">
                    Gap: {partnership.gaps[0]}
                  </p>
                )}
              </article>

              <article className="rounded-2xl border border-[#040026]/10 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Recommended Action
                </p>
                <h3 className="mt-2 text-base font-black tracking-tight text-[#040026]">
                  {tier === 'high'
                    ? 'Start direct met partnership intake'
                    : tier === 'medium'
                      ? 'Deel context pack en plan vervolggesprek'
                      : 'Valideer eerst scope met korte intake'}
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  CTA-routing is dynamisch op basis van readiness + triggerdichtheid.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <CtaButton {...ctaPrimary} />
                  <CtaButton {...ctaSecondary} />
                </div>
              </article>
            </div>

            {whyNowBullets.length > 0 && (
              <article className="rounded-2xl border border-[#040026]/10 bg-[#040026]/[0.03] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Why Now
                </p>
                <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                  {whyNowBullets.map((reason, index) => (
                    <li key={`${reason}-${index}`} className="flex items-start gap-2">
                      <Compass className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#040026]" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </article>
            )}

            {topTriggers.length > 0 && (
              <div className="grid gap-4 lg:grid-cols-2">
                {topTriggers.map((trigger, index) => (
                  <article
                    key={`${trigger.triggerType}-${index}`}
                    className="rounded-2xl border border-[#040026]/10 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${urgencyClasses(trigger.urgency)}`}
                      >
                        {trigger.urgency} urgency
                      </span>
                      <p className="text-xs font-bold text-slate-500">
                        Confidence {Math.round(trigger.confidenceScore * 100)}%
                      </p>
                    </div>
                    <h4 className="mt-2 text-base font-black tracking-tight text-[#040026]">
                      {trigger.title}
                    </h4>
                    <p className="mt-1 text-sm text-slate-600">
                      {trigger.rationale}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      Sources: {trigger.sourceTypes.map(formatSourceLabel).join(', ')}
                    </p>
                    {trigger.evidence.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {trigger.evidence.map((evidence) => (
                          <li
                            key={evidence.id}
                            className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5"
                          >
                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                              <span>{formatSourceLabel(evidence.sourceType)}</span>
                              <a
                                href={evidence.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[#040026] hover:underline"
                              >
                                open source
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                            <p className="mt-1 text-xs text-slate-600">
                              {evidence.title ? `${evidence.title}: ` : ''}
                              {evidence.snippet}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#040026]/20 bg-[#F8F9FA] p-5 text-sm text-slate-600">
            Partnership readiness wordt opgebouwd na de eerste research-run.
          </div>
        )}
      </section>

      <DashboardClient
        {...dashboardProps}
        companyName={companyName}
        lossMapId={lossMapId}
        bookingUrl={bookingUrl}
        contactEmail={contactEmail}
      />
    </div>
  );
}

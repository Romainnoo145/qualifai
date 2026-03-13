import { AtlantisDiscoverClient } from '@/components/public/atlantis-discover-client';
import { DashboardClient } from '@/components/public/prospect-dashboard-client';
import type { NarrativeAnalysis } from '@/lib/analysis/types';
import prisma from '@/lib/prisma';
import {
  buildDiscoverSlug,
  discoverLookupCandidates,
} from '@/lib/prospect-url';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

interface DiscoverEvidenceItem {
  id: string;
  sourceType: string;
  sourceUrl: string;
  title: string | null;
  snippet: string;
}

function isStackClueEvidence(item: {
  title: string | null;
  snippet: string;
  sourceUrl: string;
}): boolean {
  const haystack =
    `${item.title ?? ''} ${item.snippet} ${item.sourceUrl}`.toLowerCase();
  return (
    haystack.includes('stack clues') ||
    haystack.includes('public stack clues detected') ||
    haystack.includes('tech stack clues')
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toConfidencePercentage(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const bounded = Math.max(0, Math.min(1, value));
  return Math.round(bounded * 100);
}

function formatDateLabel(date: Date | null | undefined): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat('nl-NL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Amsterdam',
  }).format(date);
}

function statusLabel(status: string | null | undefined): string | null {
  if (!status) return null;
  switch (status) {
    case 'PENDING':
      return 'Onderzoek gestart';
    case 'CRAWLING':
      return 'Bronnen verzamelen';
    case 'EXTRACTING':
      return 'Data-extractie';
    case 'HYPOTHESIS':
      return 'Hypotheses opstellen';
    case 'BRIEFING':
      return 'Briefing opstellen';
    case 'COMPLETED':
      return 'Onderzoek afgerond';
    case 'FAILED':
      return 'Onderzoek update nodig';
    default:
      return status;
  }
}

function enrichmentLabel(strategy: unknown): string | null {
  if (typeof strategy !== 'string') return null;
  switch (strategy) {
    case 'apollo_only':
      return 'Apollo verrijking';
    case 'apollo_plus_kvk':
      return 'Apollo + KvK verificatie';
    case 'apollo_plus_kvk_unmatched':
      return 'Apollo + KvK check (geen match)';
    default:
      return null;
  }
}

function discoverDescription(
  projectType: string | null | undefined,
  companyName: string,
): string {
  if (projectType === 'ATLANTIS') {
    return `Partnership analyse voor ${companyName} met strategische inzichten en samenwerkingsmogelijkheden.`;
  }
  return `Gepersonaliseerde workflow analyse voor ${companyName}`;
}

function parseNarrativeAnalysis(content: unknown): NarrativeAnalysis | null {
  const obj = asRecord(content);
  if (!obj) return null;
  if (obj.version !== 'analysis-v2') return null;
  if (typeof obj.openingHook !== 'string') return null;
  if (typeof obj.executiveSummary !== 'string') return null;
  if (!Array.isArray(obj.sections) || obj.sections.length === 0) return null;
  if (!Array.isArray(obj.spvRecommendations)) return null;
  return obj as unknown as NarrativeAnalysis;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const candidates = discoverLookupCandidates(slug);
  if (candidates.length === 0) return { title: 'Not Found' };

  const prospect = await prisma.prospect.findFirst({
    where: {
      OR: candidates.flatMap((candidate) => [
        { slug: candidate },
        { readableSlug: candidate },
      ]),
    },
    select: {
      companyName: true,
      domain: true,
      industry: true,
      project: {
        select: {
          projectType: true,
          brandName: true,
          name: true,
        },
      },
    },
  });

  if (!prospect) return { title: 'Not Found' };

  const name = prospect.companyName ?? prospect.domain;
  const projectLabel = prospect.project.brandName ?? prospect.project.name;
  const description = discoverDescription(prospect.project.projectType, name);
  return {
    title: `${name} | Workflow Analyse by ${projectLabel}`,
    description,
    openGraph: {
      title:
        prospect.project.projectType === 'ATLANTIS'
          ? `Partnership Analyse voor ${name}`
          : `Workflow analyse voor ${name}`,
      description,
    },
  };
}

export default async function DiscoverPage({ params }: Props) {
  const { slug: discoverParam } = await params;
  const candidates = discoverLookupCandidates(discoverParam);
  if (candidates.length === 0) notFound();

  const prospect = await prisma.prospect.findFirst({
    where: {
      OR: candidates.flatMap((candidate) => [
        { slug: candidate },
        { readableSlug: candidate },
      ]),
    },
    select: {
      id: true,
      slug: true,
      readableSlug: true,
      project: {
        select: {
          projectType: true,
          name: true,
          brandName: true,
        },
      },
      spv: {
        select: {
          name: true,
        },
      },
      companyName: true,
      domain: true,
      industry: true,
      logoUrl: true,
      status: true,
      lushaRawData: true,
      lastEnrichedAt: true,
      workflowHypotheses: {
        where: { status: { in: ['ACCEPTED', 'PENDING', 'DRAFT'] } },
        orderBy: { confidenceScore: 'desc' },
        take: 6,
        select: {
          id: true,
          title: true,
          problemStatement: true,
          confidenceScore: true,
          hoursSavedWeekLow: true,
          hoursSavedWeekMid: true,
          hoursSavedWeekHigh: true,
          handoffSpeedGainPct: true,
          errorReductionPct: true,
          revenueLeakageRecoveredMid: true,
          status: true,
          proofMatches: {
            orderBy: { score: 'desc' },
            take: 3,
            select: {
              id: true,
              score: true,
              useCase: {
                select: {
                  id: true,
                  title: true,
                  summary: true,
                  category: true,
                  outcomes: true,
                },
              },
            },
          },
        },
      },
      workflowLossMaps: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true },
      },
      researchRuns: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          status: true,
          completedAt: true,
          qualityApproved: true,
          summary: true,
          inputSnapshot: true,
          evidenceItems: {
            select: {
              id: true,
              sourceType: true,
              sourceUrl: true,
              title: true,
              snippet: true,
            },
          },
        },
      },
      heroContent: true,
      dataOpportunities: true,
      automationAgents: true,
      successStories: true,
      aiRoadmap: true,
    },
  });

  if (!prospect || prospect.status === 'ARCHIVED') {
    notFound();
  }

  // Fetch latest AI master analysis for ATLANTIS prospects
  const prospectAnalysis =
    prospect.project.projectType === 'ATLANTIS'
      ? await prisma.prospectAnalysis.findFirst({
          where: { prospectId: prospect.id },
          orderBy: { createdAt: 'desc' },
          select: { content: true, createdAt: true },
        })
      : null;

  const narrativeAnalysis = prospectAnalysis
    ? parseNarrativeAnalysis(prospectAnalysis.content)
    : null;

  const canonicalSlug = buildDiscoverSlug({
    slug: prospect.slug,
    readableSlug: prospect.readableSlug,
    companyName: prospect.companyName,
    domain: prospect.domain,
  });
  if (discoverParam !== canonicalSlug) {
    redirect(`/discover/${canonicalSlug}`);
  }

  const enrichment = asRecord(prospect.lushaRawData);
  const confidence = asRecord(enrichment?.confidence);
  const kvk = asRecord(enrichment?.kvk);

  const latestAnyRun = prospect.researchRuns[0] ?? null;
  const latestCompletedRun =
    prospect.researchRuns.find((run) => run.status === 'COMPLETED') ?? null;
  const latestRun = latestCompletedRun ?? latestAnyRun;
  const latestRunSummary = asRecord(latestRun?.summary);
  const rawEvidenceItems: DiscoverEvidenceItem[] =
    latestRun?.evidenceItems.map((item) => ({
      id: item.id,
      sourceType: item.sourceType,
      sourceUrl: item.sourceUrl,
      title: item.title,
      snippet: item.snippet,
    })) ?? [];
  const evidenceItemsForDiscover =
    prospect.project.projectType === 'ATLANTIS'
      ? rawEvidenceItems.filter((item) => !isStackClueEvidence(item))
      : rawEvidenceItems;
  const diagnosticsRaw = Array.isArray(latestRunSummary?.diagnostics)
    ? latestRunSummary.diagnostics
    : [];
  const diagnosticsWarningCount = diagnosticsRaw.reduce((count, item) => {
    const diagnostic = asRecord(item);
    const status = diagnostic?.status;
    if (status === 'warning' || status === 'error') return count + 1;
    return count;
  }, 0);

  const sourceTypeCount = new Set(
    evidenceItemsForDiscover.map((item) => item.sourceType),
  ).size;

  const trustSnapshot = {
    combinedConfidencePct: toConfidencePercentage(confidence?.combined),
    enrichmentLabel: enrichmentLabel(confidence?.strategy),
    kvkNumber:
      typeof kvk?.kvkNummer === 'string' ? (kvk.kvkNummer as string) : null,
    kvkLegalForm:
      typeof kvk?.rechtsvorm === 'string' ? (kvk.rechtsvorm as string) : null,
    lastUpdateLabel:
      formatDateLabel(latestRun?.completedAt) ??
      formatDateLabel(prospect.lastEnrichedAt),
    researchStatusLabel: statusLabel(latestAnyRun?.status ?? latestRun?.status),
    qualityLabel:
      latestRun?.qualityApproved === true
        ? 'Kwaliteitscheck akkoord'
        : latestRun?.qualityApproved === false
          ? 'Kwaliteitscheck in review'
          : null,
    evidenceCount: evidenceItemsForDiscover.length,
    sourceTypeCount,
    diagnosticsWarningCount,
  };

  const dashboardProps = {
    prospectSlug: prospect.slug,
    companyName: prospect.companyName ?? prospect.domain,
    industry: prospect.industry,
    hypotheses: prospect.workflowHypotheses,
    prospectStatus: prospect.status,
    lossMapId: prospect.workflowLossMaps[0]?.id ?? null,
    bookingUrl: process.env.NEXT_PUBLIC_CALCOM_BOOKING_URL ?? null,
    whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? null,
    phoneNumber: process.env.NEXT_PUBLIC_PHONE_NUMBER ?? null,
    contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? null,
    heroContent: prospect.heroContent as Record<string, unknown>,
    dataOpportunities: prospect.dataOpportunities as Record<string, unknown>,
    automationAgents: prospect.automationAgents as Record<string, unknown>,
    successStories: prospect.successStories as Record<string, unknown>,
    aiRoadmap: prospect.aiRoadmap as Record<string, unknown>,
    trustSnapshot,
    projectType: prospect.project.projectType,
    projectBrandName: prospect.project.brandName ?? prospect.project.name,
  };

  if (prospect.project.projectType === 'ATLANTIS' && narrativeAnalysis) {
    const analysisDate = new Intl.DateTimeFormat('nl-NL', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Amsterdam',
    }).format(prospectAnalysis!.createdAt);

    return (
      <AtlantisDiscoverClient
        companyName={dashboardProps.companyName}
        industry={dashboardProps.industry}
        prospectSlug={dashboardProps.prospectSlug}
        analysis={narrativeAnalysis}
        projectBrandName={dashboardProps.projectBrandName}
        bookingUrl={dashboardProps.bookingUrl}
        whatsappNumber={dashboardProps.whatsappNumber}
        phoneNumber={dashboardProps.phoneNumber}
        contactEmail={dashboardProps.contactEmail}
        analysisDate={analysisDate}
      />
    );
  }

  if (prospect.project.projectType === 'ATLANTIS') {
    const brandName = prospect.project.brandName ?? prospect.project.name;
    const brandMark = brandName.charAt(0).toUpperCase();
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col font-sans">
        {/* Header — matches AtlantisDiscoverClient shell */}
        <header className="sticky top-0 z-50 bg-[#F8F9FA]/80 backdrop-blur-3xl border-b border-black/5">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
            <div className="w-9 h-9 rounded-2xl bg-[#040026] flex items-center justify-center shadow-lg shadow-[#040026]/10">
              <span className="text-[#EBCB4B] font-black text-xs">
                {brandMark}
              </span>
            </div>
            <span className="text-md font-black text-[#040026] tracking-tighter">
              {dashboardProps.companyName}
            </span>
          </div>
          <div className="h-0.5 bg-slate-100" />
        </header>

        {/* Content */}
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-lg text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-[#040026]/5 mb-8">
              <svg
                className="w-7 h-7 text-[#040026]/40 animate-pulse"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-black text-[#040026] tracking-tight mb-3">
              Uw partnership analyse wordt voorbereid
            </h1>
            <p className="text-sm leading-relaxed text-slate-500 max-w-sm mx-auto">
              Wij analyseren de strategische mogelijkheden voor{' '}
              {dashboardProps.companyName}. U ontvangt bericht zodra uw
              persoonlijke analyse gereed is.
            </p>
          </div>
        </main>

        {/* Footer */}
        <footer className="py-6 text-center">
          <span className="text-[10px] uppercase tracking-widest text-slate-300 font-medium">
            {brandName}
          </span>
        </footer>
      </div>
    );
  }

  return <DashboardClient {...dashboardProps} />;
}

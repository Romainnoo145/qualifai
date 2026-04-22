import { DashboardClient } from '@/components/public/prospect-dashboard-client';
import { AnalyseBrochure } from '@/components/features/analyse/analyse-brochure';
import type {
  NarrativeAnalysis,
  KlarifaiNarrativeAnalysis,
} from '@/lib/analysis/types';
import prisma from '@/lib/prisma';
import {
  buildDiscoverSlug,
  discoverLookupCandidates,
} from '@/lib/prospect-url';
import { statusLabel, isActiveStatus } from '@/lib/research/status-labels';
import { ActiveRunPoller } from '@/components/features/research/active-run-poller';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { PUBLIC_VISIBLE_STATUSES } from '@/lib/constants/prospect-statuses';

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
    return `Strategische partnership analyse voor ${companyName}.`;
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

function parseKlarifaiNarrativeAnalysis(
  content: unknown,
): KlarifaiNarrativeAnalysis | null {
  const obj = asRecord(content);
  if (!obj) return null;
  if (obj.version !== 'analysis-v2') return null;
  if (typeof obj.openingHook !== 'string') return null;
  if (typeof obj.executiveSummary !== 'string') return null;
  if (!Array.isArray(obj.sections) || obj.sections.length === 0) return null;
  if (!Array.isArray(obj.useCaseRecommendations)) return null;
  return obj as unknown as KlarifaiNarrativeAnalysis;
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
      _count: { select: { evidenceItems: true } },
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

  if (
    !prospect ||
    !(PUBLIC_VISIBLE_STATUSES as readonly string[]).includes(prospect.status)
  ) {
    notFound();
  }

  const latestRun = prospect.researchRuns[0] ?? null;

  if (isActiveStatus(latestRun?.status ?? null)) {
    return <ActiveRunPoller slug={discoverParam} />;
  }

  // Fetch latest AI master analysis for all project types
  const prospectAnalysis = await prisma.prospectAnalysis.findFirst({
    where: { prospectId: prospect.id },
    orderBy: { createdAt: 'desc' },
    select: { content: true, createdAt: true },
  });

  const narrativeAnalysis = prospectAnalysis
    ? parseNarrativeAnalysis(prospectAnalysis.content)
    : null;

  const klarifaiNarrativeAnalysis =
    prospect.project.projectType !== 'ATLANTIS' && prospectAnalysis
      ? parseKlarifaiNarrativeAnalysis(prospectAnalysis.content)
      : null;

  const canonicalSlug = buildDiscoverSlug({
    slug: prospect.slug,
    readableSlug: prospect.readableSlug,
    companyName: prospect.companyName,
    domain: prospect.domain,
  });
  if (discoverParam !== canonicalSlug) {
    redirect(`/analyse/${canonicalSlug}`);
  }

  const enrichment = asRecord(prospect.lushaRawData);
  const confidence = asRecord(enrichment?.confidence);
  const kvk = asRecord(enrichment?.kvk);

  const latestCompletedRun =
    prospect.researchRuns.find((run) => run.status === 'COMPLETED') ?? null;
  const latestRunWithData = latestCompletedRun ?? latestRun;
  const latestRunSummary = asRecord(latestRunWithData?.summary);
  const rawEvidenceItems: DiscoverEvidenceItem[] =
    latestRunWithData?.evidenceItems.map((item) => ({
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
      formatDateLabel(latestRunWithData?.completedAt) ??
      formatDateLabel(prospect.lastEnrichedAt),
    researchStatusLabel: statusLabel(
      latestRun?.status ?? latestRunWithData?.status,
    ),
    qualityLabel:
      latestRunWithData?.qualityApproved === true
        ? 'Kwaliteitscheck akkoord'
        : latestRunWithData?.qualityApproved === false
          ? 'Kwaliteitscheck in review'
          : null,
    evidenceCount: prospect._count.evidenceItems,
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

  const hasAnyAnalysis = narrativeAnalysis ?? klarifaiNarrativeAnalysis;
  const analysisDateLabel =
    hasAnyAnalysis && prospectAnalysis
      ? new Intl.DateTimeFormat('nl-NL', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          timeZone: 'Europe/Amsterdam',
        }).format(prospectAnalysis.createdAt)
      : null;

  // Compute research stats for cover overlay — use DB count as single source
  const researchStats = {
    bronnen: prospect._count.evidenceItems,
    brontypen: sourceTypeCount,
    inzichten: (
      narrativeAnalysis?.sections ??
      klarifaiNarrativeAnalysis?.sections ??
      []
    ).length,
  };

  const analysis = narrativeAnalysis ?? klarifaiNarrativeAnalysis;

  if (analysis) {
    const isAtlantis = prospect.project.projectType === 'ATLANTIS';
    const recommendations =
      isAtlantis && narrativeAnalysis
        ? narrativeAnalysis.spvRecommendations
        : (klarifaiNarrativeAnalysis?.useCaseRecommendations ?? []);

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
}

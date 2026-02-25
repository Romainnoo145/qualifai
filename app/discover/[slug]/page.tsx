import { DashboardClient } from '@/components/public/prospect-dashboard-client';
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
    select: { companyName: true, domain: true, industry: true },
  });

  if (!prospect) return { title: 'Not Found' };

  const name = prospect.companyName ?? prospect.domain;
  return {
    title: `${name} | Workflow Analyse by Klarifai`,
    description: `Gepersonaliseerde workflow analyse voor ${name}`,
    openGraph: {
      title: `Workflow analyse voor ${name}`,
      description: `Gepersonaliseerde workflow analyse voor ${name} — ontdek waar automatisering directe impact maakt.`,
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
        take: 1,
        select: {
          status: true,
          completedAt: true,
          qualityApproved: true,
          summary: true,
          evidenceItems: {
            select: {
              sourceType: true,
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

  const latestRun = prospect.researchRuns[0] ?? null;
  const latestRunSummary = asRecord(latestRun?.summary);
  const diagnosticsRaw = Array.isArray(latestRunSummary?.diagnostics)
    ? latestRunSummary.diagnostics
    : [];
  const diagnosticsWarningCount = diagnosticsRaw.reduce((count, item) => {
    const diagnostic = asRecord(item);
    const status = diagnostic?.status;
    if (status === 'warning' || status === 'error') return count + 1;
    return count;
  }, 0);

  const sourceTypeCount = latestRun
    ? new Set(latestRun.evidenceItems.map((item) => item.sourceType)).size
    : 0;

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
    researchStatusLabel: statusLabel(latestRun?.status),
    qualityLabel:
      latestRun?.qualityApproved === true
        ? 'Kwaliteitscheck akkoord'
        : latestRun?.qualityApproved === false
          ? 'Kwaliteitscheck in review'
          : null,
    evidenceCount: latestRun?.evidenceItems.length ?? 0,
    sourceTypeCount,
    diagnosticsWarningCount,
  };

  return (
    <DashboardClient
      prospectSlug={prospect.slug}
      companyName={prospect.companyName ?? prospect.domain}
      logoUrl={prospect.logoUrl}
      industry={prospect.industry}
      hypotheses={prospect.workflowHypotheses}
      prospectStatus={prospect.status}
      lossMapId={prospect.workflowLossMaps[0]?.id ?? null}
      bookingUrl={process.env.NEXT_PUBLIC_CALCOM_BOOKING_URL ?? null}
      whatsappNumber={process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? null}
      phoneNumber={process.env.NEXT_PUBLIC_PHONE_NUMBER ?? null}
      contactEmail={process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? null}
      heroContent={prospect.heroContent as Record<string, unknown>}
      dataOpportunities={prospect.dataOpportunities as Record<string, unknown>}
      automationAgents={prospect.automationAgents as Record<string, unknown>}
      successStories={prospect.successStories as Record<string, unknown>}
      aiRoadmap={prospect.aiRoadmap as Record<string, unknown>}
      trustSnapshot={trustSnapshot}
    />
  );
}

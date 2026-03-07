import { DashboardClient } from '@/components/public/prospect-dashboard-client';
import { PartnershipDiscoverClient } from '@/components/public/partnership-discover-client';
import type {
  PartnershipDiscoverEvidence,
  PartnershipDiscoverSnapshot,
  PartnershipDiscoverTrigger,
} from '@/lib/partnership/discover';
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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function compactText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
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
    return `Partnership readiness analyse voor ${companyName} met trigger-gebaseerde prioriteiten.`;
  }
  return `Gepersonaliseerde workflow analyse voor ${companyName}`;
}

function parsePartnershipSnapshot(input: {
  summary: Record<string, unknown> | null;
  evidenceItems: DiscoverEvidenceItem[];
}): PartnershipDiscoverSnapshot | null {
  const partnership = asRecord(input.summary?.partnership);
  if (!partnership) return null;

  const evidenceById = new Map(
    input.evidenceItems.map((item) => [item.id, item] as const),
  );

  const triggerRows = Array.isArray(partnership.triggers)
    ? partnership.triggers
    : [];
  const triggers: PartnershipDiscoverTrigger[] = triggerRows
    .map((item) => {
      const trigger = asRecord(item);
      if (!trigger) return null;
      const title =
        typeof trigger.title === 'string' && trigger.title.trim().length > 0
          ? trigger.title.trim()
          : null;
      if (!title) return null;

      const evidenceRefs = asStringArray(trigger.evidenceRefs);
      const evidence: PartnershipDiscoverEvidence[] = evidenceRefs
        .map((ref) => evidenceById.get(ref))
        .filter((candidate): candidate is DiscoverEvidenceItem => !!candidate)
        .slice(0, 3)
        .map((candidate) => ({
          id: candidate.id,
          sourceType: candidate.sourceType,
          sourceUrl: candidate.sourceUrl,
          title: candidate.title,
          snippet: compactText(candidate.snippet, 180),
        }));

      const urgency =
        trigger.urgency === 'high' ||
        trigger.urgency === 'medium' ||
        trigger.urgency === 'low'
          ? trigger.urgency
          : 'low';

      return {
        triggerType:
          typeof trigger.triggerType === 'string'
            ? trigger.triggerType
            : 'unknown',
        title,
        rationale:
          typeof trigger.rationale === 'string' ? trigger.rationale : '',
        whyNow: typeof trigger.whyNow === 'string' ? trigger.whyNow : '',
        confidenceScore:
          typeof trigger.confidenceScore === 'number'
            ? clamp(trigger.confidenceScore, 0, 1)
            : 0,
        readinessImpact:
          typeof trigger.readinessImpact === 'number'
            ? Math.round(trigger.readinessImpact)
            : 0,
        urgency,
        sourceTypes: asStringArray(trigger.sourceTypes),
        evidence,
      };
    })
    .filter((item): item is PartnershipDiscoverTrigger => item !== null);

  const signalCountsRaw = asRecord(partnership.signalCounts);
  const signalCounts = {
    external:
      typeof signalCountsRaw?.external === 'number'
        ? Math.max(0, Math.round(signalCountsRaw.external))
        : 0,
    diagnostic:
      typeof signalCountsRaw?.diagnostic === 'number'
        ? Math.max(0, Math.round(signalCountsRaw.diagnostic))
        : 0,
    rag:
      typeof signalCountsRaw?.rag === 'number'
        ? Math.max(0, Math.round(signalCountsRaw.rag))
        : 0,
    sourceDiversity:
      typeof signalCountsRaw?.sourceDiversity === 'number'
        ? Math.max(0, Math.round(signalCountsRaw.sourceDiversity))
        : 0,
  };

  const readinessScore =
    typeof partnership.readinessScore === 'number'
      ? clamp(Math.round(partnership.readinessScore), 0, 100)
      : 0;
  const triggerCount =
    typeof partnership.triggerCount === 'number'
      ? Math.max(0, Math.round(partnership.triggerCount))
      : triggers.length;

  const gaps = Array.isArray(partnership.gaps)
    ? partnership.gaps.filter((item): item is string => typeof item === 'string')
    : [];
  const strategyVersion =
    typeof partnership.strategyVersion === 'string' &&
    partnership.strategyVersion.trim().length > 0
      ? partnership.strategyVersion
      : 'partnership-v1';

  if (triggerCount === 0 && readinessScore === 0 && gaps.length === 0) {
    return null;
  }

  return {
    strategyVersion,
    readinessScore,
    triggerCount,
    gaps,
    signalCounts,
    triggers,
  };
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
          ? `Partnership readiness voor ${name}`
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
        take: 1,
        select: {
          status: true,
          completedAt: true,
          qualityApproved: true,
          summary: true,
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
  const partnershipSnapshot = parsePartnershipSnapshot({
    summary: latestRunSummary,
    evidenceItems:
      latestRun?.evidenceItems.map((item) => ({
        id: item.id,
        sourceType: item.sourceType,
        sourceUrl: item.sourceUrl,
        title: item.title,
        snippet: item.snippet,
      })) ?? [],
  });
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

  if (prospect.project.projectType === 'ATLANTIS') {
    return (
      <PartnershipDiscoverClient
        {...dashboardProps}
        projectName={prospect.project.brandName ?? prospect.project.name}
        spvName={prospect.spv?.name ?? null}
        partnership={partnershipSnapshot}
      />
    );
  }

  return <DashboardClient {...dashboardProps} />;
}

import { DashboardClient } from './dashboard-client';
import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const prospect = await prisma.prospect.findUnique({
    where: { readableSlug: slug },
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

export default async function ProspectDashboardPage({ params }: Props) {
  const { slug } = await params;
  const prospect = await prisma.prospect.findUnique({
    where: { readableSlug: slug },
    select: {
      id: true,
      slug: true,
      readableSlug: true,
      companyName: true,
      domain: true,
      industry: true,
      logoUrl: true,
      status: true,
      // Evidence-backed content from quality-approved hypotheses
      workflowHypotheses: {
        where: { status: { in: ['ACCEPTED', 'PENDING'] } },
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
      // Fallback JSON content from old wizard
      heroContent: true,
      dataOpportunities: true,
      automationAgents: true,
      successStories: true,
      aiRoadmap: true,
    },
  });

  if (
    !prospect ||
    !['READY', 'SENT', 'VIEWED', 'ENGAGED', 'CONVERTED'].includes(
      prospect.status,
    )
  ) {
    notFound();
  }

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
    />
  );
}

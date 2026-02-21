import { WizardClient } from './wizard-client';
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
    where: { slug },
    select: { companyName: true, domain: true, industry: true },
  });

  if (!prospect) return { title: 'Not Found' };

  const name = prospect.companyName ?? prospect.domain;
  return {
    title: `${name} | AI Discovery by Klarifai`,
    description: `Personalized AI opportunities for ${name}. Discover what artificial intelligence can do for your ${prospect.industry ?? 'business'}.`,
    openGraph: {
      title: `We analyzed ${name}'s AI potential`,
      description: `Personalized AI roadmap for ${name}`,
    },
  };
}

export default async function WizardPage({ params }: Props) {
  const { slug } = await params;
  const prospect = await prisma.prospect.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      companyName: true,
      domain: true,
      industry: true,
      logoUrl: true,
      heroContent: true,
      dataOpportunities: true,
      automationAgents: true,
      successStories: true,
      aiRoadmap: true,
      status: true,
      workflowLossMaps: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true },
      },
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
    <WizardClient
      slug={slug}
      companyName={prospect.companyName ?? prospect.domain}
      logoUrl={prospect.logoUrl}
      heroContent={prospect.heroContent as Record<string, unknown>}
      dataOpportunities={prospect.dataOpportunities as Record<string, unknown>}
      automationAgents={prospect.automationAgents as Record<string, unknown>}
      successStories={prospect.successStories as Record<string, unknown>}
      aiRoadmap={prospect.aiRoadmap as Record<string, unknown>}
      lossMapId={prospect.workflowLossMaps[0]?.id ?? null}
      bookingUrl={process.env.NEXT_PUBLIC_CALCOM_BOOKING_URL ?? null}
    />
  );
}

import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { BrochureCover } from '@/components/features/offerte/brochure-cover';
import { prettifyDomainToName } from '@/lib/enrichment/company-name';

export default async function OffertePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const prospect = await prisma.prospect.findFirst({
    where: { readableSlug: slug },
    select: {
      id: true,
      companyName: true,
      domain: true,
      logoUrl: true,
      readableSlug: true,
    },
  });

  if (!prospect) {
    notFound();
  }

  // Display name priority:
  //   1. stored companyName (from Apollo or manual entry)
  //   2. derived from domain (e.g. marfa.nl → "Marfa")
  //   3. slug fallback
  // This way the client brochure never shows a raw domain like "marfa.nl"
  // as the client name even if the DB record is sparse.
  const displayName =
    (prospect.companyName && prospect.companyName.trim()) ||
    prettifyDomainToName(prospect.domain) ||
    slug;

  return (
    <BrochureCover
      slug={slug}
      prospect={{
        companyName: displayName,
        logoUrl: prospect.logoUrl ?? null,
        domain: prospect.domain ?? null,
      }}
    />
  );
}

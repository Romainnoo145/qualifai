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

  // Active quote for brochure Page 4 (Fase B wire-up)
  const activeQuote = await prisma.quote.findFirst({
    where: {
      prospectId: prospect.id,
      isActiveProposal: true,
    },
    include: {
      lines: { orderBy: { position: 'asc' } },
    },
  });

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
      mode="offerte"
      slug={slug}
      prospect={{
        id: prospect.id,
        companyName: displayName,
        logoUrl: prospect.logoUrl ?? null,
        domain: prospect.domain ?? null,
      }}
      quote={
        activeQuote
          ? {
              nummer: activeQuote.nummer,
              onderwerp: activeQuote.onderwerp,
              btwPercentage: activeQuote.btwPercentage,
              introductie: activeQuote.introductie ?? null,
              uitdaging: activeQuote.uitdaging ?? null,
              aanpak: activeQuote.aanpak ?? null,
              lines: activeQuote.lines.map((l) => ({
                fase: l.fase,
                omschrijving: l.omschrijving ?? '',
                uren: l.uren,
                tarief: l.tarief,
              })),
            }
          : null
      }
    />
  );
}

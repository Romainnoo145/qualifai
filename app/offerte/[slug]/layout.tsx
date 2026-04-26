import type { Metadata } from 'next';
import { Sora } from 'next/font/google';
import prisma from '@/lib/prisma';
import { prettifyDomainToName } from '@/lib/enrichment/company-name';

const sora = Sora({
  variable: '--font-sora',
  weight: ['300', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const prospect = await prisma.prospect.findFirst({
    where: { readableSlug: slug },
    select: { companyName: true, domain: true },
  });

  const displayName =
    (prospect?.companyName && prospect.companyName.trim()) ||
    prettifyDomainToName(prospect?.domain ?? null) ||
    slug;

  return {
    title: `Voorstel · ${displayName}`,
    description: `Persoonlijk voorstel van Klarifai voor ${displayName}.`,
    robots: { index: false, follow: false },
  };
}

export default function OfferteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={sora.variable} style={{ fontFamily: 'var(--font-sora)' }}>
      {children}
    </div>
  );
}

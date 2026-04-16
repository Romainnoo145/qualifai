import type { Metadata } from 'next';
import { Sora, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { TRPCProvider } from '@/components/providers';

const sora = Sora({
  variable: '--font-sora',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'https://qualifai.klarifai.nl',
  ),
  title: 'Qualifai | Workflow Optimization Sprint Engine',
  description:
    'Qualifai helps you turn evidence, hypotheses, and proof into outreach that books Workflow Optimization Sprint calls.',
  openGraph: {
    title: 'Qualifai | Workflow Optimization Sprint Engine',
    description:
      'Evidence-backed outbound for Workflow Optimization Sprint offers.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Qualifai',
    description:
      'Evidence-backed outbound for Workflow Optimization Sprint offers.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${sora.variable} ${ibmPlexMono.variable} font-sans antialiased min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)] relative`}
      >
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}

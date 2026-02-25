import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { TRPCProvider } from '@/components/providers';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space',
  subsets: ['latin'],
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
        className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased min-h-screen bg-[#FCFCFD] text-[#040026] relative`}
      >
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}

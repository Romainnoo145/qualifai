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
    process.env.NEXT_PUBLIC_APP_URL || 'https://discover.klarifai.nl',
  ),
  title: 'Klarifai Discover | AI Possibilities for Your Business',
  description:
    'Discover personalized AI opportunities tailored to your business. See what artificial intelligence can do for your industry, data, and processes.',
  openGraph: {
    title: 'Klarifai Discover | AI Possibilities for Your Business',
    description:
      'Discover personalized AI opportunities tailored to your business.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Klarifai Discover',
    description:
      'Discover personalized AI opportunities tailored to your business.',
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
        className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased`}
      >
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}

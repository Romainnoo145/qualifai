import type { Metadata } from 'next';
import { Sora } from 'next/font/google';

const sora = Sora({
  variable: '--font-sora',
  weight: ['300', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Klarifai — Analyse',
  description: 'Een gepersonaliseerde analyse van Klarifai.',
  robots: { index: false, follow: false },
};

export default function AnalyseLayout({
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

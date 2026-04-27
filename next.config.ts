import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Prevent webpack from bundling chromium-min — it must remain a native binary
  // loaded at runtime. puppeteer-core is co-located so we externalize both.
  serverExternalPackages: ['@sparticuz/chromium-min', 'puppeteer-core'],

  async redirects() {
    return [
      {
        source: '/discover/:slug*',
        destination: '/analyse/:slug*',
        permanent: true,
      },
      {
        source: '/voor/:slug*',
        destination: '/analyse/:slug*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

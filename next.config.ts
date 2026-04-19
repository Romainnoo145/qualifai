import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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

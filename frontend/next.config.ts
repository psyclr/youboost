import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow an isolated build dir (e.g. .next-test) so a second `next dev` instance
  // — the isolated e2e frontend on a test port — doesn't collide with the dev
  // server's `.next/dev/lock` (the lock is per distDir).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_URL || 'http://localhost:3000'}/:path*`,
      },
    ];
  },
};

export default nextConfig;

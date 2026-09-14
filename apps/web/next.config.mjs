import { securityHeaderRoutes } from '@thefibre/shared/security-headers';
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Baseline security headers, one list for every app (packages/shared).
  async headers() {
    return securityHeaderRoutes([]);
  },
  // Hard rule §13: no personal data in Vercel. API routes here may NOT
  // touch Supabase directly — proxy to the EU backend API instead.
  experimental: {},
};
export default nextConfig;

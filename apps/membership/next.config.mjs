import { securityHeaderRoutes } from '@thefibre/shared/security-headers';
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Baseline security headers, one list for every app (packages/shared).
  async headers() {
    return securityHeaderRoutes(['/embed/:path*']);
  },
  // Hard rule §13 (inherited from The Fibre): no personal data in Vercel.
  // Flow's frontend never touches Supabase directly — all PII goes through
  // the Fibre API on Fly.io.
  experimental: {},
};
export default nextConfig;

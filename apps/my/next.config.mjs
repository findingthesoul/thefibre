import { securityHeaderRoutes } from '@thefibre/shared/security-headers';
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Baseline security headers, one list for every app (packages/shared).
  async headers() {
    return securityHeaderRoutes([]);
  },
  // Hard rule §13: no personal data in Vercel. This app renders a visitor's
  // own data, but it never stores or queries it here — every read goes to
  // the Fibre API on Fly, which holds the EU data.
  experimental: {},
};
export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Hard rule §13: no personal data in Vercel. API routes here may NOT
  // touch Supabase directly — proxy to the EU backend API instead.
  experimental: {},
};
export default nextConfig;

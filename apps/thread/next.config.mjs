/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Hard rule §13 (inherited from The Fibre): no personal data in Vercel.
  // The Thread's frontend never touches Supabase directly — all PII goes through
  // the Fibre API on Fly.io.
  experimental: {},
};
export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Hard rule §13: no personal data in Vercel. This app renders a visitor's
  // own data, but it never stores or queries it here — every read goes to
  // the Fibre API on Fly, which holds the EU data.
  experimental: {},
};
export default nextConfig;

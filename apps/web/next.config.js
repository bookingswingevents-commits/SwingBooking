/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
  },
  // Désactivation pour éviter les signatures typed routes strictes
  typedRoutes: false,
};
module.exports = nextConfig;

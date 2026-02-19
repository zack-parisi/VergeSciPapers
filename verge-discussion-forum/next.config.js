/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    domains: ['localhost', 'verge-discussion-forum.vercel.app'],
    unoptimized: false,
  },
  serverExternalPackages: ['@prisma/client'],
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  serverExternalPackages: ['mongodb'],
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
    ]
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
}

module.exports = nextConfig

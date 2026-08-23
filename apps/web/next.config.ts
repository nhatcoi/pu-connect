import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  transpilePackages: ['@pu/ui', '@pu/schemas'],
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb'
    }
  },
  async rewrites() {
    const apiUrl = process.env.INTERNAL_API_URL || 'http://localhost:4000'
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`
      },
      {
        source: '/graphql',
        destination: `${apiUrl}/graphql`
      }
    ]
  }
}

export default nextConfig

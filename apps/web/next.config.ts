import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  transpilePackages: ['@pu/ui', '@pu/schemas'],
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb'
    }
  }
}

export default nextConfig

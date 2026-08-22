import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@pu/ui', '@pu/schemas'],
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb'
    }
  }
}

export default nextConfig

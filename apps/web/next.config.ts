import type { NextConfig } from 'next'

// Build trên VPS (2GB RAM): bỏ typecheck/lint — đã chạy `pnpm typecheck` trước khi push (AGENTS.md)
const skipChecks = process.env.NEXT_SKIP_CHECKS === '1'

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  typescript: { ignoreBuildErrors: skipChecks },
  eslint: { ignoreDuringBuilds: skipChecks },
  reactStrictMode: true,
  transpilePackages: ['@pu/ui', '@pu/schemas'],
  experimental: {
    // Giảm RAM lúc build webpack (đổi lại build chậm hơn chút)
    webpackMemoryOptimizations: true,
    serverActions: {
      bodySizeLimit: '50mb'
    }
  },
  async redirects() {
    // Trang onboarding đã gỡ: link cũ chuyển về bảng tin
    return [{ source: '/get-started', destination: '/home', permanent: false }]
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

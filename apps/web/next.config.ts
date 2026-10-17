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
    // /home và trang onboarding cũ /get-started chuyển thẳng về bảng tin mặc định /
    return [
      { source: '/home', destination: '/', permanent: false },
      { source: '/get-started', destination: '/', permanent: false },
      // Đổi tên PU AI → N7AI: link cũ /puai*, /settings/puai*, /c/puai, /puai (hồ sơ bot) vẫn mở được
      { source: '/settings/puai', destination: '/n7ai/settings', permanent: true },
      { source: '/settings/puai/:item', destination: '/n7ai/settings/:item', permanent: true },
      { source: '/puai', destination: '/n7ai', permanent: true },
      { source: '/puai/:path*', destination: '/n7ai/:path*', permanent: true },
      { source: '/c/puai', destination: '/c/n7ai', permanent: true }
    ]
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

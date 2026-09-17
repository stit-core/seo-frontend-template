import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Один self-contained Node-выход: .next/standalone/server.js
  output: 'standalone',
  reactStrictMode: true,
  trailingSlash: false,
  poweredByHeader: false,
  reactCompiler: true,

  experimental: {
    // Корневой layout живёт под [lang], поэтому обычный not-found.tsx не даёт
    // серверной разметки для несовпавших URL.
    globalNotFound: true,
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    // Дисковый кеш оптимизатора: .next/cache/images
    minimumCacheTTL: 60 * 60 * 24 * 365,
  },

  // Markdown читается через fs — nft его не видит, приходится дотрейсить руками.
  outputFileTracingIncludes: {
    '/**': ['./src/entities/post/content/**/*'],
  },

  async redirects() {
    return [
      { source: '/old', destination: '/', statusCode: 301 },
      { source: '/old-permanent', destination: '/about', permanent: true },
    ]
  },

  async headers() {
    return [
      {
        source: '/covers/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },
}

export default nextConfig

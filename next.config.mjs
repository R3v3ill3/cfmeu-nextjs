/** @type {import('next').NextConfig} */
const strict = process.env.STRICT_CI === '1'
const isProduction = process.env.NODE_ENV === 'production'

const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Fail in CI when STRICT_CI=1
    ignoreDuringBuilds: !strict,
  },
  typescript: {
    // Fail in CI when STRICT_CI=1
    ignoreBuildErrors: !strict,
  },
  // CSP is now handled in middleware.ts with nonce-based policy

  // Performance optimizations for mobile
  experimental: {
    // Optimize bundle loading
    optimizePackageImports: [
      '@radix-ui/react-avatar',
      '@radix-ui/react-dialog',
      '@tanstack/react-query',
      'lucide-react',
      'date-fns',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      'recharts',
      'sonner',
      '@hookform/resolvers',
      'react-hook-form',
      'clsx',
      'tailwind-merge',
    ],
    // Server components
    serverComponentsExternalPackages: ['sharp', 'canvas'],
    // Mobile optimizations
    scrollRestoration: true,
    optimizeCss: true,
  },

  // Webpack configuration - minimal to avoid interfering with Next.js build process
  webpack: (config, { isServer, dev }) => {
    // Only add path aliases - let Next.js handle React bundling
    config.resolve.alias = {
      ...config.resolve.alias,
      '@components': '/src/components',
      '@lib': '/src/lib',
      '@hooks': '/src/hooks',
      '@utils': '/src/lib/utils',
    }

    return config
  },

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    },

  // Headers optimization
  async headers() {
    return [
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, stale-while-revalidate=300',
          },
        ],
      },
      {
        source: '/images/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/(.*).(js|css|webp|avif)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Security headers
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },

  // Redirects for mobile routes
  async redirects() {
    return [
      {
        source: '/mobile/ratings',
        destination: '/settings',
        permanent: false,
      },
      {
        source: '/mobile/ratings/:path*',
        destination: '/settings',
        permanent: false,
      },
      {
        source: '/ratings',
        destination: '/settings',
        has: [
          {
            type: 'header',
            key: 'user-agent',
            value: '(.*Mobile.*)',
          },
        ],
        permanent: false,
      },
    ]
  },

  // Compression for production
  compress: true,

  // Power by headers (disabled for production)
  poweredByHeader: false,
};

export default nextConfig;


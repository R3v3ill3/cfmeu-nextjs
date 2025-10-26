/** @type {import('next').NextConfig} */
const strict = process.env.STRICT_CI === '1'
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
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      'lucide-react',
      'date-fns',
      'recharts',
    ],
    // Server components
    serverComponentsExternalPackages: ['sharp'],
  },

  // Bundle analyzer for development
  webpack: (config, { isServer, dev }) => {
    // Bundle splitting optimizations
    if (!isServer && !dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxSize: 244000,
          cacheGroups: {
            // Vendor splitting
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
            },
            // UI library splitting
            ui: {
              test: /[\\/]node_modules[\\/](@radix-ui|lucide-react)[\\/]/,
              name: 'ui',
              chunks: 'all',
              priority: 20,
            },
            // Mobile components
            mobile: {
              test: /[\\/]src[\\/]components[\\/]mobile[\\/]/,
              name: 'mobile',
              chunks: 'async',
              priority: 30,
            },
            // Rating system components
            rating: {
              test: /[\\/]src[\\/]components[\\/]rating-system[\\/]/,
              name: 'rating',
              chunks: 'async',
              priority: 30,
            },
            // Common utilities
            utils: {
              test: /[\\/]src[\\/]lib[\\/]/,
              name: 'utils',
              chunks: 'async',
              priority: 15,
            },
          },
        },
        // Runtime chunk optimization
        runtimeChunk: {
          name: 'runtime',
        },
      }
    }

    // Resolve optimizations
    config.resolve.alias = {
      ...config.resolve.alias,
      // Optimize imports
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
        source: '/ratings',
        destination: '/mobile/ratings',
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


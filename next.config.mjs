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

  // Bundle analyzer for development and production optimization
  webpack: (config, { isServer, dev, webpack }) => {
    // Force React to be bundled for both server and client
    config.resolve.alias = {
      ...config.resolve.alias,
      'react': 'react',
      'react-dom': 'react-dom',
    }

    // Production optimizations
    if (!dev && isProduction && !isServer) {
      // Advanced code splitting for production - only for client builds
      // Server builds use Next.js defaults to avoid bundling issues
      config.optimization.splitChunks = {
        chunks: 'all',
        minSize: 20000,
        maxSize: 250000,
        cacheGroups: {
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor',
            priority: 10,
            chunks: 'all',
          },
          // Framework chunks
          framework: {
            test: /[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types)[\\/]/,
            name: 'framework',
            priority: 40,
            chunks: 'all',
            enforce: true,
          },
          // Lib chunks for common libraries
          lib: {
            test: /[\\/]node_modules[\\/](@radix-ui|@tanstack|lucide-react|date-fns|recharts)[\\/]/,
            name: 'lib',
            priority: 30,
            chunks: 'all',
          },
          // Common chunks for shared utilities
          common: {
            name: 'common',
            minChunks: 3,
            priority: 20,
            chunks: 'all',
            reuseExistingChunk: true,
          },
          // Mobile-specific chunks
          mobile: {
            test: /[\\/]src[\\/](hooks|components)[\\/]mobile[\\/]/,
            name: 'mobile',
            priority: 15,
            chunks: 'async',
          },
        },
      }

      // Tree shaking optimizations (client only)
      config.optimization.usedExports = true
      config.optimization.sideEffects = false

      // Module concatenation (client only)
      config.optimization.concatenateModules = true

      // Production-specific plugins
      config.plugins.push(
        // Remove console logs in production
        new webpack.DefinePlugin({
          'process.env.NODE_ENV': JSON.stringify('production'),
        })
      )

      // Optimize module resolution
      config.resolve.alias = {
        ...config.resolve.alias,
        // Route aliases for better tree shaking
        '@components/mobile': '/src/components/mobile',
        '@components/shared': '/src/components/shared',
        '@hooks/mobile': '/src/hooks/mobile',
        '@hooks/shared': '/src/hooks/shared',
      }

      // Enable module federation for micro-frontends (if needed)
      if (!isServer) {
        config.optimization.runtimeChunk = {
          name: 'runtime',
        }
      }
    }

    // In development, simplify bundle splitting to avoid module resolution issues
    if (dev) {
      config.optimization.splitChunks = {
        chunks: 'all',
        minSize: 0,
        maxSize: 250000,
        cacheGroups: {
          default: false,
          vendors: false,
          // Simple vendor chunk for node_modules
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 10,
            chunks: 'all',
          },
          // Bundle everything else together to avoid missing dependencies
          app: {
            name: 'app',
            chunks: 'all',
            priority: 20,
          },
        },
      }
    }

    // Force React to be bundled on server side instead of externalized
    if (isServer) {
      // Filter out React from externals while keeping other Node.js modules
      if (config.externals) {
        if (Array.isArray(config.externals)) {
          config.externals = config.externals.filter(ext =>
            typeof ext === 'string' ? !ext.includes('react') : true
          );
        } else if (typeof config.externals === 'function') {
          const originalExternals = config.externals;
          config.externals = function(context, request, callback) {
            if (request.includes('react') || request.includes('react-dom')) {
              // Don't externalize React - let it be bundled
              return callback();
            }
            return originalExternals(context, request, callback);
          };
        }
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


/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  async headers() {
    // Dynamically include the dashboard worker origin in connect-src when configured
    const connectSrc = [
      "'self'",
      'https://*.supabase.co',
      'wss://*.supabase.co',
      'https://maps.googleapis.com',
      'https://*.googleapis.com',
    ]

    const workerUrl = process.env.NEXT_PUBLIC_DASHBOARD_WORKER_URL
    if (workerUrl) {
      try {
        const origin = new URL(workerUrl).origin
        if (!connectSrc.includes(origin)) connectSrc.push(origin)
      } catch {}
    } else if (process.env.NODE_ENV !== 'production') {
      // Useful default in local dev when worker runs on :3200
      if (!connectSrc.includes('http://localhost:3200')) connectSrc.push('http://localhost:3200')
    }

    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Allow eval and inline for Next.js dev and Google Maps; tighten in prod later if needed
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://maps.googleapis.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              `connect-src ${connectSrc.join(' ')}`,
              "frame-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
};

export default nextConfig;


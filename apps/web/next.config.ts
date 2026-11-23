import type { NextConfig } from 'next';

// The browser talks only to the web app; /api/v1 requests are forwarded to the
// NestJS API. Same origin means login cookies work without CORS problems.
const API_URL = process.env.API_URL ?? 'http://localhost:4000';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The dev proxy to the API gives up after 30 seconds by default; allow the same 3 minutes as the browser.
  experimental: { proxyTimeout: 180_000 },
  async rewrites() {
    return [
      { source: '/manager/:path*', destination: '/admin/:path*' },
      { source: '/api/v1/:path*', destination: `${API_URL}/api/v1/:path*` },
    ];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default config;

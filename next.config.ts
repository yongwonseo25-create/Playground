import type { NextConfig } from 'next';
import { buildConnectSrc, parsePublicEnv } from './src/shared/config/env-core';

const publicEnv = parsePublicEnv({
  NEXT_PUBLIC_WSS_URL: process.env.NEXT_PUBLIC_WSS_URL,
  NEXT_PUBLIC_WEBHOOK_URL: process.env.NEXT_PUBLIC_WEBHOOK_URL,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV
});

const connectSrc = buildConnectSrc(publicEnv).join(' ');
const isLocalMode = publicEnv.NEXT_PUBLIC_APP_ENV === 'local';

const scriptSrc = isLocalMode
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  `connect-src ${connectSrc}`
].join('; ');

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: csp
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), geolocation=(), microphone=(self), payment=()'
  }
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;

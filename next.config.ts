import type { NextConfig } from 'next';
import { buildConnectSrc, parseServerEnv } from './src/shared/config/env-core';

const serverEnv = parseServerEnv({
  NEXT_PUBLIC_WSS_URL: process.env.NEXT_PUBLIC_WSS_URL,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  MAKE_WEBHOOK_URL: process.env.MAKE_WEBHOOK_URL,
  MAKE_WEBHOOK_SECRET: process.env.MAKE_WEBHOOK_SECRET
});

const connectSrc = buildConnectSrc(serverEnv).join(' ');
const isLocalMode = serverEnv.NEXT_PUBLIC_APP_ENV === 'local';

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

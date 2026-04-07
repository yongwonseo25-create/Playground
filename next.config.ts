import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';
import { loadEnvConfig } from '@next/env';
import { buildConnectSrc, parseServerEnv } from './src/shared/config/env-core';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = configDir;
const sharedRootCandidate = path.join(path.dirname(projectDir), 'Playground');

function hydrateEnvFile(filePath: string) {
  const file = readFileSync(filePath, 'utf8');

  for (const line of file.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) {
      continue;
    }

    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value.replace(/\\n/g, '\n');
  }
}

function loadConfigEnv(rootDir: string) {
  loadEnvConfig(rootDir);

  for (const candidate of ['.env.local', '.env']) {
    const filePath = path.join(rootDir, candidate);
    if (existsSync(filePath)) {
      hydrateEnvFile(filePath);
    }
  }
}

loadConfigEnv(projectDir);
if (path.basename(projectDir) !== 'Playground' && process.env.NEXT_PUBLIC_WSS_URL === undefined) {
  loadConfigEnv(sharedRootCandidate);
}

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
  turbopack: {
    // Worktrees often symlink node_modules back to the primary checkout.
    // Turbopack needs a root that contains both paths.
    root: path.dirname(projectDir)
  },
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

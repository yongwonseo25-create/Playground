import { parsePublicEnv, parseServerEnv } from '@/shared/config/env-core';

export const publicEnv = parsePublicEnv({
  NEXT_PUBLIC_WSS_URL: process.env.NEXT_PUBLIC_WSS_URL,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV
});

export const env = parseServerEnv({
  NEXT_PUBLIC_WSS_URL: process.env.NEXT_PUBLIC_WSS_URL,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  MAKE_WEBHOOK_URL: process.env.MAKE_WEBHOOK_URL,
  MAKE_WEBHOOK_SECRET: process.env.MAKE_WEBHOOK_SECRET
});

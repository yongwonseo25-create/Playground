export type AppEnv = 'local' | 'development' | 'staging' | 'production';

export interface PublicEnv {
  NEXT_PUBLIC_WSS_URL: string;
  NEXT_PUBLIC_APP_ENV: AppEnv;
}

export interface ServerEnv extends PublicEnv {
  MAKE_WEBHOOK_URL: string;
  MAKE_WEBHOOK_SECRET: string;
}

const APP_ENVS: AppEnv[] = ['local', 'development', 'staging', 'production'];

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(`[env] Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function parseAppEnv(raw: string): AppEnv {
  if ((APP_ENVS as string[]).includes(raw)) {
    return raw as AppEnv;
  }
  throw new Error(
    `[env] Invalid NEXT_PUBLIC_APP_ENV: "${raw}". Expected one of: ${APP_ENVS.join(', ')}`
  );
}

function parseUrl(name: string, value: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new Error(`[env] ${name} must be a valid absolute URL. Received: "${value}"`);
  }
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function assertWebSocketProtocol(name: string, url: URL): void {
  if (url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }

  throw new Error(`[env] ${name} must use ws:// or wss://.`);
}

function assertHttpProtocol(name: string, url: URL): void {
  if (url.protocol === 'http:' || url.protocol === 'https:') {
    return;
  }

  throw new Error(`[env] ${name} must use http:// or https://.`);
}

function assertWssRules(appEnv: AppEnv, wssUrl: URL): void {
  const isLocal = appEnv === 'local';
  assertWebSocketProtocol('NEXT_PUBLIC_WSS_URL', wssUrl);

  if (!isLocal && wssUrl.protocol === 'ws:') {
    throw new Error(
      '[env] Insecure WebSocket (ws://) is not allowed outside local environment. Use wss://.'
    );
  }

  if (isLocal && wssUrl.protocol === 'ws:' && !isLoopbackHost(wssUrl.hostname)) {
    throw new Error(
      '[env] Local ws:// exception is limited to loopback hosts (localhost/127.0.0.1/[::1]).'
    );
  }
}

function assertWebhookRules(appEnv: AppEnv, webhookUrl: URL): void {
  const isLocal = appEnv === 'local';
  assertHttpProtocol('MAKE_WEBHOOK_URL', webhookUrl);

  if (!isLocal && webhookUrl.protocol !== 'https:') {
    throw new Error('[env] MAKE_WEBHOOK_URL must use https:// outside local environment.');
  }

  if (isLocal && webhookUrl.protocol === 'http:' && !isLoopbackHost(webhookUrl.hostname)) {
    throw new Error(
      '[env] Local http:// MAKE_WEBHOOK_URL exception is limited to loopback hosts (localhost/127.0.0.1/[::1]).'
    );
  }
}

export function parsePublicEnv(input: Record<string, string | undefined>): PublicEnv {
  const rawWss = required('NEXT_PUBLIC_WSS_URL', input.NEXT_PUBLIC_WSS_URL);
  const rawAppEnv = required('NEXT_PUBLIC_APP_ENV', input.NEXT_PUBLIC_APP_ENV);

  const appEnv = parseAppEnv(rawAppEnv);
  const wssUrl = parseUrl('NEXT_PUBLIC_WSS_URL', rawWss);

  assertWssRules(appEnv, wssUrl);

  return {
    NEXT_PUBLIC_WSS_URL: wssUrl.toString(),
    NEXT_PUBLIC_APP_ENV: appEnv
  };
}

export function parseServerEnv(input: Record<string, string | undefined>): ServerEnv {
  const publicEnv = parsePublicEnv(input);
  const rawWebhookUrl = required('MAKE_WEBHOOK_URL', input.MAKE_WEBHOOK_URL);
  const rawWebhookSecret = required('MAKE_WEBHOOK_SECRET', input.MAKE_WEBHOOK_SECRET);
  const webhookUrl = parseUrl('MAKE_WEBHOOK_URL', rawWebhookUrl);

  assertWebhookRules(publicEnv.NEXT_PUBLIC_APP_ENV, webhookUrl);

  return {
    ...publicEnv,
    MAKE_WEBHOOK_URL: webhookUrl.toString(),
    MAKE_WEBHOOK_SECRET: rawWebhookSecret
  };
}

export function buildConnectSrc(publicEnv: PublicEnv): string[] {
  const values = new Set<string>(["'self'", new URL(publicEnv.NEXT_PUBLIC_WSS_URL).origin]);

  return [...values];
}

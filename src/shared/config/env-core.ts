export type AppEnv = 'local' | 'development' | 'staging' | 'production';

export interface PublicEnv {
  NEXT_PUBLIC_WSS_URL: string;
  NEXT_PUBLIC_WEBHOOK_URL: string;
  NEXT_PUBLIC_APP_ENV: AppEnv;
}

const APP_ENVS: AppEnv[] = ['local', 'development', 'staging', 'production'];

function required(name: keyof PublicEnv, value: string | undefined): string {
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

function parseUrl(name: keyof PublicEnv, value: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new Error(`[env] ${name} must be a valid absolute URL. Received: "${value}"`);
  }
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function assertTransportRules(appEnv: AppEnv, wssUrl: URL, webhookUrl: URL): void {
  const isLocal = appEnv === 'local';

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

  if (!isLocal && webhookUrl.protocol !== 'https:') {
    throw new Error(
      '[env] NEXT_PUBLIC_WEBHOOK_URL must use https:// outside local environment.'
    );
  }

  if (isLocal && webhookUrl.protocol === 'http:' && !isLoopbackHost(webhookUrl.hostname)) {
    throw new Error(
      '[env] Local http:// webhook exception is limited to loopback hosts (localhost/127.0.0.1/[::1]).'
    );
  }
}

export function parsePublicEnv(input: Record<string, string | undefined>): PublicEnv {
  const rawWss = required('NEXT_PUBLIC_WSS_URL', input.NEXT_PUBLIC_WSS_URL);
  const rawWebhook = required('NEXT_PUBLIC_WEBHOOK_URL', input.NEXT_PUBLIC_WEBHOOK_URL);
  const rawAppEnv = required('NEXT_PUBLIC_APP_ENV', input.NEXT_PUBLIC_APP_ENV);

  const appEnv = parseAppEnv(rawAppEnv);
  const wssUrl = parseUrl('NEXT_PUBLIC_WSS_URL', rawWss);
  const webhookUrl = parseUrl('NEXT_PUBLIC_WEBHOOK_URL', rawWebhook);

  assertTransportRules(appEnv, wssUrl, webhookUrl);

  return {
    NEXT_PUBLIC_WSS_URL: wssUrl.toString(),
    NEXT_PUBLIC_WEBHOOK_URL: webhookUrl.toString(),
    NEXT_PUBLIC_APP_ENV: appEnv
  };
}

export function buildConnectSrc(publicEnv: PublicEnv): string[] {
  const values = new Set<string>([
    "'self'",
    new URL(publicEnv.NEXT_PUBLIC_WSS_URL).origin,
    new URL(publicEnv.NEXT_PUBLIC_WEBHOOK_URL).origin
  ]);

  return [...values];
}

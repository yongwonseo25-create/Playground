import { spawn } from 'node:child_process';

const port = process.env.PLAYWRIGHT_PORT ?? '3400';
const host = '127.0.0.1';

const wsChild = spawn(
  process.execPath,
  ['scripts/voice-wss-server.mjs'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_PUBLIC_WSS_URL: process.env.NEXT_PUBLIC_WSS_URL ?? 'ws://127.0.0.1:8787/voice'
    }
  }
);

const nextChild = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'dev', '--hostname', host, '--port', String(port)],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV ?? 'local',
      NEXT_PUBLIC_WSS_URL: process.env.NEXT_PUBLIC_WSS_URL ?? 'ws://127.0.0.1:8787/voice',
      NEXT_PUBLIC_WEBHOOK_URL:
        process.env.NEXT_PUBLIC_WEBHOOK_URL ?? 'http://127.0.0.1:8788/webhook',
      MAKE_WEBHOOK_URL: process.env.MAKE_WEBHOOK_URL ?? 'http://127.0.0.1:8788/webhook',
      INTERNAL_APP_BASE_URL: process.env.INTERNAL_APP_BASE_URL ?? `http://${host}:${port}`
    }
  }
);

const shutdown = () => {
  if (!wsChild.killed) {
    wsChild.kill('SIGTERM');
  }

  if (!nextChild.killed) {
    nextChild.kill('SIGTERM');
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

nextChild.on('exit', (code) => {
  shutdown();
  process.exit(code ?? 0);
});

wsChild.on('exit', (code) => {
  if ((code ?? 0) !== 0) {
    shutdown();
    process.exit(code ?? 1);
  }
});

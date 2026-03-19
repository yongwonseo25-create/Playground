import path from 'node:path';
import { spawn } from 'node:child_process';

const NEXT_DEV_READY_TOKENS = ['Ready in', 'ready started server', 'Local:'];

async function probeNextDevServer(port: number): Promise<{ status: number | null; bodyText: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/capture`, {
      signal: controller.signal
    });
    const bodyText = await response.text().catch(() => '');

    return {
      status: response.status,
      bodyText
    };
  } catch (error) {
    return {
      status: null,
      bodyText: error instanceof Error ? error.message : 'Probe request failed.'
    };
  } finally {
    clearTimeout(timeout);
  }
}

export interface NextDevRunResult {
  exitCode: number | null;
  output: string;
  ready: boolean;
  timedOut: boolean;
}

export async function runNextDevOnce(options: {
  cwd: string;
  port: number;
  env: Record<string, string | undefined>;
  timeoutMs?: number;
}): Promise<NextDevRunResult> {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const cwd = options.cwd || process.cwd();
  const nextBinPath = path.join(cwd, 'node_modules', 'next', 'dist', 'bin', 'next');

  return await new Promise<NextDevRunResult>((resolve) => {
    const child = spawn(
      process.execPath,
      [nextBinPath, 'dev', '--hostname', '127.0.0.1', '--port', String(options.port)],
      {
        cwd,
        env: {
          ...process.env,
          ...options.env
        },
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe']
      }
    );

    let output = '';
    let settled = false;
    let ready = false;
    let probeStarted = false;

    const settle = (result: NextDevRunResult) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (!child.killed) {
        child.kill('SIGTERM');
      }
      resolve(result);
    };

    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      if (!ready && NEXT_DEV_READY_TOKENS.some((token) => text.includes(token))) {
        ready = true;

        if (!probeStarted) {
          probeStarted = true;
          void probeNextDevServer(options.port).then((probe) => {
            const combinedOutput = `${output}\n${probe.bodyText}`;
            const hasEnvError =
              combinedOutput.includes('[env]') ||
              combinedOutput.includes('Insecure WebSocket (ws://) is not allowed outside local environment') ||
              combinedOutput.includes('MAKE_WEBHOOK_URL must use http:// or https://.');

            settle({
              exitCode: null,
              output: combinedOutput,
              ready: !hasEnvError && (probe.status === null || probe.status < 500),
              timedOut: false
            });
          });
        }
      }
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);

    child.on('exit', (exitCode) => {
      const hasEnvError =
        output.includes('[env]') ||
        output.includes('Insecure WebSocket (ws://) is not allowed outside local environment') ||
        output.includes('MAKE_WEBHOOK_URL must use http:// or https://.');

      settle({
        exitCode,
        output,
        ready: ready && !hasEnvError,
        timedOut: false
      });
    });

    const timer = setTimeout(() => {
      settle({
        exitCode: null,
        output,
        ready,
        timedOut: true
      });
    }, timeoutMs);
  });
}

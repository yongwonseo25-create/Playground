import path from 'node:path';
import { spawn } from 'node:child_process';

const NEXT_DEV_READY_TOKENS = ['Ready in', 'ready started server', 'Local:'];

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
        settle({
          exitCode: null,
          output,
          ready: true,
          timedOut: false
        });
      }
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);

    child.on('exit', (exitCode) => {
      settle({
        exitCode,
        output,
        ready,
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

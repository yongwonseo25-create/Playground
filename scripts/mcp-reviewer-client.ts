import process from 'node:process';
import { spawn } from 'node:child_process';

type JsonRpcId = number | string;

const HEADER_SEPARATOR = '\r\n\r\n';

function encodeJsonRpcMessage(message: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  return Buffer.concat([
    Buffer.from(`Content-Length: ${body.length}${HEADER_SEPARATOR}`, 'utf8'),
    body
  ]);
}

class JsonRpcMessageBuffer {
  private buffer = Buffer.alloc(0);

  push(chunk: Buffer): unknown[] {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const messages: unknown[] = [];

    while (true) {
      const separatorIndex = this.buffer.indexOf(HEADER_SEPARATOR);
      if (separatorIndex === -1) {
        break;
      }

      const headerText = this.buffer.subarray(0, separatorIndex).toString('utf8');
      const contentLengthLine = headerText
        .split('\r\n')
        .find((line) => line.toLowerCase().startsWith('content-length:'));
      if (!contentLengthLine) {
        throw new Error('Missing Content-Length header.');
      }

      const contentLength = Number.parseInt(contentLengthLine.split(':')[1].trim(), 10);
      const bodyStart = separatorIndex + HEADER_SEPARATOR.length;
      const bodyEnd = bodyStart + contentLength;
      if (this.buffer.length < bodyEnd) {
        break;
      }

      const bodyText = this.buffer.subarray(bodyStart, bodyEnd).toString('utf8');
      messages.push(JSON.parse(bodyText));
      this.buffer = this.buffer.subarray(bodyEnd);
    }

    return messages;
  }
}

function getLineNumber(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

function analyzeUpdate(update: { updateId: string; files: Array<{ path: string; content: string }> }) {
  const diagnostics: Array<{ path: string; line: number; ruleId: string; message: string }> = [];

  for (const file of update.files) {
    const bodyParseMatch = file.content.match(/await\s+request\.json\(\)/);
    const importsZod = /\bfrom\s+['"]zod['"]/.test(file.content) || /\bimport\s+\{\s*z\s*\}/.test(file.content);
    const usesZodValidation = /\.safeParse\(/.test(file.content) || /\.parse\(/.test(file.content);
    if (
      /src\/(?:app\/api\/.+\/route|server\/.+)\.tsx?$/.test(file.path) &&
      bodyParseMatch &&
      !(importsZod && usesZodValidation)
    ) {
      diagnostics.push({
        path: file.path,
        line: getLineNumber(file.content, bodyParseMatch.index ?? 0),
        ruleId: 'missing-zod-validation',
        message: 'Backend request parsing must be guarded by a Zod schema before business logic runs.'
      });
    }

    const secretPatterns = [
      /\bsk-[A-Za-z0-9]{20,}\b/g,
      /\bAIza[0-9A-Za-z\-_]{20,}\b/g,
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
      /process\.env\.[A-Z0-9_]+\s*(?:\?\?|\|\|)\s*['"`][^'"`\n]{4,}['"`]/g,
      /\b(?:apiKey|api_key|token|secret|password)\b\s*[:=]\s*['"`][^'"`\n]{8,}['"`]/gi
    ];

    for (const pattern of secretPatterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(file.content);
      if (!match) {
        continue;
      }

      diagnostics.push({
        path: file.path,
        line: getLineNumber(file.content, match.index),
        ruleId: 'hardcoded-secret',
        message: 'Hardcoded secret material or insecure secret fallback detected.'
      });
    }
  }

  return {
    updateId: update.updateId,
    verdict: diagnostics.length === 0 ? 'allow' : 'deny',
    diagnostics,
    reviewedAt: new Date().toISOString()
  };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const command = process.env.MCP_BRIDGE_COMMAND;
  if (!command) {
    throw new Error('Missing MCP_BRIDGE_COMMAND.');
  }

  const args = process.env.MCP_BRIDGE_ARGS ? (JSON.parse(process.env.MCP_BRIDGE_ARGS) as string[]) : [];
  const pollIntervalMs = Number.parseInt(process.env.MCP_POLL_INTERVAL_MS ?? '5000', 10);
  const once = process.argv.includes('--once');
  const parser = new JsonRpcMessageBuffer();
  const pending = new Map<JsonRpcId, { resolve: (value: any) => void; reject: (error: unknown) => void }>();
  let nextId = 1;

  const child = spawn(command, args, {
    cwd: process.env.MCP_BRIDGE_CWD || process.cwd(),
    env: process.env,
    stdio: ['pipe', 'pipe', 'inherit'],
    shell: false
  });

  child.stdout.on('data', (chunk: Buffer) => {
    for (const message of parser.push(chunk)) {
      if (!message || typeof message !== 'object') {
        continue;
      }

      const envelope = message as {
        id?: JsonRpcId;
        result?: unknown;
        error?: { message?: string };
      };

      if (envelope.id === undefined) {
        continue;
      }

      const request = pending.get(envelope.id);
      if (!request) {
        continue;
      }

      pending.delete(envelope.id);
      if (envelope.error) {
        request.reject(new Error(envelope.error.message ?? 'Unknown JSON-RPC error.'));
      } else {
        request.resolve(envelope.result);
      }
    }
  });

  const request = async <T>(method: string, params?: unknown): Promise<T> => {
    const id = nextId++;
    child.stdin.write(
      encodeJsonRpcMessage({
        jsonrpc: '2.0',
        id,
        method,
        params
      })
    );

    return new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
  };

  await request('initialize', {
    clientInfo: {
      name: 'voxera-reviewer-stdio',
      transport: 'stdio'
    }
  });

  let cursor: string | null = null;

  while (true) {
    const response: {
      cursor: string | null;
      updates: Array<{ updateId: string; files: Array<{ path: string; content: string }> }>;
    } = (await request<{
      cursor: string | null;
      updates: Array<{ updateId: string; files: Array<{ path: string; content: string }> }>;
    }>('updates.pull', { cursor })) ?? { cursor: null, updates: [] };

    cursor = response.cursor ?? cursor;

    for (const update of response.updates) {
      const review = analyzeUpdate(update);
      await request('reviews.submit', review);
      process.stdout.write(`${JSON.stringify(review)}\n`);
    }

    if (once) {
      break;
    }

    await sleep(pollIntervalMs);
  }

  child.kill();
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});

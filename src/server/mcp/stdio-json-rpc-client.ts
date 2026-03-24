import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { encodeJsonRpcMessage, JsonRpcMessageBuffer, type JsonRpcId } from '@/server/mcp/json-rpc';

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (reason?: unknown) => void;
};

export interface StdioJsonRpcClientOptions {
  command: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export class JsonRpcRemoteError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly data: unknown
  ) {
    super(message);
    this.name = 'JsonRpcRemoteError';
  }
}

export class StdioJsonRpcClient {
  private childProcess: ChildProcessWithoutNullStreams | null = null;
  private readonly parser = new JsonRpcMessageBuffer();
  private readonly pendingRequests = new Map<JsonRpcId, PendingRequest>();
  private nextId = 1;

  constructor(private readonly options: StdioJsonRpcClientOptions) {}

  async start(): Promise<void> {
    if (this.childProcess) {
      return;
    }

    this.childProcess = spawn(this.options.command, this.options.args ?? [], {
      cwd: this.options.cwd,
      env: {
        ...process.env,
        ...this.options.env
      },
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.childProcess.stdout.on('data', (chunk) => {
      for (const message of this.parser.push(chunk)) {
        this.handleMessage(message);
      }
    });

    this.childProcess.on('exit', (code, signal) => {
      const error = new Error(`MCP bridge exited (code=${code ?? 'null'}, signal=${signal ?? 'null'}).`);
      this.rejectAll(error);
      this.childProcess = null;
    });
  }

  async request<T>(method: string, params?: unknown): Promise<T> {
    await this.start();

    const id = this.nextId++;
    const payload = encodeJsonRpcMessage({
      jsonrpc: '2.0',
      id,
      method,
      params
    });

    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.childProcess?.stdin.write(payload);
    });
  }

  async notify(method: string, params?: unknown): Promise<void> {
    await this.start();
    const payload = encodeJsonRpcMessage({
      jsonrpc: '2.0',
      method,
      params
    });
    this.childProcess?.stdin.write(payload);
  }

  close(): void {
    if (!this.childProcess) {
      return;
    }

    this.childProcess.kill();
    this.childProcess = null;
  }

  private handleMessage(message: unknown): void {
    if (!message || typeof message !== 'object') {
      return;
    }

    const envelope = message as {
      id?: JsonRpcId;
      result?: unknown;
      error?: { code?: number; message?: string; data?: unknown };
    };

    if (envelope.id === undefined) {
      return;
    }

    const pending = this.pendingRequests.get(envelope.id);
    if (!pending) {
      return;
    }

    this.pendingRequests.delete(envelope.id);

    if (envelope.error) {
      pending.reject(
        new JsonRpcRemoteError(
          envelope.error.message ?? 'Unknown JSON-RPC error.',
          envelope.error.code ?? -32000,
          envelope.error.data
        )
      );
      return;
    }

    pending.resolve(envelope.result);
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pendingRequests.values()) {
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }
}

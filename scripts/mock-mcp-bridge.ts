import { writeFileSync } from 'node:fs';
import process from 'node:process';

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

const update = process.env.MOCK_BRIDGE_UPDATE_JSON
  ? JSON.parse(process.env.MOCK_BRIDGE_UPDATE_JSON)
  : {
      updateId: 'update-1',
      files: []
    };

const capturePath = process.env.MOCK_BRIDGE_CAPTURE_FILE;
const submissions: unknown[] = [];
let delivered = false;

function sendResponse(id: JsonRpcId, result: unknown) {
  process.stdout.write(
    encodeJsonRpcMessage({
      jsonrpc: '2.0',
      id,
      result
    })
  );
}

process.on('exit', () => {
  if (capturePath) {
    writeFileSync(capturePath, JSON.stringify(submissions, null, 2), 'utf8');
  }
});

const parser = new JsonRpcMessageBuffer();
process.stdin.on('data', (chunk: Buffer) => {
  for (const message of parser.push(chunk)) {
    if (!message || typeof message !== 'object') {
      continue;
    }

    const envelope = message as { id?: JsonRpcId; method?: string; params?: unknown };
    if (envelope.id === undefined || !envelope.method) {
      continue;
    }

    if (envelope.method === 'initialize') {
      sendResponse(envelope.id, {
        ok: true,
        serverInfo: {
          name: 'mock-bridge'
        }
      });
      continue;
    }

    if (envelope.method === 'updates.pull') {
      sendResponse(envelope.id, {
        cursor: delivered ? 'cursor-1' : 'cursor-0',
        updates: delivered ? [] : [update]
      });
      delivered = true;
      continue;
    }

    if (envelope.method === 'reviews.submit') {
      submissions.push(envelope.params);
      sendResponse(envelope.id, { ok: true });
      if (capturePath) {
        writeFileSync(capturePath, JSON.stringify(submissions, null, 2), 'utf8');
      }
      continue;
    }

    sendResponse(envelope.id, { ok: true });
  }
});

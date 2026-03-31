export type JsonRpcId = number | string;

const HEADER_SEPARATOR = '\r\n\r\n';
const CONTENT_LENGTH_HEADER = 'content-length';

export function encodeJsonRpcMessage(message: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  const header = Buffer.from(`Content-Length: ${body.length}${HEADER_SEPARATOR}`, 'utf8');
  return Buffer.concat([header, body]);
}

export class JsonRpcMessageBuffer {
  private buffer = Buffer.alloc(0);

  push(chunk: Buffer | string): unknown[] {
    const nextChunk = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk;
    this.buffer = Buffer.concat([this.buffer, nextChunk]);

    const messages: unknown[] = [];

    while (true) {
      const separatorIndex = this.buffer.indexOf(HEADER_SEPARATOR);
      if (separatorIndex === -1) {
        break;
      }

      const headerText = this.buffer.subarray(0, separatorIndex).toString('utf8');
      const contentLength = this.readContentLength(headerText);
      if (contentLength === null) {
        throw new Error('JSON-RPC message is missing a Content-Length header.');
      }

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

  private readContentLength(headerText: string): number | null {
    const headerLines = headerText.split('\r\n');
    for (const line of headerLines) {
      const separatorIndex = line.indexOf(':');
      if (separatorIndex === -1) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim().toLowerCase();
      if (key !== CONTENT_LENGTH_HEADER) {
        continue;
      }

      const value = Number.parseInt(line.slice(separatorIndex + 1).trim(), 10);
      return Number.isFinite(value) ? value : null;
    }

    return null;
  }
}

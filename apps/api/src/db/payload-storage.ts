import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const MAX_INLINE_JSON_BYTES = 256 * 1024;

export type PersistedJsonPayload = {
  externalUri: string | null;
  inlineJson: unknown | null;
  sizeBytes: number;
  sha256: string;
};

type PersistJsonPayloadInput = {
  namespace: string;
  value: unknown;
  storageRoot?: string;
};

function resolveStorageRoot(customRoot?: string) {
  return customRoot ?? path.join(process.cwd(), 'apps', 'api', '.payload-store');
}

function toJsonText(value: unknown) {
  return JSON.stringify(value ?? null);
}

async function ensureFile(filePath: string, content: string) {
  try {
    await access(filePath);
  } catch {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content, 'utf8');
  }
}

export async function persistJsonPayload({
  namespace,
  value,
  storageRoot
}: PersistJsonPayloadInput): Promise<PersistedJsonPayload> {
  const jsonText = toJsonText(value);
  const sizeBytes = Buffer.byteLength(jsonText, 'utf8');
  const digest = createHash('sha256').update(jsonText).digest('hex');

  if (sizeBytes <= MAX_INLINE_JSON_BYTES) {
    return {
      externalUri: null,
      inlineJson: JSON.parse(jsonText) as unknown,
      sizeBytes,
      sha256: digest
    };
  }

  const filePath = path.join(resolveStorageRoot(storageRoot), namespace, `${digest}.json`);

  await ensureFile(filePath, jsonText);

  return {
    externalUri: pathToFileURL(filePath).toString(),
    inlineJson: null,
    sizeBytes,
    sha256: digest
  };
}

export async function readPersistedJsonPayload(payload: PersistedJsonPayload) {
  if (payload.inlineJson !== null) {
    return payload.inlineJson;
  }

  if (!payload.externalUri?.startsWith('file://')) {
    throw new Error(`Unsupported external payload URI: ${payload.externalUri ?? 'null'}`);
  }

  const filePath = new URL(payload.externalUri);
  const jsonText = await readFile(filePath, 'utf8');
  return JSON.parse(jsonText) as unknown;
}

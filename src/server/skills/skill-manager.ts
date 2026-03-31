import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  GetObjectCommand,
  type GetObjectCommandOutput,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { z } from 'zod';

export interface SkillFileContent {
  template: string;
  metadata: {
    name: string;
    description: string;
  };
}

export interface GeminiOutput {
  skillId: string;
  contentChanges: Record<string, unknown>;
}

export interface ObjectStorage {
  getText(key: string): Promise<string>;
  putText(key: string, body: string, contentType?: string): Promise<void>;
  putJson<T>(key: string, body: T): Promise<void>;
  getJson<T>(key: string): Promise<T>;
  exists(key: string): Promise<boolean>;
}

export interface SkillMeta {
  skillId: string;
  fileName: string;
  displayName: string;
  aliases: string[];
  category: string;
  sizeBytes: number;
  checksum: string;
}

export interface SkillManifest {
  userId: string;
  version: number;
  updatedAt: string;
  skills: SkillMeta[];
}

export interface ResolvedSkillFile {
  skill: SkillFileContent;
  meta: SkillMeta;
  storageKey: string;
}

const skillMetaSchema = z.object({
  skillId: z.string().trim().min(1),
  fileName: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  aliases: z.array(z.string()).default([]),
  category: z.string().trim().min(1).default('default'),
  sizeBytes: z.number().int().nonnegative().default(0),
  checksum: z.string().trim().min(1)
});

const skillManifestSchema = z.object({
  userId: z.string().trim().min(1),
  version: z.number().int().nonnegative(),
  updatedAt: z.string().trim().min(1),
  skills: z.array(skillMetaSchema)
});

const routeEntrySchema = z.object({
  routeId: z.string().trim().min(1),
  intentLabels: z.array(z.string()).default([]),
  skillBlobKey: z.string().trim().min(1),
  skillSha256: z.string().trim().min(1),
  claudeModel: z.string().trim().min(1),
  outputFormat: z.enum(['markdown', 'html', 'json']),
  destinations: z.array(z.enum(['file', 'notion', 'slack'])),
  active: z.boolean()
});

const tenantManifestSchema = z.object({
  tenantId: z.string().trim().min(1),
  publishedAt: z.string().trim().min(1),
  routes: z.array(routeEntrySchema)
});

function normalizeStorageKey(key: string): string {
  return key.replace(/\\/g, '/').replace(/^\/+/, '');
}

function normalizeChecksum(checksum: string): string {
  return checksum.startsWith('sha256:') ? checksum : `sha256:${checksum}`;
}

function parseFrontmatterValue(frontmatter: string, field: string): string | null {
  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = frontmatter.match(new RegExp(`^${escapedField}:\\s*["']?(.+?)["']?$`, 'm'));
  return match?.[1]?.trim() ?? null;
}

function buildSkillDescription(meta: SkillMeta | undefined, template: string, skillId: string): string {
  const frontmatterMatch = template.match(/^---\s*\n([\s\S]*?)\n---/);
  const frontmatter = frontmatterMatch?.[1] ?? '';
  const frontmatterDescription = parseFrontmatterValue(frontmatter, 'description');

  if (frontmatterDescription) {
    return frontmatterDescription;
  }

  if (meta) {
    return `${meta.displayName} (${meta.category})`;
  }

  return `Skill for ${skillId}`;
}

export function createSkillFileContent(
  skillId: string,
  template: string,
  meta?: SkillMeta
): SkillFileContent {
  const frontmatterMatch = template.match(/^---\s*\n([\s\S]*?)\n---/);
  const frontmatter = frontmatterMatch?.[1] ?? '';
  const name =
    parseFrontmatterValue(frontmatter, 'name') ??
    parseFrontmatterValue(frontmatter, 'skill_id') ??
    meta?.displayName ??
    skillId;

  return {
    template,
    metadata: {
      name,
      description: buildSkillDescription(meta, template, skillId)
    }
  };
}

async function bodyToString(body: GetObjectCommandOutput['Body']): Promise<string> {
  if (!body) {
    throw new Error('S3 object body is empty.');
  }

  if (typeof body.transformToString === 'function') {
    return body.transformToString();
  }

  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array | string>) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf8');
}

export class LocalObjectStorage implements ObjectStorage {
  constructor(private readonly baseDir: string) {}

  private resolvePath(key: string): string {
    const normalized = normalizeStorageKey(key);
    return path.join(this.baseDir, ...normalized.split('/'));
  }

  async getText(key: string): Promise<string> {
    return fs.readFile(this.resolvePath(key), 'utf8');
  }

  async putText(key: string, body: string, _contentType?: string): Promise<void> {
    const filePath = this.resolvePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, body, 'utf8');
  }

  async putJson<T>(key: string, body: T): Promise<void> {
    await this.putText(key, JSON.stringify(body, null, 2), 'application/json');
  }

  async getJson<T>(key: string): Promise<T> {
    return JSON.parse(await this.getText(key)) as T;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolvePath(key));
      return true;
    } catch {
      return false;
    }
  }
}

export interface S3ObjectStorageOptions {
  bucket: string;
  region: string;
  prefix?: string;
  endpoint?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(private readonly options: S3ObjectStorageOptions) {
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      credentials: options.credentials
    });
  }

  private resolveKey(key: string): string {
    const normalized = normalizeStorageKey(key);
    if (!this.options.prefix) {
      return normalized;
    }

    return `${normalizeStorageKey(this.options.prefix)}/${normalized}`;
  }

  async getText(key: string): Promise<string> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.options.bucket,
        Key: this.resolveKey(key)
      })
    );

    return bodyToString(response.Body);
  }

  async putText(key: string, body: string, contentType = 'text/plain; charset=utf-8'): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: this.resolveKey(key),
        Body: body,
        ContentType: contentType
      })
    );
  }

  async putJson<T>(key: string, body: T): Promise<void> {
    await this.putText(key, JSON.stringify(body, null, 2), 'application/json');
  }

  async getJson<T>(key: string): Promise<T> {
    return JSON.parse(await this.getText(key)) as T;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.options.bucket,
          Key: this.resolveKey(key)
        })
      );
      return true;
    } catch {
      return false;
    }
  }
}

interface CacheEntry {
  value: SkillFileContent;
  loadedAt: number;
}

class SkillCache {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs: number;

  constructor(private readonly maxEntries = 5000, ttlMinutes = 30) {
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  get(key: string): SkillFileContent | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() - entry.loadedAt > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: SkillFileContent): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      loadedAt: Date.now()
    });
  }

  invalidate(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }
}

export class SkillNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkillNotFoundError';
  }
}

export class SkillIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkillIntegrityError';
  }
}

export interface SkillManagerOptions {
  storage: ObjectStorage;
  cacheMaxEntries?: number;
  cacheTtlMinutes?: number;
}

export class SkillManager {
  private readonly cache: SkillCache;

  constructor(private readonly options: SkillManagerOptions) {
    this.cache = new SkillCache(options.cacheMaxEntries ?? 5000, options.cacheTtlMinutes ?? 30);
  }

  async readManifest(tenantId: string): Promise<SkillManifest> {
    const manifestKey = await this.resolveManifestKey(tenantId);
    const rawManifest = await this.options.storage.getJson<unknown>(manifestKey);

    const directManifest = skillManifestSchema.safeParse(rawManifest);
    if (directManifest.success) {
      return directManifest.data;
    }

    const routeManifest = tenantManifestSchema.parse(rawManifest);
    return {
      userId: routeManifest.tenantId,
      version: 1,
      updatedAt: routeManifest.publishedAt,
      skills: routeManifest.routes
        .filter((route) => route.active)
        .map((route) => ({
          skillId: route.routeId,
          fileName: route.skillBlobKey,
          displayName: route.routeId,
          aliases: route.intentLabels,
          category: route.outputFormat,
          sizeBytes: 0,
          checksum: normalizeChecksum(route.skillSha256)
        }))
    };
  }

  async getAvailableSkills(tenantId: string): Promise<SkillMeta[]> {
    const manifest = await this.readManifest(tenantId);
    return manifest.skills;
  }

  async validateSkillId(tenantId: string, skillId: string): Promise<boolean> {
    const manifest = await this.readManifest(tenantId);
    return manifest.skills.some((skill) => skill.skillId === skillId);
  }

  async loadResolvedSkill(tenantId: string, skillId: string): Promise<ResolvedSkillFile> {
    const manifest = await this.readManifest(tenantId);
    const meta = manifest.skills.find((skill) => skill.skillId === skillId);

    if (!meta) {
      throw new SkillNotFoundError(
        `Tenant "${tenantId}" does not have skill "${skillId}". Available skills: [${manifest.skills
          .map((skill) => skill.skillId)
          .join(', ')}]`
      );
    }

    const cacheKey = `${tenantId}::${normalizeChecksum(meta.checksum)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return {
        skill: cached,
        meta,
        storageKey: await this.resolveSkillStorageKey(tenantId, meta.fileName)
      };
    }

    const storageKey = await this.resolveSkillStorageKey(tenantId, meta.fileName);
    const template = await this.options.storage.getText(storageKey);
    this.assertChecksum(meta, template);

    const skill = createSkillFileContent(skillId, template, meta);
    this.cache.set(cacheKey, skill);

    return {
      skill,
      meta,
      storageKey
    };
  }

  async loadSkillFile(tenantId: string, skillId: string): Promise<SkillFileContent> {
    const resolved = await this.loadResolvedSkill(tenantId, skillId);
    return resolved.skill;
  }

  async routeSkillFile(tenantId: string, geminiOutput: GeminiOutput): Promise<SkillFileContent> {
    if (!geminiOutput.skillId) {
      throw new Error('Gemini output must contain a skillId for routing.');
    }

    return this.loadSkillFile(tenantId, geminiOutput.skillId);
  }

  invalidateCache(tenantId: string, skillId?: string): void {
    const prefix = `${tenantId}::`;
    this.cache.invalidate(prefix);
  }

  private assertChecksum(meta: SkillMeta, template: string): void {
    const checksum = normalizeChecksum(meta.checksum);
    const actual = `sha256:${createHash('sha256').update(template).digest('hex')}`;

    if (checksum !== actual) {
      throw new SkillIntegrityError(
        `Checksum mismatch for skill "${meta.skillId}". Expected ${checksum} but received ${actual}.`
      );
    }
  }

  private async resolveManifestKey(tenantId: string): Promise<string> {
    const candidates = [
      `/tenants/${tenantId}/routing/manifest.json`,
      `/tenants/${tenantId}/skills/_manifest.json`,
      `/tenants/${tenantId}/_manifest.json`,
      `/${tenantId}/skills/_manifest.json`,
      `/${tenantId}/_manifest.json`
    ];

    for (const candidate of candidates) {
      if (await this.options.storage.exists(candidate)) {
        return candidate;
      }
    }

    throw new Error(`Manifest not found for tenant "${tenantId}".`);
  }

  private async resolveSkillStorageKey(tenantId: string, fileName: string): Promise<string> {
    const normalizedFileName = normalizeStorageKey(fileName);
    const basename = path.posix.basename(normalizedFileName);
    const candidates = Array.from(
      new Set([
        normalizedFileName.startsWith('tenants/')
          ? `/${normalizedFileName}`
          : `/tenants/${tenantId}/${normalizedFileName}`,
        `/tenants/${tenantId}/skills/${basename}`,
        `/tenants/${tenantId}/${basename}`,
        `/${tenantId}/skills/${basename}`,
        `/${tenantId}/${basename}`
      ])
    );

    for (const candidate of candidates) {
      if (await this.options.storage.exists(candidate)) {
        return candidate;
      }
    }

    return candidates[0];
  }
}

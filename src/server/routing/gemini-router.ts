import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import type { GeminiOutput, SkillMeta } from '@/server/skills/skill-manager';

const contentChangesSchema = z.record(z.string(), z.unknown());

export function createGeminiOutputSchema(skillIds: [string, ...string[]]) {
  return z
    .object({
      skillId: z.enum(skillIds),
      contentChanges: contentChangesSchema
    })
    .strict();
}

function buildResponseJsonSchema(skillIds: readonly string[]) {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      skillId: {
        type: 'string',
        enum: skillIds
      },
      contentChanges: {
        type: 'object'
      }
    },
    required: ['skillId', 'contentChanges']
  };
}

export class GeminiRuntimeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiRuntimeValidationError';
  }
}

export interface GeminiRouterOptions {
  apiKey: string;
  model?: string;
}

export interface GeminiRouteInput {
  tenantId: string;
  utterance: string;
  availableSkills: SkillMeta[];
}

export function parseGeminiOutput(
  availableSkills: SkillMeta[],
  payload: unknown
): GeminiOutput {
  const skillIds = Array.from(new Set(availableSkills.map((skill) => skill.skillId)));
  if (skillIds.length === 0) {
    throw new GeminiRuntimeValidationError('No available skills were provided for Gemini validation.');
  }

  const schema = createGeminiOutputSchema(skillIds as [string, ...string[]]);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new GeminiRuntimeValidationError(
      `Gemini output failed runtime validation: ${parsed.error.message}`
    );
  }

  return parsed.data;
}

export class GeminiRouter {
  private readonly ai: GoogleGenAI;
  private readonly model: string;

  constructor(options: GeminiRouterOptions) {
    this.ai = new GoogleGenAI({ apiKey: options.apiKey });
    this.model = options.model ?? 'gemini-2.5-pro';
  }

  async route(input: GeminiRouteInput): Promise<GeminiOutput> {
    const skillIds = Array.from(new Set(input.availableSkills.map((skill) => skill.skillId)));
    if (skillIds.length === 0) {
      throw new GeminiRuntimeValidationError(
        `Tenant "${input.tenantId}" does not have any available skills to route.`
      );
    }

    const typedSkillIds = skillIds as [string, ...string[]];
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: this.buildPrompt(input),
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: buildResponseJsonSchema(typedSkillIds)
      }
    });

    const rawText = response.text ?? '';
    let parsedJson: unknown;

    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      throw new GeminiRuntimeValidationError(`Gemini did not return valid JSON: ${rawText}`);
    }

    return parseGeminiOutput(input.availableSkills, parsedJson);
  }

  private buildPrompt(input: GeminiRouteInput): string {
    const skillCatalog = input.availableSkills
      .map((skill) => {
        const aliases = skill.aliases.length > 0 ? skill.aliases.join(', ') : 'none';
        return `- skillId="${skill.skillId}" | displayName="${skill.displayName}" | aliases="${aliases}" | category="${skill.category}"`;
      })
      .join('\n');

    return [
      'You are VOXERA\'s strict JSON router.',
      'Choose exactly one skillId from the allowed list.',
      'Extract only the content changes explicitly supported by the utterance.',
      'Never invent skill ids, file paths, or extra top-level fields.',
      'Return JSON only.',
      '',
      `Tenant: ${input.tenantId}`,
      'Allowed skills:',
      skillCatalog,
      '',
      `Utterance: ${input.utterance}`
    ].join('\n');
  }
}

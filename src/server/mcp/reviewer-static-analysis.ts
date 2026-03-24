import { z } from 'zod';

export const cloudUpdateFileSchema = z.object({
  path: z.string().trim().min(1),
  content: z.string()
});

export const cloudUpdateBatchSchema = z.object({
  updateId: z.string().trim().min(1),
  files: z.array(cloudUpdateFileSchema).min(1)
});

export const reviewerDiagnosticSchema = z.object({
  path: z.string(),
  line: z.number().int().positive(),
  ruleId: z.enum(['missing-zod-validation', 'hardcoded-secret']),
  message: z.string()
});

export const reviewerFeedbackSchema = z.object({
  updateId: z.string(),
  verdict: z.enum(['allow', 'deny']),
  diagnostics: z.array(reviewerDiagnosticSchema),
  reviewedAt: z.string()
});

export type CloudUpdateBatch = z.infer<typeof cloudUpdateBatchSchema>;
export type ReviewerFeedback = z.infer<typeof reviewerFeedbackSchema>;

const backendValidationPathPattern = /src\/(?:app\/api\/.+\/route|server\/.+)\.tsx?$/;
const hardcodedSecretPatterns = [
  /\bsk-[A-Za-z0-9]{20,}\b/g,
  /\bAIza[0-9A-Za-z\-_]{20,}\b/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  /process\.env\.[A-Z0-9_]+\s*(?:\?\?|\|\|)\s*['"`][^'"`\n]{4,}['"`]/g,
  /\b(?:apiKey|api_key|token|secret|password)\b\s*[:=]\s*['"`][^'"`\n]{8,}['"`]/gi
];

function getLineNumber(content: string, index: number): number {
  const prefix = content.slice(0, index);
  return prefix.split('\n').length;
}

function detectMissingZodValidation(path: string, content: string) {
  if (!backendValidationPathPattern.test(path)) {
    return null;
  }

  const bodyParseMatch = content.match(/await\s+request\.json\(\)/);
  if (!bodyParseMatch) {
    return null;
  }

  const importsZod = /\bfrom\s+['"]zod['"]/.test(content) || /\bimport\s+\{\s*z\s*\}/.test(content);
  const usesZodValidation = /\.safeParse\(/.test(content) || /\.parse\(/.test(content);

  if (importsZod && usesZodValidation) {
    return null;
  }

  return {
    path,
    line: getLineNumber(content, bodyParseMatch.index ?? 0),
    ruleId: 'missing-zod-validation' as const,
    message: 'Backend request parsing must be guarded by a Zod schema before business logic runs.'
  };
}

function detectHardcodedSecrets(path: string, content: string) {
  const diagnostics: Array<z.infer<typeof reviewerDiagnosticSchema>> = [];

  for (const pattern of hardcodedSecretPatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(content);
    if (!match) {
      continue;
    }

    diagnostics.push({
      path,
      line: getLineNumber(content, match.index),
      ruleId: 'hardcoded-secret',
      message: 'Hardcoded secret material or insecure secret fallback detected.'
    });
  }

  return diagnostics;
}

export function analyzeCloudUpdate(update: CloudUpdateBatch): ReviewerFeedback {
  const diagnostics = update.files.flatMap((file) => {
    const fileDiagnostics = detectHardcodedSecrets(file.path, file.content);
    const zodDiagnostic = detectMissingZodValidation(file.path, file.content);
    if (zodDiagnostic) {
      fileDiagnostics.push(zodDiagnostic);
    }
    return fileDiagnostics;
  });

  return reviewerFeedbackSchema.parse({
    updateId: update.updateId,
    verdict: diagnostics.length === 0 ? 'allow' : 'deny',
    diagnostics,
    reviewedAt: new Date().toISOString()
  });
}

import { z } from 'zod';

export const contractIssueSchema = z
  .object({
    path: z.string().min(1),
    message: z.string().min(1),
    code: z.string().min(1)
  })
  .strict();

export type ContractIssue = z.infer<typeof contractIssueSchema>;

export const contractErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z.string().min(1),
    issues: z.array(contractIssueSchema).default([]),
    queueError: z.string().min(1).optional()
  })
  .strict();

export type ContractErrorResponse = z.infer<typeof contractErrorResponseSchema>;

export function formatZodIssues(error: z.ZodError): ContractIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : 'root',
    message: issue.message,
    code: issue.code
  }));
}

export function buildContractError(message: string, error: z.ZodError): ContractErrorResponse {
  return {
    ok: false,
    error: message,
    issues: formatZodIssues(error)
  };
}

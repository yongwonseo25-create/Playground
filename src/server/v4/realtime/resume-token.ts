export type ResumeTokenPayload = {
  streamKey: string;
  connectionId: string;
  issuedAt: string;
};

export function issueResumeToken(payload: ResumeTokenPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function parseResumeToken(token: string): ResumeTokenPayload {
  try {
    const parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as Partial<ResumeTokenPayload>;

    if (!parsed.streamKey || !parsed.connectionId || !parsed.issuedAt) {
      throw new Error('resume token is missing required fields.');
    }

    return {
      streamKey: parsed.streamKey,
      connectionId: parsed.connectionId,
      issuedAt: parsed.issuedAt
    };
  } catch (error) {
    throw new Error(
      error instanceof Error ? `Invalid resume token: ${error.message}` : 'Invalid resume token.'
    );
  }
}

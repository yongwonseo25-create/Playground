import type { DecodedIdToken } from 'firebase-admin/auth';
import { getAdminAuth } from '@/server/firebase/admin';

export class UnauthorizedError extends Error {
  readonly statusCode = 401;

  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export interface VerifiedFirebaseUser {
  uid: string;
  email: string | null;
  decodedToken: DecodedIdToken;
}

function getBearerToken(request: Request): string {
  const header = request.headers.get('authorization');
  if (!header) {
    throw new UnauthorizedError('Missing Authorization header.');
  }

  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new UnauthorizedError('Authorization header must be a Bearer token.');
  }

  return token;
}

export async function verifyFirebaseUserFromRequest(
  request: Request
): Promise<VerifiedFirebaseUser> {
  const token = getBearerToken(request);

  try {
    const decodedToken = await getAdminAuth().verifyIdToken(token, true);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email ?? null,
      decodedToken
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Firebase Auth error.';
    throw new UnauthorizedError(`Firebase Auth verification failed: ${message}`);
  }
}

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getServerEnv } from '@/server/config/server-env';

let cachedSecretManagerClient: SecretManagerServiceClient | null = null;

function createFirebaseApp(): App {
  const existing = getApps()[0];
  if (existing) {
    return existing;
  }

  const env = getServerEnv();
  const hasServiceAccount =
    Boolean(env.FIREBASE_PROJECT_ID) &&
    Boolean(env.FIREBASE_CLIENT_EMAIL) &&
    Boolean(env.FIREBASE_PRIVATE_KEY);

  if (hasServiceAccount) {
    return initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY
      }),
      projectId: env.FIREBASE_PROJECT_ID
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId: env.FIREBASE_PROJECT_ID
  });
}

export function getFirebaseAdminApp(): App {
  return createFirebaseApp();
}

export function getAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}

export function getAdminFirestore(): Firestore {
  const env = getServerEnv();
  return getFirestore(getFirebaseAdminApp(), env.FIRESTORE_DATABASE_ID);
}

export function getSecretManagerClient(): SecretManagerServiceClient {
  if (!cachedSecretManagerClient) {
    cachedSecretManagerClient = new SecretManagerServiceClient();
  }

  return cachedSecretManagerClient;
}

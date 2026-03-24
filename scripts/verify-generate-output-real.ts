import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

type EnvMap = Record<string, string>;

function parseEnvFile(raw: string): EnvMap {
  const result: EnvMap = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    result[key] = value;
  }

  return result;
}

async function loadEnvLocal(): Promise<EnvMap> {
  return parseEnvFile(await readFile('.env.local', 'utf8'));
}

function requireEnv(env: EnvMap, name: string): string {
  const value = env[name] ?? process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getAdminApp(env: EnvMap): App {
  const existing = getApps()[0];
  if (existing) {
    return existing;
  }

  const projectId = requireEnv(env, 'FIREBASE_PROJECT_ID');
  const clientEmail = env.FIREBASE_CLIENT_EMAIL ?? process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (env.FIREBASE_PRIVATE_KEY ?? process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n');

  if (clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey
      }),
      projectId
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId
  });
}

async function waitForServer(child: ReturnType<typeof spawn>, port: number): Promise<void> {
  const readyTokens = ['Ready in', 'ready started server', 'Local:'];
  let output = '';
  const stdout = child.stdout;
  const stderr = child.stderr;

  if (!stdout || !stderr) {
    throw new Error('Next dev child process did not expose stdout/stderr pipes.');
  }

  await new Promise<void>((resolve, reject) => {
    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);

      if (readyTokens.some((token) => text.includes(token))) {
        resolve();
      }
    };

    stdout.on('data', onData);
    stderr.on('data', onData);
    child.on('exit', (code) => reject(new Error(`Next dev exited early with code ${code}.\n${output}`)));
  });

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await fetch(`http://127.0.0.1:${port}`);
      return;
    } catch {
      await sleep(500);
    }
  }

  throw new Error('Timed out waiting for Next dev HTTP readiness.');
}

async function main() {
  const envLocal = await loadEnvLocal();
  if (envLocal.GOOGLE_APPLICATION_CREDENTIALS) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = envLocal.GOOGLE_APPLICATION_CREDENTIALS;
  }
  const projectId = requireEnv(envLocal, 'FIREBASE_PROJECT_ID');
  const databaseId = requireEnv(envLocal, 'FIRESTORE_DATABASE_ID');
  const firebaseAuthApiKey = requireEnv(envLocal, 'FIREBASE_AUTH_API_KEY');
  const internalBaseUrl = requireEnv(envLocal, 'INTERNAL_APP_BASE_URL');
  const port = Number.parseInt(new URL(internalBaseUrl).port || '3000', 10);

  const app = getAdminApp(envLocal);
  const auth = getAuth(app);
  const firestore = getFirestore(app, databaseId);
  const uid = `voxera-e2e-${Date.now()}`;
  const walletRef = firestore.collection('wallets').doc(uid);
  const clientRequestId = `real-cloud-${Date.now()}`;

  await walletRef.set({
    availableCredits: 25,
    pendingCredits: 0,
    deductedCredits: 0,
    refundedCredits: 0,
    updatedAt: new Date()
  });

  const customToken = await auth.createCustomToken(uid);
  const idTokenResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(
      firebaseAuthApiKey
    )}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: customToken,
        returnSecureToken: true
      })
    }
  );

  if (!idTokenResponse.ok) {
    throw new Error(`Failed to exchange custom token: ${await idTokenResponse.text()}`);
  }

  const idTokenPayload = (await idTokenResponse.json()) as { idToken: string };
  const idToken = idTokenPayload.idToken;
  if (!idToken) {
    throw new Error('Identity Toolkit response did not include an idToken.');
  }

  const nextBinPath = 'node_modules/next/dist/bin/next';
  const child = spawn(process.execPath, [nextBinPath, 'dev', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...envLocal
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForServer(child, port);

    const response = await fetch(`${internalBaseUrl}/api/v1/generate-output`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({
        clientRequestId,
        prompt: 'Summarize why Voxera uses a two-phase billing commit in exactly two short sentences.',
        outputType: 'summary'
      })
    });

    const body = await response.json();
    if (!response.ok) {
      throw new Error(`Route returned ${response.status}: ${JSON.stringify(body)}`);
    }

    const walletSnapshot = await walletRef.get();
    const transactionSnapshot = await firestore.collection('billingTransactions').doc(clientRequestId).get();

    process.stdout.write(
      `${JSON.stringify(
        {
          projectId,
          databaseId,
          uid,
          clientRequestId,
          billing: body.billing,
          providerModel: body.providerModel,
          providerUsage: body.providerUsage,
          outputPreview: typeof body.outputText === 'string' ? body.outputText.slice(0, 160) : null,
          walletAfter: walletSnapshot.data(),
          transactionAfter: transactionSnapshot.data()
        },
        null,
        2
      )}\n`
    );
  } finally {
    child.kill('SIGTERM');
    await sleep(1_000);
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});

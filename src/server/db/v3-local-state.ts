type LocalUserRecord = {
  id: number;
  email: string;
  credits: number;
  subscriptionTier: string;
};

type LocalVoiceLogRecord = {
  userId: number;
  clientRequestId: string;
  s3Key: string;
  creditsUsed: number;
  status: string;
  createdAt: string;
};

type LockState = Map<number, Promise<void>>;

type V3LocalState = {
  users: Map<number, LocalUserRecord>;
  voiceLogs: Map<string, LocalVoiceLogRecord>;
  userLocks: LockState;
};

function createDefaultUser(id: number): LocalUserRecord {
  return {
    id,
    email: `local-user-${id}@voxera.test`,
    credits: 100,
    subscriptionTier: 'free'
  };
}

function getSharedState(): V3LocalState {
  const globalState = globalThis as typeof globalThis & {
    __voxeraV3LocalState?: V3LocalState;
  };

  if (!globalState.__voxeraV3LocalState) {
    globalState.__voxeraV3LocalState = {
      users: new Map([[1, createDefaultUser(1)]]),
      voiceLogs: new Map(),
      userLocks: new Map()
    };
  }

  return globalState.__voxeraV3LocalState;
}

export class V3LocalStateStore {
  constructor(private readonly state: V3LocalState = getSharedState()) {}

  getOrCreateUser(userId: number): LocalUserRecord {
    const existing = this.state.users.get(userId);
    if (existing) {
      return existing;
    }

    const created = createDefaultUser(userId);
    this.state.users.set(userId, created);
    return created;
  }

  getUserCredits(userId: number): number {
    return this.getOrCreateUser(userId).credits;
  }

  setUserCredits(userId: number, credits: number): void {
    const user = this.getOrCreateUser(userId);
    user.credits = credits;
  }

  insertVoiceLog(input: {
    userId: number;
    clientRequestId: string;
    s3Key: string;
    creditsUsed: number;
    status: string;
  }): boolean {
    if (this.state.voiceLogs.has(input.clientRequestId)) {
      return false;
    }

    this.state.voiceLogs.set(input.clientRequestId, {
      userId: input.userId,
      clientRequestId: input.clientRequestId,
      s3Key: input.s3Key,
      creditsUsed: input.creditsUsed,
      status: input.status,
      createdAt: new Date().toISOString()
    });

    return true;
  }

  getVoiceLog(clientRequestId: string): LocalVoiceLogRecord | null {
    return this.state.voiceLogs.get(clientRequestId) ?? null;
  }

  updateVoiceLogStatus(clientRequestId: string, status: string): void {
    const record = this.state.voiceLogs.get(clientRequestId);
    if (!record) {
      return;
    }

    record.status = status;
  }

  async deductCreditsWithLock(
    userId: number,
    clientRequestId: string,
    creditsRequired: number
  ): Promise<
    | { ok: true; remainingCredits: number }
    | { ok: false; reason: 'insufficient_credits' | 'duplicate' }
  > {
    const previousLock = this.state.userLocks.get(userId) ?? Promise.resolve();
    let releaseCurrent!: () => void;
    const currentLock = new Promise<void>((resolve) => {
      releaseCurrent = () => {
        resolve();
      };
    });
    const lockChain = previousLock.then(() => currentLock);
    this.state.userLocks.set(userId, lockChain);

    await previousLock;

    try {
      const log = this.getVoiceLog(clientRequestId);
      if (!log) {
        throw new Error(`Voice log ${clientRequestId} does not exist.`);
      }

      if (['charged', 'completed', 'webhook_failed', 'insufficient_credits'].includes(log.status)) {
        return {
          ok: false,
          reason: 'duplicate'
        };
      }

      const user = this.getOrCreateUser(userId);
      if (user.credits < creditsRequired) {
        log.status = 'insufficient_credits';
        return {
          ok: false,
          reason: 'insufficient_credits'
        };
      }

      user.credits -= creditsRequired;
      log.creditsUsed = creditsRequired;
      log.status = 'charged';

      return {
        ok: true,
        remainingCredits: user.credits
      };
    } finally {
      releaseCurrent();
      if (this.state.userLocks.get(userId) === lockChain) {
        this.state.userLocks.delete(userId);
      }
    }
  }

  size(): number {
    return this.state.voiceLogs.size;
  }
}

export function resetV3LocalState(): void {
  const state = getSharedState();
  state.users.clear();
  state.users.set(1, createDefaultUser(1));
  state.voiceLogs.clear();
  state.userLocks.clear();
}

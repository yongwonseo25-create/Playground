export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export type CircuitBreakerOptions = {
  failureThreshold?: number;
  cooldownMs?: number;
};

export class CircuitOpenError extends Error {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super(`Circuit breaker is OPEN. Retry after ${retryAfterMs}ms.`);
    this.name = 'CircuitOpenError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private openedAt: number | null = null;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.cooldownMs = options.cooldownMs ?? 30_000;
  }

  getState(now = Date.now()): CircuitState {
    if (this.state === 'OPEN' && this.openedAt !== null && now - this.openedAt >= this.cooldownMs) {
      this.state = 'HALF_OPEN';
    }
    return this.state;
  }

  assertCanRequest(now = Date.now()): void {
    const state = this.getState(now);
    if (state !== 'OPEN') {
      return;
    }

    const retryAfterMs = Math.max(0, this.cooldownMs - (now - (this.openedAt ?? now)));
    throw new CircuitOpenError(retryAfterMs);
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = 'CLOSED';
    this.openedAt = null;
  }

  recordFailure(now = Date.now()): void {
    this.consecutiveFailures += 1;

    if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = now;
    } else if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.openedAt = now;
    }
  }

  snapshot(now = Date.now()) {
    return {
      state: this.getState(now),
      consecutiveFailures: this.consecutiveFailures,
      failureThreshold: this.failureThreshold,
      cooldownMs: this.cooldownMs,
      openedAt: this.openedAt
    };
  }
}

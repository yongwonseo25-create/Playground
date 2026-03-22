export type ConcurrencySnapshot = {
  active: number;
  queued: number;
  peakConcurrency: number;
  maximumConcurrency: number;
};

type Task<T> = () => Promise<T> | T;

export class MaximumConcurrencyLimiter {
  private activeCount = 0;

  private queuedResolvers: Array<() => void> = [];

  private peakConcurrency = 0;

  constructor(private readonly maximumConcurrency: number) {
    if (!Number.isInteger(maximumConcurrency) || maximumConcurrency <= 0) {
      throw new Error('[v4-concurrency] maximumConcurrency must be a positive integer.');
    }
  }

  private acquire(): Promise<void> {
    if (this.activeCount < this.maximumConcurrency) {
      this.activeCount += 1;
      this.peakConcurrency = Math.max(this.peakConcurrency, this.activeCount);
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.queuedResolvers.push(() => {
        this.activeCount += 1;
        this.peakConcurrency = Math.max(this.peakConcurrency, this.activeCount);
        resolve();
      });
    });
  }

  private release(): void {
    this.activeCount -= 1;

    const next = this.queuedResolvers.shift();
    if (next) {
      next();
    }
  }

  async run<T>(task: Task<T>): Promise<T> {
    await this.acquire();

    try {
      return await task();
    } finally {
      this.release();
    }
  }

  snapshot(): ConcurrencySnapshot {
    return {
      active: this.activeCount,
      queued: this.queuedResolvers.length,
      peakConcurrency: this.peakConcurrency,
      maximumConcurrency: this.maximumConcurrency
    };
  }
}

export function createMaximumConcurrencyLimiter(maximumConcurrency: number): MaximumConcurrencyLimiter {
  return new MaximumConcurrencyLimiter(maximumConcurrency);
}

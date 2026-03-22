import { issueResumeToken, parseResumeToken } from '@/server/v4/realtime/resume-token';

export type RealtimeStreamEvent = {
  seq: number;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export class InMemoryRedisStreamResumeStore {
  private readonly streams = new Map<string, RealtimeStreamEvent[]>();

  append(
    streamKey: string,
    event: {
      type: string;
      payload: Record<string, unknown>;
      createdAt?: string;
    }
  ): RealtimeStreamEvent {
    const events = this.streams.get(streamKey) ?? [];
    const next: RealtimeStreamEvent = {
      seq: (events.at(-1)?.seq ?? 0) + 1,
      type: event.type,
      payload: event.payload,
      createdAt: event.createdAt ?? new Date().toISOString()
    };
    events.push(next);
    this.streams.set(streamKey, events);
    return next;
  }

  issue(streamKey: string, connectionId: string): string {
    return issueResumeToken({
      streamKey,
      connectionId,
      issuedAt: new Date().toISOString()
    });
  }

  resume(input: {
    resumeToken: string;
    lastSeq: number;
    limit?: number;
  }): RealtimeStreamEvent[] {
    const payload = parseResumeToken(input.resumeToken);
    const events = this.streams.get(payload.streamKey) ?? [];
    const limit = input.limit ?? 100;

    return events.filter((event) => event.seq > input.lastSeq).slice(0, limit);
  }
}

import {
  InMemoryRedisStreamResumeStore,
  type RealtimeStreamEvent
} from '@/server/v4/realtime/redis-streams-resume';
import { InMemoryMongoOutbox } from '@/server/v4/realtime/mongo-outbox';

export class V4RealtimeSessionResumeService {
  constructor(
    private readonly streamStore: InMemoryRedisStreamResumeStore,
    private readonly outbox: InMemoryMongoOutbox
  ) {}

  publish(input: {
    streamKey: string;
    connectionId: string;
    eventType: string;
    payload: Record<string, unknown>;
    outboxId: string;
  }): { resumeToken: string; event: RealtimeStreamEvent } {
    const event = this.streamStore.append(input.streamKey, {
      type: input.eventType,
      payload: input.payload
    });
    this.outbox.enqueue({
      id: input.outboxId,
      aggregateId: input.streamKey,
      eventType: input.eventType,
      payload: {
        seq: event.seq,
        ...input.payload
      }
    });

    return {
      resumeToken: this.streamStore.issue(input.streamKey, input.connectionId),
      event
    };
  }

  resume(input: { resumeToken: string; lastSeq: number }): RealtimeStreamEvent[] {
    return this.streamStore.resume(input);
  }
}

import type { DequeuedVoiceJob, EnqueueVoiceJobResult, VoiceJobQueue } from '@/server/queue/v3/types';
import { getV3QueueEnv } from '@/server/config/v3-env';
import { voiceJobQueuePayloadSchema, type VoiceJobQueuePayload } from '@/shared/contracts/v3-voice-job';

type SqsClientConfig = {
  region?: string;
};

type CommandLike = new (input: Record<string, unknown>) => unknown;

type SqsClientLike = {
  send(command: unknown): Promise<Record<string, unknown>>;
};

type SqsModule = {
  SQSClient: new (config: SqsClientConfig) => SqsClientLike;
  SendMessageCommand: CommandLike;
  ReceiveMessageCommand: CommandLike;
  DeleteMessageCommand: CommandLike;
  GetQueueAttributesCommand: CommandLike;
};

export class SqsVoiceJobQueue implements VoiceJobQueue {
  readonly provider = 'sqs' as const;

  constructor(
    private readonly moduleLoader: () => Promise<SqsModule> = () =>
      import('@aws-sdk/client-sqs').then((module) => module as unknown as SqsModule)
  ) {}

  private async getClient() {
    const env = getV3QueueEnv();
    if (!env.AWS_REGION || !env.SQS_QUEUE_URL) {
      throw new Error('SQS queue configuration is incomplete.');
    }

    const sqs = await this.moduleLoader();
    const config: SqsClientConfig = {
      region: env.AWS_REGION
    };
    return {
      env,
      client: new sqs.SQSClient(config),
      sqs
    };
  }

  async enqueue(payload: VoiceJobQueuePayload): Promise<EnqueueVoiceJobResult> {
    const { client, env, sqs } = await this.getClient();
    const response = await client.send(
      new sqs.SendMessageCommand({
        QueueUrl: env.SQS_QUEUE_URL,
        MessageBody: JSON.stringify(payload)
      })
    );

    const messageId = typeof response.MessageId === 'string' ? response.MessageId : null;

    if (!messageId) {
      throw new Error('SQS did not return a MessageId.');
    }

    return {
      provider: this.provider,
      messageId
    };
  }

  async receive(maxMessages = 1): Promise<DequeuedVoiceJob[]> {
    const { client, env, sqs } = await this.getClient();
    const response = await client.send(
      new sqs.ReceiveMessageCommand({
        QueueUrl: env.SQS_QUEUE_URL,
        MaxNumberOfMessages: Math.min(10, Math.max(1, maxMessages)),
        WaitTimeSeconds: 0
      })
    );

    const messages = Array.isArray(response.Messages)
      ? (response.Messages as Array<Record<string, unknown>>)
      : [];

    return messages.map((message) => {
      const payload = voiceJobQueuePayloadSchema.parse(
        JSON.parse(typeof message.Body === 'string' ? message.Body : '{}')
      );

      return {
        receiptId: typeof message.ReceiptHandle === 'string' ? message.ReceiptHandle : '',
        messageId: typeof message.MessageId === 'string' ? message.MessageId : '',
        payload
      };
    });
  }

  async ack(receiptIds: readonly string[]): Promise<void> {
    if (receiptIds.length === 0) {
      return;
    }

    const { client, env, sqs } = await this.getClient();
    await Promise.all(
      receiptIds.map((receiptId) =>
        client.send(
          new sqs.DeleteMessageCommand({
            QueueUrl: env.SQS_QUEUE_URL,
            ReceiptHandle: receiptId
          })
        )
      )
    );
  }

  async size(): Promise<number> {
    const { client, env, sqs } = await this.getClient();
    const response = await client.send(
      new sqs.GetQueueAttributesCommand({
        QueueUrl: env.SQS_QUEUE_URL,
        AttributeNames: ['ApproximateNumberOfMessages']
      })
    );

    const attributes =
      response.Attributes && typeof response.Attributes === 'object'
        ? (response.Attributes as Record<string, string>)
        : {};

    return Number(attributes.ApproximateNumberOfMessages ?? 0);
  }
}

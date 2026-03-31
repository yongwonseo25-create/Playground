import {
  SendMessageCommand,
  SQSClient,
  type MessageAttributeValue,
  type SQSClientConfig
} from '@aws-sdk/client-sqs';

export type SqsMessageAttributePrimitive = string | number | boolean;

export interface SqsQueueServiceOptions {
  queueUrl: string;
  region: string;
  endpoint?: string;
  client?: Pick<SQSClient, 'send'>;
  clientConfig?: Omit<SQSClientConfig, 'region' | 'endpoint'>;
}

export interface SqsEnqueueOptions {
  delaySeconds?: number;
  messageAttributes?: Record<string, SqsMessageAttributePrimitive>;
}

export interface SqsEnqueueResult {
  messageId?: string;
  md5OfMessageBody?: string;
}

const MAX_SQS_MESSAGE_BYTES = 1_048_576;

export class SqsQueueService {
  private readonly client: Pick<SQSClient, 'send'>;

  constructor(private readonly options: SqsQueueServiceOptions) {
    this.client =
      options.client ??
      new SQSClient({
        region: options.region,
        endpoint: options.endpoint,
        ...options.clientConfig
      });
  }

  async enqueue<TBody extends object>(
    body: TBody,
    options: SqsEnqueueOptions = {}
  ): Promise<SqsEnqueueResult> {
    const messageBody = JSON.stringify(body);
    const payloadBytes = Buffer.byteLength(messageBody, 'utf8');

    if (payloadBytes > MAX_SQS_MESSAGE_BYTES) {
      throw new Error(`SQS_MESSAGE_BODY_TOO_LARGE:${payloadBytes}`);
    }

    const response = await this.client.send(
      new SendMessageCommand({
        QueueUrl: this.options.queueUrl,
        MessageBody: messageBody,
        DelaySeconds: normalizeDelaySeconds(options.delaySeconds),
        MessageAttributes: toMessageAttributes(options.messageAttributes)
      })
    );

    return {
      messageId: response.MessageId,
      md5OfMessageBody: response.MD5OfMessageBody
    };
  }
}

function normalizeDelaySeconds(delaySeconds?: number) {
  if (delaySeconds === undefined) {
    return undefined;
  }

  if (!Number.isInteger(delaySeconds) || delaySeconds < 0 || delaySeconds > 900) {
    throw new Error(`SQS_DELAY_SECONDS_OUT_OF_RANGE:${delaySeconds}`);
  }

  return delaySeconds;
}

function toMessageAttributes(
  attributes?: Record<string, SqsMessageAttributePrimitive>
): Record<string, MessageAttributeValue> | undefined {
  if (!attributes || Object.keys(attributes).length === 0) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(attributes).map(([name, value]) => [
      name,
      toMessageAttributeValue(value)
    ])
  );
}

function toMessageAttributeValue(value: SqsMessageAttributePrimitive): MessageAttributeValue {
  if (typeof value === 'number') {
    return {
      DataType: 'Number',
      StringValue: String(value)
    };
  }

  return {
    DataType: 'String',
    StringValue: String(value)
  };
}

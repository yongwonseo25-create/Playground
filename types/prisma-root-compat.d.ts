import '@prisma/client';

declare module '@prisma/client' {
  export interface ExecutionBillingLog {
    id: string;
    user_id: string;
    session_id: string;
    audio_duration: number;
    destination_type: string;
    execution_attempted: boolean;
    destination_delivered: boolean;
    billed_transcription_unit: number;
    billed_execution_unit: number;
    createdAt: Date;
  }

  export interface NotionOAuthConnection {
    id: string;
    workspaceId: string;
    botId: string;
    workspaceName: string | null;
    workspaceIcon: string | null;
    duplicatedTemplateId: string | null;
    ownerJson: unknown;
    encryptedAccessToken: string;
    encryptionIv: string;
    encryptionTag: string;
    createdAt: Date;
    updatedAt: Date;
  }

  interface ExecutionBillingLogDelegate {
    create(args: { data: Record<string, unknown> }): Promise<ExecutionBillingLog>;
  }

  interface NotionOAuthConnectionDelegate {
    upsert(args: Record<string, unknown>): Promise<NotionOAuthConnection>;
    findUnique(args: Record<string, unknown>): Promise<NotionOAuthConnection | null>;
  }

  interface PrismaClient {
    executionBillingLog: ExecutionBillingLogDelegate;
    notionOAuthConnection: NotionOAuthConnectionDelegate;
  }

  namespace Prisma {
    interface TransactionClient {
      executionBillingLog: ExecutionBillingLogDelegate;
      notionOAuthConnection: NotionOAuthConnectionDelegate;
    }
  }
}

export {};

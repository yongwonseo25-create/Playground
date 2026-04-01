import { getSscePrismaClient } from '../db/ssce-prisma';

export interface BillingExecutionInput {
  userId: string;
  sessionId: string;
  audioDuration: number;
  executionSucceeded: boolean;
  destinationDelivered: boolean;
  processingTimeMs: number;
}

export interface BillingExecutionConstants {
  INPUT_RATE_PER_SECOND: number;
  SUCCESS_REWARD_VALUE: number;
}

export const DEFAULT_BILLING_CONSTANTS: BillingExecutionConstants = {
  INPUT_RATE_PER_SECOND: 0.1, // 초당 0.1 크레딧 (입력 비용)
  SUCCESS_REWARD_VALUE: 5,     // 성공 시 5 크레딧 (실행 가치)
};

export class BillingExecutionService {
  private readonly prisma = getSscePrismaClient();

  /**
   * 과금 로그를 기록하고 2축 과금 로직에 따라 총 비용을 계산합니다.
   */
  async logAndCalculate(input: BillingExecutionInput, constants = DEFAULT_BILLING_CONSTANTS) {
    const costInput = input.audioDuration * constants.INPUT_RATE_PER_SECOND;
    const costExecution = input.destinationDelivered ? constants.SUCCESS_REWARD_VALUE : 0;

    const log = await this.prisma.billingExecutionLog.create({
      data: {
        userId: input.userId,
        sessionId: input.sessionId,
        audioDuration: input.audioDuration,
        executionSucceeded: input.executionSucceeded,
        destinationDelivered: input.destinationDelivered,
        processingTimeMs: input.processingTimeMs,
        costInput,
        costExecution,
      },
    });

    return {
      log,
      totalCost: costInput + costExecution,
    };
  }

  /**
   * 특정 세션의 로그를 조회합니다.
   */
  async getLog(sessionId: string) {
    return this.prisma.billingExecutionLog.findUnique({
      where: { sessionId },
    });
  }
}

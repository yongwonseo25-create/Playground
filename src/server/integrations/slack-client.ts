/**
 * Slack API 커넥터 (Bot Token 또는 Webhook 전송 담당) 및 에러 시뮬레이터 모듈
 */
export class SlackIntegrationClient {
  /**
   * OAuth 연동 DB (user_integrations)에서 토큰을 추출/복호화
   */
  private async getSlackToken(userId: string): Promise<string> {
    return 'mock_slack_xoxb_encrypted_token';
  }

  /**
   * Slack 채널에 LLM 메시지를 전송하고 장애(5xx)를 20% 확률로 던집니다.
   */
  public async sendMessage(userId: string, channelId: string, message: string): Promise<boolean> {
    const token = await this.getSlackToken(userId);
    console.log(`[Slack Client] User: ${userId} -> Channel: ${channelId} 봇 발화 시도 중.`);

    await new Promise(res => setTimeout(res, 400)); // HTTP Network Delays

    // Slack 통신 오류 시뮬레이션 (서버 에러)
    const randomChance = Math.random();
    if (randomChance < 0.2) {
      console.error(`[Slack Client] ⚠️ 서버 측 타임아웃/오류 응답 (500/503) 감지!`);
      throw new Error('SLACK_SERVER_ERROR_5XX');
    }

    console.log(`[Slack Client] Slack 전송(200 OK) 성공.`);
    return true; 
  }
}

export const slackClient = new SlackIntegrationClient();

/**
 * Notion API 제어 모듈 및 Rate Limit(429) 시뮬레이터 로직
 */
export class NotionIntegrationClient {
  /**
   * OAuth 연동 DB (user_integrations)에서 토큰을 복호화 프로세스를 시뮬레이션
   */
  private async getEncryptedToken(userId: string): Promise<string> {
    // 실제 로직:
    // const dbRow = supabase.from('user_integrations').select('access_token_encrypted').where({ user_id: userId, provider: 'notion' })
    // const decryptedToken = crypto.createDecipheriv(...).update(dbRow).final('utf8');
    return 'mock_notion_decrypted_token';
  }

  /**
   * 타겟 DB에 데이터(텍스트/페이지) 전송 처리. 
   * 고의로 실패(Random)를 넣어 Rate Limit과 Saga 복구를 테스트합니다.
   */
  public async sendContentToPage(userId: string, targetId: string, content: string): Promise<boolean> {
    const token = await this.getEncryptedToken(userId);
    console.log(`[Notion Client] User: ${userId} -> Target: ${targetId} 반영을 시도합니다.`);

    // 네트워크 딜레이 발생 (실제 HTTP 통신 모사)
    await new Promise(res => setTimeout(res, 600));

    // 약 20%의 확률로 Notion 429 Rate Limit이나 Server Error 모사
    const randomChance = Math.random();
    if (randomChance < 0.2) {
      console.warn(`[Notion Client] ⚠️ Rate Limit(429) 또는 서버 타임아웃 발생!`);
      throw new Error('NOTION_RATE_LIMIT_429');
    }

    console.log(`[Notion Client] 전송 성공(200 OK) 완료.`);
    return true; 
  }
}

export const notionClient = new NotionIntegrationClient();

import { getSscePrismaClient } from '../../../apps/api/src/db/ssce-prisma';
import { sanitizerUtil } from '../utils/sanitizer-util';

const prisma = getSscePrismaClient();

// 로컬 캐시 (Redis 도입 전 임시 메모리 캐시)
const contextCache = new Map<string, { data: UserContext; timestamp: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30분

export interface UserContext {
  project?: string;
  style?: string;
  skills?: string;
  versionInfo?: Record<string, number>;
}

/**
 * [Phase 5] 초개인화 Context Storage Service
 * 사용자의 Project(맥락), Style(문체), Skills(규칙)을 조회하여 AI 프롬프트에 주입할 조각을 생성합니다.
 */
export class ContextStorageService {
  /**
   * [Phase 5] 특정 인텐트(Notion/Slack 등)에 맞는 최적화된 컨텍스트 조립
   * - [Auditor Fix]: Prompt Injection 방어 및 토큰 폭발 방지(Take: 5) 반영
   */
  async getIntentBasedContext(userId: string, targetIntent?: string): Promise<UserContext> {
    const cacheKey = `ctx:${userId}:${targetIntent || 'global'}`;
    const cached = contextCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      console.log(`[ContextStorage] Cache Hit for ${userId}`);
      return cached.data;
    }

    // 1. 보안 필터링 기반 컨텍스트 로드 (최신 버전 위주)
    const contextTypes = ['GLOBAL_PROJECT', 'STYLE'];
    if (targetIntent) {
      contextTypes.push(`SKILL_${targetIntent.toUpperCase()}`);
    }

    const contexts = await prisma.userClaudeContext.findMany({
      where: {
        userId,
        isActive: true,
        contextType: { in: contextTypes }
      },
      orderBy: { version: 'desc' },
      take: 10 // [Auditor Fix] 무분별한 토큰 로드 방지
    });

    const result: UserContext = {};
    const versions: Record<string, number> = {};

    contexts.forEach((ctx: any) => {
      const type = ctx.contextType.toUpperCase();
      versions[type] = ctx.version;
      
      // [Auditor Fix] 프롬프트 인젝션 방어 (Sanitize) 
      const cleanContent = this.sanitizeContent(ctx.content);

      if (type === 'GLOBAL_PROJECT') result.project = (result.project || '') + '\n' + cleanContent;
      if (type === 'STYLE') result.style = (result.style || '') + '\n' + cleanContent;
      if (type.startsWith('SKILL_')) result.skills = (result.skills || '') + '\n' + cleanContent;
    });

    const finalData = {
      project: result.project?.trim(),
      style: result.style?.trim(),
      skills: result.skills?.trim(),
      versionInfo: versions
    };

    // 캐시 저장
    contextCache.set(cacheKey, { data: finalData, timestamp: Date.now() });
    return finalData;
  }

  /**
   * [Auditor Fix] Prompt Sanitization 유틸리티
   */
  private sanitizeContent(text: string): string {
    return text
      .replace(/(System:|Human:|Assistant:|Ignore all previous)/gi, '[REDACTED]')
      .substring(0, 5000); // 토큰 폭발 방지를 위한 Truncation
  }

  /**
   * [Phase 5] 컨텍스트 저장 (버전 관리 포함)
   */
  async saveContext(userId: string, type: string, content: string): Promise<any> {
    // 1. 보안필터링 (Sanitize)
    const sanitizedContent = sanitizerUtil.sanitize(content);

    // 2. 현재 최신 버전 확인
    const latest = await prisma.userClaudeContext.findFirst({
      where: { userId, contextType: type },
      orderBy: { version: 'desc' }
    });

    const nextVersion = (latest?.version || 0) + 1;

    // 3. 기존 활성 데이터 비활성화
    await prisma.userClaudeContext.updateMany({
      where: { userId, contextType: type, isActive: true },
      data: { isActive: false }
    });

    // 4. 새 버전 저장
    const newContext = await prisma.userClaudeContext.create({
      data: {
        userId,
        contextType: type,
        content: sanitizedContent,
        version: nextVersion,
        isActive: true
      }
    });

    // 관련 캐시 초기화 (해당 유저의 모든 캐시 무효화)
    this.invalidateCache(userId);

    return newContext;
  }

  /**
   * [Phase 5] 특정 버전으로 롤백
   */
  async rollbackContext(userId: string, type: string, targetVersion: number): Promise<boolean> {
    const target = await prisma.userClaudeContext.findFirst({
      where: { userId, contextType: type, version: targetVersion }
    });

    if (!target) return false;

    await prisma.userClaudeContext.updateMany({
      where: { userId, contextType: type },
      data: { isActive: false }
    });

    await prisma.userClaudeContext.update({
      where: { id: target.id },
      data: { isActive: true }
    });

    this.invalidateCache(userId);
    return true;
  }

  private invalidateCache(userId: string) {
    for (const key of contextCache.keys()) {
      if (key.includes(`ctx:${userId}:`)) {
        contextCache.delete(key);
      }
    }
  }

  /**
   * AI System Prompt에 주입할 형태로 문자열 변환
   */
  formatContextForPrompt(context: UserContext): string {
    let promptPart = '\n\n### [VOXERA Personalized Automation OS Context] ###\n';
    
    if (context.project) {
      promptPart += `[User's Global Project Context]:\n${context.project}\n\n`;
    }
    if (context.style) {
      promptPart += `[User's Personal Voice & Style Signature]:\n${context.style}\n\n`;
    }
    if (context.skills) {
      promptPart += `[Target-Specific Automation Rules & Skills]:\n${context.skills}\n\n`;
    }

    if (!context.project && !context.style && !context.skills) {
      return ''; 
    }

    return promptPart + '###############################################';
  }
}

export const contextStorageService = new ContextStorageService();


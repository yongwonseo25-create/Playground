import { NextRequest, NextResponse } from 'next/server';
import { contextStorageService } from '../../../../../server/ai/context-storage-service';

/**
 * [Phase 5] Context Management API
 * POST: 새로운 컨텍스트 저장 (자동 버전 업 및 이전 버전 비활성화)
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, type, content } = await req.json();

    if (!userId || !type || !content) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const newContext = await contextStorageService.saveContext(userId, type, content);

    return NextResponse.json({
      success: true,
      data: {
        id: newContext.id,
        version: newContext.version,
        type: newContext.contextType
      }
    });

  } catch (error: any) {
    console.error('[Context API] Save Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * GET: 현재 활성화된 컨텍스트 및 버전 정보 조회
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const intent = searchParams.get('intent') || undefined;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    const context = await contextStorageService.getIntentBasedContext(userId, intent);

    return NextResponse.json({
      success: true,
      data: context
    });

  } catch (error: any) {
    console.error('[Context API] Fetch Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

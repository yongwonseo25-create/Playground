import { NextRequest, NextResponse } from 'next/server';
import { contextStorageService } from '../../../../../server/ai/context-storage-service';

/**
 * [Phase 5] Context Rollback API
 * POST: 특정 버전으로 롤백 수행
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, type, version } = await req.json();

    if (!userId || !type || version === undefined) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const success = await contextStorageService.rollbackContext(userId, type, Number(version));

    if (!success) {
      return NextResponse.json({ success: false, error: 'Version not found or rollback failed' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully rolled back to version ${version} for type ${type}`
    });

  } catch (error: any) {
    console.error('[Context API] Rollback Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

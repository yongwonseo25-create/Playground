import { NextRequest, NextResponse } from 'next/server';
import { exchangeNotionOAuthCode } from '@/server/notion/direct-write';
import { storeNotionOAuthConnection } from '@/server/notion/oauth-store';

export const runtime = 'nodejs';

function jsonError(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const error = request.nextUrl.searchParams.get('error');
  const state = request.nextUrl.searchParams.get('state');

  if (error) {
    return jsonError(400, `Notion OAuth returned an error: ${error}`);
  }

  if (!code) {
    return jsonError(400, 'Missing Notion OAuth authorization code.');
  }

  try {
    const tokenResponse = await exchangeNotionOAuthCode({ code });
    if (!tokenResponse.workspace_id || !tokenResponse.bot_id) {
      throw new Error('Notion OAuth response is missing workspace_id or bot_id.');
    }

    await storeNotionOAuthConnection({
      accessToken: tokenResponse.access_token,
      workspaceId: tokenResponse.workspace_id,
      botId: tokenResponse.bot_id,
      workspaceName: tokenResponse.workspace_name,
      workspaceIcon: tokenResponse.workspace_icon ?? null,
      duplicatedTemplateId: tokenResponse.duplicated_template_id ?? null,
      owner: tokenResponse.owner
    });

    return NextResponse.json({
      ok: true,
      state,
      integration: {
        workspaceId: tokenResponse.workspace_id,
        workspaceName: tokenResponse.workspace_name ?? null,
        workspaceIcon: tokenResponse.workspace_icon ?? null,
        botId: tokenResponse.bot_id,
        duplicatedTemplateId: tokenResponse.duplicated_template_id ?? null,
        owner: tokenResponse.owner ?? null,
        persisted: true
      }
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Unknown Notion OAuth callback failure.';
    return jsonError(500, message);
  }
}

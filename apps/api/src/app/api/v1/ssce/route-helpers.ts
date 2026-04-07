import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import { ZodError } from 'zod';
import type { SsceErrorResponse } from '@adapter/validators/ssce-zod';
import { mapZodIssues } from '@adapter/validators/ssce-zod';
import { createSsceRouter, type SsceRouteResult } from '@ssce/routes/ssce-router';

type RouterMethodName = 'harvest' | 'generate' | 'feedback';
type RouterFactory = () => ReturnType<typeof createSsceRouter>;

let routerFactory: RouterFactory = () => createSsceRouter();

function errorJson(status: number, code: string, message: string, issues: SsceErrorResponse['error']['issues'] = []) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        issues
      }
    },
    { status }
  );
}

export function setSsceRouterFactoryForTests(factory: RouterFactory | null) {
  routerFactory = factory ?? (() => createSsceRouter());
}

export async function handleSsceRoute<TRequest, TResponse>(
  request: Request,
  schema: ZodType<TRequest>,
  methodName: RouterMethodName
) {
  try {
    const parsedBody = schema.parse(await request.json());
    const router = routerFactory();
    const result = (await router[methodName](parsedBody)) as SsceRouteResult<TResponse>;

    return NextResponse.json(result.body, {
      status: result.status === 200 ? 200 : result.status === 400 ? 400 : 500
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return errorJson(400, `SSCE_${methodName.toUpperCase()}_INVALID`, `${methodName} payload failed Zod validation.`, mapZodIssues(error));
    }

    return errorJson(
      500,
      `SSCE_${methodName.toUpperCase()}_HTTP_FAILED`,
      error instanceof Error ? error.message : `Unknown ${methodName} route failure.`
    );
  }
}

import { feedbackRequestSchema } from '@adapter/validators/ssce-zod';
import { handleSsceRoute } from '../route-helpers';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return handleSsceRoute(request, feedbackRequestSchema, 'feedback');
}

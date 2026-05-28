import { ok } from '@/lib/api';

export const runtime = 'nodejs';

export async function GET() {
  return ok({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'an-central-command-web',
  });
}

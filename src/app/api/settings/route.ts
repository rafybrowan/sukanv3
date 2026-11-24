import { getSettings } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ settings: await getSettings() });
}

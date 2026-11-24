import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getAdminId, unauthorized } from '@/lib/auth';
import { getSettings } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest) {
  if (!getAdminId(req)) return unauthorized();
  const body = await req.json();
  const updates: { key: string; value: string }[] = [];
  if (body.pricePerPerson !== undefined) {
    const v = Number(body.pricePerPerson);
    if (!Number.isFinite(v) || v < 1000 || v > 1000000) {
      return Response.json({ error: 'Harga per orang tidak valid (Rp1.000 - Rp1.000.000).' }, { status: 400 });
    }
    updates.push({ key: 'pricePerPerson', value: String(Math.round(v)) });
  }
  for (const u of updates) {
    await db.setting.upsert({ where: { key: u.key }, update: { value: u.value }, create: u });
  }
  return Response.json({ settings: await getSettings() });
}

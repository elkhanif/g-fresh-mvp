import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';

const schema = z.object({ id: z.string().optional() }); // tanpa id = tandai semua

// POST /api/notifications/read — tandai satu atau semua notifikasi terbaca.
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: 'Perlu login.' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  const id = parsed.success ? parsed.data.id : undefined;

  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null, ...(id ? { id } : {}) },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}

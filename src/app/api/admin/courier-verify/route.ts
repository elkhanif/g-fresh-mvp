import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';

const schema = z.object({ courierId: z.string(), verified: z.boolean() });

// POST /api/admin/courier-verify — ADMIN memverifikasi KTP kurir.
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Hanya admin.' }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });

  const updated = await prisma.courierProfile.update({
    where: { id: parsed.data.courierId },
    data: { ktpVerified: parsed.data.verified },
  });
  return NextResponse.json(updated);
}

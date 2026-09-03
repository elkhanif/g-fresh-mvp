import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';

const schema = z.object({ active: z.boolean() });

// POST /api/courier/availability — kurir menyalakan/mematikan ketersediaan.
// Kurir nonaktif tidak muncul sebagai mitra aktif dan tidak menerima tugas baru.
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user || user.role !== 'KURIR') {
    return NextResponse.json({ error: 'Hanya kurir.' }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });

  const courier = await prisma.courierProfile.findUnique({ where: { userId: user.id } });
  if (!courier) return NextResponse.json({ error: 'Profil kurir tidak ada.' }, { status: 400 });

  const updated = await prisma.courierProfile.update({
    where: { id: courier.id },
    data: { active: parsed.data.active },
  });
  return NextResponse.json(updated);
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';
import { notifyRole } from '@/lib/notification';

const schema = z.object({
  companyName: z.string().min(2),
  businessType: z.string().min(2),
  npwp: z.string().optional(),
  picName: z.string().min(2),
  picPhone: z.string().min(8),
  billingAddress: z.string().min(5),
});

// POST /api/business — konsumen mendaftarkan/memperbarui profil bisnis (kanal B2B).
// Perubahan data mengembalikan status ke belum terverifikasi (perlu tinjau ulang).
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user || user.role !== 'KONSUMEN') {
    return NextResponse.json({ error: 'Hanya akun konsumen dapat mendaftar B2B.' }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data tidak valid', detail: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const existing = await prisma.businessProfile.findUnique({ where: { userId: user.id } });

  const profile = await prisma.businessProfile.upsert({
    where: { userId: user.id },
    update: { ...d, verified: false },
    create: { userId: user.id, ...d },
  });

  await notifyRole('ADMIN', {
    kind: 'AKUN',
    title: existing ? 'Profil bisnis diperbarui' : 'Pendaftaran B2B baru',
    body: `${d.companyName} (${d.businessType}) menunggu verifikasi kanal B2B.`,
    href: '/app/admin',
  });

  return NextResponse.json(profile, { status: existing ? 200 : 201 });
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';
import { notify } from '@/lib/notification';

const schema = z.object({ businessId: z.string(), verified: z.boolean() });

// POST /api/business/verify — admin memverifikasi pembeli B2B.
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Hanya admin.' }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });

  const updated = await prisma.businessProfile.update({
    where: { id: parsed.data.businessId },
    data: { verified: parsed.data.verified },
  });

  await notify({
    userId: updated.userId,
    kind: 'AKUN',
    title: parsed.data.verified ? 'Akun B2B disetujui' : 'Verifikasi B2B dicabut',
    body: parsed.data.verified
      ? 'Anda kini dapat memesan dengan harga grosir dan pembayaran bertermin.'
      : 'Akses kanal B2B Anda dinonaktifkan. Hubungi operator untuk informasi.',
    href: '/app/konsumen/bisnis',
    alsoWhatsApp: true,
  });

  return NextResponse.json(updated);
}

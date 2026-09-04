import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';

const schema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(8).optional(),
  defaultAddress: z.string().optional(),
});

// PATCH /api/account — perbarui profil sendiri (nama, HP, alamat tersimpan).
export async function PATCH(req: Request) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: 'Perlu login.' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const d = parsed.data;

  // Nomor HP harus unik bila diganti.
  if (d.phone) {
    const clash = await prisma.user.findFirst({
      where: { phone: d.phone, NOT: { id: user.id } },
      select: { id: true },
    });
    if (clash) return NextResponse.json({ error: 'Nomor HP sudah dipakai akun lain.' }, { status: 409 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      name: d.name,
      phone: d.phone,
      defaultAddress: d.defaultAddress,
    },
    select: { id: true, name: true, phone: true, defaultAddress: true },
  });
  return NextResponse.json(updated);
}

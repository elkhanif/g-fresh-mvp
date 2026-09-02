import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8),
  password: z.string().min(6),
  role: z.enum(['PRODUSEN', 'KONSUMEN', 'KURIR']), // ADMIN/PEMKAB dibuat via seed
  kecamatan: z.string().optional(),
  farmName: z.string().optional(), // wajib bila PRODUSEN
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data tidak valid', detail: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const exists = await prisma.user.findFirst({
    where: { OR: [{ email: d.email.toLowerCase() }, { phone: d.phone }] },
  });
  if (exists) {
    return NextResponse.json({ error: 'Email atau nomor HP sudah terdaftar.' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(d.password, 10);

  const user = await prisma.user.create({
    data: {
      name: d.name,
      email: d.email.toLowerCase(),
      phone: d.phone,
      passwordHash,
      role: d.role,
      kecamatan: d.kecamatan,
      ...(d.role === 'PRODUSEN'
        ? { producer: { create: { farmName: d.farmName || d.name, kecamatan: d.kecamatan || '-' } } }
        : {}),
      ...(d.role === 'KURIR'
        ? { courier: { create: { kecamatan: d.kecamatan || '-' } } }
        : {}),
    },
  });

  return NextResponse.json({ id: user.id, role: user.role }, { status: 201 });
}

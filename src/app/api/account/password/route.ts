import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';

const schema = z.object({
  current: z.string().min(1),
  next: z.string().min(6),
});

// POST /api/account/password — ganti kata sandi (verifikasi sandi lama dulu).
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: 'Perlu login.' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Kata sandi baru minimal 6 karakter.' }, { status: 400 });
  }

  const row = await prisma.user.findUnique({ where: { id: user.id } });
  if (!row) return NextResponse.json({ error: 'Akun tidak ada.' }, { status: 404 });

  const ok = await bcrypt.compare(parsed.data.current, row.passwordHash);
  if (!ok) return NextResponse.json({ error: 'Kata sandi lama salah.' }, { status: 403 });

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.next, 10) },
  });
  return NextResponse.json({ ok: true });
}

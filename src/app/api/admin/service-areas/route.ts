import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';

// GET /api/admin/service-areas — semua wilayah (termasuk nonaktif), untuk panel Admin.
export async function GET() {
  const user = await apiUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Hanya admin.' }, { status: 403 });
  }
  const areas = await prisma.serviceArea.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json(areas);
}

const createSchema = z.object({ name: z.string().min(2).max(50) });

// POST /api/admin/service-areas — tambah kecamatan baru (default aktif).
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Hanya admin.' }, { status: 403 });
  }
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Nama kecamatan tidak valid.' }, { status: 400 });

  const exists = await prisma.serviceArea.findUnique({ where: { name: parsed.data.name } });
  if (exists) return NextResponse.json({ error: 'Kecamatan ini sudah ada di daftar.' }, { status: 409 });

  const area = await prisma.serviceArea.create({ data: { name: parsed.data.name } });
  return NextResponse.json(area, { status: 201 });
}

const toggleSchema = z.object({ id: z.string(), active: z.boolean() });

// PATCH /api/admin/service-areas — aktifkan/nonaktifkan kecamatan.
export async function PATCH(req: Request) {
  const user = await apiUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Hanya admin.' }, { status: 403 });
  }
  const parsed = toggleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });

  const area = await prisma.serviceArea.update({
    where: { id: parsed.data.id },
    data: { active: parsed.data.active },
  });
  return NextResponse.json(area);
}

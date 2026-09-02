import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';

// GET /api/het — daftar HET berlaku hari ini per kategori (publik untuk transparansi).
export async function GET() {
  const cats = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const out = [];
  for (const c of cats) {
    const het = await prisma.hetPrice.findFirst({
      where: { categoryId: c.id, effectiveOn: { lte: today } },
      orderBy: { effectiveOn: 'desc' },
    });
    out.push({ category: c, het });
  }
  return NextResponse.json(out);
}

const setSchema = z.object({
  categoryId: z.string(),
  maxPrice: z.number().int().positive(),
  floorPrice: z.number().int().positive().optional(),
  effectiveOn: z.string(), // ISO date
});

// POST /api/het — HANYA PEMKAB yang menetapkan HET.
// Governance proposal: operator (ADMIN) tidak boleh mengubah nilai batas harga.
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user || user.role !== 'PEMKAB') {
    return NextResponse.json({ error: 'Hanya Pemkab yang menetapkan HET.' }, { status: 403 });
  }
  const parsed = setSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
  const d = parsed.data;

  const day = new Date(d.effectiveOn);
  day.setHours(0, 0, 0, 0);

  const het = await prisma.hetPrice.upsert({
    where: { categoryId_effectiveOn: { categoryId: d.categoryId, effectiveOn: day } },
    update: { maxPrice: d.maxPrice, floorPrice: d.floorPrice, setById: user.id },
    create: {
      categoryId: d.categoryId,
      maxPrice: d.maxPrice,
      floorPrice: d.floorPrice,
      effectiveOn: day,
      setById: user.id,
    },
  });
  return NextResponse.json(het, { status: 201 });
}

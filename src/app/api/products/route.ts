import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';
import { validatePriceAgainstHet } from '@/lib/het';
import { SUSPEND_RATING } from '@/lib/rating';

// GET /api/products — katalog publik untuk marketplace konsumen.
// Produk dari produsen yang ditangguhkan (rating < ambang) disembunyikan.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get('categoryId') || undefined;
  const q = searchParams.get('q') || undefined;

  const products = await prisma.product.findMany({
    where: {
      active: true,
      stock: { gt: 0 },
      categoryId,
      name: q ? { contains: q, mode: 'insensitive' } : undefined,
      producer: { ratingScore: { gte: SUSPEND_RATING } },
    },
    include: {
      category: true,
      producer: { select: { farmName: true, kecamatan: true, certStatus: true, certType: true } },
    },
    orderBy: { harvestedAt: 'desc' },
    take: 100,
  });
  return NextResponse.json(products);
}

const createSchema = z.object({
  name: z.string().min(2),
  categoryId: z.string(),
  unit: z.string().min(1),
  price: z.number().int().positive(),
  stock: z.number().int().nonnegative(),
  harvestedAt: z.string(),
  // Terima path lokal (/uploads/...) maupun URL penuh (Supabase). Bukan .url().
  photoUrl: z.string().min(1).optional(),
  // #8: harga grosir B2B opsional (harus <= harga ritel).
  b2bPrice: z.number().int().positive().optional(),
  b2bMinQty: z.number().int().positive().optional(),
});

// POST /api/products — produsen menambah produk. Harga divalidasi terhadap HET.
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user || user.role !== 'PRODUSEN') {
    return NextResponse.json({ error: 'Hanya produsen.' }, { status: 403 });
  }
  const producer = await prisma.producerProfile.findUnique({ where: { userId: user.id } });
  if (!producer) return NextResponse.json({ error: 'Profil produsen tidak ada.' }, { status: 400 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data tidak valid', detail: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const check = await validatePriceAgainstHet(d.categoryId, d.price);
  if (!check.ok) {
    return NextResponse.json({ error: check.reason, het: check.het }, { status: 422 });
  }

  // Harga grosir wajib lebih murah dari harga ritel dan punya kuantitas minimum.
  if (d.b2bPrice != null) {
    if (d.b2bPrice >= d.price) {
      return NextResponse.json(
        { error: 'Harga grosir B2B harus lebih rendah dari harga ritel.' },
        { status: 422 },
      );
    }
    if (!d.b2bMinQty) {
      return NextResponse.json(
        { error: 'Tetapkan kuantitas minimum untuk harga grosir.' },
        { status: 422 },
      );
    }
  }

  const product = await prisma.product.create({
    data: {
      producerId: producer.id,
      categoryId: d.categoryId,
      name: d.name,
      unit: d.unit,
      price: d.price,
      stock: d.stock,
      harvestedAt: new Date(d.harvestedAt),
      photoUrl: d.photoUrl,
      b2bPrice: d.b2bPrice,
      b2bMinQty: d.b2bMinQty,
    },
  });
  return NextResponse.json(product, { status: 201 });
}

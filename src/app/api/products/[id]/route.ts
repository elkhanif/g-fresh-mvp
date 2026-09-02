import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';
import { validatePriceAgainstHet } from '@/lib/het';

const patchSchema = z.object({
  price: z.number().int().positive().optional(),
  stock: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
  harvestedAt: z.string().optional(),
});

// PATCH /api/products/[id] — hanya produsen pemilik. Harga tetap dicek HET.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await apiUser();
  if (!user || user.role !== 'PRODUSEN') {
    return NextResponse.json({ error: 'Hanya produsen.' }, { status: 403 });
  }
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: { producer: true },
  });
  if (!product) return NextResponse.json({ error: 'Produk tidak ada.' }, { status: 404 });
  if (product.producer.userId !== user.id) {
    return NextResponse.json({ error: 'Bukan produk Anda.' }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
  }
  const d = parsed.data;

  if (d.price !== undefined) {
    const check = await validatePriceAgainstHet(product.categoryId, d.price);
    if (!check.ok) {
      return NextResponse.json({ error: check.reason, het: check.het }, { status: 422 });
    }
  }

  const updated = await prisma.product.update({
    where: { id: params.id },
    data: {
      price: d.price,
      stock: d.stock,
      active: d.active,
      harvestedAt: d.harvestedAt ? new Date(d.harvestedAt) : undefined,
    },
  });
  return NextResponse.json(updated);
}

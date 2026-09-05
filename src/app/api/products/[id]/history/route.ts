import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireOwnedProduct } from '@/lib/product-owner';

// GET /api/products/[id]/history — riwayat harga + mutasi stok satu produk.
// Hanya untuk produsen pemiliknya (guard yang sama dengan endpoint ubah).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireOwnedProduct(params.id);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const [prices, movements] = await Promise.all([
    prisma.priceHistory.findMany({
      where: { productId: guard.product.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.stockMovement.findMany({
      where: { productId: guard.product.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ]);

  return NextResponse.json({ prices, movements, stock: guard.product.stock });
}

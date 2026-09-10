import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireOwnedProduct } from '@/lib/product-owner';

/**
 * PATCH /api/products/[id] — atribut non-sensitif produk.
 *
 * PENTING: `price` dan `stock` SENGAJA TIDAK diterima di sini lagi.
 * Keduanya punya endpoint sendiri yang menulis jejak audit:
 *   - harga → PATCH /api/products/[id]/price   (PriceHistory + validasi HET)
 *   - stok  → POST  /api/products/[id]/stock   (StockMovement, delta atomik)
 * Kalau field-nya tetap diterima di sini, tersedia jalur pintas yang
 * melewati riwayat — dan riwayat yang bisa dilewati sama saja tidak ada.
 */
const patchSchema = z.object({
  active: z.boolean().optional(),
  freshAt: z.string().optional(),
  // Melengkapi data mutu setelah produk terbit harus bisa — inilah jalan
  // produk naik dari Jalur B ke Jalur A tanpa didaftarkan ulang.
  cultivationMethod: z
    .enum(['ORGANIK_MURNI', 'ANORGANIK_KONVENSIONAL', 'CAMPURAN'])
    .nullable()
    .optional(),
  harvestLat: z.number().min(-90).max(90).nullable().optional(),
  harvestLng: z.number().min(-180).max(180).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireOwnedProduct(params.id);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await req.json().catch(() => null);
  if (body && (body.price !== undefined || body.stock !== undefined)) {
    return NextResponse.json(
      {
        error:
          'Harga dan stok tidak diubah lewat endpoint ini. Pakai /price untuk harga dan /stock untuk penyesuaian stok.',
      },
      { status: 400 },
    );
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
  }
  const d = parsed.data;

  const updated = await prisma.product.update({
    where: { id: guard.product.id },
    data: {
      active: d.active,
      freshAt: d.freshAt ? new Date(d.freshAt) : undefined,
      cultivationMethod: d.cultivationMethod,
      harvestLat: d.harvestLat,
      harvestLng: d.harvestLng,
    },
  });
  return NextResponse.json(updated);
}

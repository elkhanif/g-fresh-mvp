import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireOwnedProduct } from '@/lib/product-owner';
import { validatePriceAgainstHet } from '@/lib/het';
import { applyPriceChange } from '@/lib/inventory';

// Harga grosir dikirim sebagai null untuk MENGHAPUS penawaran B2B,
// atau tidak dikirim sama sekali (undefined) untuk membiarkannya apa adanya.
const schema = z.object({
  price: z.number().int().positive(),
  b2bPrice: z.number().int().positive().nullable().optional(),
  b2bMinQty: z.number().int().positive().nullable().optional(),
  note: z.string().max(200).optional(),
});

// PATCH /api/products/[id]/price — ubah harga ritel (+ grosir opsional).
// Selalu divalidasi terhadap HET aktif, sama seperti saat produk dibuat.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireOwnedProduct(params.id);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const product = guard.product;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Data tidak valid', detail: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;

  // Nilai akhir harga grosir: undefined = pertahankan yang lama.
  const nextB2bPrice = d.b2bPrice === undefined ? product.b2bPrice : d.b2bPrice;
  const nextB2bMinQty = d.b2bMinQty === undefined ? product.b2bMinQty : d.b2bMinQty;

  // 1) HET (batas atas lindungi konsumen, floorPrice lindungi produsen).
  const check = await validatePriceAgainstHet(product.categoryId, d.price);
  if (!check.ok) {
    return NextResponse.json({ error: check.reason, het: check.het }, { status: 422 });
  }

  // 2) Aturan harga grosir sama dengan saat pembuatan produk.
  if (nextB2bPrice != null) {
    if (nextB2bPrice >= d.price) {
      return NextResponse.json(
        { error: 'Harga grosir B2B harus lebih rendah dari harga ritel.' },
        { status: 422 },
      );
    }
    if (!nextB2bMinQty) {
      return NextResponse.json(
        { error: 'Tetapkan kuantitas minimum untuk harga grosir.' },
        { status: 422 },
      );
    }
    const b2bCheck = await validatePriceAgainstHet(product.categoryId, nextB2bPrice);
    if (!b2bCheck.ok) {
      return NextResponse.json(
        { error: `Harga grosir: ${b2bCheck.reason}`, het: b2bCheck.het },
        { status: 422 },
      );
    }
  }

  // Tidak ada yang berubah → jangan kotori riwayat dengan baris kosong.
  const unchanged =
    d.price === product.price &&
    nextB2bPrice === product.b2bPrice &&
    nextB2bMinQty === product.b2bMinQty;
  if (unchanged) {
    return NextResponse.json({ ...product, unchanged: true });
  }

  const updated = await prisma.$transaction(async (tx) =>
    applyPriceChange(tx, {
      productId: product.id,
      oldPrice: product.price,
      newPrice: d.price,
      oldB2bPrice: product.b2bPrice ?? null,
      newB2bPrice: nextB2bPrice ?? null,
      newB2bMinQty: nextB2bPrice == null ? null : (nextB2bMinQty ?? null),
      hetMaxAt: check.het?.maxPrice ?? null,
      hetFloorAt: check.het?.floorPrice ?? null,
      note: d.note ?? null,
      actorId: guard.userId,
    }),
  );

  return NextResponse.json(updated);
}

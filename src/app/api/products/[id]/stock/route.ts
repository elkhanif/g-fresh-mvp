import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireOwnedProduct } from '@/lib/product-owner';
import {
  MANUAL_STOCK_REASONS,
  adjustStock,
  checkDeltaDirection,
  noteRequiredFor,
  StockError,
} from '@/lib/inventory';

const schema = z.object({
  // DELTA, bukan nilai absolut. Lihat komentar di lib/inventory.ts soal
  // alasan desainnya (aman dari race dengan checkout).
  delta: z.number().int(),
  reason: z.enum(MANUAL_STOCK_REASONS),
  note: z.string().max(200).optional(),
});

// POST /api/products/[id]/stock — sesuaikan stok (+/-) dengan alasan wajib.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireOwnedProduct(params.id);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Data tidak valid', detail: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const dir = checkDeltaDirection(d.reason, d.delta);
  if (!dir.ok) return NextResponse.json({ error: dir.reason }, { status: 422 });

  const note = d.note?.trim() || '';
  if (noteRequiredFor(d.reason) && note.length < 3) {
    return NextResponse.json(
      { error: 'Alasan ini wajib disertai catatan singkat (min. 3 karakter).' },
      { status: 422 },
    );
  }

  try {
    const movement = await prisma.$transaction(async (tx) =>
      adjustStock(tx, {
        productId: guard.product.id,
        delta: d.delta,
        reason: d.reason,
        note: note || null,
        actorId: guard.userId,
      }),
    );
    return NextResponse.json(movement, { status: 201 });
  } catch (e) {
    // Gagal bersih bila checkout menang cepat — stok tidak pernah ketimpa.
    if (e instanceof StockError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'Gagal menyesuaikan stok.' }, { status: 500 });
  }
}

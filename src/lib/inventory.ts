import type { StockReason } from '@prisma/client';

/**
 * Mutasi stok & riwayat harga produk.
 *
 * Dua aksi ini sengaja DIPISAH (bukan satu form "edit produk"):
 * - Harga  → nilai absolut, dicatat di PriceHistory (jejak untuk pengawasan HET).
 * - Stok   → DELTA (+/-) dengan alasan wajib, dicatat di StockMovement.
 *
 * Kenapa stok pakai delta, bukan set-absolut: checkout konsumen memotong stok
 * lewat `decrement` di dalam transaksi. Kalau produsen menyimpan nilai absolut
 * ("stok = 50") sementara ada 3 kg terjual di detik yang sama, penjualan itu
 * ketimpa dan stok jadi over-sell. Delta + increment/decrement atomik aman
 * dari race condition tersebut.
 */

export const STOCK_REASON_LABEL: Record<StockReason, string> = {
  RESTOCK: 'Restock / panen baru',
  TERJUAL_MANUAL: 'Terjual manual (luar aplikasi)',
  RUSAK: 'Rusak / busuk / susut',
  KOREKSI: 'Koreksi salah input',
  PENJUALAN_APP: 'Terjual di aplikasi',
};

// Alasan yang boleh dipilih produsen. PENJUALAN_APP tidak ada di sini —
// hanya sistem yang boleh menulisnya, supaya buku besar tidak bisa dipalsukan
// dari klien.
export const MANUAL_STOCK_REASONS = ['RESTOCK', 'TERJUAL_MANUAL', 'RUSAK', 'KOREKSI'] as const;
export type ManualStockReason = (typeof MANUAL_STOCK_REASONS)[number];

export function isManualStockReason(v: string): v is ManualStockReason {
  return (MANUAL_STOCK_REASONS as readonly string[]).includes(v);
}

// Arah mutasi yang masuk akal per alasan. Mencegah "RUSAK +10" yang bikin
// buku besar tidak bisa dibaca.
export function checkDeltaDirection(
  reason: ManualStockReason,
  delta: number,
): { ok: true } | { ok: false; reason: string } {
  if (delta === 0) return { ok: false, reason: 'Perubahan stok tidak boleh 0.' };
  if (reason === 'RESTOCK' && delta < 0) {
    return { ok: false, reason: 'Restock harus menambah stok (nilai positif).' };
  }
  if ((reason === 'TERJUAL_MANUAL' || reason === 'RUSAK') && delta > 0) {
    return {
      ok: false,
      reason: `"${STOCK_REASON_LABEL[reason]}" harus mengurangi stok (nilai negatif).`,
    };
  }
  return { ok: true };
}

// Alasan yang wajib disertai catatan: tanpa penjelasan, dua alasan ini tidak
// ada nilainya untuk audit.
export function noteRequiredFor(reason: ManualStockReason): boolean {
  return reason === 'RUSAK' || reason === 'KOREKSI';
}

export class StockError extends Error {}

/**
 * Ubah stok secara atomik dan catat mutasinya. WAJIB dipanggil di dalam
 * `prisma.$transaction` — parameter `tx` adalah client transaksi.
 *
 * Pola anti-race: syarat stok cukup ditaruh DI DALAM `where` updateMany,
 * bukan dibaca dulu lalu ditulis. Kalau ada checkout yang menang cepat,
 * `count` jadi 0 dan kita gagal bersih — bukan menimpa stok orang lain.
 */
export async function adjustStock(
  tx: any,
  opts: {
    productId: string;
    delta: number;
    reason: StockReason;
    note?: string | null;
    actorId?: string | null;
    orderId?: string | null;
  },
) {
  const { productId, delta, reason } = opts;
  if (!Number.isInteger(delta) || delta === 0) {
    throw new StockError('Perubahan stok harus bilangan bulat bukan nol.');
  }

  const res = await tx.product.updateMany({
    // Untuk pengurangan: hanya berhasil bila stok saat ini masih cukup.
    where: { id: productId, ...(delta < 0 ? { stock: { gte: -delta } } : {}) },
    data: { stock: { increment: delta } },
  });
  if (res.count === 0) {
    throw new StockError(
      'Stok tidak cukup untuk pengurangan sebanyak itu — kemungkinan ada pesanan masuk barusan. Muat ulang lalu coba lagi.',
    );
  }

  // Baris sudah terkunci oleh update kita di transaksi ini, jadi nilai ini
  // pasti hasil operasi kita sendiri.
  const row = await tx.product.findUnique({ where: { id: productId }, select: { stock: true } });
  const after: number = row!.stock;

  return tx.stockMovement.create({
    data: {
      productId,
      delta,
      before: after - delta,
      after,
      reason,
      note: opts.note ?? null,
      actorId: opts.actorId ?? null,
      orderId: opts.orderId ?? null,
    },
  });
}

/**
 * Simpan perubahan harga + catat riwayatnya. Juga wajib di dalam transaksi.
 * Validasi HET dilakukan pemanggil (butuh async lookup HET) — di sini hanya
 * snapshot nilainya untuk konteks audit.
 */
export async function applyPriceChange(
  tx: any,
  opts: {
    productId: string;
    oldPrice: number;
    newPrice: number;
    oldB2bPrice: number | null;
    newB2bPrice: number | null;
    newB2bMinQty: number | null;
    hetMaxAt?: number | null;
    hetFloorAt?: number | null;
    note?: string | null;
    actorId?: string | null;
  },
) {
  await tx.priceHistory.create({
    data: {
      productId: opts.productId,
      oldPrice: opts.oldPrice,
      newPrice: opts.newPrice,
      oldB2bPrice: opts.oldB2bPrice,
      newB2bPrice: opts.newB2bPrice,
      hetMaxAt: opts.hetMaxAt ?? null,
      hetFloorAt: opts.hetFloorAt ?? null,
      note: opts.note ?? null,
      actorId: opts.actorId ?? null,
    },
  });

  return tx.product.update({
    where: { id: opts.productId },
    data: {
      price: opts.newPrice,
      b2bPrice: opts.newB2bPrice,
      b2bMinQty: opts.newB2bMinQty,
    },
  });
}

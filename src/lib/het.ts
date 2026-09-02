import { prisma } from './db';

/**
 * Ambil HET yang berlaku untuk sebuah kategori pada tanggal tertentu.
 * "Berlaku" = record HET dengan effectiveOn <= tanggal, paling baru.
 * Mengembalikan null bila Pemkab belum menetapkan HET untuk kategori itu.
 */
export async function getActiveHet(categoryId: string, on: Date = new Date()) {
  // Normalisasi ke awal hari agar pencocokan tanggal konsisten.
  const day = new Date(on);
  day.setHours(23, 59, 59, 999);

  return prisma.hetPrice.findFirst({
    where: { categoryId, effectiveOn: { lte: day } },
    orderBy: { effectiveOn: 'desc' },
  });
}

export type HetCheck =
  | { ok: true; het: Awaited<ReturnType<typeof getActiveHet>> }
  | { ok: false; reason: string; het: Awaited<ReturnType<typeof getActiveHet>> };

/**
 * Guard harga produk terhadap HET. Dipanggil server-side setiap kali
 * produsen membuat/mengubah harga. Jika belum ada HET, harga diizinkan
 * (Pemkab belum mengatur kategori tsb) — keputusan desain untuk fase pilot.
 */
export async function validatePriceAgainstHet(
  categoryId: string,
  price: number,
  on: Date = new Date(),
): Promise<HetCheck> {
  const het = await getActiveHet(categoryId, on);
  if (!het) return { ok: true, het };

  if (price > het.maxPrice) {
    return {
      ok: false,
      het,
      reason: `Harga ${price} melebihi HET ${het.maxPrice} untuk kategori ini.`,
    };
  }
  if (het.floorPrice && price < het.floorPrice) {
    return {
      ok: false,
      het,
      reason: `Harga ${price} di bawah harga dasar ${het.floorPrice} yang melindungi produsen.`,
    };
  }
  return { ok: true, het };
}

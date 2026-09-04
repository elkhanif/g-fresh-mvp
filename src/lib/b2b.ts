import { prisma } from './db';

// #8 Kanal B2B — mesin lintas-subsidi pada proposal 11.2.
//
// Model pendapatan: produsen tetap komisi 0%. Operator memungut platform fee
// dari PEMBELI B2B (katering/restoran/hotel) atas layanan agregasi, penagihan
// bertermin, dan jaminan pasokan. Pendapatan inilah yang mendanai subsidi
// ongkir B2C (lihat deliverySubsidyFactor di lib/rating.ts).

export const PLATFORM_FEE_RATE = 0.025; // 2,5% dari subtotal
export const PAYMENT_TERM_DAYS = 14; // termin invoice: net 14 hari
export const B2B_MIN_SUBTOTAL = 500_000; // nilai minimum pesanan kanal B2B

export function platformFeeOf(subtotal: number): number {
  // Dibulatkan ke ratusan rupiah terdekat agar angka invoice rapi.
  return Math.round((subtotal * PLATFORM_FEE_RATE) / 100) * 100;
}

export function dueDateFrom(issued: Date = new Date()): Date {
  return new Date(issued.getTime() + PAYMENT_TERM_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Harga per satuan yang berlaku untuk sebuah produk pada kanal & kuantitas
 * tertentu. Harga grosir hanya dipakai bila produsen menetapkannya DAN
 * kuantitas memenuhi minimum. Harga grosir tetap tunduk pada HET karena
 * nilainya selalu lebih rendah dari harga ritel.
 */
export function unitPriceFor(
  product: { price: number; b2bPrice: number | null; b2bMinQty: number | null },
  channel: 'B2C' | 'B2B',
  qty: number,
): { unitPrice: number; wholesale: boolean } {
  if (
    channel === 'B2B' &&
    product.b2bPrice != null &&
    product.b2bMinQty != null &&
    qty >= product.b2bMinQty
  ) {
    return { unitPrice: product.b2bPrice, wholesale: true };
  }
  return { unitPrice: product.price, wholesale: false };
}

/** Nomor invoice berurutan per tahun: GF/B2B/2026/0001 */
export async function nextInvoiceNumber(tx: any, now: Date = new Date()): Promise<string> {
  const year = now.getFullYear();
  const prefix = `GF/B2B/${year}/`;
  const last = await tx.invoice.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  const seq = last ? parseInt(last.number.slice(prefix.length), 10) + 1 : 1;
  return prefix + String(seq).padStart(4, '0');
}

/** Tandai invoice yang sudah melewati jatuh tempo. Dipanggil dari cron. */
export async function markOverdueInvoices(now: Date = new Date()) {
  const res = await prisma.invoice.updateMany({
    where: { status: 'BELUM_DIBAYAR', dueDate: { lt: now } },
    data: { status: 'JATUH_TEMPO' },
  });
  return res.count;
}

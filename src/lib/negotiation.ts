// Negosiasi resolusi komplain: produsen menawar → konsumen terima/tolak →
// maksimal beberapa putaran sebelum otomatis dieskalasi ke admin.
//
// Filosofi: kasus yang jelas (mis. "kurang 1 dari 10 kg") harusnya selesai
// cepat antara produsen-konsumen tanpa menunggu admin. Admin baru turun
// tangan untuk kasus yang benar-benar berselisih atau macet negosiasinya.

export const MAX_NEGOTIATION_ROUNDS = 3;

export const CATEGORY_LABEL: Record<string, string> = {
  KURANG_TIMBANGAN: 'Jumlah/berat kurang',
  RUSAK: 'Rusak dalam perjalanan',
  TIDAK_SEGAR: 'Tidak segar / kualitas turun',
  SALAH_PRODUK: 'Barang tidak sesuai pesanan',
  LAINNYA: 'Lainnya',
};

export const CATEGORIES = Object.keys(CATEGORY_LABEL) as (keyof typeof CATEGORY_LABEL)[];

/**
 * Hitung saran nominal refund untuk kategori KURANG_TIMBANGAN — proporsional
 * terhadap porsi yang bermasalah dari nilai produk (di luar ongkir, karena
 * ongkir tetap terpakai penuh terlepas dari kekurangan jumlah barang).
 *
 * Mengembalikan null bila kategori bukan KURANG_TIMBANGAN, atau data tidak
 * cukup untuk dihitung — dalam hal ini form tetap mengizinkan input manual.
 */
export function suggestedRefundFor(
  category: string,
  qtyAffected: number | null | undefined,
  item: { qty: number; lineTotal: number } | null,
): number | null {
  if (category !== 'KURANG_TIMBANGAN') return null;
  if (!qtyAffected || qtyAffected <= 0 || !item || item.qty <= 0) return null;

  const proporsi = Math.min(1, qtyAffected / item.qty);
  const nilai = Math.round((proporsi * item.lineTotal) / 100) * 100;
  return Math.max(100, Math.min(item.lineTotal, nilai));
}

export function roundsLeft(currentRound: number): number {
  return Math.max(0, MAX_NEGOTIATION_ROUNDS - currentRound);
}

export function isLastRound(currentRound: number): boolean {
  return currentRound >= MAX_NEGOTIATION_ROUNDS;
}

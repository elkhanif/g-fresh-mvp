// Rating engine G-Fresh.
//
// Skor 1.0–5.0 dihitung dari riwayat transaksi peserta:
//   - "baik"  = order SELESAI yang memuat produk/tugasnya
//   - "buruk" = order REFUND (akibat komplain valid)
//
// Rumus: rating turun proporsional terhadap rasio transaksi buruk,
// di-smooth prior (PRIOR_GOOD) supaya 1 komplain di antara banyak
// transaksi sukses cuma sedikit berpengaruh, sementara komplain
// berulang menjatuhkan skor dengan cepat (→ penangguhan).
//
// bad = 0  → selalu 5.0 (tidak ada penalti untuk sukses).

const PRIOR_GOOD = 6; // bobot awal "baik" (peredam sampel kecil)
const W_BAD = 4; // bobot tiap transaksi buruk (komplain valid = serius)

export function computeRating(good: number, bad: number): number {
  const ge = good + PRIOR_GOOD;
  const be = bad * W_BAD;
  const rate = ge / (ge + be); // 1.0 saat bad=0
  const rating = 1 + 4 * rate; // petakan ke skala 1..5
  return Math.round(Math.min(5, Math.max(1, rating)) * 10) / 10;
}

// Ambang penangguhan otomatis (sanksi bertingkat tahap akhir).
export const SUSPEND_RATING = 3.0;

export function isSuspended(rating: number): boolean {
  return rating < SUSPEND_RATING;
}

export type Tier = {
  key: 'SANGAT_BAIK' | 'BAIK' | 'PEMBINAAN' | 'DITANGGUHKAN';
  label: string;
  // true = subsidi ongkir dibatasi / akun diblok bertransaksi
  restricted: boolean;
};

export function tierOf(rating: number): Tier {
  if (rating >= 4.5) return { key: 'SANGAT_BAIK', label: 'Sangat baik', restricted: false };
  if (rating >= 4.0) return { key: 'BAIK', label: 'Baik', restricted: false };
  if (rating >= SUSPEND_RATING) return { key: 'PEMBINAAN', label: 'Perlu pembinaan', restricted: false };
  return { key: 'DITANGGUHKAN', label: 'Ditangguhkan', restricted: true };
}

// --- Fitur #1: subsidi ongkir berbasis tier produsen ---
// Produsen berkinerja baik "diganjar" ongkir lebih murah bagi konsumen
// (didanai lintas-subsidi B2B, sesuai proposal 5.2). Faktor dikalikan ke
// ongkir dasar: 0.7 = konsumen bayar 70%, 30% disubsidi.
export function deliverySubsidyFactor(rating: number): number {
  const t = tierOf(rating);
  if (t.key === 'SANGAT_BAIK') return 0.7; // subsidi 30%
  if (t.key === 'BAIK') return 0.85; // subsidi 15%
  return 1.0; // pembinaan / ditangguhkan: tanpa subsidi
}

// Persentase subsidi untuk ditampilkan ke pengguna (0, 15, atau 30).
export function subsidyPercent(rating: number): number {
  return Math.round((1 - deliverySubsidyFactor(rating)) * 100);
}

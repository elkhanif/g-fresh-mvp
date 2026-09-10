import type { CultivationMethod, FreshBasis, TraceStratum } from '@prisma/client';

/**
 * Penentuan strata penelusuran mutu (poster: Jalur A / Jalur B).
 *
 * Prinsip yang dipegang file ini: strata BUKAN pilihan produsen, melainkan
 * turunan dari kelengkapan data. Kalau di form ada opsi "Jalur A / Jalur B",
 * hampir semua orang memilih yang paling sedikit kerjanya dan badge
 * "Mutu Terverifikasi" berhenti berarti apa pun. Dengan diturunkan, mengisi
 * lebih banyak field otomatis menaikkan strata — insentifnya melekat pada
 * pekerjaannya, bukan pada klaimnya.
 *
 * Sengaja bebas import Prisma client & auth (mengikuti pola src/lib/cert.ts)
 * supaya bisa dipakai juga di komponen klien untuk indikator kelengkapan.
 */

export type StratumInput = {
  freshBasis: FreshBasis;
  harvestLat: number | null;
  harvestLng: number | null;
  cultivationMethod: CultivationMethod | null;
  certVerified: boolean;
};

export const STRATUM_LABEL: Record<TraceStratum, string> = {
  MUTU_TERVERIFIKASI: 'Mutu Terverifikasi',
  INFORMASI_DASAR: 'Informasi Mutu Dasar',
};

export const CULTIVATION_LABEL: Record<CultivationMethod, string> = {
  ORGANIK_MURNI: 'Organik murni',
  ANORGANIK_KONVENSIONAL: 'Anorganik / konvensional',
  CAMPURAN: 'Campuran / diversifikasi',
};

/** Urutan tampil checklist di form produsen. */
export const STRATUM_REQUIREMENTS = [
  { key: 'lokasi', label: 'Lokasi lahan / tambak (GPS)' },
  { key: 'panen', label: 'Tanggal & jam panen' },
  { key: 'metode', label: 'Metode budidaya' },
  { key: 'sertifikat', label: 'Sertifikat terverifikasi dinas' },
] as const;

export type StratumRequirement = (typeof STRATUM_REQUIREMENTS)[number]['key'];

/**
 * Empat syarat Jalur A dipecah satu-satu, bukan dikembalikan sebagai boolean
 * tunggal, supaya form bisa menampilkan "3 dari 4 terisi" dan produsen tahu
 * persis apa yang kurang. Insentif harus kelihatan di titik pengisian.
 */
export function stratumChecklist(i: StratumInput): Record<StratumRequirement, boolean> {
  return {
    lokasi: i.harvestLat != null && i.harvestLng != null,
    // Pedagang kios (freshBasis TRANSAKSI) memang tidak punya waktu panen.
    // Ini bukan kelalaian mereka — Jalur B adalah tempat yang benar, bukan
    // hukuman. Lihat komentar enum FreshBasis di schema.prisma.
    panen: i.freshBasis === 'PANEN',
    metode: i.cultivationMethod != null,
    sertifikat: i.certVerified,
  };
}

export function stratumProgress(i: StratumInput): { done: number; total: number } {
  const c = stratumChecklist(i);
  return {
    done: STRATUM_REQUIREMENTS.filter((r) => c[r.key]).length,
    total: STRATUM_REQUIREMENTS.length,
  };
}

export function deriveStratum(i: StratumInput): TraceStratum {
  const c = stratumChecklist(i);
  return STRATUM_REQUIREMENTS.every((r) => c[r.key])
    ? 'MUTU_TERVERIFIKASI'
    : 'INFORMASI_DASAR';
}

/**
 * Satu-satunya tempat "sertifikat sah" ditentukan.
 *
 * Sengaja dipisah dari deriveStratum: saat sertifikat multi-jenis (Paket B)
 * mendarat, isi fungsi ini diganti menjadi
 *   certs.some(c => c.status === 'TERVERIFIKASI' && belum kedaluwarsa)
 * dan seluruh pemanggilnya tidak perlu disentuh.
 *
 * Pemeriksaan certExpiresAt di sini BUKAN duplikasi cron cert-expiry.ts.
 * Cron berjalan berkala; fungsi ini menutup jendela antara detik sertifikat
 * kedaluwarsa dan cron berikutnya. Badge hijau di atas sertifikat mati adalah
 * klaim palsu, sekecil apa pun jendelanya.
 */
export function certVerifiedOf(p: {
  certStatus: string;
  certExpiresAt: Date | null;
}): boolean {
  if (p.certStatus !== 'TERVERIFIKASI') return false;
  return p.certExpiresAt == null || p.certExpiresAt.getTime() > Date.now();
}

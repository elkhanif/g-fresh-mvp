import { Badge } from './ui/Badge';
import type { TraceStratum } from '@prisma/client';

/**
 * Label strata penelusuran mutu (poster: Jalur A / Jalur B).
 *
 * Dua hal yang disengaja:
 *
 * 1. Jalur B TIDAK pernah disembunyikan. Mengikuti alasan yang sama seperti
 *    CertBadge: kalau yang negatif dihilangkan, produk tanpa badge terbaca
 *    seolah aman padahal justru sebaliknya. "Informasi Mutu Dasar" itu
 *    keterangan netral tentang kelengkapan data, bukan tuduhan.
 *
 * 2. Warnanya biru, bukan merah/kuning. Jalur B bukan pelanggaran — pedagang
 *    kios pasar memang tidak punya data panen, dan poster memposisikan mereka
 *    sebagai jalur yang sah dengan keuntungan sendiri.
 *
 * `compact` dipakai saat badge menumpang di atas foto produk pada kartu
 * katalog (kolom bisa selebar ~150px di HP).
 */
export function StratumBadge({
  stratum,
  compact = false,
}: {
  stratum: TraceStratum;
  compact?: boolean;
}) {
  const kelas = compact
    ? 'max-w-full truncate bg-white/90 text-[11px] backdrop-blur-xs'
    : undefined;

  if (stratum === 'MUTU_TERVERIFIKASI')
    return (
      <Badge tone="green" className={kelas}>
        ✓ Mutu Terverifikasi
      </Badge>
    );

  return (
    <Badge tone="blue" className={kelas}>
      {compact ? 'Mutu Dasar' : 'Informasi Mutu Dasar'}
    </Badge>
  );
}

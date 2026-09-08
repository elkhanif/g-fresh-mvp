import { Badge } from './ui/Badge';
import type { CertStatus } from '@prisma/client';

/**
 * Label status sertifikasi produsen.
 *
 * `compact` dipakai saat badge ini menumpang di atas foto produk di kartu
 * katalog (kolom bisa selebar ~150px di HP). Perbedaannya cuma dua:
 *  - nama skema sertifikat (P-IRT, Halal, …) dilepas — di kartu yang penting
 *    hanya "sudah diverifikasi atau belum"; nama skemanya tetap ada di
 *    halaman detail produk;
 *  - teks lebih kecil + latar semi-buram, supaya tetap terbaca di atas foto
 *    apa pun tanpa perlu menggelapkan fotonya.
 *
 * Statusnya TIDAK pernah disembunyikan di mode compact, termasuk "Belum
 * bersertifikat". Menyembunyikan yang negatif membuat kartu tanpa badge
 * terbaca seolah aman, padahal justru sebaliknya.
 */
export function CertBadge({
  status,
  type,
  compact = false,
}: {
  status: CertStatus;
  type?: string | null;
  compact?: boolean;
}) {
  const kelas = compact
    ? 'max-w-full truncate bg-white/90 text-[11px] backdrop-blur-xs'
    : undefined;

  if (status === 'TERVERIFIKASI')
    return (
      <Badge tone="green" className={kelas}>
        ✓ Tersertifikasi{!compact && type ? ` · ${type}` : ''}
      </Badge>
    );
  if (status === 'MENUNGGU_VERIFIKASI')
    return <Badge tone="amber" className={kelas}>Menunggu verifikasi</Badge>;
  if (status === 'MENUNGGU_PERBAIKAN')
    return <Badge tone="amber" className={kelas}>Perlu perbaikan</Badge>;
  // Kedaluwarsa dibedakan dari ditolak: sertifikatnya pernah sah, hanya lewat
  // masa berlaku. Menyamakan keduanya tidak adil bagi produsen.
  if (status === 'KEDALUWARSA')
    return <Badge tone="amber" className={kelas}>Kedaluwarsa</Badge>;
  if (status === 'DICABUT')
    return <Badge tone="red" className={kelas}>Sertifikasi dicabut</Badge>;
  if (status === 'DITOLAK')
    return <Badge tone="red" className={kelas}>Sertifikasi ditolak</Badge>;
  return <Badge tone="neutral" className={kelas}>Belum bersertifikat</Badge>;
}

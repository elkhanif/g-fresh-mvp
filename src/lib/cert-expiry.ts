import { prisma } from './db';

/**
 * Tandai sertifikat yang masa berlakunya sudah lewat.
 *
 * Dijalankan cron, bukan dihitung saat render: kalau hanya dihitung di UI,
 * badge "tersertifikasi" tetap tersimpan TERVERIFIKASI di database dan ikut
 * terbawa ke tempat lain (katalog konsumen, laporan dinas). Statusnya harus
 * benar-benar berubah, dan perubahan itu masuk jejak audit seperti keputusan
 * manusia — dengan actor kosong yang artinya sistem.
 */
export async function markExpiredCertifications() {
  const now = new Date();
  const expired = await prisma.producerProfile.findMany({
    where: { certStatus: 'TERVERIFIKASI', certExpiresAt: { lt: now } },
    select: { id: true, certType: true, certNumber: true, farmName: true },
  });
  if (expired.length === 0) return [];

  for (const p of expired) {
    await prisma.$transaction(async (tx) => {
      // Syarat status diulang di WHERE: kalau petugas mencabut di detik yang
      // sama, count 0 dan kita tidak menulis jejak palsu.
      const res = await tx.producerProfile.updateMany({
        where: { id: p.id, certStatus: 'TERVERIFIKASI' },
        data: { certStatus: 'KEDALUWARSA' },
      });
      if (res.count === 0) return;
      await tx.certReview.create({
        data: {
          producerId: p.id,
          fromStatus: 'TERVERIFIKASI',
          toStatus: 'KEDALUWARSA',
          certType: p.certType,
          certNumber: p.certNumber,
          note: 'Masa berlaku sertifikat lewat (ditandai otomatis)',
        },
      });
    });
  }
  return expired.map((p) => p.farmName);
}

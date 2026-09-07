import { prisma } from './db';

/**
 * Dompet kurir & angsuran perlengkapan.
 *
 * Dua aturan yang menopang seluruh berkas ini:
 *
 * 1. **Saldo tidak pernah disimpan.** Ia selalu dihitung ulang dari
 *    penjumlahan `WalletTx`. Menyimpan saldo sekaligus riwayatnya berarti dua
 *    sumber kebenaran untuk uang yang sama; begitu keduanya berselisih,
 *    tidak ada cara menentukan mana yang benar.
 *
 * 2. **Upah ongkir tidak boleh ganda.** Penjaganya `@@unique([orderId, kind])`
 *    di basis data, bukan pengecekan di kode — kalau cron berjalan dua kali
 *    atau dua permintaan masuk bersamaan, Postgres yang menolak.
 */

export type WalletKind = 'ONGKIR' | 'POTONGAN_ALAT' | 'PENARIKAN' | 'PENYESUAIAN';

export const WALLET_LABEL: Record<WalletKind, string> = {
  ONGKIR: 'Upah antar',
  POTONGAN_ALAT: 'Angsuran coolbox',
  PENARIKAN: 'Penarikan ke rekening',
  PENYESUAIAN: 'Penyesuaian admin',
};

export async function saldoKurir(courierId: string): Promise<number> {
  const agg = await prisma.walletTx.aggregate({
    where: { courierId },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

/**
 * Kreditkan upah antar saat pesanan selesai.
 *
 * Sengaja memakai `create` di dalam try/catch alih-alih `upsert`: kalau baris
 * untuk order ini sudah ada, kita ingin operasi kedua diam-diam tidak
 * berpengaruh, bukan menimpa nilai yang sudah tercatat.
 */
export async function kreditOngkir(courierId: string, orderId: string, jumlah: number) {
  if (jumlah <= 0) return null;
  try {
    return await prisma.walletTx.create({
      data: {
        courierId,
        kind: 'ONGKIR',
        amount: jumlah,
        orderId,
        note: `Pesanan #${orderId.slice(-6)}`,
      },
    });
  } catch {
    // Pelanggaran unique = sudah pernah dikreditkan. Bukan kesalahan.
    return null;
  }
}

/**
 * Potong angsuran harian untuk kurir yang hari ini bekerja.
 *
 * Dipanggil cron. Aturan yang dipilih dan alasannya:
 * - Hanya memotong pada hari kurir menyelesaikan minimal satu antaran. Kurir
 *   yang sedang sakit atau libur tidak boleh saldonya tergerus.
 * - Tidak memotong bila saldo tidak mencukupi — lebih baik angsuran mundur
 *   sehari daripada dompet kurir jadi minus.
 * - Cicilan terakhir menyesuaikan sisa, supaya total terpotong tepat sama
 *   dengan harga alat, tidak lebih.
 */
export async function potongAngsuranHarian(now: Date = new Date()) {
  const awalHari = new Date(now);
  awalHari.setHours(0, 0, 0, 0);

  const rencana = await prisma.toolkitPlan.findMany({
    where: { settledAt: null },
    include: { courier: { select: { id: true } } },
  });

  const hasil: string[] = [];
  for (const r of rencana) {
    if (r.lastChargeOn && r.lastChargeOn >= awalHari) continue; // sudah hari ini

    const bekerjaHariIni = await prisma.order.count({
      where: {
        courierId: r.courierId,
        status: { in: ['DITERIMA', 'SELESAI'] },
        updatedAt: { gte: awalHari },
      },
    });
    if (bekerjaHariIni === 0) continue;

    const sudahTerbayar = r.paidDays * r.dailyAmount;
    const sisa = Math.max(0, r.totalAmount - sudahTerbayar);
    if (sisa === 0) {
      await prisma.toolkitPlan.update({ where: { id: r.id }, data: { settledAt: now } });
      continue;
    }
    const potong = Math.min(r.dailyAmount, sisa);

    const saldo = await saldoKurir(r.courierId);
    if (saldo < potong) continue; // tunggu sampai ada pemasukan

    await prisma.$transaction(async (tx) => {
      await tx.walletTx.create({
        data: {
          courierId: r.courierId,
          kind: 'POTONGAN_ALAT',
          amount: -potong,
          note: `Angsuran ${r.itemName} hari ke-${r.paidDays + 1}`,
        },
      });
      const lunas = sudahTerbayar + potong >= r.totalAmount;
      await tx.toolkitPlan.update({
        where: { id: r.id },
        data: {
          paidDays: { increment: 1 },
          lastChargeOn: now,
          settledAt: lunas ? now : null,
        },
      });
    });
    hasil.push(r.courierId);
  }
  return hasil;
}

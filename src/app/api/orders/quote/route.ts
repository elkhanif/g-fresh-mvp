import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';
import { isSuspended } from '@/lib/rating';
import { acuanOngkir, hitungOngkir, type BarisAcuan } from '@/lib/ongkir';
import { platformFeeOf, unitPriceFor, B2B_MIN_SUBTOTAL } from '@/lib/b2b';

/**
 * POST /api/orders/quote — perkiraan biaya, tanpa membuat apa pun.
 *
 * Ada supaya konsumen tahu ongkirnya SEBELUM menekan bayar. Sebelum ini
 * ongkir baru muncul di halaman pembayaran, setelah pesanan dan reservasi
 * stok sudah terbentuk — pembeli yang keberatan sudah berada di titik yang
 * mahal untuk dibatalkan.
 *
 * ATURAN BERKAS INI: tidak menulis apa pun. Tidak ada `create`, tidak ada
 * `update`, tidak ada reservasi stok, tidak ada transaksi. Ia membaca harga
 * dan koordinat, lalu memanggil fungsi yang SAMA dengan yang dipakai
 * `POST /api/orders` (`acuanOngkir` + `hitungOngkir` di lib/ongkir.ts).
 * Itu yang membuat angka di checkout tidak bisa menyimpang dari yang ditagih.
 *
 * Perkiraan ini tetap bisa berbeda dari tagihan bila harga atau stok berubah
 * di antara dua permintaan. Karena itu selisihnya dilaporkan sebagai
 * `catatan`, bukan disembunyikan.
 */

const schema = z.object({
  items: z.array(z.object({ productId: z.string(), qty: z.number().int().positive() })).min(1),
  destLat: z.number().optional(),
  destLng: z.number().optional(),
  channel: z.enum(['B2C', 'B2B']).default('B2C'),
});

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user || user.role !== 'KONSUMEN') {
    return NextResponse.json({ error: 'Hanya konsumen.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
  }
  const d = parsed.data;

  const produk = await prisma.product.findMany({
    where: { id: { in: d.items.map((i) => i.productId) } },
    include: { producer: true },
  });

  const catatan: string[] = [];
  const barisAcuan: BarisAcuan[] = [];
  let subtotal = 0;

  // Urutan keranjang dipertahankan — acuanOngkir() memilih berdasarkan urutan,
  // jadi melooping hasil query (yang urutannya ditentukan basis data) akan
  // memberi acuan yang berbeda dari saat pesanan dibuat.
  for (const it of d.items) {
    const p = produk.find((x) => x.id === it.productId);
    if (!p || !p.active) {
      catatan.push('Ada produk di keranjang yang sudah tidak dijual. Hapus dulu sebelum memesan.');
      continue;
    }
    if (isSuspended(p.producer.ratingScore)) {
      catatan.push(`Produsen "${p.producer.farmName}" sedang ditangguhkan — pesanan akan ditolak.`);
      continue;
    }
    if (p.stock < it.qty) {
      catatan.push(`Stok "${p.name}" tinggal ${p.stock} ${p.unit}.`);
    }
    const { unitPrice } = unitPriceFor(p, d.channel, it.qty);
    subtotal += unitPrice * it.qty;
    barisAcuan.push({
      lat: p.producer.latitude,
      lng: p.producer.longitude,
      rating: p.producer.ratingScore,
    });
  }

  const ongkir = hitungOngkir({
    acuan: acuanOngkir(barisAcuan),
    tujuan: d.destLat != null && d.destLng != null ? { lat: d.destLat, lng: d.destLng } : null,
    channel: d.channel,
  });

  const platformFee = d.channel === 'B2B' ? platformFeeOf(subtotal) : 0;

  if (d.channel === 'B2B' && subtotal < B2B_MIN_SUBTOTAL) {
    catatan.push(`Pesanan grosir minimal Rp${B2B_MIN_SUBTOTAL.toLocaleString('id-ID')}.`);
  }

  return NextResponse.json({
    subtotal,
    ongkir,
    platformFee,
    total: subtotal + ongkir.ongkir + platformFee,
    catatan,
  });
}

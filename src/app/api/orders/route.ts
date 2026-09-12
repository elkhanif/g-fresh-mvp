import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';
import { makeTraceCode } from '@/lib/qr';
import { isSuspended } from '@/lib/rating';
import { acuanOngkir, hitungOngkir, type BarisAcuan } from '@/lib/ongkir';
import { pecahNilai, slotMasihBuka, tanggalKeKolom, labelJam, type KodeSlot } from '@/lib/slot';
import {
  platformFeeOf, dueDateFrom, unitPriceFor, nextInvoiceNumber, B2B_MIN_SUBTOTAL,
} from '@/lib/b2b';
import { adjustStock, StockError } from '@/lib/inventory';
import { deriveStratum, certVerifiedOf } from '@/lib/trace-stratum';

// GET /api/orders — daftar order sesuai peran.
export async function GET() {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: 'Perlu login.' }, { status: 401 });

  let where = {};
  if (user.role === 'KONSUMEN') where = { consumerId: user.id };
  else if (user.role === 'KURIR') {
    const courier = await prisma.courierProfile.findUnique({ where: { userId: user.id } });
    // Jangan biarkan courierId jadi undefined masuk ke where — Prisma akan
    // memperlakukan itu sebagai "tidak ada filter", yang berarti endpoint ini
    // bisa balik mengembalikan SEMUA order di sistem ke akun kurir yang
    // profilnya belum ada. Kembalikan kosong secara eksplisit sebagai gantinya.
    if (!courier) return NextResponse.json([]);
    where = { courierId: courier.id };
  }
  // ADMIN/PEMKAB melihat semua; PRODUSEN pakai endpoint lain (belum dibutuhkan MVP).

  const orders = await prisma.order.findMany({
    where,
    include: {
      items: { include: { product: { include: { producer: true } } } },
      consumer: { select: { name: true, phone: true } },
      courier: { include: { user: { select: { name: true, phone: true } } } },
      invoice: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json(orders);
}

const createSchema = z.object({
  items: z.array(z.object({ productId: z.string(), qty: z.number().int().positive() })).min(1),
  addressText: z.string().min(3),
  destLat: z.number().optional(),
  destLng: z.number().optional(),
  channel: z.enum(['B2C', 'B2B']).default('B2C'),
  // Jendela pengiriman, dalam bentuk "2026-09-12|PAGI".
  //
  // Opsional, bukan wajib: pesanan tanpa jendela tetap sah supaya klien lama
  // (dan pengujian lewat curl) tidak pecah. Tapi begitu dikirim, nilainya
  // DIPERIKSA ULANG di sini — bukan dipercaya dari klien. Halaman keranjang
  // bisa terbuka berjam-jam; slot yang tampak terbuka saat halaman dimuat
  // mungkin sudah tutup saat tombol ditekan.
  slot: z.string().optional(),
});

// POST /api/orders — konsumen membuat order (status MENUNGGU_BAYAR).
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user || user.role !== 'KONSUMEN') {
    return NextResponse.json({ error: 'Hanya konsumen.' }, { status: 403 });
  }
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data tidak valid', detail: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  // Jendela pengiriman diverifikasi SEBELUM transaksi dibuka: menolak lebih
  // awal berarti tidak ada stok yang sempat direservasi lalu dibatalkan.
  let jendela: { tanggal: string; kode: KodeSlot } | null = null;
  if (d.slot) {
    jendela = pecahNilai(d.slot);
    if (!jendela) {
      return NextResponse.json({ error: 'Jendela pengiriman tidak dikenali.' }, { status: 400 });
    }
    if (!slotMasihBuka(jendela.kode, jendela.tanggal)) {
      return NextResponse.json(
        {
          error:
            `Jendela ${labelJam(jendela.kode)} sudah tutup. ` +
            'Muat ulang halaman keranjang lalu pilih jendela berikutnya.',
        },
        { status: 409 },
      );
    }
  }

  // Kanal B2B hanya untuk akun dengan profil bisnis terverifikasi.
  if (d.channel === 'B2B') {
    const biz = await prisma.businessProfile.findUnique({ where: { userId: user.id } });
    if (!biz) {
      return NextResponse.json(
        { error: 'Lengkapi profil bisnis terlebih dahulu untuk memesan sebagai B2B.' },
        { status: 403 },
      );
    }
    if (!biz.verified) {
      return NextResponse.json(
        { error: 'Profil bisnis Anda belum diverifikasi admin.' },
        { status: 403 },
      );
    }
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      const itemRows = [];
      const movementIds: string[] = []; // mutasi stok yang perlu ditandai orderId
      // Baris acuan ongkir, dalam urutan keranjang. Aturan "produsen mana yang
      // dipakai" tinggal di acuanOngkir() supaya endpoint perkiraan memilih
      // acuan yang sama persis.
      const barisAcuan: BarisAcuan[] = [];
      let subtotal = 0;

      for (const it of d.items) {
        const p = await tx.product.findUnique({
          where: { id: it.productId },
          include: { producer: true },
        });
        if (!p || !p.active) throw new Error(`Produk ${it.productId} tidak tersedia.`);

        // Sanksi bertingkat: produsen yang ditangguhkan tidak bisa menerima order.
        if (isSuspended(p.producer.ratingScore)) {
          throw new Error(`Produsen "${p.producer.farmName}" sedang ditangguhkan karena skor performa rendah.`);
        }
        if (p.stock < it.qty) throw new Error(`Stok "${p.name}" tidak cukup (sisa ${p.stock}).`);

        // Reservasi stok — lewat adjustStock supaya (a) syarat stok cukup
        // dievaluasi di dalam WHERE (bukan read-then-write seperti cek di
        // atas, yang bisa kalah balapan), dan (b) potongannya ikut tercatat
        // di buku besar StockMovement. Tanpa ini, produsen lihat stok turun
        // tanpa jejak dan buku besar bohong.
        const mv = await adjustStock(tx, {
          productId: p.id,
          delta: -it.qty,
          reason: 'PENJUALAN_APP',
          note: `Checkout ${d.channel}`,
          actorId: user.id,
        }).catch((e) => {
          // Hanya kalah balapan stok yang diterjemahkan jadi pesan ramah;
          // error lain jangan disamarkan supaya tetap kelihatan saat debug.
          if (e instanceof StockError) {
            throw new Error(`Stok "${p.name}" baru saja berubah. Muat ulang halaman lalu pesan lagi.`);
          }
          throw e;
        });
        movementIds.push(mv.id);

        // #8: harga grosir bila kanal B2B & kuantitas memenuhi minimum.
        const { unitPrice } = unitPriceFor(p, d.channel, it.qty);
        const lineTotal = unitPrice * it.qty;
        subtotal += lineTotal;
        barisAcuan.push({
          lat: p.producer.latitude,
          lng: p.producer.longitude,
          rating: p.producer.ratingScore,
        });

        itemRows.push({
          productId: p.id,
          qty: it.qty,
          unitPrice,
          lineTotal,
          traceCode: makeTraceCode(),
          // Snapshot deklarasi produsen SAAT transaksi. Semuanya dibekukan di
          // sini, termasuk strata — lihat komentar traceStratum di schema.
          freshAt: p.freshAt,
          freshBasis: p.freshBasis,
          cultivationMethod: p.cultivationMethod,
          harvestLat: p.harvestLat,
          harvestLng: p.harvestLng,
          producerLat: p.producer.latitude,
          producerLng: p.producer.longitude,
          traceStratum: deriveStratum({
            freshBasis: p.freshBasis,
            harvestLat: p.harvestLat,
            harvestLng: p.harvestLng,
            cultivationMethod: p.cultivationMethod,
            certVerified: certVerifiedOf(p.producer),
          }),
        });
      }

      if (d.channel === 'B2B' && subtotal < B2B_MIN_SUBTOTAL) {
        throw new Error(
          `Nilai minimum pesanan B2B adalah ${B2B_MIN_SUBTOTAL.toLocaleString('id-ID')}. ` +
          `Subtotal Anda ${subtotal.toLocaleString('id-ID')}.`,
        );
      }

      // Ongkir hyperlocal: jarak produsen → tujuan bila koordinat lengkap.
      // Rumusnya ada di lib/ongkir.ts dan dipakai bersama oleh endpoint
      // perkiraan, jadi angka di checkout tidak bisa berbeda dari yang ditagih.
      const rincian = hitungOngkir({
        acuan: acuanOngkir(barisAcuan),
        tujuan: d.destLat != null && d.destLng != null ? { lat: d.destLat, lng: d.destLng } : null,
        channel: d.channel,
      });
      const deliveryFee = rincian.ongkir;

      // #8: platform fee (2,5%) hanya dipungut pada kanal B2B.
      const platformFee = d.channel === 'B2B' ? platformFeeOf(subtotal) : 0;

      const created = await tx.order.create({
        data: {
          consumerId: user.id,
          status: 'MENUNGGU_BAYAR',
          channel: d.channel,
          subtotal,
          deliveryFee,
          platformFee,
          total: subtotal + deliveryFee + platformFee,
          addressText: d.addressText,
          destLat: d.destLat,
          destLng: d.destLng,
          slot: jendela?.kode ?? null,
          slotDate: jendela ? tanggalKeKolom(jendela.tanggal) : null,
          items: { create: itemRows },
          events: { create: { status: 'MENUNGGU_BAYAR', note: 'Order dibuat.', actorId: user.id } },
        },
        include: { items: true },
      });

      // Tautkan mutasi stok ke order-nya. Dilakukan setelah order dibuat
      // karena ID-nya baru ada di sini; masih di dalam transaksi yang sama,
      // jadi tidak mungkin setengah jadi.
      if (movementIds.length) {
        await tx.stockMovement.updateMany({
          where: { id: { in: movementIds } },
          data: { orderId: created.id },
        });
      }

      // #8: invoice bertermin (net 14 hari) otomatis untuk pesanan B2B.
      if (d.channel === 'B2B') {
        const issued = new Date();
        await tx.invoice.create({
          data: {
            number: await nextInvoiceNumber(tx, issued),
            orderId: created.id,
            subtotal,
            deliveryFee,
            platformFee,
            total: created.total,
            issuedAt: issued,
            dueDate: dueDateFrom(issued),
          },
        });
      }

      return created;
    });

    return NextResponse.json(order, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 422 });
  }
}

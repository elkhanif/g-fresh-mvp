import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';
import { makeTraceCode } from '@/lib/qr';
import { distanceKm, estimateDeliveryFee } from '@/lib/utils';
import { isSuspended, deliverySubsidyFactor } from '@/lib/rating';
import {
  platformFeeOf, dueDateFrom, unitPriceFor, nextInvoiceNumber, B2B_MIN_SUBTOTAL,
} from '@/lib/b2b';

// GET /api/orders — daftar order sesuai peran.
export async function GET() {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: 'Perlu login.' }, { status: 401 });

  let where = {};
  if (user.role === 'KONSUMEN') where = { consumerId: user.id };
  else if (user.role === 'KURIR') {
    const courier = await prisma.courierProfile.findUnique({ where: { userId: user.id } });
    where = { courierId: courier?.id };
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
      let subtotal = 0;
      let firstProducerCoords: { lat: number; lng: number } | null = null;
      let firstProducerRating = 5;

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

        // Reservasi stok.
        await tx.product.update({
          where: { id: p.id },
          data: { stock: { decrement: it.qty } },
        });

        // #8: harga grosir bila kanal B2B & kuantitas memenuhi minimum.
        const { unitPrice } = unitPriceFor(p, d.channel, it.qty);
        const lineTotal = unitPrice * it.qty;
        subtotal += lineTotal;
        if (!firstProducerCoords && p.producer.latitude && p.producer.longitude) {
          firstProducerCoords = { lat: p.producer.latitude, lng: p.producer.longitude };
        }
        if (itemRows.length === 0) firstProducerRating = p.producer.ratingScore;

        itemRows.push({
          productId: p.id,
          qty: it.qty,
          unitPrice,
          lineTotal,
          traceCode: makeTraceCode(),
          harvestedAt: p.harvestedAt, // snapshot deklarasi produsen
          producerLat: p.producer.latitude,
          producerLng: p.producer.longitude,
        });
      }

      if (d.channel === 'B2B' && subtotal < B2B_MIN_SUBTOTAL) {
        throw new Error(
          `Nilai minimum pesanan B2B adalah ${B2B_MIN_SUBTOTAL.toLocaleString('id-ID')}. ` +
          `Subtotal Anda ${subtotal.toLocaleString('id-ID')}.`,
        );
      }

      // Ongkir hyperlocal: jarak produsen → tujuan bila koordinat lengkap.
      let baseFee = estimateDeliveryFee(3); // default ~3 km
      if (firstProducerCoords && d.destLat != null && d.destLng != null) {
        const km = distanceKm(firstProducerCoords, { lat: d.destLat, lng: d.destLng });
        baseFee = estimateDeliveryFee(km);
      }
      // #1: subsidi ongkir hanya untuk B2C — kanal B2B justru yang mendanainya.
      const deliveryFee =
        d.channel === 'B2C'
          ? Math.round((baseFee * deliverySubsidyFactor(firstProducerRating)) / 500) * 500
          : baseFee;

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
          items: { create: itemRows },
          events: { create: { status: 'MENUNGGU_BAYAR', note: 'Order dibuat.', actorId: user.id } },
        },
        include: { items: true },
      });

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

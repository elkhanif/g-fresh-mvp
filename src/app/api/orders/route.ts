import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';
import { makeTraceCode } from '@/lib/qr';
import { distanceKm, estimateDeliveryFee } from '@/lib/utils';
import { isSuspended } from '@/lib/rating';

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

  try {
    const order = await prisma.$transaction(async (tx) => {
      const itemRows = [];
      let subtotal = 0;
      let firstProducerCoords: { lat: number; lng: number } | null = null;

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

        const lineTotal = p.price * it.qty;
        subtotal += lineTotal;
        if (!firstProducerCoords && p.producer.latitude && p.producer.longitude) {
          firstProducerCoords = { lat: p.producer.latitude, lng: p.producer.longitude };
        }

        itemRows.push({
          productId: p.id,
          qty: it.qty,
          unitPrice: p.price,
          lineTotal,
          traceCode: makeTraceCode(),
          harvestedAt: p.harvestedAt, // snapshot deklarasi produsen
          producerLat: p.producer.latitude,
          producerLng: p.producer.longitude,
        });
      }

      // Ongkir hyperlocal: jarak produsen → tujuan bila koordinat lengkap.
      let deliveryFee = estimateDeliveryFee(3); // default ~3 km
      if (firstProducerCoords && d.destLat != null && d.destLng != null) {
        const km = distanceKm(firstProducerCoords, { lat: d.destLat, lng: d.destLng });
        deliveryFee = estimateDeliveryFee(km);
      }

      const created = await tx.order.create({
        data: {
          consumerId: user.id,
          status: 'MENUNGGU_BAYAR',
          channel: d.channel,
          subtotal,
          deliveryFee,
          total: subtotal + deliveryFee,
          addressText: d.addressText,
          destLat: d.destLat,
          destLng: d.destLng,
          items: { create: itemRows },
          events: { create: { status: 'MENUNGGU_BAYAR', note: 'Order dibuat.', actorId: user.id } },
        },
        include: { items: true },
      });
      return created;
    });

    return NextResponse.json(order, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 422 });
  }
}
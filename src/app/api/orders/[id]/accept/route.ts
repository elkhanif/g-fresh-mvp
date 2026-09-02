import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';
import { transitionOrder } from '@/lib/escrow';
import { isSuspended } from '@/lib/rating';

// POST /api/orders/[id]/accept — kurir mengambil order yang sudah dibayar & belum ada kurir.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await apiUser();
  if (!user || user.role !== 'KURIR') {
    return NextResponse.json({ error: 'Hanya kurir.' }, { status: 403 });
  }
  const courier = await prisma.courierProfile.findUnique({ where: { userId: user.id } });
  if (!courier) return NextResponse.json({ error: 'Profil kurir tidak ada.' }, { status: 400 });
  if (!courier.ktpVerified) {
    return NextResponse.json({ error: 'KTP belum diverifikasi admin.' }, { status: 403 });
  }
  // Sanksi bertingkat: kurir dengan skor rendah ditangguhkan dari mengambil tugas.
  if (isSuspended(courier.ratingScore)) {
    return NextResponse.json(
      { error: 'Akun kurir Anda sedang ditangguhkan karena skor performa rendah.' },
      { status: 403 },
    );
  }

  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order) return NextResponse.json({ error: 'Order tidak ada.' }, { status: 404 });
  if (order.status !== 'DIBAYAR' || order.courierId) {
    return NextResponse.json({ error: 'Order tidak tersedia untuk diambil.' }, { status: 409 });
  }

  await prisma.order.update({ where: { id: order.id }, data: { courierId: courier.id } });
  const updated = await transitionOrder(order.id, 'DIJEMPUT_KURIR', {
    actorId: user.id,
    note: `Diambil kurir ${user.name}.`,
  });
  return NextResponse.json(updated);
}
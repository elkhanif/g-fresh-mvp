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

  // Model penugasan: REBUTAN (siapa cepat dia dapat).
  //
  // Klaim harus ATOMIK. Kalau dipisah menjadi "cek lalu tulis", dua kurir yang
  // menekan tombol nyaris bersamaan bisa lolos pengecekan bersama-sama dan
  // saling menimpa courierId. updateMany dengan syarat `courierId: null`
  // membuat database sendiri yang menjadi penengah: hanya satu baris yang
  // benar-benar berubah, sisanya mendapat count 0.
  const claim = await prisma.order.updateMany({
    where: { id: params.id, status: 'DIBAYAR', courierId: null },
    data: { courierId: courier.id },
  });
  if (claim.count === 0) {
    return NextResponse.json(
      { error: 'Tugas ini baru saja diambil kurir lain.' },
      { status: 409 },
    );
  }

  const updated = await transitionOrder(params.id, 'DIJEMPUT_KURIR', {
    actorId: user.id,
    note: `Diambil kurir ${user.name}.`,
  });
  return NextResponse.json(updated);
}

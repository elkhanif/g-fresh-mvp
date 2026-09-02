import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';
import { transitionOrder } from '@/lib/escrow';

const schema = z.object({ to: z.enum(['DIKIRIM', 'DITERIMA']) });

// POST /api/orders/[id]/status — kurir memajukan status pengiriman.
// DIJEMPUT_KURIR → DIKIRIM (barang diambil dari produsen)
// DIKIRIM → DITERIMA (sampai ke konsumen; grace period 2 jam mulai)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await apiUser();
  if (!user || user.role !== 'KURIR') {
    return NextResponse.json({ error: 'Hanya kurir.' }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Status tidak valid.' }, { status: 400 });

  const courier = await prisma.courierProfile.findUnique({ where: { userId: user.id } });
  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order) return NextResponse.json({ error: 'Order tidak ada.' }, { status: 404 });
  if (!courier || order.courierId !== courier.id) {
    return NextResponse.json({ error: 'Bukan tugas Anda.' }, { status: 403 });
  }

  try {
    const updated = await transitionOrder(order.id, parsed.data.to, { actorId: user.id });
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 409 });
  }
}

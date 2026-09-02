import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';
import { createEscrowCharge } from '@/lib/providers/payment';
import { transitionOrder } from '@/lib/escrow';
import { EscrowStatus } from '@prisma/client';

// POST /api/orders/[id]/pay — konsumen membayar → dana masuk escrow (HELD).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await apiUser();
  if (!user || user.role !== 'KONSUMEN') {
    return NextResponse.json({ error: 'Hanya konsumen.' }, { status: 403 });
  }
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { consumer: true },
  });
  if (!order) return NextResponse.json({ error: 'Order tidak ada.' }, { status: 404 });
  if (order.consumerId !== user.id) return NextResponse.json({ error: 'Bukan order Anda.' }, { status: 403 });
  if (order.status !== 'MENUNGGU_BAYAR') {
    return NextResponse.json({ error: 'Order tidak dalam status menunggu bayar.' }, { status: 409 });
  }

  const charge = await createEscrowCharge({
    orderId: order.id,
    amount: order.total,
    customer: { name: order.consumer.name, email: order.consumer.email, phone: order.consumer.phone },
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { escrowStatus: EscrowStatus.HELD, paymentRef: charge.paymentRef },
  });
  const updated = await transitionOrder(order.id, 'DIBAYAR', {
    actorId: user.id,
    note: 'Pembayaran diterima, dana ditahan (escrow).',
  });

  return NextResponse.json({ order: updated, redirectUrl: charge.redirectUrl ?? null });
}

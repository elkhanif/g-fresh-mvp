import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';
import { transitionOrder } from '@/lib/escrow';

// POST /api/orders/[id]/complete — konsumen konfirmasi selesai lebih awal
// (tak perlu menunggu grace period habis). Dana escrow diteruskan ke produsen.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await apiUser();
  if (!user || user.role !== 'KONSUMEN') {
    return NextResponse.json({ error: 'Hanya konsumen.' }, { status: 403 });
  }
  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order) return NextResponse.json({ error: 'Order tidak ada.' }, { status: 404 });
  if (order.consumerId !== user.id) return NextResponse.json({ error: 'Bukan order Anda.' }, { status: 403 });

  try {
    const updated = await transitionOrder(order.id, 'SELESAI', {
      actorId: user.id,
      note: 'Konsumen mengonfirmasi pesanan diterima dengan baik.',
    });
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 409 });
  }
}

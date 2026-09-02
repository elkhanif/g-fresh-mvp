import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';

// GET /api/orders/[id] — detail order (konsumen pemilik, kurir bertugas, admin/pemkab).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: 'Perlu login.' }, { status: 401 });

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      items: { include: { product: { include: { producer: true, category: true } } } },
      consumer: { select: { name: true, phone: true } },
      courier: { include: { user: { select: { name: true, phone: true } } } },
      complaint: true,
      events: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!order) return NextResponse.json({ error: 'Order tidak ada.' }, { status: 404 });

  const isOwner = order.consumerId === user.id;
  const isStaff = user.role === 'ADMIN' || user.role === 'PEMKAB';
  const courier = user.role === 'KURIR'
    ? await prisma.courierProfile.findUnique({ where: { userId: user.id } })
    : null;
  const isCourier = courier && order.courierId === courier.id;

  if (!isOwner && !isStaff && !isCourier) {
    return NextResponse.json({ error: 'Tidak berhak.' }, { status: 403 });
  }
  return NextResponse.json(order);
}

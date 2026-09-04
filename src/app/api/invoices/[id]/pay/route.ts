import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';
import { notify } from '@/lib/notification';

// POST /api/invoices/[id]/pay — admin menandai invoice B2B sebagai LUNAS.
// Pada MVP, konfirmasi pelunasan transfer dilakukan manual oleh operator.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await apiUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Hanya admin.' }, { status: 403 });
  }

  const inv = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { order: { select: { consumerId: true } } },
  });
  if (!inv) return NextResponse.json({ error: 'Invoice tidak ada.' }, { status: 404 });
  if (inv.status === 'LUNAS') {
    return NextResponse.json({ error: 'Invoice sudah lunas.' }, { status: 409 });
  }

  const updated = await prisma.invoice.update({
    where: { id: params.id },
    data: { status: 'LUNAS', paidAt: new Date() },
  });

  await notify({
    userId: inv.order.consumerId,
    kind: 'TAGIHAN',
    title: 'Pembayaran invoice diterima',
    body: `Invoice ${inv.number} telah dilunasi. Terima kasih.`,
    href: `/app/konsumen/invoice/${inv.id}`,
  });

  return NextResponse.json(updated);
}

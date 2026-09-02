import Link from 'next/link';
import { requireRole } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { rupiah } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';

export const dynamic = 'force-dynamic';

export default async function MyOrders() {
  const user = await requireRole('KONSUMEN');
  const orders = await prisma.order.findMany({
    where: { consumerId: user.id },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div>
      <h1 className="mb-3 text-xl font-semibold">Pesanan saya</h1>
      {orders.length === 0 && <Card><p className="text-ink/60">Belum ada pesanan.</p></Card>}
      <div className="space-y-3">
        {orders.map((o) => (
          <Link key={o.id} href={`/app/konsumen/pesanan/${o.id}`}>
            <Card className="flex items-center justify-between transition hover:border-leaf-300">
              <div>
                <p className="font-medium">Pesanan #{o.id.slice(-6)}</p>
                <p className="text-sm text-ink/60">{o.items.length} item · {rupiah(o.total)}</p>
              </div>
              <OrderStatusBadge status={o.status} />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

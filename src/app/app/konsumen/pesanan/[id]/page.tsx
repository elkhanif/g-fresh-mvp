import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { rupiah } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { OrderActions } from '@/components/forms/OrderActions';

export const dynamic = 'force-dynamic';

function fmt(d: Date) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(d);
}

export default async function OrderDetail({ params }: { params: { id: string } }) {
  const user = await requireRole('KONSUMEN');
  const o = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      items: { include: { product: true } },
      courier: { include: { user: { select: { name: true, phone: true } } } },
      complaint: true,
      events: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!o || o.consumerId !== user.id) notFound();

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Pesanan #{o.id.slice(-6)}</h1>
          <OrderStatusBadge status={o.status} />
        </div>

        <Card className="space-y-2">
          {o.items.map((it) => (
            <div key={it.id} className="flex justify-between text-sm">
              <span>{it.product.name} × {it.qty}</span>
              <span className="font-medium">{rupiah(it.lineTotal)}</span>
            </div>
          ))}
          <div className="border-t border-leaf-100 pt-2 text-sm">
            <div className="flex justify-between"><span className="text-ink/60">Subtotal</span><span>{rupiah(o.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-ink/60">Ongkir</span><span>{rupiah(o.deliveryFee)}</span></div>
            <div className="mt-1 flex justify-between font-semibold"><span>Total</span><span>{rupiah(o.total)}</span></div>
          </div>
        </Card>

        <Card className="mt-4">
          <p className="text-sm text-ink/60">Kirim ke</p>
          <p className="font-medium">{o.addressText}</p>
          {o.courier && (
            <p className="mt-2 text-sm text-ink/60">Kurir: {o.courier.user.name} · {o.courier.user.phone}</p>
          )}
          {o.gracePeriodEnd && o.status === 'DITERIMA' && (
            <p className="mt-2 text-sm text-amber-700">Masa garansi berakhir: {fmt(o.gracePeriodEnd)}</p>
          )}
        </Card>

        <Card className="mt-4">
          <p className="mb-2 text-sm font-medium">Riwayat status</p>
          <ol className="space-y-1 text-sm text-ink/70">
            {o.events.map((e) => (
              <li key={e.id} className="flex justify-between gap-3">
                <span>{e.status}{e.note ? ` — ${e.note}` : ''}</span>
                <span className="text-ink/40">{fmt(e.createdAt)}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <aside>
        <Card>
          <h2 className="mb-3 font-semibold">Tindakan</h2>
          <OrderActions orderId={o.id} status={o.status} />
          {o.complaint && (
            <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
              Komplain: {o.complaint.status}
            </p>
          )}
        </Card>
      </aside>
    </div>
  );
}

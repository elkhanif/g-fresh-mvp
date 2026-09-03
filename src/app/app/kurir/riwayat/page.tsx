import { requireRole } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { rupiah } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';

export const dynamic = 'force-dynamic';

function fmt(d: Date) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta',
  }).format(d);
}

export default async function KurirRiwayat() {
  const user = await requireRole('KURIR');
  const courier = await prisma.courierProfile.findUnique({ where: { userId: user.id } });

  const orders = await prisma.order.findMany({
    where: { courierId: courier?.id, status: { in: ['SELESAI', 'REFUND', 'SENGKETA'] } },
    include: {
      items: { include: { product: { include: { producer: true } } } },
      consumer: { select: { name: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });

  // Rekap pendapatan per hari (hanya pengiriman yang selesai).
  const perHari = new Map<string, { jumlah: number; ongkir: number }>();
  for (const o of orders) {
    if (o.status !== 'SELESAI') continue;
    const key = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeZone: 'Asia/Jakarta' })
      .format(o.updatedAt);
    const cur = perHari.get(key) ?? { jumlah: 0, ongkir: 0 };
    cur.jumlah += 1;
    cur.ongkir += o.deliveryFee;
    perHari.set(key, cur);
  }
  const hari = [...perHari.entries()].slice(0, 14);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Riwayat pengiriman</h1>
        <p className="text-sm text-ink/60">Rekap tugas yang sudah tuntas beserta pendapatan ongkir.</p>
      </div>

      {hari.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Rekap harian</h2>
          <Card className="overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-leaf-50 text-left text-ink/70">
                <tr>
                  <th className="px-4 py-2">Tanggal</th>
                  <th className="px-4 py-2">Pengiriman</th>
                  <th className="px-4 py-2">Pendapatan ongkir</th>
                </tr>
              </thead>
              <tbody>
                {hari.map(([tgl, v]) => (
                  <tr key={tgl} className="border-t border-leaf-50">
                    <td className="px-4 py-2">{tgl}</td>
                    <td className="px-4 py-2">{v.jumlah}</td>
                    <td className="px-4 py-2 font-medium text-leaf-700">{rupiah(v.ongkir)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Daftar pengiriman</h2>
        {orders.length === 0 ? (
          <Card><p className="text-ink/60">Belum ada pengiriman yang tuntas.</p></Card>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <Card key={o.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">#{o.id.slice(-6)}</span>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <p className="mt-1 text-sm text-ink/60">
                    {o.items[0]?.product.producer.farmName} → {o.consumer.name}
                  </p>
                  <p className="text-xs text-ink/45">{fmt(o.updatedAt)}</p>
                </div>
                <span className={o.status === 'SELESAI' ? 'font-medium text-leaf-700' : 'text-ink/40'}>
                  {o.status === 'SELESAI' ? `+ ${rupiah(o.deliveryFee)}` : 'tidak dibayarkan'}
                </span>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

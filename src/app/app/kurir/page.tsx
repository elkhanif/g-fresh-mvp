import { requireRole } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { rupiah } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { KurirAccept, KurirAdvance } from '@/components/forms/KurirActions';

export const dynamic = 'force-dynamic';

export default async function KurirDashboard() {
  const user = await requireRole('KURIR');
  const courier = await prisma.courierProfile.findUnique({ where: { userId: user.id } });

  const available = await prisma.order.findMany({
    where: { status: 'DIBAYAR', courierId: null },
    include: { items: { include: { product: { include: { producer: true } } } } },
    orderBy: { createdAt: 'asc' },
    take: 30,
  });

  const mine = await prisma.order.findMany({
    where: { courierId: courier?.id, status: { in: ['DIJEMPUT_KURIR', 'DIKIRIM'] } },
    include: { items: { include: { product: { include: { producer: true } } } } },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <div className="space-y-6">
      {!courier?.ktpVerified && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-800">
            KTP Anda belum diverifikasi admin. Anda belum bisa mengambil tugas. Hubungi operator G-Fresh.
          </p>
        </Card>
      )}

      <section>
        <h1 className="mb-3 text-xl font-semibold">Tugas saya</h1>
        {mine.length === 0 && <Card><p className="text-ink/60">Tidak ada tugas aktif.</p></Card>}
        <div className="space-y-3">
          {mine.map((o) => {
            const prod = o.items[0]?.product.producer;
            return (
              <Card key={o.id} className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">#{o.id.slice(-6)}</span>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <p className="mt-1 text-sm text-ink/60">
                    Ambil di: {prod?.farmName} (Kec. {prod?.kecamatan}) → {o.addressText}
                  </p>
                </div>
                <KurirAdvance orderId={o.id} status={o.status} />
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Order tersedia</h2>
        {available.length === 0 && <Card><p className="text-ink/60">Belum ada order untuk diambil.</p></Card>}
        <div className="space-y-3">
          {available.map((o) => {
            const prod = o.items[0]?.product.producer;
            return (
              <Card key={o.id} className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">#{o.id.slice(-6)}</span>
                    <Badge tone="blue">Ongkir {rupiah(o.deliveryFee)}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink/60">
                    Ambil di: {prod?.farmName} (Kec. {prod?.kecamatan}) → {o.addressText}
                  </p>
                </div>
                {courier?.ktpVerified && <KurirAccept orderId={o.id} />}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

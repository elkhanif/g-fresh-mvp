import { requireRole } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { rupiah } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { CourierVerifyButton, ComplaintDecision } from '@/components/forms/AdminActions';

export const dynamic = 'force-dynamic';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <p className="text-sm text-ink/60">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-leaf-700">{value}</p>
    </Card>
  );
}

function isImage(url: string) {
  return /\.(jpg|jpeg|png|webp|gif)$/i.test(url);
}

function Evidence({ urls }: { urls: string[] }) {
  if (!urls || urls.length === 0) {
    return <p className="mt-2 text-xs text-amber-700">Tanpa bukti foto/video.</p>;
  }
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {urls.map((u) =>
        isImage(u) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <a key={u} href={u} target="_blank" rel="noreferrer">
            <img src={u} alt="bukti komplain" className="h-20 w-20 rounded-lg border border-leaf-100 object-cover" />
          </a>
        ) : (
          <a
            key={u}
            href={u}
            target="_blank"
            rel="noreferrer"
            className="flex h-20 w-20 items-center justify-center rounded-lg border border-leaf-100 bg-leaf-50 text-xs text-leaf-700"
          >
            ▶ Video
          </a>
        ),
      )}
    </div>
  );
}

export default async function AdminDashboard() {
  await requireRole('ADMIN');

  const [orderCount, activeOrders, gmvAgg, openComplaints, couriers] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: { in: ['DIBAYAR', 'DIJEMPUT_KURIR', 'DIKIRIM', 'DITERIMA'] } } }),
    prisma.order.aggregate({ _sum: { total: true }, where: { status: 'SELESAI' } }),
    prisma.complaint.findMany({
      where: { status: { in: ['BARU', 'DITINJAU'] } },
      include: { order: { include: { items: { include: { product: true } } } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.courierProfile.findMany({
      include: { user: { select: { name: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Operasional</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total order" value={orderCount} />
        <Stat label="Order berjalan" value={activeOrders} />
        <Stat label="GMV selesai" value={rupiah(gmvAgg._sum.total ?? 0)} />
        <Stat label="Komplain terbuka" value={openComplaints.length} />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Komplain menunggu keputusan</h2>
        {openComplaints.length === 0 && <Card><p className="text-ink/60">Tidak ada komplain terbuka.</p></Card>}
        <div className="space-y-3">
          {openComplaints.map((c) => (
            <Card key={c.id}>
              <div className="flex items-center justify-between">
                <p className="font-medium">Order #{c.orderId.slice(-6)}</p>
                <OrderStatusBadge status={c.order.status} />
              </div>
              <p className="mt-1 text-sm text-ink/70">Alasan: {c.reason}</p>
              <p className="text-xs text-ink/50">
                Item: {c.order.items.map((i) => i.product.name).join(', ')} · Nilai {rupiah(c.order.total)}
              </p>
              <Evidence urls={c.evidenceUrls} />
              <div className="mt-3">
                <ComplaintDecision complaintId={c.id} />
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Kurir</h2>
        <div className="space-y-3">
          {couriers.map((c) => (
            <Card key={c.id} className="flex items-center justify-between">
              <div>
                <p className="font-medium">{c.user.name}</p>
                <p className="text-sm text-ink/60">
                  {c.user.phone} · Kec. {c.kecamatan}{' '}
                  {c.ktpVerified ? <Badge tone="green">KTP terverifikasi</Badge> : <Badge tone="amber">belum verifikasi</Badge>}
                </p>
              </div>
              <CourierVerifyButton courierId={c.id} verified={c.ktpVerified} />
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
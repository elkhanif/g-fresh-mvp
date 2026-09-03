import Link from 'next/link';
import { requireRole } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { rupiah, distanceKm } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { PerfBadge } from '@/components/PerfBadge';
import { KurirAccept, KurirAdvance, AvailabilityToggle } from '@/components/forms/KurirActions';

export const dynamic = 'force-dynamic';

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <p className="text-sm text-ink/60">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-leaf-700">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink/45">{hint}</p>}
    </Card>
  );
}

export default async function KurirDashboard() {
  const user = await requireRole('KURIR');
  const courier = await prisma.courierProfile.findUnique({ where: { userId: user.id } });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [available, mine, selesaiTotal, selesaiHariIni, pendapatanAgg, pendapatanHariIni] =
    await Promise.all([
      prisma.order.findMany({
        where: { status: 'DIBAYAR', courierId: null },
        include: { items: { include: { product: { include: { producer: true } } } } },
        orderBy: { createdAt: 'asc' },
        take: 30,
      }),
      prisma.order.findMany({
        where: { courierId: courier?.id, status: { in: ['DIJEMPUT_KURIR', 'DIKIRIM'] } },
        include: { items: { include: { product: { include: { producer: true } } } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.order.count({ where: { courierId: courier?.id, status: 'SELESAI' } }),
      prisma.order.count({
        where: { courierId: courier?.id, status: 'SELESAI', updatedAt: { gte: startOfDay } },
      }),
      prisma.order.aggregate({
        _sum: { deliveryFee: true },
        where: { courierId: courier?.id, status: 'SELESAI' },
      }),
      prisma.order.aggregate({
        _sum: { deliveryFee: true },
        where: { courierId: courier?.id, status: 'SELESAI', updatedAt: { gte: startOfDay } },
      }),
    ]);

  const aktif = courier?.active ?? false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Beranda kurir</h1>
          <p className="text-sm text-ink/60">Kec. {courier?.kecamatan} · {courier?.vehicle ?? 'kendaraan belum diisi'}</p>
        </div>
        <div className="flex items-center gap-2">
          {courier && <PerfBadge rating={courier.ratingScore} />}
          <AvailabilityToggle active={aktif} />
        </div>
      </div>

      {!courier?.ktpVerified && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-800">
            KTP Anda belum diverifikasi admin, sehingga Anda belum bisa mengambil tugas.
            Hubungi operator G-Fresh untuk proses verifikasi.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Tugas aktif" value={mine.length} hint="sedang berjalan" />
        <Stat label="Selesai hari ini" value={selesaiHariIni} hint={`total ${selesaiTotal} pengiriman`} />
        <Stat label="Pendapatan hari ini" value={rupiah(pendapatanHariIni._sum.deliveryFee ?? 0)} hint="dari ongkir" />
        <Stat label="Total pendapatan" value={rupiah(pendapatanAgg._sum.deliveryFee ?? 0)} hint="akumulasi" />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tugas berjalan</h2>
          <Link href="/app/kurir/riwayat" className="text-sm text-leaf-700 hover:underline">
            Lihat riwayat →
          </Link>
        </div>
        {mine.length === 0 && <Card><p className="text-ink/60">Tidak ada tugas aktif saat ini.</p></Card>}
        <div className="space-y-3">
          {mine.map((o) => {
            const prod = o.items[0]?.product.producer;
            return (
              <Card key={o.id} className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-[240px]">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">#{o.id.slice(-6)}</span>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <p className="mt-1 text-sm text-ink/60">
                    Jemput: {prod?.farmName} (Kec. {prod?.kecamatan})
                  </p>
                  <p className="text-sm text-ink/60">Antar: {o.addressText}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/app/kurir/tugas/${o.id}`}>
                    <span className="text-sm text-leaf-700 hover:underline">Detail</span>
                  </Link>
                  <KurirAdvance orderId={o.id} status={o.status} />
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Order tersedia</h2>
        {!aktif && (
          <Card className="mb-3 border-gray-200 bg-gray-50">
            <p className="text-sm text-ink/60">
              Anda sedang nonaktif. Nyalakan ketersediaan di atas untuk mulai mengambil tugas.
            </p>
          </Card>
        )}
        {available.length === 0 && <Card><p className="text-ink/60">Belum ada order untuk diambil.</p></Card>}
        <div className="space-y-3">
          {available.map((o) => {
            const prod = o.items[0]?.product.producer;
            const jarak =
              prod?.latitude && prod?.longitude && o.destLat != null && o.destLng != null
                ? distanceKm(
                    { lat: prod.latitude, lng: prod.longitude },
                    { lat: o.destLat, lng: o.destLng },
                  )
                : null;
            return (
              <Card key={o.id} className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-[240px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">#{o.id.slice(-6)}</span>
                    <Badge tone="blue">Ongkir {rupiah(o.deliveryFee)}</Badge>
                    {jarak != null && <Badge tone="neutral">± {jarak.toFixed(1)} km</Badge>}
                    <Badge tone="neutral">{o.items.length} item</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink/60">
                    Jemput: {prod?.farmName} (Kec. {prod?.kecamatan})
                  </p>
                  <p className="text-sm text-ink/60">Antar: {o.addressText}</p>
                </div>
                {aktif && courier?.ktpVerified && <KurirAccept orderId={o.id} />}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

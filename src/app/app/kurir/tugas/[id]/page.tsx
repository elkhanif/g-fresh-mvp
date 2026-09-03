import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { rupiah, distanceKm } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { KurirAdvance } from '@/components/forms/KurirActions';

export const dynamic = 'force-dynamic';

function fmt(d: Date) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta',
  }).format(d);
}

export default async function TugasDetail({ params }: { params: { id: string } }) {
  const user = await requireRole('KURIR');
  const courier = await prisma.courierProfile.findUnique({ where: { userId: user.id } });

  const o = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      items: { include: { product: { include: { producer: { include: { user: true } } } } } },
      consumer: { select: { name: true, phone: true } },
      events: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!o || !courier || o.courierId !== courier.id) notFound();

  const prod = o.items[0]?.product.producer;
  const jarak =
    prod?.latitude && prod?.longitude && o.destLat != null && o.destLng != null
      ? distanceKm({ lat: prod.latitude, lng: prod.longitude }, { lat: o.destLat, lng: o.destLng })
      : null;

  const petaJemput =
    prod?.latitude && prod?.longitude
      ? `https://www.google.com/maps/search/?api=1&query=${prod.latitude},${prod.longitude}`
      : null;
  const petaAntar =
    o.destLat != null && o.destLng != null
      ? `https://www.google.com/maps/search/?api=1&query=${o.destLat},${o.destLng}`
      : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/app/kurir" className="text-sm text-leaf-700 hover:underline">← Kembali</Link>
          <h1 className="mt-1 text-xl font-semibold">Tugas #{o.id.slice(-6)}</h1>
        </div>
        <div className="flex items-center gap-2">
          <OrderStatusBadge status={o.status} />
          <KurirAdvance orderId={o.id} status={o.status} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <p className="font-semibold text-leaf-700">Titik jemput</p>
            <Badge tone="neutral">Produsen</Badge>
          </div>
          <p className="mt-2 font-medium">{prod?.farmName}</p>
          <p className="text-sm text-ink/60">Kec. {prod?.kecamatan}</p>
          <p className="mt-1 text-sm text-ink/60">
            Kontak: {prod?.user.name} · {prod?.user.phone}
          </p>
          <div className="mt-3 flex gap-3 text-sm">
            {petaJemput && (
              <a href={petaJemput} target="_blank" rel="noreferrer" className="text-leaf-700 hover:underline">
                Buka di peta
              </a>
            )}
            {prod?.user.phone && (
              <a href={`tel:${prod.user.phone}`} className="text-leaf-700 hover:underline">Telepon</a>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <p className="font-semibold text-leaf-700">Titik antar</p>
            <Badge tone="neutral">Konsumen</Badge>
          </div>
          <p className="mt-2 font-medium">{o.consumer.name}</p>
          <p className="text-sm text-ink/60">{o.addressText}</p>
          <p className="mt-1 text-sm text-ink/60">Kontak: {o.consumer.phone}</p>
          <div className="mt-3 flex gap-3 text-sm">
            {petaAntar && (
              <a href={petaAntar} target="_blank" rel="noreferrer" className="text-leaf-700 hover:underline">
                Buka di peta
              </a>
            )}
            <a href={`tel:${o.consumer.phone}`} className="text-leaf-700 hover:underline">Telepon</a>
          </div>
        </Card>
      </div>

      <Card>
        <p className="mb-2 font-semibold">Muatan</p>
        {o.items.map((it) => (
          <div key={it.id} className="flex justify-between border-b border-leaf-50 py-1.5 text-sm last:border-0">
            <span>{it.product.name} × {it.qty}</span>
            <span className="text-ink/60">{it.product.unit}</span>
          </div>
        ))}
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Badge tone="blue">Ongkir Anda {rupiah(o.deliveryFee)}</Badge>
          {jarak != null && <Badge tone="neutral">± {jarak.toFixed(1)} km</Badge>}
          <Badge tone="neutral">Nilai pesanan {rupiah(o.total)}</Badge>
        </div>
        <p className="mt-3 rounded-lg bg-leaf-50 p-2 text-xs text-ink/60">
          Pastikan produk dibawa dalam cool-box dan QR pada kemasan tidak rusak — konsumen memindainya
          untuk memverifikasi asal produk.
        </p>
      </Card>

      <Card>
        <p className="mb-2 font-semibold">Linimasa</p>
        <ol className="space-y-1 text-sm text-ink/70">
          {o.events.map((e) => (
            <li key={e.id} className="flex justify-between gap-3">
              <span>{e.status}{e.note ? ` — ${e.note}` : ''}</span>
              <span className="whitespace-nowrap text-ink/40">{fmt(e.createdAt)}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

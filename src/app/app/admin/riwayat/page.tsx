import Link from 'next/link';
import { requireRole } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { rupiah } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import type { OrderStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

function fmt(d: Date) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta',
  }).format(d);
}

const FILTERS: { key: string; label: string; status?: OrderStatus[] }[] = [
  { key: 'semua', label: 'Semua' },
  { key: 'berjalan', label: 'Berjalan', status: ['DIBAYAR', 'DIJEMPUT_KURIR', 'DIKIRIM', 'DITERIMA'] },
  { key: 'selesai', label: 'Selesai', status: ['SELESAI'] },
  { key: 'sengketa', label: 'Sengketa', status: ['SENGKETA'] },
  { key: 'refund', label: 'Refund', status: ['REFUND'] },
  { key: 'batal', label: 'Dibatalkan', status: ['DIBATALKAN', 'MENUNGGU_BAYAR'] },
];

export default async function AdminRiwayat({
  searchParams,
}: {
  searchParams: { f?: string };
}) {
  await requireRole('ADMIN');
  const active = FILTERS.find((f) => f.key === searchParams.f) ?? FILTERS[0];

  const [orders, complaints] = await Promise.all([
    prisma.order.findMany({
      where: active.status ? { status: { in: active.status } } : {},
      include: {
        items: { include: { product: { include: { producer: true } } } },
        consumer: { select: { name: true } },
        courier: { include: { user: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 80,
    }),
    prisma.complaint.findMany({
      where: { status: { in: ['VALID', 'DITOLAK'] } },
      include: {
        order: { include: { items: { include: { product: { include: { producer: true } } } } } },
        reporter: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/admin" className="text-sm text-leaf-700 hover:underline">← Kembali ke operasional</Link>
        <h1 className="mt-1 text-xl font-semibold">Riwayat</h1>
        <p className="text-sm text-ink/60">Catatan seluruh pesanan dan komplain yang sudah diputuskan.</p>
      </div>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-lg font-semibold">Riwayat pesanan</h2>
          {FILTERS.map((f) => (
            <Link key={f.key} href={`/app/admin/riwayat?f=${f.key}`}>
              <span
                className={
                  'rounded-full px-3 py-1 text-sm ' +
                  (f.key === active.key
                    ? 'bg-leaf-600 text-white'
                    : 'bg-leaf-100 text-leaf-800 hover:bg-leaf-200')
                }
              >
                {f.label}
              </span>
            </Link>
          ))}
        </div>

        {orders.length === 0 ? (
          <Card><p className="text-ink/60">Tidak ada pesanan pada filter ini.</p></Card>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-leaf-50 text-left text-ink/70">
                <tr>
                  <th className="px-4 py-2">Pesanan</th>
                  <th className="px-4 py-2">Produsen</th>
                  <th className="px-4 py-2">Konsumen</th>
                  <th className="px-4 py-2">Kurir</th>
                  <th className="px-4 py-2">Nilai</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Dibuat</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-leaf-50">
                    <td className="px-4 py-2 font-medium">#{o.id.slice(-6)}</td>
                    <td className="px-4 py-2">{o.items[0]?.product.producer.farmName ?? '—'}</td>
                    <td className="px-4 py-2">{o.consumer.name}</td>
                    <td className="px-4 py-2">{o.courier?.user.name ?? <span className="text-ink/40">belum ada</span>}</td>
                    <td className="px-4 py-2">{rupiah(o.total)}</td>
                    <td className="px-4 py-2"><OrderStatusBadge status={o.status} /></td>
                    <td className="px-4 py-2 whitespace-nowrap text-ink/60">{fmt(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Riwayat komplain terputus</h2>
        {complaints.length === 0 ? (
          <Card><p className="text-ink/60">Belum ada komplain yang diputuskan.</p></Card>
        ) : (
          <div className="space-y-3">
            {complaints.map((c) => (
              <Card key={c.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">Order #{c.orderId.slice(-6)}</p>
                  <div className="flex gap-2">
                    <Badge tone={c.producerStance === 'SETUJU' ? 'neutral' : c.producerStance === 'TOLAK' ? 'blue' : 'amber'}>
                      {c.producerStance === 'SETUJU' ? 'Produsen setuju'
                        : c.producerStance === 'TOLAK' ? 'Produsen menyanggah'
                        : 'Tanpa tanggapan'}
                    </Badge>
                    <Badge tone={c.status === 'VALID' ? 'red' : 'green'}>
                      {c.status === 'VALID' ? 'Refund ke konsumen' : 'Dana ke produsen'}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-ink/50">
                  {c.order.items[0]?.product.producer.farmName} · pelapor {c.reporter.name} · {fmt(c.createdAt)}
                </p>
                <p className="mt-2 text-sm"><span className="font-medium">Klaim: </span>{c.reason}</p>
                {c.producerResponse && (
                  <p className="mt-1 text-sm text-ink/70"><span className="font-medium">Sanggahan: </span>{c.producerResponse}</p>
                )}
                {c.reviewNote && (
                  <p className="mt-1 text-xs text-ink/50">Catatan keputusan: {c.reviewNote}</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

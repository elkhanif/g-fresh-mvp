import { requireRole } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { rupiah } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { CourierVerifyButton, ComplaintDecision } from '@/components/forms/AdminActions';
import { BusinessVerifyButton } from '@/components/forms/BusinessVerifyButton';
import { InvoicePayButton } from '@/components/forms/InvoicePayButton';
import { riskLabel, FLAG_LABEL } from '@/lib/fraud';
import Link from 'next/link';

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

function isImage(u: string) {
  return /\.(jpg|jpeg|png|webp|gif)$/i.test(u);
}

function Bukti({ urls, label }: { urls: string[]; label: string }) {
  if (!urls?.length) return <p className="mt-1 text-xs text-amber-700">{label}: tidak ada.</p>;
  return (
    <div className="mt-2">
      <p className="text-xs font-medium text-ink/60">{label}</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {urls.map((u) =>
          isImage(u) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <a key={u} href={u} target="_blank" rel="noreferrer">
              <img src={u} alt="bukti" className="h-20 w-20 rounded-lg border border-leaf-100 object-cover" />
            </a>
          ) : (
            <a key={u} href={u} target="_blank" rel="noreferrer"
              className="flex h-20 w-20 items-center justify-center rounded-lg border border-leaf-100 bg-leaf-50 text-xs text-leaf-700">
              ▶ Video
            </a>
          ),
        )}
      </div>
    </div>
  );
}

export default async function AdminDashboard() {
  await requireRole('ADMIN');

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    produsenCount, konsumenCount, kurirCount, kurirVerified, kurirAktif,
    orderCount, orderHariIni, activeOrders, gmvAgg,
    escalated, menungguSanggahan, couriers, businesses, openInvoices, feeAgg,
  ] = await Promise.all([
    prisma.producerProfile.count(),
    prisma.user.count({ where: { role: 'KONSUMEN' } }),
    prisma.courierProfile.count(),
    prisma.courierProfile.count({ where: { ktpVerified: true } }),
    prisma.courierProfile.count({ where: { ktpVerified: true, active: true } }),
    prisma.order.count(),
    prisma.order.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.order.count({ where: { status: { in: ['DIBAYAR', 'DIJEMPUT_KURIR', 'DIKIRIM', 'DITERIMA'] } } }),
    prisma.order.aggregate({ _sum: { total: true }, where: { status: 'SELESAI' } }),
    prisma.complaint.findMany({
      where: { status: 'DITINJAU' },
      include: {
        order: {
          include: {
            items: { include: { product: { include: { producer: true } } } },
            consumer: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.complaint.count({ where: { status: 'MENUNGGU_SANGGAHAN' } }),
    prisma.courierProfile.findMany({
      include: { user: { select: { name: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.businessProfile.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.invoice.findMany({
      where: { status: { in: ['BELUM_DIBAYAR', 'JATUH_TEMPO'] } },
      include: { order: { include: { consumer: { include: { business: true } } } } },
      orderBy: { dueDate: 'asc' },
      take: 20,
    }),
    prisma.order.aggregate({
      _sum: { platformFee: true },
      where: { channel: 'B2B', status: { in: ['SELESAI', 'DITERIMA', 'DIKIRIM', 'DIJEMPUT_KURIR', 'DIBAYAR'] } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Operasional</h1>
        <Link href="/app/admin/riwayat" className="text-sm text-leaf-700 hover:underline">
          Lihat riwayat lengkap →
        </Link>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Pengguna terdaftar</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Produsen" value={produsenCount} hint="kelompok tani / tambak / UMKM" />
          <Stat label="Konsumen" value={konsumenCount} hint="rumah tangga & B2B" />
          <Stat label="Kurir" value={kurirCount} hint={`${kurirVerified} terverifikasi · ${kurirAktif} aktif`} />
          <Stat label="Total pengguna" value={produsenCount + konsumenCount + kurirCount} hint="seluruh peran lapangan" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Transaksi</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Total order" value={orderCount} hint={`${orderHariIni} dibuat hari ini`} />
          <Stat label="Order berjalan" value={activeOrders} hint="belum tuntas" />
          <Stat label="GMV selesai" value={rupiah(gmvAgg._sum.total ?? 0)} hint="pesanan berstatus selesai" />
          <Stat label="Perlu keputusan" value={escalated.length} hint={`${menungguSanggahan} masih di produsen`} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Komplain menunggu keputusan admin</h2>
        {menungguSanggahan > 0 && (
          <Card className="mb-3 border-amber-200 bg-amber-50">
            <p className="text-sm text-amber-800">
              {menungguSanggahan} komplain lain masih dalam masa sanggah produsen (12 jam).
              Kasus tersebut baru masuk antrian ini bila produsen menyanggah atau tidak merespon.
            </p>
          </Card>
        )}
        {escalated.length === 0 ? (
          <Card><p className="text-ink/60">Tidak ada komplain yang perlu diputuskan.</p></Card>
        ) : (
          <div className="space-y-3">
            {escalated.map((c) => (
              <Card key={c.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">Order #{c.orderId.slice(-6)}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={c.producerStance === 'TOLAK' ? 'red' : 'amber'}>
                      {c.producerStance === 'TOLAK' ? 'Produsen menyanggah' : 'Produsen tidak merespon'}
                    </Badge>
                    {c.adminDeadline && (
                      <Badge tone={c.adminDeadline < new Date() ? 'red' : 'amber'}>
                        {c.adminDeadline < new Date()
                          ? 'SLA lewat — akan auto-refund'
                          : `putuskan sebelum ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(c.adminDeadline)}`}
                      </Badge>
                    )}
                    <OrderStatusBadge status={c.order.status} />
                  </div>
                </div>
                <p className="text-xs text-ink/50">
                  {c.order.items[0]?.product.producer.farmName} → {c.order.consumer.name} · Nilai {rupiah(c.order.total)}
                </p>

                {/* #7 Konteks risiko penyalahgunaan klaim — bahan pertimbangan, bukan penentu */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone={riskLabel(c.riskScore).tone}>{riskLabel(c.riskScore).text}</Badge>
                  {c.riskFlags.map((f) => (
                    <Badge key={f} tone="neutral">{FLAG_LABEL[f] ?? f}</Badge>
                  ))}
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg bg-leaf-50 p-3">
                    <p className="text-xs font-semibold text-ink/70">KLAIM KONSUMEN</p>
                    <p className="mt-1 text-sm">{c.reason}</p>
                    <Bukti urls={c.evidenceUrls} label="Bukti konsumen" />
                  </div>
                  <div className="rounded-lg bg-amber-50 p-3">
                    <p className="text-xs font-semibold text-ink/70">SANGGAHAN PRODUSEN</p>
                    <p className="mt-1 text-sm">
                      {c.producerResponse || <span className="text-ink/45">Tidak ada tanggapan dalam batas waktu.</span>}
                    </p>
                    <Bukti urls={c.producerEvidence} label="Bukti produsen" />
                  </div>
                </div>

                <div className="mt-3">
                  <ComplaintDecision complaintId={c.id} orderTotal={c.order.total} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Kanal B2B</h2>
          <span className="text-sm text-ink/60">
            Pendapatan platform terkumpul: <b className="text-leaf-700">{rupiah(feeAgg._sum.platformFee ?? 0)}</b>
          </span>
        </div>

        <h3 className="mb-2 text-sm font-semibold text-ink/70">Pembeli bisnis</h3>
        {businesses.length === 0 ? (
          <Card className="mb-4"><p className="text-ink/60">Belum ada pendaftaran B2B.</p></Card>
        ) : (
          <div className="mb-4 space-y-3">
            {businesses.map((b) => (
              <Card key={b.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{b.companyName}</p>
                  <p className="flex flex-wrap items-center gap-2 text-sm text-ink/60">
                    {b.businessType} · PIC {b.picName} ({b.picPhone})
                    {b.verified ? <Badge tone="green">terverifikasi</Badge> : <Badge tone="amber">menunggu</Badge>}
                  </p>
                  <p className="text-xs text-ink/45">{b.user.email} · {b.billingAddress}</p>
                </div>
                <BusinessVerifyButton businessId={b.id} verified={b.verified} />
              </Card>
            ))}
          </div>
        )}

        <h3 className="mb-2 text-sm font-semibold text-ink/70">Tagihan belum lunas</h3>
        {openInvoices.length === 0 ? (
          <Card><p className="text-ink/60">Tidak ada tagihan terbuka.</p></Card>
        ) : (
          <div className="space-y-3">
            {openInvoices.map((i) => (
              <Card key={i.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/app/konsumen/invoice/${i.id}`} className="font-medium text-leaf-700 hover:underline">
                      {i.number}
                    </Link>
                    <Badge tone={i.status === 'JATUH_TEMPO' ? 'red' : 'amber'}>
                      {i.status === 'JATUH_TEMPO' ? 'jatuh tempo' : 'belum dibayar'}
                    </Badge>
                  </div>
                  <p className="text-sm text-ink/60">
                    {i.order.consumer.business?.companyName ?? i.order.consumer.name} · {rupiah(i.total)}
                    {' · '}jatuh tempo {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(i.dueDate)}
                  </p>
                  <p className="text-xs text-ink/45">Fee platform {rupiah(i.platformFee)}</p>
                </div>
                <InvoicePayButton invoiceId={i.id} />
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Kurir</h2>
        <div className="space-y-3">
          {couriers.map((c) => (
            <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{c.user.name}</p>
                <p className="flex flex-wrap items-center gap-2 text-sm text-ink/60">
                  {c.user.phone} · Kec. {c.kecamatan}
                  {c.ktpVerified ? <Badge tone="green">KTP terverifikasi</Badge> : <Badge tone="amber">belum verifikasi</Badge>}
                  {c.active ? <Badge tone="neutral">aktif</Badge> : <Badge tone="neutral">nonaktif</Badge>}
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

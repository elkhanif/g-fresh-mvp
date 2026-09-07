import Link from 'next/link';
import { requireRole } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { rupiah, distanceKm } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { PerfBadge } from '@/components/PerfBadge';
import { KurirAccept, KurirAdvance, AvailabilityToggle } from '@/components/forms/KurirActions';
import { saldoKurir } from '@/lib/wallet';
import { prisma as db } from '@/lib/db';

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

  // Wajib berhenti di sini bila profil tidak ada — TANPA guard ini,
  // courier?.id di bawah akan bernilai undefined, dan Prisma memperlakukan
  // filter undefined sebagai "abaikan filter ini". Akibatnya query "tugas
  // saya" dan statistik pendapatan bisa balik menampilkan data SEMUA kurir.
  if (!courier) {
    return (
      <Card>
        <p className="text-ink/60">
          Profil kurir tidak ditemukan untuk akun ini. Coba keluar lalu masuk kembali —
          bila masih terjadi, hubungi admin.
        </p>
      </Card>
    );
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // Dompet & angsuran perlengkapan (poster panel 3).
  const [saldo, toolkit, mutasi] = await Promise.all([
    saldoKurir(courier.id),
    db.toolkitPlan.findUnique({ where: { courierId: courier.id } }),
    db.walletTx.findMany({
      where: { courierId: courier.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  const [available, mine, selesaiTotal, selesaiHariIni, pendapatanAgg, pendapatanHariIni] =
    await Promise.all([
      prisma.order.findMany({
        where: { status: 'DIBAYAR', courierId: null },
        include: { items: { include: { product: { include: { producer: true } } } } },
        orderBy: { createdAt: 'asc' },
        take: 30,
      }),
      prisma.order.findMany({
        where: { courierId: courier.id, status: { in: ['DIJEMPUT_KURIR', 'DIKIRIM'] } },
        include: { items: { include: { product: { include: { producer: true } } } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.order.count({ where: { courierId: courier.id, status: 'SELESAI' } }),
      prisma.order.count({
        where: { courierId: courier.id, status: 'SELESAI', updatedAt: { gte: startOfDay } },
      }),
      prisma.order.aggregate({
        _sum: { deliveryFee: true },
        where: { courierId: courier.id, status: 'SELESAI' },
      }),
      prisma.order.aggregate({
        _sum: { deliveryFee: true },
        where: { courierId: courier.id, status: 'SELESAI', updatedAt: { gte: startOfDay } },
      }),
    ]);

  const aktif = courier.active;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Beranda kurir</h1>
          <p className="text-sm text-ink/60">Kec. {courier.kecamatan} · {courier.vehicle ?? 'kendaraan belum diisi'}</p>
        </div>
        <div className="flex items-center gap-2">
          {courier && <PerfBadge rating={courier.ratingScore} />}
          <AvailabilityToggle active={aktif} />
        </div>
      </div>

      {!courier.ktpVerified && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-800">
            {courier.ktpRejectedReason
              ? `Pengajuan KTP Anda ditolak: ${courier.ktpRejectedReason}`
              : courier.ktpSubmittedAt
                ? 'KTP Anda sedang ditinjau admin — belum bisa mengambil tugas.'
                : 'Anda belum bisa mengambil tugas sebelum verifikasi KTP.'}
            {' '}
            <Link href="/app/kurir/verifikasi" className="font-medium underline">
              {courier.ktpSubmittedAt && !courier.ktpRejectedReason ? 'Lihat status' : 'Verifikasi sekarang'}
            </Link>
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Tugas aktif" value={mine.length} hint="sedang berjalan" />
        <Stat label="Selesai hari ini" value={selesaiHariIni} hint={`total ${selesaiTotal} pengiriman`} />
        <Stat label="Pendapatan hari ini" value={rupiah(pendapatanHariIni._sum.deliveryFee ?? 0)} hint="dari ongkir" />
        <Stat label="Total pendapatan" value={rupiah(pendapatanAgg._sum.deliveryFee ?? 0)} hint="akumulasi" />
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-ink/60">Saldo dompet</p>
          <p className="mt-1 text-2xl font-semibold text-leaf-700">{rupiah(saldo)}</p>
          <p className="mt-0.5 text-xs text-ink/45">
            Upah antar masuk otomatis begitu pesanan selesai.
          </p>
          {mutasi.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-leaf-50 pt-2 text-xs">
              {mutasi.map((m) => (
                <li key={m.id} className="flex justify-between gap-2">
                  <span className="truncate text-ink/60">{m.note ?? m.kind}</span>
                  <span className={m.amount >= 0 ? 'text-leaf-700' : 'text-accent-600'}>
                    {m.amount >= 0 ? '+' : '−'}
                    {rupiah(Math.abs(m.amount))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {toolkit ? (
          <Card>
            <p className="text-sm text-ink/60">{toolkit.itemName}</p>
            {toolkit.settledAt ? (
              <>
                <p className="mt-1 text-lg font-semibold text-leaf-700">Lunas</p>
                <p className="mt-0.5 text-xs text-ink/45">Alat sepenuhnya milik Anda.</p>
              </>
            ) : (
              <>
                <p className="mt-1 text-lg font-semibold text-leaf-700">
                  Hari ke-{toolkit.paidDays} dari {toolkit.tenorDays}
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-leaf-50">
                  <div
                    className="h-full bg-leaf-500"
                    style={{
                      width: `${Math.min(100, Math.round((toolkit.paidDays / toolkit.tenorDays) * 100))}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-xs text-ink/55">
                  {rupiah(toolkit.dailyAmount)}/hari kerja · sisa{' '}
                  {rupiah(Math.max(0, toolkit.totalAmount - toolkit.paidDays * toolkit.dailyAmount))}
                </p>
                <p className="mt-1 text-xs text-ink/45">
                  Hanya dipotong pada hari Anda mengantar. Libur atau sakit tidak memotong saldo.
                </p>
              </>
            )}
          </Card>
        ) : (
          <Card>
            <p className="text-sm text-ink/60">Perlengkapan kerja</p>
            <p className="mt-1 text-sm text-ink/50">
              Belum ada skema coolbox aktif untuk akun ini.
            </p>
          </Card>
        )}
      </section>

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

                  {/* Langkah bernomor (poster panel 3). Tahap yang sudah lewat
                      diredupkan supaya kurir tahu posisinya tanpa membaca
                      status teknis pesanan. */}
                  <ol className="mt-2 space-y-1 text-sm">
                    <li className={o.status === 'DIJEMPUT_KURIR' ? 'text-ink' : 'text-ink/40'}>
                      <b>1.</b> Jemput di {prod?.farmName} (Kec. {prod?.kecamatan})
                    </li>
                    <li className={o.status === 'DIJEMPUT_KURIR' ? 'text-ink' : 'text-ink/40'}>
                      <b>2.</b> Cek jumlah &amp; kemas ulang
                    </li>
                    <li className={o.status === 'DIKIRIM' ? 'text-ink' : 'text-ink/40'}>
                      <b>3.</b> Antar ke {o.addressText}
                    </li>
                  </ol>

                  {/* Tautan ke aplikasi peta bawaan HP. Tujuan diambil dari
                      koordinat produsen saat menjemput, lalu beralih ke alamat
                      konsumen begitu barang di tangan. */}
                  <a
                    href={
                      o.status === 'DIKIRIM'
                        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(o.addressText)}`
                        : prod?.lat != null && prod?.lng != null
                          ? `https://www.google.com/maps/dir/?api=1&destination=${prod.lat},${prod.lng}`
                          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prod?.farmName ?? '')}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block rounded-lg bg-leaf-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-leaf-700"
                  >
                    Navigasi ke {o.status === 'DIKIRIM' ? 'konsumen' : 'lokasi jemput'}
                  </a>
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
                {aktif && courier.ktpVerified && <KurirAccept orderId={o.id} />}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

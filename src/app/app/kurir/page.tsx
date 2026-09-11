import Link from 'next/link';
import { requireRole } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { rupiah, distanceKm } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Stat, StatRow } from '@/components/ui/Stat';
import { Section } from '@/components/ui/Section';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { PerfBadge } from '@/components/PerfBadge';
import { KurirAccept, KurirAdvance, AvailabilityToggle } from '@/components/forms/KurirActions';
import { urlNavigasi } from '@/lib/maps';
import { labelJendela } from '@/lib/slot';
import { saldoKurir } from '@/lib/wallet';
import { prisma as db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Kelas tautan yang berperan sebagai tombol. `Button` tidak bisa dipakai
 *  karena ia merender <button>, sementara navigasi peta dan halaman detail
 *  harus tetap berupa <a> agar bisa dibuka di tab baru dan disalin. Bentuknya
 *  disamakan dengan `Button variant="outline"` supaya tidak ada dua wujud
 *  berbeda untuk hal yang sama-sama bisa diketuk. */
const TAUTAN_TOMBOL =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-leaf-600 px-4 py-2 text-sm font-medium text-leaf-700 transition hover:bg-leaf-50';

export default async function KurirDashboard() {
  const user = await requireRole('KURIR');
  const courier = await prisma.courierProfile.findUnique({ where: { userId: user.id } });

  // Wajib berhenti di sini bila profil tidak ada — TANPA guard ini,
  // courier?.id di bawah akan bernilai undefined, dan Prisma memperlakukan
  // filter undefined sebagai "abaikan filter ini". Akibatnya query "tugas
  // saya" dan statistik pendapatan bisa balik menampilkan data SEMUA kurir.
  if (!courier) {
    return (
      <EmptyState
        icon="truck"
        title="Profil kurir belum terpasang"
        description="Akun ini belum punya profil kurir, jadi tugas belum bisa diambil. Coba keluar lalu masuk kembali; bila masih begini, hubungi admin."
      />
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

  // Total pendapatan akumulasi TIDAK lagi diambil di sini. Angka itu tidak
  // menjawab pertanyaan apa pun yang dimiliki kurir saat sedang narik, dan
  // halaman /app/kurir/riwayat memang sudah bernama "Riwayat & pendapatan".
  // Ikut hilang: satu query aggregate per pembukaan halaman.
  const [available, mine, selesaiTotal, selesaiHariIni, pendapatanHariIni] = await Promise.all([
    prisma.order.findMany({
      where: { status: 'DIBAYAR', courierId: null },
      include: { items: { include: { product: { include: { producer: true } } } } },
      // Diurutkan menurut RIT, bukan waktu pesan. Pesanan yang dijanjikan
      // 15.00–18.00 hari ini lebih mendesak daripada pesanan yang masuk lebih
      // dulu tapi dijanjikan besok pagi. Enum DeliverySlot dideklarasikan
      // urut jam, dan Postgres mengurutkan enum menurut urutan deklarasi,
      // jadi 'asc' sudah berarti pagi → siang → sore.
      //
      // `nulls: 'last'` untuk pesanan lama yang dibuat sebelum ada jendela:
      // tanpa itu Postgres menaruh NULL paling akhir pada ASC (kebetulan
      // benar), tapi menuliskannya membuat urutan tidak bergantung pada
      // kebetulan.
      orderBy: [
        { slotDate: { sort: 'asc', nulls: 'last' } },
        { slot: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'asc' },
      ],
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
      where: { courierId: courier.id, status: 'SELESAI', updatedAt: { gte: startOfDay } },
    }),
  ]);

  const aktif = courier.active;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Beranda kurir"
        meta={[`Kec. ${courier.kecamatan}`, courier.vehicle ?? 'Kendaraan belum diisi']}
        badges={<PerfBadge rating={courier.ratingScore} />}
        actions={<AvailabilityToggle active={aktif} />}
      />

      {!courier.ktpVerified && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm leading-relaxed text-amber-800">
            {courier.ktpRejectedReason
              ? `Pengajuan KTP Anda ditolak: ${courier.ktpRejectedReason}`
              : courier.ktpSubmittedAt
                ? 'KTP Anda sedang ditinjau admin — belum bisa mengambil tugas.'
                : 'Anda belum bisa mengambil tugas sebelum verifikasi KTP.'}{' '}
            <Link href="/app/kurir/verifikasi" className="font-medium underline">
              {courier.ktpSubmittedAt && !courier.ktpRejectedReason
                ? 'Lihat status'
                : 'Verifikasi sekarang'}
            </Link>
          </p>
        </Card>
      )}

      {/* TUGAS DULU, ANGKA BELAKANGAN.
          Sebelumnya halaman ini dibuka dengan empat kotak angka lalu dua kartu
          dompet, dan "Tugas berjalan" baru muncul setelah enam kartu — di HP
          itu sekitar satu setengah layar penuh gulir. Kurir membuka aplikasi
          ini di pinggir jalan sambil memegang motor; yang ia butuhkan pertama
          adalah alamat berikutnya dan tombol untuk melanjutkan, bukan laporan
          pendapatan. */}
      <Section
        title="Tugas berjalan"
        action={
          <Link href="/app/kurir/riwayat" className="text-sm font-medium text-leaf-700 hover:underline">
            Riwayat &amp; pendapatan
          </Link>
        }
      >
        {mine.length === 0 ? (
          <EmptyState
            icon="truck"
            title="Belum ada tugas berjalan"
            description={
              aktif
                ? 'Ambil salah satu order yang tersedia di bawah untuk mulai mengantar.'
                : 'Nyalakan ketersediaan di bagian atas dulu, baru order yang tersedia bisa diambil.'
            }
          />
        ) : (
          <div className="space-y-3">
            {mine.map((o) => {
              const prod = o.items[0]?.product.producer;
              const sudahDiambil = o.status === 'DIKIRIM';

              // DUA langkah, bukan tiga. Versi sebelumnya menampilkan tiga
              // langkah ("jemput", "cek jumlah & kemas ulang", "antar") tapi
              // langkah 1 dan 2 memakai kondisi yang persis sama
              // (status === 'DIJEMPUT_KURIR'), jadi keduanya selalu menyala
              // bersamaan dan kurir tidak pernah bisa tahu ia di nomor berapa.
              // Aplikasi ini cuma punya dua keadaan nyata, jadi penomorannya
              // dibuat mengikuti keadaan itu: pengecekan jumlah digabung ke
              // langkah menjemput, tempat kegiatannya memang berlangsung.
              const langkah = [
                {
                  teks: `Jemput di ${prod?.farmName ?? 'lokasi penjual'} (Kec. ${prod?.kecamatan ?? '—'}), cek jumlah lalu kemas ulang`,
                  selesai: sudahDiambil,
                },
                { teks: `Antar ke ${o.addressText}`, selesai: false },
              ];

              // Tujuan konsumen dulu dikirim sebagai TEKS alamat, padahal
              // `o.destLat/destLng` tersedia di baris yang sama dan dipakai
              // untuk menghitung jarak beberapa baris di bawah. Sekarang
              // koordinat diutamakan, teks jadi jaring pengaman untuk pesanan
              // lama yang dibuat sebelum pin ada.
              const tautanPeta = sudahDiambil
                ? urlNavigasi({ lat: o.destLat, lng: o.destLng, teks: o.addressText })
                : urlNavigasi({
                    lat: prod?.latitude,
                    lng: prod?.longitude,
                    teks: prod?.farmName,
                  });

              return (
                // Satu-satunya elemen di halaman ini yang diberi ring hijau.
                // Kartu putih biasa dipakai untuk isi pendukung, kotak hijau
                // muda untuk angka; cincin hijau menandai "ini pekerjaan Anda
                // sekarang". Kalau setiap kartu punya penanda, tidak ada yang
                // menonjol — jadi penandanya cuma dipakai di sini.
                <div
                  key={o.id}
                  className="rounded-xl bg-white p-4 shadow-xs ring-1 ring-leaf-600/25 sm:p-5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold tabular-nums">#{o.id.slice(-6)}</span>
                    <OrderStatusBadge status={o.status} />
                    {labelJendela(o.slot, o.slotDate) && (
                      <Badge tone="amber">{labelJendela(o.slot, o.slotDate)}</Badge>
                    )}
                  </div>

                  <ol className="mt-3 space-y-2">
                    {langkah.map((l, i) => {
                      const berjalan = !l.selesai && (i === 0 ? !sudahDiambil : sudahDiambil);
                      return (
                        <li key={i} className="flex gap-2.5">
                          <span
                            className={
                              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ' +
                              (l.selesai
                                ? 'bg-leaf-100 text-leaf-700'
                                : berjalan
                                  ? 'bg-leaf-600 text-white'
                                  : 'bg-leaf-50 text-leaf-400')
                            }
                          >
                            {l.selesai ? <Icon name="check" size={13} /> : i + 1}
                          </span>
                          <span
                            className={
                              'text-sm leading-snug ' +
                              (l.selesai
                                ? 'text-ink/40 line-through decoration-ink/20'
                                : berjalan
                                  ? 'text-ink'
                                  : 'text-ink/50')
                            }
                          >
                            {l.teks}
                          </span>
                        </li>
                      );
                    })}
                  </ol>

                  {/* Aksi dipisah garis dari isi, dan tombol lanjut keadaan
                      diletakkan paling kanan (paling bawah di HP) sebagai satu
                      titik akhir yang tetap. "Detail" dulu berupa teks
                      bergaris bawah yang duduk persis di samping tombol asli —
                      dua wujud berbeda untuk dua aksi yang setara. Sekarang
                      keduanya berbentuk tombol. */}
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-leaf-50 pt-3">
                    {/* Tanpa koordinat maupun teks, tombol ini disembunyikan
                        alih-alih membuka aplikasi peta yang kosong. */}
                    {tautanPeta && (
                      <a href={tautanPeta} target="_blank" rel="noreferrer" className={TAUTAN_TOMBOL}>
                        <Icon name="truck" size={16} />
                        Navigasi ke {sudahDiambil ? 'konsumen' : 'lokasi jemput'}
                      </a>
                    )}
                    <Link href={`/app/kurir/tugas/${o.id}`} className={TAUTAN_TOMBOL}>
                      Detail
                    </Link>
                    <div className="ms-auto w-full sm:w-auto">
                      <KurirAdvance orderId={o.id} status={o.status} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <StatRow>
        <Stat
          label="Selesai hari ini"
          value={selesaiHariIni}
          hint={`${selesaiTotal} pengiriman seluruhnya`}
        />
        <Stat
          label="Pendapatan hari ini"
          value={rupiah(pendapatanHariIni._sum.deliveryFee ?? 0)}
          hint="dari ongkir"
        />
        <Stat label="Saldo dompet" value={rupiah(saldo)} hint="masuk otomatis saat selesai" />
      </StatRow>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-sm font-medium">Mutasi terakhir</p>
          {mutasi.length > 0 ? (
            <ul className="mt-2 space-y-1.5 text-xs">
              {mutasi.map((m) => (
                <li key={m.id} className="flex justify-between gap-2">
                  <span className="truncate text-ink/60">{m.note ?? m.kind}</span>
                  <span
                    className={
                      'shrink-0 tabular-nums ' +
                      (m.amount >= 0 ? 'text-leaf-700' : 'text-accent-700')
                    }
                  >
                    {m.amount >= 0 ? '+' : '−'}
                    {rupiah(Math.abs(m.amount))}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-ink/50">
              Belum ada mutasi. Upah antar tercatat di sini setiap pesanan selesai.
            </p>
          )}
        </Card>

        {toolkit ? (
          <Card>
            <p className="text-sm font-medium">{toolkit.itemName}</p>
            {toolkit.settledAt ? (
              <>
                <p className="mt-1 text-lg font-semibold text-leaf-700">Lunas</p>
                <p className="mt-0.5 text-xs text-ink/45">Alat sepenuhnya milik Anda.</p>
              </>
            ) : (
              <>
                <p className="mt-1 text-sm tabular-nums text-ink/70">
                  Hari ke-{toolkit.paidDays} dari {toolkit.tenorDays}
                </p>
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-leaf-50"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={toolkit.tenorDays}
                  aria-valuenow={toolkit.paidDays}
                  aria-label={`Angsuran ${toolkit.itemName}`}
                >
                  <div
                    className="h-full bg-leaf-500"
                    style={{
                      width: `${Math.min(100, Math.round((toolkit.paidDays / toolkit.tenorDays) * 100))}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-xs leading-relaxed tabular-nums text-ink/55">
                  {rupiah(toolkit.dailyAmount)} per hari kerja, sisa{' '}
                  {rupiah(Math.max(0, toolkit.totalAmount - toolkit.paidDays * toolkit.dailyAmount))}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink/45">
                  Hanya dipotong pada hari Anda mengantar. Libur atau sakit tidak memotong saldo.
                </p>
              </>
            )}
          </Card>
        ) : (
          <Card>
            <p className="text-sm font-medium">Perlengkapan kerja</p>
            <p className="mt-1 text-sm text-ink/50">
              Belum ada skema coolbox aktif untuk akun ini.
            </p>
          </Card>
        )}
      </div>

      <Section title="Order tersedia">
        {!aktif && (
          <Card className="mb-3 border-amber-200 bg-amber-50">
            <p className="text-sm text-amber-800">
              Anda sedang nonaktif. Nyalakan ketersediaan di bagian atas untuk mulai mengambil
              tugas.
            </p>
          </Card>
        )}

        {available.length === 0 ? (
          <EmptyState
            icon="receipt"
            title="Belum ada order untuk diambil"
            description="Order yang sudah dibayar konsumen akan muncul di sini. Halaman ini menyegar sendiri setiap kali dibuka."
          />
        ) : (
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
                  <div className="min-w-[240px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium tabular-nums">#{o.id.slice(-6)}</span>
                      {/* Rit yang dijanjikan ke konsumen. Ditaruh sebagai badge
                          pertama setelah nomor karena inilah yang menentukan
                          kurir mau ambil tugas ini atau tidak — bukan besar
                          ongkirnya. Pesanan lama tanpa jendela tidak diberi
                          badge apa pun; menuliskan "tanpa jendela" cuma
                          menambah kata tanpa menambah keputusan. */}
                      {labelJendela(o.slot, o.slotDate) && (
                        <Badge tone="amber">{labelJendela(o.slot, o.slotDate)}</Badge>
                      )}
                      <Badge tone="blue">Ongkir {rupiah(o.deliveryFee)}</Badge>
                      {jarak != null && <Badge tone="neutral">± {jarak.toFixed(1)} km</Badge>}
                      <Badge tone="neutral">{o.items.length} item</Badge>
                    </div>
                    <dl className="mt-1.5 space-y-0.5 text-sm text-ink/60">
                      <div className="flex gap-1.5">
                        <dt className="shrink-0 text-ink/45">Jemput</dt>
                        <dd>
                          {prod?.farmName} (Kec. {prod?.kecamatan})
                        </dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt className="shrink-0 text-ink/45">Antar</dt>
                        <dd>{o.addressText}</dd>
                      </div>
                    </dl>
                  </div>
                  {aktif && courier.ktpVerified && <KurirAccept orderId={o.id} />}
                </Card>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

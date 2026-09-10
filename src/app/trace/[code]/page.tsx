import Link from 'next/link';
import { prisma } from '@/lib/db';
import { isValidTraceCodeShape } from '@/lib/qr';
import { CertBadge } from '@/components/CertBadge';
import { StratumBadge } from '@/components/StratumBadge';
import { CULTIVATION_LABEL } from '@/lib/trace-stratum';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';

export const dynamic = 'force-dynamic';

function fmt(d: Date) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(d);
}

export default async function TracePage({ params }: { params: { code: string } }) {
  const code = decodeURIComponent(params.code);

  const shapeOk = isValidTraceCodeShape(code);
  const item = shapeOk
    ? await prisma.orderItem.findUnique({
        where: { traceCode: code },
        include: {
          product: { include: { category: true, producer: { include: { market: true } } } },
          order: { select: { createdAt: true, status: true } },
        },
      })
    : null;

  // Koordinat lahan lebih spesifik daripada koordinat produsen — satu petani
  // bisa menggarap beberapa lahan — jadi diutamakan untuk peta.
  const petaLat = item?.harvestLat ?? item?.producerLat ?? null;
  const petaLng = item?.harvestLng ?? item?.producerLng ?? null;

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <Link href="/" className="text-lg font-bold text-leaf-700">G-Fresh</Link>
      <h1 className="mt-4 text-xl font-semibold">Paspor Mutu Produk</h1>

      {!item ? (
        <Card className="mt-4">
          <p className="text-ink/70">
            Kode telusur tidak dikenali. Pastikan Anda memindai QR resmi G-Fresh pada kemasan.
          </p>
        </Card>
      ) : (
        <Card className="mt-4 space-y-4">
          <div className="rounded-lg bg-leaf-50 px-3 py-2 text-center">
            <p className="text-xs text-ink/50">Kode telusur</p>
            <p className="font-mono text-lg font-semibold tracking-wider text-leaf-800">{code}</p>
          </div>

          <div>
            <p className="text-sm text-ink/60">{item.product.category.name}</p>
            <h2 className="text-lg font-semibold">{item.product.name}</h2>
          </div>

          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              {/* Label mengikuti freshBasis, bukan diasumsikan "panen".
                  Pedagang kios melaporkan waktu kulakan — menyebutnya waktu
                  panen membuat paspor ini berbohong tentang asal barang. */}
              <dt className="text-ink/60">
                {item.freshBasis === 'PANEN'
                  ? 'Waktu panen (dilaporkan produsen)'
                  : 'Waktu transaksi di pasar (dilaporkan penjual)'}
              </dt>
              <dd className="text-right font-medium">{fmt(item.freshAt)}</dd>
            </div>
            {item.cultivationMethod && (
              <div className="flex justify-between gap-4">
                <dt className="text-ink/60">Metode budidaya</dt>
                <dd className="text-right font-medium">
                  {CULTIVATION_LABEL[item.cultivationMethod]}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-ink/60">Produsen</dt>
              <dd className="text-right font-medium">{item.product.producer.farmName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink/60">Asal produksi</dt>
              <dd className="text-right font-medium">Kec. {item.product.producer.kecamatan}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink/60">Dipesan pada</dt>
              <dd className="text-right font-medium">{fmt(item.order.createdAt)}</dd>
            </div>
          </dl>

          {/*
            Strata dibaca dari snapshot OrderItem, BUKAN dari
            producer.certStatus yang live. Paspor ini dokumen satu transaksi:
            isinya harus apa yang benar saat barang dibeli. Sertifikat yang
            dicabut bulan depan tidak boleh menurunkan QR yang sudah tercetak
            hari ini, dan sebaliknya.

            CertBadge tetap ditampilkan sebagai keterangan status sertifikasi
            produsen SEKARANG — dua informasi yang berbeda, jadi dipisah
            labelnya supaya pembaca tidak mengira keduanya hal yang sama.
          */}
          <div className="space-y-2">
            <div>
              <p className="mb-1 text-xs text-ink/50">Strata penelusuran saat dibeli</p>
              <StratumBadge stratum={item.traceStratum} />
            </div>
            <div>
              <p className="mb-1 text-xs text-ink/50">Status sertifikasi produsen saat ini</p>
              <CertBadge status={item.product.producer.certStatus} type={item.product.producer.certType} />
            </div>
          </div>

          {petaLat != null && petaLng != null && (
            <div>
              <p className="mb-2 text-sm font-medium">Lokasi produksi</p>
              {/*
                Peta OpenStreetMap disematkan tanpa kunci API dan tanpa pustaka
                tambahan. Titik yang ditampilkan adalah koordinat yang tercatat
                SAAT transaksi (snapshot di OrderItem), bukan posisi produsen
                sekarang — kalau produsen pindah lahan, paspor lama tetap
                menunjukkan asal barang yang sebenarnya.
              */}
              <div className="overflow-hidden rounded-lg border border-leaf-100">
                <iframe
                  title="Peta lokasi produksi"
                  className="h-48 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${petaLng - 0.02}%2C${petaLat - 0.015}%2C${petaLng + 0.02}%2C${petaLat + 0.015}&layer=mapnik&marker=${petaLat}%2C${petaLng}`}
                />
              </div>
              <p className="mt-1 text-xs text-ink/45">
                Peta dipersempit ke tingkat kecamatan demi privasi produsen. Sumber peta:
                OpenStreetMap.
              </p>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium">Rantai pasok</p>
            <div className="flex items-center justify-between gap-1 rounded-lg border border-leaf-100 px-3 py-3 text-center text-xs">
              {(item.product.producer.sellerType === 'PASAR'
                ? ([
                    { ikon: 'leaf', label: 'Produsen' },
                    { ikon: 'store', label: 'Kios' },
                    { ikon: 'truck', label: 'Kurir' },
                    { ikon: 'home', label: 'Anda' },
                  ] as const)
                : ([
                    { ikon: 'leaf', label: 'Produsen' },
                    { ikon: 'truck', label: 'Kurir' },
                    { ikon: 'home', label: 'Anda' },
                  ] as const)
              ).map((n, i, arr) => (
                <div key={n.label} className="flex flex-1 items-center gap-1">
                  <div className="flex-1">
                    <div className="flex justify-center text-leaf-600">
                      <Icon name={n.ikon} size={22} />
                    </div>
                    <div className="mt-1 text-ink/60">{n.label}</div>
                  </div>
                  {i < arr.length - 1 && <span className="text-leaf-300" aria-hidden="true">&rarr;</span>}
                </div>
              ))}
            </div>
            <p className="mt-1 text-xs text-ink/45">
              {item.product.producer.sellerType === 'PASAR'
                ? `Dijual di ${item.product.producer.kioskName ?? 'kios'}${
                    item.product.producer.market ? ` — ${item.product.producer.market.name}` : ''
                  }.`
                : 'Produk ini datang langsung dari produsen, tanpa perantara kios.'}
            </p>
          </div>

          <p className="rounded-lg bg-leaf-50 p-3 text-xs text-ink/60">
            {item.freshBasis === 'PANEN' ? 'Waktu panen' : 'Waktu transaksi'} dan metode budidaya
            bersumber dari laporan produsen saat mendaftarkan produk. Status sertifikasi diverifikasi
            manual oleh dinas terkait pada fase pilot. Strata di atas dibekukan saat transaksi, jadi
            tidak berubah meski data produsen berubah setelahnya. Lokasi ditampilkan hingga tingkat
            kecamatan untuk menjaga privasi produsen.
          </p>
        </Card>
      )}
    </main>
  );
}

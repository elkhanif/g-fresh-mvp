import Link from 'next/link';
import { prisma } from '@/lib/db';
import { isValidTraceCodeShape } from '@/lib/qr';
import { CertBadge } from '@/components/CertBadge';
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
          product: { include: { category: true, producer: true } },
          order: { select: { createdAt: true, status: true } },
        },
      })
    : null;

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
              <dt className="text-ink/60">Waktu panen (dilaporkan produsen)</dt>
              <dd className="text-right font-medium">{fmt(item.harvestedAt)}</dd>
            </div>
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

          <div>
            <CertBadge status={item.product.producer.certStatus} type={item.product.producer.certType} />
          </div>

          {item.producerLat != null && item.producerLng != null && (
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
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${item.producerLng - 0.02}%2C${item.producerLat - 0.015}%2C${item.producerLng + 0.02}%2C${item.producerLat + 0.015}&layer=mapnik&marker=${item.producerLat}%2C${item.producerLng}`}
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
              {([
                { ikon: 'leaf', label: 'Produsen' },
                { ikon: 'truck', label: 'Kurir' },
                { ikon: 'home', label: 'Anda' },
              ] as const).map((n, i, arr) => (
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
              Simpul kios pasar belum ditampilkan — produk ini datang langsung dari produsen.
            </p>
          </div>

          <p className="rounded-lg bg-leaf-50 p-3 text-xs text-ink/60">
            Waktu panen bersumber dari laporan produsen saat mendaftarkan produk. Status sertifikasi
            diverifikasi manual oleh dinas terkait pada fase pilot. Lokasi ditampilkan hingga tingkat
            kecamatan untuk menjaga privasi produsen.
          </p>
        </Card>
      )}
    </main>
  );
}

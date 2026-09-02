import Link from 'next/link';
import { prisma } from '@/lib/db';
import { isValidTraceCodeShape } from '@/lib/qr';
import { CertBadge } from '@/components/CertBadge';
import { Card } from '@/components/ui/Card';

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
      <h1 className="mt-4 text-xl font-semibold">Telusur Produk</h1>

      {!item ? (
        <Card className="mt-4">
          <p className="text-ink/70">
            Kode telusur tidak dikenali. Pastikan Anda memindai QR resmi G-Fresh pada kemasan.
          </p>
        </Card>
      ) : (
        <Card className="mt-4 space-y-4">
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

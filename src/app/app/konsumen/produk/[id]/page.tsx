import { notFound } from 'next/navigation';
import { Icon, categoryIcon } from '@/components/ui/Icon';
import { requireRole } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { getActiveHet } from '@/lib/het';
import { subsidyPercent } from '@/lib/rating';
import { getSessionUser } from '@/lib/rbac';
import { rupiah } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CertBadge } from '@/components/CertBadge';
import { StratumBadge } from '@/components/StratumBadge';
import { deriveStratum, certVerifiedOf, CULTIVATION_LABEL } from '@/lib/trace-stratum';
import { PerfBadge } from '@/components/PerfBadge';
import { AddToCart } from '@/components/forms/AddToCart';

export const dynamic = 'force-dynamic';

function fmt(d: Date) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(d);
}

export default async function ProductDetail({ params }: { params: { id: string } }) {
  await requireRole('KONSUMEN');
  const me = await getSessionUser();
  const account = me
    ? await prisma.user.findUnique({
        where: { id: me.id },
        select: { defaultAddress: true, business: true },
      })
    : null;
  const p = await prisma.product.findUnique({
    where: { id: params.id },
    include: { category: true, producer: true },
  });
  if (!p) notFound();
  const het = await getActiveHet(p.categoryId);
  const subsidi = subsidyPercent(p.producer.ratingScore);
  // Badge "panen segar" di poster: klaimnya dibatasi 24 jam supaya tidak
  // menempel selamanya pada produk lama.
  const segar = Date.now() - p.freshAt.getTime() < 24 * 60 * 60 * 1000;
  // Sebelum dibeli, strata dihitung live dari produk. Yang dibekukan hanyalah
  // strata di OrderItem saat checkout — halaman ini memang harus menampilkan
  // kondisi terkini, karena inilah yang akan didapat pembeli kalau memesan
  // sekarang.
  const stratum = deriveStratum({
    freshBasis: p.freshBasis,
    harvestLat: p.harvestLat,
    harvestLng: p.harvestLng,
    cultivationMethod: p.cultivationMethod,
    certVerified: certVerifiedOf(p.producer),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <div className="relative mb-4 aspect-[4/3] w-full overflow-hidden rounded-xl bg-leaf-50">
          {p.photoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={p.photoUrl} alt={p.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-leaf-300"><Icon name={categoryIcon(p.category.name)} size={72} /></div>
          )}
          {segar && (
            <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-leaf-700 shadow-xs">
              {/* Pedagang kios tidak memanen. Menempelkan "panen segar hari
                  ini" pada barang kulakan adalah klaim yang tidak dia buat. */}
              {p.freshBasis === 'PANEN' ? '✓ Panen segar hari ini' : '✓ Masuk kios hari ini'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge>{p.category.name}</Badge>
          <StratumBadge stratum={stratum} />
          <CertBadge status={p.producer.certStatus} type={p.producer.certType} />
        </div>
        <h1 className="mt-2 text-2xl font-semibold">{p.name}</h1>
        <p className="mt-1 text-2xl font-bold text-leaf-700">
          {rupiah(p.price)}<span className="text-base font-normal text-ink/50">/{p.unit}</span>
        </p>

        <Card className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-ink/60">Produsen</span><span className="font-medium">{p.producer.farmName}</span></div>
          <div className="flex justify-between"><span className="text-ink/60">Reputasi</span><PerfBadge rating={p.producer.ratingScore} /></div>
          <div className="flex justify-between"><span className="text-ink/60">Lokasi</span><span className="font-medium">Kec. {p.producer.kecamatan}</span></div>
          <div className="flex justify-between">
            <span className="text-ink/60">
              {p.freshBasis === 'PANEN' ? 'Panen (dilaporkan produsen)' : 'Masuk kios (dilaporkan penjual)'}
            </span>
            <span className="font-medium">{fmt(p.freshAt)}</span>
          </div>
          {p.cultivationMethod && (
            <div className="flex justify-between">
              <span className="text-ink/60">Metode budidaya</span>
              <span className="font-medium">{CULTIVATION_LABEL[p.cultivationMethod]}</span>
            </div>
          )}
          <div className="flex justify-between"><span className="text-ink/60">Stok</span><span className="font-medium">{p.stock} {p.unit}</span></div>
          {het && (
            <div className="flex justify-between"><span className="text-ink/60">HET kategori</span><span className="font-medium">{rupiah(het.maxPrice)}</span></div>
          )}
          {p.b2bPrice != null && p.b2bMinQty != null && (
            <div className="flex justify-between">
              <span className="text-ink/60">Harga grosir (B2B)</span>
              <span className="font-medium text-leaf-700">
                {rupiah(p.b2bPrice)} · min {p.b2bMinQty} {p.unit}
              </span>
            </div>
          )}
        </Card>
      </div>

      <div>
        <Card>
          <h2 className="mb-3 font-semibold">Pesan</h2>
          <AddToCart
            item={{
              productId: p.id,
              name: p.name,
              unit: p.unit,
              price: p.price,
              b2bPrice: p.b2bPrice,
              b2bMinQty: p.b2bMinQty,
              stock: p.stock,
              photoUrl: p.photoUrl,
              producerId: p.producerId,
              producerName: p.producer.farmName,
            }}
          />
          {subsidi > 0 && (
            <p className="mt-3 rounded-lg bg-leaf-50 px-3 py-2 text-xs text-leaf-800">
              Produsen berkinerja baik — Anda dapat subsidi ongkir {subsidi}% untuk pesanan ini.
            </p>
          )}
          <p className="mt-3 text-xs text-ink/50">
            Setelah bayar, dana ditahan sistem (escrow) dan baru diteruskan ke produsen setelah Anda
            menerima pesanan dan masa garansi 2 jam berlalu tanpa komplain.
          </p>
        </Card>
      </div>
    </div>
  );
}

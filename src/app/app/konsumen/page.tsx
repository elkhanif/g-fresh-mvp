import Link from 'next/link';
import { requireRole } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { rupiah } from '@/lib/utils';
import { SUSPEND_RATING } from '@/lib/rating';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CertBadge } from '@/components/CertBadge';
import { SearchFilter } from '@/components/forms/SearchFilter';
import { AddToCart } from '@/components/forms/AddToCart';
import { Icon, categoryIcon } from '@/components/ui/Icon';

// Label pendek untuk pintasan kategori. Lebar chip cuma ~72px, jadi nama
// panjang terpotong jadi "Daging.." yang terlihat seperti bug, bukan desain.
const LABEL_PENDEK: Record<string, string> = {
  'Daging Ayam': 'Ayam',
  'Olahan UMKM': 'Olahan',
};


export const dynamic = 'force-dynamic';

export default async function Marketplace({
  searchParams,
}: {
  searchParams: { q?: string; kategori?: string; mode?: string };
}) {
  await requireRole('KONSUMEN');
  const q = searchParams.q?.trim() || '';
  const kategori = searchParams.kategori || '';
  // Mode tampilan harga. Tidak mengubah apa pun saat checkout — kanal pesanan
  // tetap ditentukan di keranjang. Ini murni cara melihat katalog dari sudut
  // pandang pembeli grosir.
  const grosir = searchParams.mode === 'grosir';
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (kategori) p.set('kategori', kategori);
    if (grosir) p.set('mode', 'grosir');
    for (const [k, v] of Object.entries(extra)) v ? p.set(k, v) : p.delete(k);
    return p.toString() ? `?${p}` : '';
  };
  const categories = await prisma.category.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const pasar = await prisma.market.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, slug: true, name: true, kecamatan: true, _count: { select: { producers: true } } },
  });
  const products = await prisma.product.findMany({
    where: {
      active: true,
      stock: { gt: 0 },
      categoryId: kategori || undefined,
      name: q ? { contains: q, mode: 'insensitive' } : undefined,
      // Sanksi bertingkat: sembunyikan produk dari produsen yang ditangguhkan.
      producer: { ratingScore: { gte: SUSPEND_RATING } },
    },
    include: {
      category: true,
      producer: {
        select: {
          farmName: true, kecamatan: true, certStatus: true, certType: true,
          sellerType: true, kioskName: true,
          market: { select: { name: true, slug: true } },
        },
      },
    },
    orderBy: { harvestedAt: 'desc' },
    take: 60,
  });

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Belanja pangan segar</h1>
      <p className="mb-4 text-sm text-ink/60">Langsung dari produsen Gresik. Harga sudah di bawah HET.</p>

      <div className="mb-4 flex gap-2 rounded-xl bg-leaf-50 p-1">
        <Link
          href={`/app/konsumen${qs({ mode: '' })}`}
          className={
            'flex-1 rounded-lg px-3 py-1.5 text-center text-sm font-medium transition ' +
            (grosir ? 'text-ink/60' : 'bg-white text-leaf-800 shadow-sm')
          }
        >
          Eceran
        </Link>
        <Link
          href={`/app/konsumen${qs({ mode: 'grosir' })}`}
          className={
            'flex-1 rounded-lg px-3 py-1.5 text-center text-sm font-medium transition ' +
            (grosir ? 'bg-white text-leaf-800 shadow-sm' : 'text-ink/60')
          }
        >
          Grosir (B2B)
        </Link>
      </div>

      {grosir && (
        <p className="mb-4 rounded-xl bg-accent-50 px-4 py-2.5 text-xs text-ink/70">
          Harga grosir berlaku mulai kuantitas minimum tiap produk, dan pesanan B2B minimal
          Rp500.000. Kanal pesanan dipilih saat checkout di keranjang.
        </p>
      )}

      <div className="mb-4 flex items-center gap-3 rounded-xl bg-info-50 px-4 py-3">
        <span className="text-info-500"><Icon name="shield" size={26} /></span>
        <div>
          <p className="font-semibold text-info-600">Jaminan Harga HET</p>
          <p className="text-xs text-ink/60">
            Semua harga di sini tidak boleh melampaui batas yang ditetapkan Pemkab Gresik.
          </p>
        </div>
      </div>

      <div className="mb-4 flex gap-3 overflow-x-auto pb-1">
        <Link
          href={`/app/konsumen${qs({ kategori: '' })}`}
          className={
            'flex shrink-0 flex-col items-center gap-1 rounded-xl px-2.5 py-2 text-center text-xs ' +
            (kategori ? 'text-ink/60 hover:bg-leaf-50' : 'bg-leaf-50 font-medium text-leaf-800')
          }
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-leaf-100 text-leaf-700"><Icon name="basket" size={21} /></span>
          Semua
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/app/konsumen${qs({ kategori: c.id })}`}
            className={
              'flex shrink-0 flex-col items-center gap-1 rounded-xl px-2.5 py-2 text-center text-xs ' +
              (kategori === c.id ? 'bg-leaf-50 font-medium text-leaf-800' : 'text-ink/60 hover:bg-leaf-50')
            }
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-leaf-50 text-leaf-700"><Icon name={categoryIcon(c.name)} size={21} /></span>
            <span className="whitespace-nowrap">{LABEL_PENDEK[c.name] ?? c.name}</span>
          </Link>
        ))}
      </div>

      {pasar.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Pasar rakyat Gresik</p>
            <span className="text-xs text-ink/45">{pasar.length} pasar</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {pasar.map((m) => (
              <Link
                key={m.id}
                href={`/pasar/${m.slug}`}
                className="shrink-0 rounded-xl border border-leaf-100 px-3 py-2 hover:bg-leaf-50"
              >
                <p className="whitespace-nowrap text-sm font-medium">{m.name}</p>
                <p className="whitespace-nowrap text-xs text-ink/50">
                  Kec. {m.kecamatan} · {m._count.producers} kios
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <SearchFilter initialQ={q} initialCat={kategori} />

      {products.length === 0 ? (
        <Card><p className="text-ink/60">{q || kategori ? 'Tidak ada produk yang cocok dengan pencarian.' : 'Belum ada produk tersedia. Cek lagi nanti ya.'}</p></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Link key={p.id} href={`/app/konsumen/produk/${p.id}`}>
              <Card className="h-full overflow-hidden p-0 transition hover:border-leaf-300">
                <div className="aspect-[5/3] w-full overflow-hidden bg-leaf-50">
                  {p.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photoUrl} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-leaf-300">
                      <Icon name={categoryIcon(p.category.name)} size={44} />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <Badge>{p.category.name}</Badge>
                    <CertBadge status={p.producer.certStatus} type={p.producer.certType} />
                  </div>
                  <h3 className="mt-2 font-medium">{p.name}</h3>
                  <p className="text-lg font-semibold text-leaf-700">
                    {grosir && p.b2bPrice ? (
                      <>
                        {rupiah(p.b2bPrice)}
                        <span className="text-sm font-normal text-ink/50">/{p.unit}</span>
                        <span className="ml-2 align-middle text-xs font-normal text-ink/45 line-through">
                          {rupiah(p.price)}
                        </span>
                      </>
                    ) : (
                      <>
                        {rupiah(p.price)}
                        <span className="text-sm font-normal text-ink/50">/{p.unit}</span>
                      </>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-ink/50">
                    {p.producer.sellerType === 'PASAR' && p.producer.market
                      ? `${p.producer.kioskName ?? p.producer.farmName} · ${p.producer.market.name}`
                      : `${p.producer.farmName} · Kec. ${p.producer.kecamatan}`}
                  </p>
                  <div className="mt-3">
                    <AddToCart
                      compact
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
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

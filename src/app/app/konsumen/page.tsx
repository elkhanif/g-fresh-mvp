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


export const dynamic = 'force-dynamic';

export default async function Marketplace({
  searchParams,
}: {
  searchParams: { q?: string; kategori?: string };
}) {
  await requireRole('KONSUMEN');
  const q = searchParams.q?.trim() || '';
  const kategori = searchParams.kategori || '';
  const categories = await prisma.category.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
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
      producer: { select: { farmName: true, kecamatan: true, certStatus: true, certType: true } },
    },
    orderBy: { harvestedAt: 'desc' },
    take: 60,
  });

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Belanja pangan segar</h1>
      <p className="mb-4 text-sm text-ink/60">Langsung dari produsen Gresik. Harga sudah di bawah HET.</p>

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
          href="/app/konsumen"
          className={
            'flex w-16 shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-2 text-center text-xs ' +
            (kategori ? 'text-ink/60 hover:bg-leaf-50' : 'bg-leaf-50 font-medium text-leaf-800')
          }
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-leaf-100 text-leaf-700"><Icon name="basket" size={20} /></span>
          Semua
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/app/konsumen?kategori=${c.id}`}
            className={
              'flex w-16 shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-2 text-center text-xs ' +
              (kategori === c.id ? 'bg-leaf-50 font-medium text-leaf-800' : 'text-ink/60 hover:bg-leaf-50')
            }
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-leaf-50 text-leaf-700"><Icon name={categoryIcon(c.name)} size={20} /></span>
            <span className="line-clamp-1">{c.name}</span>
          </Link>
        ))}
      </div>

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
                    {rupiah(p.price)}<span className="text-sm font-normal text-ink/50">/{p.unit}</span>
                  </p>
                  <p className="mt-1 text-xs text-ink/50">
                    {p.producer.farmName} · Kec. {p.producer.kecamatan}
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

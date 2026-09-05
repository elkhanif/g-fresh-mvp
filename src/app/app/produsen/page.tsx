import { requireRole } from '@/lib/rbac';
import { Icon } from '@/components/ui/Icon';
import { prisma } from '@/lib/db';
import { getActiveHet } from '@/lib/het';
import { rupiah } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CertBadge } from '@/components/CertBadge';
import { PerfBadge } from '@/components/PerfBadge';
import { AddProductForm } from '@/components/forms/AddProductForm';
import { ProductActions } from '@/components/forms/ProductActions';

export const dynamic = 'force-dynamic';

export default async function ProdusenDashboard() {
  const user = await requireRole('PRODUSEN');
  const producer = await prisma.producerProfile.findUnique({
    where: { userId: user.id },
    include: { products: { include: { category: true }, orderBy: { createdAt: 'desc' } } },
  });
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });

  const hetByCat: Record<string, { max: number | null; floor: number | null }> = {};
  for (const c of categories) {
    const h = await getActiveHet(c.id);
    hetByCat[c.id] = { max: h?.maxPrice ?? null, floor: h?.floorPrice ?? null };
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,360px]">
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">Produk saya</h1>
          <div className="flex items-center gap-2">
            {producer && <PerfBadge rating={producer.ratingScore} />}
            {producer && <CertBadge status={producer.certStatus} type={producer.certType} />}
          </div>
        </div>

        {producer?.products.length ? (
          <div className="space-y-3">
            {producer.products.map((p) => {
              const het = hetByCat[p.categoryId]?.max ?? null;
              const floor = hetByCat[p.categoryId]?.floor ?? null;
              return (
                <Card key={p.id} className="flex items-start gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-leaf-50">
                    {p.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photoUrl} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-leaf-300"><Icon name="basket" size={22} /></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.name}</span>
                      <Badge>{p.category.name}</Badge>
                      {!p.active && <Badge tone="neutral">nonaktif</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-ink/60">
                      {rupiah(p.price)}/{p.unit} · stok {p.stock}
                      {p.stock === 0 && (
                        <span className="ml-2 text-red-600">· habis, tidak tampil di marketplace</span>
                      )}
                      {het != null && p.price >= het && (
                        <span className="ml-2 text-amber-700">· tepat di HET {rupiah(het)}</span>
                      )}
                    </p>
                    <ProductActions
                      product={{
                        id: p.id,
                        name: p.name,
                        unit: p.unit,
                        price: p.price,
                        stock: p.stock,
                        b2bPrice: p.b2bPrice,
                        b2bMinQty: p.b2bMinQty,
                        active: p.active,
                      }}
                      hetMax={het}
                      hetFloor={floor}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card><p className="text-ink/60">Belum ada produk. Tambahkan lewat formulir di samping.</p></Card>
        )}
      </section>

      <aside>
        <Card>
          <h2 className="mb-3 font-semibold">Tambah produk</h2>
          <AddProductForm categories={categories} />
          <p className="mt-3 text-xs text-ink/50">
            Harga otomatis ditolak bila melebihi HET yang ditetapkan Pemkab untuk kategori tersebut.
          </p>
        </Card>
      </aside>
    </div>
  );
}

import { requireRole } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { getActiveHet } from '@/lib/het';
import { rupiah } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CertBadge } from '@/components/CertBadge';
import { PerfBadge } from '@/components/PerfBadge';
import { AddProductForm } from '@/components/forms/AddProductForm';

export const dynamic = 'force-dynamic';

export default async function ProdusenDashboard() {
  const user = await requireRole('PRODUSEN');
  const producer = await prisma.producerProfile.findUnique({
    where: { userId: user.id },
    include: { products: { include: { category: true }, orderBy: { createdAt: 'desc' } } },
  });
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });

  const hetByCat: Record<string, number | null> = {};
  for (const c of categories) {
    const h = await getActiveHet(c.id);
    hetByCat[c.id] = h?.maxPrice ?? null;
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
              const het = hetByCat[p.categoryId];
              return (
                <Card key={p.id} className="flex items-center gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-leaf-50">
                    {p.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photoUrl} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xl text-leaf-200">🥬</div>
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
                      {het != null && p.price >= het && (
                        <span className="ml-2 text-amber-700">· tepat di HET {rupiah(het)}</span>
                      )}
                    </p>
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
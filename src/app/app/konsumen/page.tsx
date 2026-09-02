import Link from 'next/link';
import { requireRole } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { rupiah } from '@/lib/utils';
import { SUSPEND_RATING } from '@/lib/rating';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CertBadge } from '@/components/CertBadge';

export const dynamic = 'force-dynamic';

export default async function Marketplace() {
  await requireRole('KONSUMEN');
  const products = await prisma.product.findMany({
    where: {
      active: true,
      stock: { gt: 0 },
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

      {products.length === 0 ? (
        <Card><p className="text-ink/60">Belum ada produk tersedia. Cek lagi nanti ya.</p></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Link key={p.id} href={`/app/konsumen/produk/${p.id}`}>
              <Card className="h-full overflow-hidden p-0 transition hover:border-leaf-300">
                <div className="aspect-[4/3] w-full overflow-hidden bg-leaf-50">
                  {p.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photoUrl} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-3xl text-leaf-200">🥬</div>
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
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
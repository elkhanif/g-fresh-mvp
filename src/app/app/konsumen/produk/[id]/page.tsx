import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { getActiveHet } from '@/lib/het';
import { rupiah } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CertBadge } from '@/components/CertBadge';
import { ProductOrderForm } from '@/components/forms/ProductOrderForm';

export const dynamic = 'force-dynamic';

function fmt(d: Date) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(d);
}

export default async function ProductDetail({ params }: { params: { id: string } }) {
  await requireRole('KONSUMEN');
  const p = await prisma.product.findUnique({
    where: { id: params.id },
    include: { category: true, producer: true },
  });
  if (!p) notFound();
  const het = await getActiveHet(p.categoryId);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        {p.photoUrl && (
          <div className="mb-4 aspect-[4/3] w-full overflow-hidden rounded-xl bg-leaf-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.photoUrl} alt={p.name} className="h-full w-full object-cover" />
          </div>
        )}
        <div className="flex items-center gap-2">
          <Badge>{p.category.name}</Badge>
          <CertBadge status={p.producer.certStatus} type={p.producer.certType} />
        </div>
        <h1 className="mt-2 text-2xl font-semibold">{p.name}</h1>
        <p className="mt-1 text-2xl font-bold text-leaf-700">
          {rupiah(p.price)}<span className="text-base font-normal text-ink/50">/{p.unit}</span>
        </p>

        <Card className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-ink/60">Produsen</span><span className="font-medium">{p.producer.farmName}</span></div>
          <div className="flex justify-between"><span className="text-ink/60">Lokasi</span><span className="font-medium">Kec. {p.producer.kecamatan}</span></div>
          <div className="flex justify-between"><span className="text-ink/60">Panen (dilaporkan produsen)</span><span className="font-medium">{fmt(p.harvestedAt)}</span></div>
          <div className="flex justify-between"><span className="text-ink/60">Stok</span><span className="font-medium">{p.stock} {p.unit}</span></div>
          {het && (
            <div className="flex justify-between"><span className="text-ink/60">HET kategori</span><span className="font-medium">{rupiah(het.maxPrice)}</span></div>
          )}
        </Card>
      </div>

      <div>
        <Card>
          <h2 className="mb-3 font-semibold">Pesan</h2>
          <ProductOrderForm productId={p.id} price={p.price} unit={p.unit} maxStock={p.stock} />
          <p className="mt-3 text-xs text-ink/50">
            Setelah bayar, dana ditahan sistem (escrow) dan baru diteruskan ke produsen setelah Anda
            menerima pesanan dan masa garansi 2 jam berlalu tanpa komplain.
          </p>
        </Card>
      </div>
    </div>
  );
}
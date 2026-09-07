import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { rupiah } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CertBadge } from '@/components/CertBadge';
import { Icon, categoryIcon } from '@/components/ui/Icon';

export const dynamic = 'force-dynamic';

/**
 * Etalase satu pasar rakyat — halaman PUBLIK, tanpa login.
 *
 * Ini tujuan deep-link dari portal SIBAPO Diskoperindag: pengunjung yang
 * sedang mengecek harga di sana bisa langsung mendarat di katalog pasar yang
 * sama. Karena itu halaman ini sengaja tidak diletakkan di balik autentikasi;
 * tautan yang mengharuskan login duluan akan kehilangan sebagian besar
 * pengunjung sebelum mereka melihat apa pun.
 *
 * Membeli tetap butuh masuk — tombolnya mengarah ke halaman login.
 */
export default async function EtalasePasar({ params }: { params: { slug: string } }) {
  const market = await prisma.market.findUnique({
    where: { slug: params.slug },
    include: {
      producers: {
        select: { id: true, farmName: true, kioskName: true, certStatus: true, certType: true },
      },
    },
  });
  if (!market || !market.active) notFound();

  const products = await prisma.product.findMany({
    where: {
      active: true,
      stock: { gt: 0 },
      producer: { marketId: market.id },
    },
    include: {
      category: true,
      producer: { select: { farmName: true, kioskName: true, certStatus: true, certType: true } },
    },
    orderBy: { harvestedAt: 'desc' },
    take: 40,
  });

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <Link href="/" className="text-sm text-leaf-700 hover:underline">
        ← G-Fresh
      </Link>

      <h1 className="mt-3 text-2xl font-semibold">{market.name}</h1>
      <p className="text-sm text-ink/60">
        Kec. {market.kecamatan} · {market.address}
      </p>
      <p className="mt-1 text-sm text-ink/60">
        {market.producers.length} kios terdaftar · {products.length} produk tersedia hari ini
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/app/konsumen"
          className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600"
        >
          Belanja di G-Fresh
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-leaf-300 px-4 py-2 text-sm font-medium text-leaf-700 hover:bg-leaf-50"
        >
          Masuk
        </Link>
      </div>

      {products.length === 0 ? (
        <Card className="mt-6">
          <p className="text-ink/60">
            Belum ada produk yang tayang dari pasar ini hari ini. Coba lihat katalog lengkap
            G-Fresh.
          </p>
        </Card>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Card key={p.id} className="overflow-hidden p-0">
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
                <div className="flex items-start justify-between gap-2">
                  <Badge>{p.category.name}</Badge>
                  <CertBadge status={p.producer.certStatus} type={p.producer.certType} />
                </div>
                <p className="mt-2 font-medium">{p.name}</p>
                <p className="text-lg font-semibold text-leaf-700">
                  {rupiah(p.price)}
                  <span className="text-sm font-normal text-ink/50">/{p.unit}</span>
                </p>
                <p className="mt-1 text-xs text-ink/50">
                  {p.producer.kioskName ?? p.producer.farmName}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-ink/45">
        Daftar pasar mengikuti data pasar rakyat Kabupaten Gresik. Harga di halaman ini adalah harga
        tayang pedagang di G-Fresh, bukan hasil survei harga resmi.
      </p>
    </main>
  );
}

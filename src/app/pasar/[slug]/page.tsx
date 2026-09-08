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
        <div className="mt-6 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
          {products.map((p) => (
            <Card key={p.id} className="overflow-hidden p-0">
              <div className="relative aspect-[5/3] w-full overflow-hidden bg-leaf-50">
                {p.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photoUrl} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-leaf-300">
                    <Icon name={categoryIcon(p.category.name)} size={44} />
                  </div>
                )}
                <div className="absolute bottom-1.5 left-1.5 right-1.5">
                  <CertBadge status={p.producer.certStatus} type={p.producer.certType} compact />
                </div>
              </div>
              <div className="p-3 sm:p-4">
                <div>
                  <Badge>{p.category.name}</Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-medium sm:text-base">{p.name}</p>
                <p className="text-base font-semibold text-leaf-700 sm:text-lg">
                  {rupiah(p.price)}
                  <span className="text-sm font-normal text-ink/50">/{p.unit}</span>
                </p>
                <p className="mt-1 line-clamp-1 text-xs text-ink/50">
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

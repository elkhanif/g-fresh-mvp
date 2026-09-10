import { requireRole } from '@/lib/rbac';
import { Icon } from '@/components/ui/Icon';
import { prisma } from '@/lib/db';
import { getActiveHet } from '@/lib/het';
import { rupiah } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Stat, StatRow } from '@/components/ui/Stat';
import { Section } from '@/components/ui/Section';
import { EmptyState } from '@/components/ui/EmptyState';
import { CertBadge } from '@/components/CertBadge';
import { PerfBadge } from '@/components/PerfBadge';
import { AddProductSheet } from '@/components/forms/AddProductSheet';
import { certVerifiedOf } from '@/lib/trace-stratum';
import { ProductActions } from '@/components/forms/ProductActions';

export const dynamic = 'force-dynamic';

export default async function ProdusenDashboard() {
  const user = await requireRole('PRODUSEN');
  const producer = await prisma.producerProfile.findUnique({
    where: { userId: user.id },
    include: { products: { include: { category: true }, orderBy: { createdAt: 'desc' } } },
  });
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });

  // Ringkasan hari ini (poster panel 3: "Pesanan Masuk Hari Ini" + omzet).
  // Dihitung dari OrderItem milik produsen ini, bukan dari Order — satu order
  // bisa memuat barang beberapa penjual, jadi menghitung per order akan
  // melebih-lebihkan angka setiap penjual di dalamnya.
  const awalHari = new Date();
  awalHari.setHours(0, 0, 0, 0);
  const itemHariIni = producer
    ? await prisma.orderItem.findMany({
        where: {
          product: { producerId: producer.id },
          order: { createdAt: { gte: awalHari }, status: { not: 'DIBATALKAN' } },
        },
        select: { qty: true, unitPrice: true, orderId: true },
      })
    : [];
  const omzetHariIni = itemHariIni.reduce((a, i) => a + i.unitPrice * i.qty, 0);
  const pesananHariIni = new Set(itemHariIni.map((i) => i.orderId)).size;
  const stokHabis = producer?.products.filter((p) => p.stock < 1).length ?? 0;

  const hetByCat: Record<string, { max: number | null; floor: number | null }> = {};
  for (const c of categories) {
    const h = await getActiveHet(c.id);
    hetByCat[c.id] = { max: h?.maxPrice ?? null, floor: h?.floorPrice ?? null };
  }

  // Tanpa profil produsen, tidak ada satu pun bagian halaman ini yang punya
  // arti: daftar produk kosong bukan karena belum menambah, dan formulir
  // tambah produk akan gagal di server karena tidak ada pemiliknya. Berhenti
  // di sini dengan jalan keluar yang jelas, bukan menampilkan halaman kosong
  // yang terlihat seperti data hilang.
  if (!producer) {
    return (
      <EmptyState
        icon="store"
        title="Profil penjual belum terpasang"
        description="Akun ini belum punya profil penjual, jadi produk belum bisa ditambahkan. Coba keluar lalu masuk kembali; bila masih begini, hubungi admin."
      />
    );
  }

  const ctxProdusen = {
    sellerType: producer.sellerType,
    latitude: producer.latitude ?? null,
    longitude: producer.longitude ?? null,
    // Dihitung di server dengan fungsi yang sama seperti checkout, supaya
    // definisi "sertifikat sah" tidak bercabang.
    certVerified: certVerifiedOf(producer),
  };

  return (
    <div className="space-y-6">
      {/* Rating dan sertifikat itu keterangan tentang PENJUALNYA, bukan tentang
          daftar produk. Sebelumnya keduanya menempel di sebelah judul "Produk
          saya" di tengah halaman, jadi terbaca seolah melabeli produk. Di
          kepala halaman, sejajar nama usaha, keduanya melabeli hal yang benar. */}
      <PageHeader
        title="Beranda penjual"
        meta={[
          producer.farmName,
          `Kec. ${producer.kecamatan}`,
          producer.sellerType === 'PASAR' ? 'Pedagang pasar' : 'Petani / pembudidaya',
        ]}
        badges={
          <>
            <PerfBadge rating={producer.ratingScore} />
            <CertBadge status={producer.certStatus} type={producer.certType} />
          </>
        }
      />

      <StatRow>
        <Stat label="Pesanan hari ini" value={pesananHariIni} />
        <Stat label="Omzet hari ini" value={rupiah(omzetHariIni)} />
        <Stat
          label="Stok habis"
          value={stokHabis}
          tone={stokHabis > 0 ? 'warn' : 'default'}
          hint={stokHabis > 0 ? 'tidak tampil di pasar' : undefined}
        />
      </StatRow>

      <Section
        title="Produk saya"
        action={
          producer.products.length > 0 ? (
            <AddProductSheet categories={categories} producer={ctxProdusen} />
          ) : undefined
        }
      >
        {producer.products.length ? (
          <div className="space-y-3">
            {producer.products.map((p) => {
              const het = hetByCat[p.categoryId]?.max ?? null;
              const floor = hetByCat[p.categoryId]?.floor ?? null;
              const habis = p.stock < 1;
              const diBatasHet = het != null && p.price >= het;

              return (
                <Card key={p.id} className="flex items-start gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-leaf-50 sm:h-16 sm:w-16">
                    {p.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photoUrl} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-leaf-300">
                        <Icon name="basket" size={22} />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium">{p.name}</span>
                      <Badge>{p.category.name}</Badge>
                      {!p.active && <Badge tone="neutral">Nonaktif</Badge>}
                    </div>

                    {/* Harga dan stok adalah dua angka yang dibaca berulang kali
                        setiap hari, jadi keduanya diberi baris sendiri dengan
                        tabular-nums supaya sejajar antar baris produk. */}
                    <p className="mt-1 text-sm tabular-nums text-ink/70">
                      {rupiah(p.price)}/{p.unit}
                      <span className="mx-1.5 text-ink/25">|</span>
                      stok {p.stock}
                    </p>

                    {/* Dulu peringatan stok habis dan batas HET ditulis sebagai
                        lanjutan kalimat harga, dirangkai dengan titik-tengah dan
                        tiga warna teks dalam satu <p>. Peringatan yang menyamar
                        jadi kalimat biasa akan terlewat; sebagai label ia
                        terbaca sekali lihat. */}
                    {(habis || diBatasHet) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {habis && <Badge tone="red">Stok habis</Badge>}
                        {diBatasHet && <Badge tone="amber">Di batas HET {rupiah(het!)}</Badge>}
                      </div>
                    )}
                    {habis && (
                      <p className="mt-1 text-xs text-ink/50">
                        Produk tidak tampil di pasar sampai stoknya diisi.
                      </p>
                    )}

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
          <EmptyState
            icon="box"
            title="Belum ada produk"
            description="Tambahkan produk pertama supaya barang Anda muncul di pasar dan bisa dipesan."
            action={
              <AddProductSheet
                categories={categories}
                producer={ctxProdusen}
                label="Tambah produk pertama"
              />
            }
          />
        )}
      </Section>
    </div>
  );
}

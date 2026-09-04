import Link from 'next/link';
import { prisma } from '@/lib/db';
import { rupiah } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

export const dynamic = 'force-dynamic';

export default async function Landing() {
  // Transparansi HET hari ini — data publik, tanpa login.
  const cats = await prisma.category.findMany({ orderBy: { name: 'asc' } }).catch(() => []);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const hetRows = [];
  for (const c of cats) {
    const het = await prisma.hetPrice.findFirst({
      where: { categoryId: c.id, effectiveOn: { lte: today } },
      orderBy: { effectiveOn: 'desc' },
    });
    hetRows.push({ name: c.name, unit: c.unit, max: het?.maxPrice ?? null });
  }

  return (
    <main className="mx-auto max-w-5xl px-5">
      <header className="flex items-center justify-between py-5">
        <span className="text-lg font-bold text-leaf-700">G-Fresh</span>
        <nav className="flex gap-2">
          <Link href="/login">
            <Button variant="ghost">Masuk</Button>
          </Link>
          <Link href="/register">
            <Button>Daftar</Button>
          </Link>
        </nav>
      </header>

      <section className="py-10">
        <p className="text-sm font-medium uppercase tracking-wide text-clay-600">
          Pasar pangan segar hyperlocal · Kabupaten Gresik
        </p>
        <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-tight text-ink">
          Dari lahan &amp; tambak Gresik, sampai dapur Anda di hari yang sama.
        </h1>
        <p className="mt-4 max-w-xl text-ink/70">
          Beli langsung dari produsen tanpa tengkulak. Setiap produk membawa kode telusur QR
          berisi waktu panen dan asal produksi, dengan garansi kesegaran 2 jam yang dilindungi
          sistem penahanan dana (escrow).
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/register">
            <Button className="px-6 py-3 text-base">Mulai belanja</Button>
          </Link>
          <Link href="/register">
            <Button variant="outline" className="px-6 py-3 text-base">
              Jual hasil panen
            </Button>
          </Link>
        </div>
      </section>

      <section className="grid gap-4 py-6 sm:grid-cols-3">
        {[
          ['Telusur QR', 'Waktu panen & lokasi produksi dicatat per pesanan, dapat diperiksa siapa pun.'],
          ['Harga wajar', 'HET harian dari Pemkab jadi batas atas otomatis. Komisi 0% untuk produsen.'],
          ['Garansi kesegaran', 'Dana ditahan 2 jam setelah tiba; tidak sesuai bisa diklaim dengan bukti.'],
        ].map(([t, d]) => (
          <div key={t} className="rounded-xl border border-leaf-100 bg-white p-4">
            <h3 className="font-semibold text-leaf-700">{t}</h3>
            <p className="mt-1 text-sm text-ink/70">{d}</p>
          </div>
        ))}
      </section>

      {hetRows.length > 0 && (
        <section className="py-6">
          <h2 className="text-lg font-semibold">Harga Eceran Tertinggi hari ini</h2>
          <p className="text-sm text-ink/60">Ditetapkan Pemerintah Kabupaten Gresik. Transparan untuk umum.</p>
          <div className="mt-3 overflow-hidden rounded-xl border border-leaf-100 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-leaf-50 text-left text-ink/70">
                <tr>
                  <th className="px-4 py-2">Kategori</th>
                  <th className="px-4 py-2">Satuan</th>
                  <th className="px-4 py-2">HET</th>
                </tr>
              </thead>
              <tbody>
                {hetRows.map((r) => (
                  <tr key={r.name} className="border-t border-leaf-50">
                    <td className="px-4 py-2">{r.name}</td>
                    <td className="px-4 py-2">/{r.unit}</td>
                    <td className="px-4 py-2 font-medium">
                      {r.max != null ? rupiah(r.max) : <span className="text-ink/40">belum diatur</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <footer className="border-t border-leaf-100 py-8 text-sm text-ink/50">
        G-Fresh · Prototipe MVP untuk Gresik Inovasi Kompetisi 2026. Kemitraan operator swasta ×
        Pemerintah Kabupaten Gresik.
      </footer>
    </main>
  );
}

import Link from 'next/link';
import { requireRole } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { rupiah } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LineChart } from '@/components/charts/LineChart';
import {
  buildCategorySeries,
  buildCategorySummaries,
  detectLonjakan,
  recentPriceChanges,
} from '@/lib/price-monitor';

export const dynamic = 'force-dynamic';

const PERIODE = [7, 30, 90];

function pctText(v: number | null) {
  if (v == null) return '—';
  const s = v >= 0 ? '+' : '';
  return `${s}${v.toFixed(1)}%`;
}

function fmtWaktu(d: Date) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(d);
}

export default async function PantauanHarga({
  searchParams,
}: {
  searchParams: { kat?: string; hari?: string };
}) {
  await requireRole('PEMKAB');

  const hari = PERIODE.includes(Number(searchParams.hari)) ? Number(searchParams.hari) : 30;

  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  if (categories.length === 0) {
    return <Card><p className="text-ink/60">Belum ada kategori.</p></Card>;
  }

  const katId = categories.find((c) => c.id === searchParams.kat)?.id ?? categories[0].id;
  const kat = categories.find((c) => c.id === katId)!;

  const [summaries, series, lonjakan, perubahan] = await Promise.all([
    buildCategorySummaries(hari),
    buildCategorySeries(katId, hari),
    detectLonjakan(hari),
    recentPriceChanges(hari),
  ]);

  const adaPelanggaran = summaries.some((s) => s.lewatHet > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Pantauan harga pangan</h1>
          <p className="text-sm text-ink/60">
            Pergerakan harga tayang di marketplace terhadap HET yang Anda tetapkan.
          </p>
        </div>
        <div className="flex gap-2">
          {PERIODE.map((d) => (
            <Link
              key={d}
              href={`/app/pemkab/harga?kat=${katId}&hari=${d}`}
              className={`rounded-lg border px-3 py-1 text-xs ${
                d === hari
                  ? 'border-leaf-600 bg-leaf-600 text-white'
                  : 'border-leaf-200 hover:bg-leaf-50'
              }`}
            >
              {d} hari
            </Link>
          ))}
        </div>
      </div>

      {adaPelanggaran && (
        <Card className="border-red-200 bg-red-50">
          <p className="text-sm text-red-700">
            Ada produk yang tayang di atas HET. Ini seharusnya tidak mungkin lewat form produsen —
            periksa apakah HET baru saja diturunkan setelah produk terlanjur tayang.
          </p>
        </Card>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Ringkasan per kategori</h2>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-leaf-50 text-left text-ink/70">
              <tr>
                <th className="px-4 py-2">Kategori</th>
                <th className="px-4 py-2">Harga rata-rata</th>
                <th className="px-4 py-2">HET</th>
                <th className="px-4 py-2">Terhadap HET</th>
                <th className="px-4 py-2">Tren {hari} hari</th>
                <th className="px-4 py-2">Produk</th>
                <th className="px-4 py-2">Mepet HET</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr
                  key={s.categoryId}
                  className={`border-t border-leaf-50 ${s.categoryId === katId ? 'bg-leaf-50/50' : ''}`}
                >
                  <td className="px-4 py-2">
                    <Link
                      href={`/app/pemkab/harga?kat=${s.categoryId}&hari=${hari}`}
                      className="font-medium hover:underline"
                    >
                      {s.name}
                    </Link>
                    <span className="text-ink/40"> /{s.unit}</span>
                  </td>
                  <td className="px-4 py-2 font-medium">
                    {s.avgNow != null ? rupiah(s.avgNow) : <span className="text-ink/40">—</span>}
                  </td>
                  <td className="px-4 py-2">
                    {s.hetMax ? rupiah(s.hetMax) : <span className="text-ink/40">belum diatur</span>}
                  </td>
                  <td className="px-4 py-2">
                    {s.pctOfHet == null ? (
                      <span className="text-ink/40">—</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-leaf-50">
                          <div
                            className={
                              s.pctOfHet >= 95 ? 'h-full bg-amber-400' : 'h-full bg-leaf-500'
                            }
                            style={{ width: `${Math.min(100, Math.max(3, s.pctOfHet))}%` }}
                          />
                        </div>
                        <span className={s.pctOfHet >= 95 ? 'text-amber-700' : 'text-ink/60'}>
                          {s.pctOfHet.toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {s.trendPct == null ? (
                      <span className="text-ink/40">—</span>
                    ) : (
                      <span
                        className={
                          s.trendPct > 5
                            ? 'text-amber-700'
                            : s.trendPct < -5
                              ? 'text-leaf-700'
                              : 'text-ink/60'
                        }
                      >
                        {pctText(s.trendPct)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">{s.produkCount}</td>
                  <td className="px-4 py-2">
                    {s.lewatHet > 0 ? (
                      <Badge tone="red">{s.lewatHet} lewat HET</Badge>
                    ) : s.mepetHet > 0 ? (
                      <Badge tone="amber">{s.mepetHet} produk</Badge>
                    ) : (
                      <span className="text-ink/40">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Pergerakan harga — {kat.name}</h2>
        <p className="mb-3 text-sm text-ink/60">
          Rata-rata harga tayang seluruh produk kategori ini, direkonstruksi dari riwayat perubahan
          harga produsen.
        </p>
        <Card>
          <LineChart
            labels={series.map((p) => p.label)}
            series={[
              {
                label: `Rata-rata harga ${kat.name}`,
                color: '#2E7D32', // leaf-600
                values: series.map((p) => p.avg),
              },
              {
                label: 'HET (batas atas)',
                color: '#FF8F00', // accent-500
                dashed: true,
                values: series.map((p) => p.hetMax),
              },
              {
                label: 'Harga dasar',
                color: '#1565C0', // info-500
                dashed: true,
                values: series.map((p) => p.hetFloor),
              },
            ]}
          />
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-1 text-lg font-semibold">Kenaikan mendadak</h2>
          <p className="mb-3 text-sm text-ink/60">
            Perubahan harga naik ≥15% dalam {hari} hari terakhir. Ini daftar yang layak ditanyakan,
            bukan tuduhan — kenaikan bisa saja wajar.
          </p>
          <Card>
            {lonjakan.length === 0 ? (
              <p className="text-sm text-ink/60">Tidak ada kenaikan mendadak pada periode ini.</p>
            ) : (
              <ul className="space-y-3">
                {lonjakan.map((l) => (
                  <li key={l.id} className="border-b border-leaf-50 pb-2 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{l.productName}</span>
                      <Badge tone="amber">+{l.pct.toFixed(0)}%</Badge>
                    </div>
                    <p className="text-xs text-ink/60">
                      {l.farmName} · {l.categoryName} · {rupiah(l.oldPrice)} → {rupiah(l.newPrice)}
                    </p>
                    <p className="text-xs text-ink/50">
                      {fmtWaktu(l.createdAt)}
                      {l.note ? ` · ${l.note}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <section>
          <h2 className="mb-1 text-lg font-semibold">Perubahan harga terbaru</h2>
          <p className="mb-3 text-sm text-ink/60">
            Seluruh perubahan lintas kategori dalam {hari} hari terakhir.
          </p>
          <Card className="overflow-hidden p-0">
            {perubahan.length === 0 ? (
              <p className="p-4 text-sm text-ink/60">Belum ada perubahan harga tercatat.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-leaf-50 text-left text-ink/70">
                  <tr>
                    <th className="px-4 py-2">Produk</th>
                    <th className="px-4 py-2">Perubahan</th>
                    <th className="px-4 py-2">Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {perubahan.map((r: any) => {
                    const naik = r.newPrice > r.oldPrice;
                    return (
                      <tr key={r.id} className="border-t border-leaf-50 align-top">
                        <td className="px-4 py-2">
                          <div className="font-medium">{r.product.name}</div>
                          <div className="text-xs text-ink/50">{r.product.producer.farmName}</div>
                        </td>
                        <td className="px-4 py-2">
                          <span className={naik ? 'text-amber-700' : 'text-leaf-700'}>
                            {rupiah(r.oldPrice)} → {rupiah(r.newPrice)}
                          </span>
                          {r.hetMaxAt && (
                            <div className="text-xs text-ink/50">HET saat itu {rupiah(r.hetMaxAt)}</div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs text-ink/60">{fmtWaktu(r.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </section>
      </div>

      <p className="text-xs text-ink/50">
        Angka di halaman ini berasal dari harga tayang di marketplace G-Fresh, bukan survei pasar
        tradisional. Cakupannya sebatas produsen yang sudah bergabung.
      </p>
    </div>
  );
}

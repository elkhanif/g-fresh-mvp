import { prisma } from './db';

/**
 * Lapisan data untuk pemantauan harga Pemkab.
 *
 * Sumbernya `PriceHistory` (dibuat di batch #13) + `HetPrice`. Tidak ada tabel
 * baru: harga historis DIREKONSTRUKSI, bukan disimpan ulang per hari.
 *
 * Cara rekonstruksinya: harga sebuah produk pada waktu T adalah `oldPrice`
 * dari perubahan PERTAMA yang terjadi SETELAH T; kalau tidak ada perubahan
 * setelah T, berarti harga sekarang. Konsekuensinya jujur — produk yang
 * harganya tidak pernah diubah akan terlihat datar sejak awal, dan periode
 * sebelum batch #13 tidak punya data perubahan sama sekali.
 */

const DAY = 86_400_000;

export type DayPoint = {
  date: Date;
  label: string;
  avg: number | null; // rata-rata harga tayang produk aktif di kategori itu
  hetMax: number | null;
  hetFloor: number | null;
  count: number;
};

export type CategorySummary = {
  categoryId: string;
  name: string;
  unit: string;
  produkCount: number;
  avgNow: number | null;
  avgThen: number | null;
  trendPct: number | null; // + naik, - turun
  hetMax: number | null;
  hetFloor: number | null;
  pctOfHet: number | null; // rata-rata harga terhadap HET
  mepetHet: number; // jumlah produk >= 95% HET
  lewatHet: number; // jumlah produk di atas HET (seharusnya 0)
};

export type Lonjakan = {
  id: string;
  productName: string;
  categoryName: string;
  farmName: string;
  oldPrice: number;
  newPrice: number;
  pct: number;
  note: string | null;
  createdAt: Date;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function labelOf(d: Date) {
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' }).format(d);
}

type ChangeRow = { productId: string; oldPrice: number; createdAt: Date };

// Harga produk pada akhir hari tertentu, direkonstruksi dari daftar perubahan
// yang sudah terurut menaik.
function priceAt(currentPrice: number, changes: ChangeRow[], at: Date): number {
  for (const c of changes) {
    if (c.createdAt.getTime() > at.getTime()) return c.oldPrice;
  }
  return currentPrice;
}

function hetAt(hets: Array<{ effectiveOn: Date; maxPrice: number; floorPrice: number | null }>, at: Date) {
  let cur: { maxPrice: number; floorPrice: number | null } | null = null;
  for (const h of hets) {
    if (h.effectiveOn.getTime() <= at.getTime()) cur = { maxPrice: h.maxPrice, floorPrice: h.floorPrice };
    else break;
  }
  return cur;
}

/** Deret harian rata-rata harga tayang satu kategori + garis HET-nya. */
export async function buildCategorySeries(categoryId: string, days: number): Promise<DayPoint[]> {
  const since = new Date(Date.now() - days * DAY);

  const [products, changes, hets] = await Promise.all([
    prisma.product.findMany({
      where: { categoryId },
      select: { id: true, price: true, createdAt: true },
    }),
    prisma.priceHistory.findMany({
      where: { product: { categoryId } },
      orderBy: { createdAt: 'asc' },
      select: { productId: true, oldPrice: true, createdAt: true },
    }),
    prisma.hetPrice.findMany({
      where: { categoryId },
      orderBy: { effectiveOn: 'asc' },
      select: { effectiveOn: true, maxPrice: true, floorPrice: true },
    }),
  ]);

  const byProduct = new Map<string, ChangeRow[]>();
  for (const c of changes) {
    const arr = byProduct.get(c.productId) ?? [];
    arr.push(c);
    byProduct.set(c.productId, arr);
  }

  const points: DayPoint[] = [];
  for (let i = days; i >= 0; i--) {
    const day = startOfDay(new Date(Date.now() - i * DAY));
    const cutoff = new Date(day.getTime() + DAY - 1);

    let sum = 0;
    let n = 0;
    for (const p of products) {
      // Produk yang belum ada pada hari itu tidak boleh ikut menarik rata-rata.
      if (p.createdAt.getTime() > cutoff.getTime()) continue;
      sum += priceAt(p.price, byProduct.get(p.id) ?? [], cutoff);
      n += 1;
    }
    const het = hetAt(hets, cutoff);
    points.push({
      date: day,
      label: labelOf(day),
      avg: n > 0 ? Math.round(sum / n) : null,
      hetMax: het?.maxPrice ?? null,
      hetFloor: het?.floorPrice ?? null,
      count: n,
    });
  }
  return points;
}

/** Ringkasan semua kategori untuk tabel pantauan. */
export async function buildCategorySummaries(days: number): Promise<CategorySummary[]> {
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  const out: CategorySummary[] = [];

  for (const c of categories) {
    const series = await buildCategorySeries(c.id, days);
    const now = series[series.length - 1];
    const then = series[0];

    const produk = await prisma.product.findMany({
      where: { categoryId: c.id, active: true },
      select: { price: true },
    });

    const hetMax = now?.hetMax ?? null;
    const mepet = hetMax ? produk.filter((p) => p.price >= hetMax * 0.95 && p.price <= hetMax).length : 0;
    const lewat = hetMax ? produk.filter((p) => p.price > hetMax).length : 0;

    out.push({
      categoryId: c.id,
      name: c.name,
      unit: c.unit,
      produkCount: produk.length,
      avgNow: now?.avg ?? null,
      avgThen: then?.avg ?? null,
      trendPct:
        now?.avg != null && then?.avg != null && then.avg > 0
          ? ((now.avg - then.avg) / then.avg) * 100
          : null,
      hetMax,
      hetFloor: now?.hetFloor ?? null,
      pctOfHet: now?.avg != null && hetMax ? (now.avg / hetMax) * 100 : null,
      mepetHet: mepet,
      lewatHet: lewat,
    });
  }
  return out;
}

/**
 * Kenaikan harga mendadak. Ambang default 15% dalam satu perubahan.
 *
 * Ini indikator untuk DITINDAKLANJUTI manual, bukan vonis. Kenaikan bisa saja
 * wajar (gagal panen, biaya pakan naik) — yang berguna buat dinas adalah
 * daftar pendek yang layak ditanyakan, bukan tuduhan otomatis.
 */
export async function detectLonjakan(days: number, minPct = 15): Promise<Lonjakan[]> {
  const since = new Date(Date.now() - days * DAY);
  const rows = await prisma.priceHistory.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      product: {
        select: { name: true, category: { select: { name: true } }, producer: { select: { farmName: true } } },
      },
    },
  });

  return rows
    .map((r: any) => ({
      id: r.id,
      productName: r.product.name,
      categoryName: r.product.category.name,
      farmName: r.product.producer.farmName,
      oldPrice: r.oldPrice,
      newPrice: r.newPrice,
      pct: r.oldPrice > 0 ? ((r.newPrice - r.oldPrice) / r.oldPrice) * 100 : 0,
      note: r.note,
      createdAt: r.createdAt,
    }))
    .filter((r: Lonjakan) => r.pct >= minPct)
    .sort((a: Lonjakan, b: Lonjakan) => b.pct - a.pct)
    .slice(0, 12);
}

/** Perubahan harga terbaru lintas kategori, untuk tabel riwayat. */
export async function recentPriceChanges(days: number, take = 25) {
  const since = new Date(Date.now() - days * DAY);
  return prisma.priceHistory.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      product: {
        select: { name: true, unit: true, category: { select: { name: true } }, producer: { select: { farmName: true } } },
      },
    },
  });
}

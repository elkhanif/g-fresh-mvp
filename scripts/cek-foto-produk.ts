/**
 * Laporan foto produk: mana yang sudah ada, mana yang masih placeholder.
 *
 *   npx tsx scripts/cek-foto-produk.ts
 *
 * Membaca daftar produk dari DATABASE (bukan dari seed), jadi produk yang
 * ditambahkan produsen lewat aplikasi ikut terperiksa. Tidak menulis apa pun.
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const DIR = path.join(process.cwd(), 'public', 'img', 'produk');
const EXT = ['.jpg', '.jpeg', '.png', '.webp'];

const slug = (n: string) =>
  n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function main() {
  const products = await prisma.product.findMany({
    select: { name: true, category: { select: { name: true } } },
    orderBy: [{ category: { name: 'asc' } }, { name: 'asc' } ],
  });

  const perKategori = new Map<string, { name: string; slug: string; ada: string | null }[]>();
  for (const p of products) {
    const s = slug(p.name);
    const ada = EXT.map((e) => s + e).find((f) => fs.existsSync(path.join(DIR, f))) ?? null;
    const k = p.category.name;
    if (!perKategori.has(k)) perKategori.set(k, []);
    perKategori.get(k)!.push({ name: p.name, slug: s, ada });
  }

  let punya = 0;
  for (const [kategori, rows] of perKategori) {
    const n = rows.filter((r) => r.ada).length;
    punya += n;
    console.log(`\n${kategori} — ${n}/${rows.length}`);
    for (const r of rows) {
      console.log(r.ada ? `  ✓ ${r.ada}` : `  · ${r.slug}.jpg  (belum ada, pakai placeholder)`);
    }
  }
  console.log(`\nTotal: ${punya}/${products.length} produk berfoto.`);

  // Berkas yang ada tapi tidak dipakai produk mana pun — biasanya salah nama.
  if (fs.existsSync(DIR)) {
    const dipakai = new Set(
      [...perKategori.values()].flat().map((r) => r.ada).filter(Boolean) as string[],
    );
    const nganggur = fs.readdirSync(DIR)
      .filter((f) => EXT.includes(path.extname(f).toLowerCase()) && !dipakai.has(f));
    if (nganggur.length) {
      console.log('\n⚠ Ada tapi tidak cocok nama produk mana pun (cek ejaan slug-nya):');
      for (const f of nganggur) console.log(`  ${f}`);
    }
  }
}

main().finally(() => prisma.$disconnect());

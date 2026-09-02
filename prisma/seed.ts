import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const pass = await bcrypt.hash('password123', 10);

  // --- Kategori ---
  const cats = await Promise.all(
    [
      { name: 'Sayur', unit: 'ikat' },
      { name: 'Ikan', unit: 'kg' },
      { name: 'Daging Ayam', unit: 'kg' },
      { name: 'Beras', unit: 'kg' },
      { name: 'Buah', unit: 'kg' },
    ].map((c) =>
      prisma.category.upsert({ where: { name: c.name }, update: {}, create: c }),
    ),
  );
  const catByName = Object.fromEntries(cats.map((c) => [c.name, c]));

  // --- Pemkab (penetap HET & verifikator) ---
  const pemkab = await prisma.user.upsert({
    where: { email: 'pemkab@gresih.go.id' },
    update: {},
    create: {
      name: 'Dinas Ketahanan Pangan',
      email: 'pemkab@gresih.go.id',
      phone: '0318000001',
      passwordHash: pass,
      role: 'PEMKAB',
      kecamatan: 'Gresik',
    },
  });

  // --- Admin operator ---
  await prisma.user.upsert({
    where: { email: 'admin@gfresh.id' },
    update: {},
    create: {
      name: 'Operator G-Fresh',
      email: 'admin@gfresh.id',
      phone: '0318000002',
      passwordHash: pass,
      role: 'ADMIN',
      kecamatan: 'Kebomas',
    },
  });

  // --- HET hari ini ---
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const hetData: Record<string, { max: number; floor?: number }> = {
    Sayur: { max: 8000, floor: 2000 },
    Ikan: { max: 45000, floor: 20000 },
    'Daging Ayam': { max: 40000, floor: 28000 },
    Beras: { max: 15000, floor: 10000 },
    Buah: { max: 30000 },
  };
  for (const [name, v] of Object.entries(hetData)) {
    await prisma.hetPrice.upsert({
      where: { categoryId_effectiveOn: { categoryId: catByName[name].id, effectiveOn: today } },
      update: { maxPrice: v.max, floorPrice: v.floor },
      create: {
        categoryId: catByName[name].id,
        maxPrice: v.max,
        floorPrice: v.floor,
        effectiveOn: today,
        setById: pemkab.id,
      },
    });
  }

  // --- Produsen + produk ---
  const tani = await prisma.user.upsert({
    where: { email: 'tani@gfresh.id' },
    update: {},
    create: {
      name: 'Pak Slamet',
      email: 'tani@gfresh.id',
      phone: '0812000001',
      passwordHash: pass,
      role: 'PRODUSEN',
      kecamatan: 'Cerme',
      producer: {
        create: {
          farmName: 'Kelompok Tani Cerme Makmur',
          kecamatan: 'Cerme',
          latitude: -7.1725,
          longitude: 112.5891,
          certStatus: 'TERVERIFIKASI',
          certType: 'P-IRT',
        },
      },
    },
    include: { producer: true },
  });

  const tambak = await prisma.user.upsert({
    where: { email: 'tambak@gfresh.id' },
    update: {},
    create: {
      name: 'Bu Aminah',
      email: 'tambak@gfresh.id',
      phone: '0812000002',
      passwordHash: pass,
      role: 'PRODUSEN',
      kecamatan: 'Manyar',
      producer: {
        create: {
          farmName: 'Tambak Bandeng Manyar',
          kecamatan: 'Manyar',
          latitude: -7.1256,
          longitude: 112.6339,
          certStatus: 'MENUNGGU_VERIFIKASI',
        },
      },
    },
    include: { producer: true },
  });

  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);

  await prisma.product.createMany({
    data: [
      { producerId: tani.producer!.id, categoryId: catByName['Sayur'].id, name: 'Bayam Segar', unit: 'ikat', price: 5000, stock: 40, harvestedAt: hoursAgo(6) },
      { producerId: tani.producer!.id, categoryId: catByName['Sayur'].id, name: 'Kangkung', unit: 'ikat', price: 4500, stock: 35, harvestedAt: hoursAgo(6) },
      { producerId: tani.producer!.id, categoryId: catByName['Beras'].id, name: 'Beras Merah Lokal', unit: 'kg', price: 14000, stock: 100, harvestedAt: hoursAgo(72) },
      { producerId: tambak.producer!.id, categoryId: catByName['Ikan'].id, name: 'Bandeng Segar', unit: 'kg', price: 38000, stock: 25, harvestedAt: hoursAgo(3) },
    ],
  });

  // --- Konsumen & kurir demo ---
  await prisma.user.upsert({
    where: { email: 'konsumen@gfresh.id' },
    update: {},
    create: {
      name: 'Rina', email: 'konsumen@gfresh.id', phone: '0813000001',
      passwordHash: pass, role: 'KONSUMEN', kecamatan: 'Kebomas',
    },
  });

  await prisma.user.upsert({
    where: { email: 'kurir@gfresh.id' },
    update: {},
    create: {
      name: 'Budi Kurir', email: 'kurir@gfresh.id', phone: '0814000001',
      passwordHash: pass, role: 'KURIR', kecamatan: 'Kebomas',
      courier: { create: { kecamatan: 'Kebomas', vehicle: 'Motor + cool-box', ktpVerified: true } },
    },
  });

  console.log('Seed selesai. Semua akun demo memakai kata sandi: password123');
  console.log('  pemkab@gresih.go.id · admin@gfresh.id · tani@gfresh.id · tambak@gfresh.id · konsumen@gfresh.id · kurir@gfresh.id');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

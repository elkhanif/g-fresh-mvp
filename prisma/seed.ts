/**
 * Seed data demo G-Fresh.
 *
 * Idempoten: aman dijalankan berulang (memakai upsert + pembersihan data
 * transaksi demo di awal). Menghasilkan ekosistem yang cukup "hidup" untuk
 * demonstrasi: banyak produsen, kurir, konsumen, riwayat pesanan, rating
 * yang sudah bergerak, komplain terbuka, serta satu pembeli B2B.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// --- Muat .env secara manual (tsx tidak memuatnya otomatis) -------------
// Penting agar TRACE_SECRET yang dipakai seed SAMA dengan yang dipakai
// aplikasi; kalau berbeda, kode QR hasil seed tidak akan lolos verifikasi.
(function loadEnv() {
  for (const f of ['.env', '.env.local']) {
    const p = path.join(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
})();

const prisma = new PrismaClient();

// --- Util --------------------------------------------------------------
const SECRET = process.env.TRACE_SECRET || 'dev-trace-secret-change-me';

/** Meniru makeTraceCode() di src/lib/qr.ts agar kode telusur valid. */
function traceCode(): string {
  const rand = crypto.randomBytes(10).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(rand).digest('base64url').slice(0, 11);
  return `${rand}.${sig}`;
}

/** Meniru computeRating() di src/lib/rating.ts. */
function computeRating(good: number, bad: number): number {
  const ge = good + 6;
  const be = bad * 4;
  const rating = 1 + 4 * (ge / (ge + be));
  return Math.round(Math.min(5, Math.max(1, rating)) * 10) / 10;
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);
const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];

function ongkir(km: number) {
  return Math.round((6000 + Math.ceil(km) * 2000) / 500) * 500;
}

/**
 * Upsert akun "sistem" (Pemkab/Admin) yang tahan terhadap perubahan email
 * (mis. typo domain yang dibetulkan di seed versi berikutnya). Mencocokkan
 * berdasarkan EMAIL ATAU NOMOR HP — bukan email saja — supaya baris lama
 * dengan email berbeda tapi HP sama tidak menabrak unique constraint saat
 * baris baru dibuat.
 */
async function upsertSystemUser(data: {
  email: string; phone: string; name: string; role: 'PEMKAB' | 'ADMIN';
  kecamatan?: string; passwordHash: string;
}) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: data.email }, { phone: data.phone }] },
  });
  if (existing) {
    return prisma.user.update({ where: { id: existing.id }, data });
  }
  return prisma.user.create({ data });
}

// ======================================================================
async function main() {
  const pass = await bcrypt.hash('password123', 10);

  // --- Reset total data pengguna & katalog demo ---
  // PENTING: dulu hanya data transaksi yang dibersihkan, sehingga produsen/produk
  // dari versi seed sebelumnya (mis. email lama 'tani@gfresh.id') tersisa sebagai
  // duplikat di samping data versi baru. Duplikat itu menggeser urutan array yang
  // dipakai skenario order/komplain demo di bawah, membuat data nempel ke akun
  // yang salah. Reset total ini memastikan hasil seed selalu deterministik,
  // berapa kali pun dijalankan dan dari versi seed sebelumnya yang mana pun.
  console.log('› reset total data demo (pengguna, katalog, transaksi)…');
  await prisma.notification.deleteMany({});
  await prisma.complaint.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.orderEvent.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.hetPrice.deleteMany({}); // HetPrice.setBy → User tanpa cascade, harus lebih dulu
  await prisma.user.deleteMany({});     // cascade ke ProducerProfile/CourierProfile/BusinessProfile/Notification

  // ---------------------------------------------------------------- Wilayah layanan
  // 18 kecamatan resmi Kabupaten Gresik. Aktif = kecamatan yang sudah dilayani
  // pada fase pilot (dipakai produsen/kurir demo di bawah); sisanya nonaktif
  // sebagai contoh perluasan cakupan yang bisa dilakukan Admin tanpa deploy ulang.
  const SEMUA_KECAMATAN = [
    'Balongpanggang', 'Benjeng', 'Bungah', 'Cerme', 'Driyorejo', 'Duduksampeyan',
    'Dukun', 'Gresik', 'Kebomas', 'Kedamean', 'Manyar', 'Menganti',
    'Panceng', 'Sangkapura', 'Sidayu', 'Tambak', 'Ujungpangkah', 'Wringinanom',
  ];
  const KECAMATAN_PILOT = new Set([
    'Cerme', 'Manyar', 'Duduksampeyan', 'Menganti', 'Kebomas', 'Gresik', 'Balongpanggang', 'Wringinanom',
  ]);
  await prisma.serviceArea.deleteMany({});
  await prisma.serviceArea.createMany({
    data: SEMUA_KECAMATAN.map((name) => ({ name, active: KECAMATAN_PILOT.has(name) })),
  });
  console.log(`› ${SEMUA_KECAMATAN.length} kecamatan dimuat (${KECAMATAN_PILOT.size} aktif untuk pilot)`);

  // ---------------------------------------------------------------- Kategori
  const KATEGORI = [
    { name: 'Sayur', unit: 'ikat' },
    { name: 'Ikan', unit: 'kg' },
    { name: 'Daging Ayam', unit: 'kg' },
    { name: 'Beras', unit: 'kg' },
    { name: 'Buah', unit: 'kg' },
    { name: 'Telur', unit: 'kg' },
    { name: 'Olahan UMKM', unit: 'pack' },
  ];
  const cats = await Promise.all(
    KATEGORI.map((c) => prisma.category.upsert({ where: { name: c.name }, update: {}, create: c })),
  );
  const cat = Object.fromEntries(cats.map((c) => [c.name, c]));
  console.log(`› ${cats.length} kategori siap`);

  // ---------------------------------------------------------------- Pemkab & Admin
  const pemkab = await upsertSystemUser({
    name: 'Dinas Ketahanan Pangan', email: 'pemkab@gresik.go.id', phone: '0318000001',
    passwordHash: pass, role: 'PEMKAB', kecamatan: 'Gresik',
  });
  await upsertSystemUser({
    name: 'Operator G-Fresh', email: 'admin@gfresh.id', phone: '0318000002',
    passwordHash: pass, role: 'ADMIN', kecamatan: 'Kebomas',
  });

  // ---------------------------------------------------------------- HET hari ini
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const HET: Record<string, { max: number; floor?: number }> = {
    Sayur: { max: 8000, floor: 2000 },
    Ikan: { max: 45000, floor: 20000 },
    'Daging Ayam': { max: 40000, floor: 28000 },
    Beras: { max: 15000, floor: 10000 },
    Buah: { max: 30000 },
    Telur: { max: 32000, floor: 24000 },
    'Olahan UMKM': { max: 50000 },
  };
  for (const [name, v] of Object.entries(HET)) {
    await prisma.hetPrice.upsert({
      where: { categoryId_effectiveOn: { categoryId: cat[name].id, effectiveOn: today } },
      update: { maxPrice: v.max, floorPrice: v.floor },
      create: {
        categoryId: cat[name].id, maxPrice: v.max, floorPrice: v.floor,
        effectiveOn: today, setById: pemkab.id,
      },
    });
  }
  console.log(`› HET ditetapkan untuk ${Object.keys(HET).length} kategori`);

  // ---------------------------------------------------------------- Produsen
  type SeedProducer = {
    email: string; owner: string; farm: string; kecamatan: string;
    lat: number; lng: number; cert: 'TERVERIFIKASI' | 'MENUNGGU_VERIFIKASI' | 'BELUM_DIAJUKAN' | 'DITOLAK';
    certType?: string;
    products: {
      cat: string; name: string; price: number; stock: number; unit?: string;
      panenJamLalu: number; b2bPrice?: number; b2bMinQty?: number;
    }[];
  };

  const PRODUSEN: SeedProducer[] = [
    {
      email: 'tani.cerme@gfresh.id', owner: 'Pak Slamet', farm: 'Kelompok Tani Cerme Makmur',
      kecamatan: 'Cerme', lat: -7.1725, lng: 112.5891, cert: 'TERVERIFIKASI', certType: 'P-IRT',
      products: [
        { cat: 'Sayur', name: 'Bayam Segar', price: 5000, stock: 60, panenJamLalu: 5, b2bPrice: 4000, b2bMinQty: 30 },
        { cat: 'Sayur', name: 'Kangkung', price: 4500, stock: 80, panenJamLalu: 5, b2bPrice: 3500, b2bMinQty: 40 },
        { cat: 'Sayur', name: 'Sawi Hijau', price: 6000, stock: 45, panenJamLalu: 7 },
        { cat: 'Beras', name: 'Beras Merah Lokal', price: 14000, stock: 200, unit: 'kg', panenJamLalu: 72, b2bPrice: 12500, b2bMinQty: 50 },
      ],
    },
    {
      email: 'tambak.manyar@gfresh.id', owner: 'Bu Aminah', farm: 'Tambak Bandeng Manyar',
      kecamatan: 'Manyar', lat: -7.1256, lng: 112.6339, cert: 'TERVERIFIKASI', certType: 'BPOM',
      products: [
        { cat: 'Ikan', name: 'Bandeng Segar', price: 38000, stock: 40, unit: 'kg', panenJamLalu: 3, b2bPrice: 34000, b2bMinQty: 20 },
        { cat: 'Ikan', name: 'Bandeng Cabut Tulang', price: 44000, stock: 15, unit: 'kg', panenJamLalu: 4 },
        { cat: 'Ikan', name: 'Udang Vaname', price: 42000, stock: 25, unit: 'kg', panenJamLalu: 2, b2bPrice: 38000, b2bMinQty: 15 },
      ],
    },
    {
      email: 'tani.duduk@gfresh.id', owner: 'Pak Hasan', farm: 'Tani Duduksampeyan Jaya',
      kecamatan: 'Duduksampeyan', lat: -7.1489, lng: 112.5203, cert: 'TERVERIFIKASI', certType: 'P-IRT',
      products: [
        { cat: 'Sayur', name: 'Terong Ungu', price: 7000, stock: 50, unit: 'kg', panenJamLalu: 8 },
        { cat: 'Sayur', name: 'Kacang Panjang', price: 6500, stock: 35, unit: 'kg', panenJamLalu: 6 },
        { cat: 'Buah', name: 'Pepaya California', price: 12000, stock: 60, unit: 'kg', panenJamLalu: 12, b2bPrice: 10000, b2bMinQty: 30 },
      ],
    },
    {
      email: 'ayam.menganti@gfresh.id', owner: 'Pak Yusuf', farm: 'Peternakan Ayam Menganti',
      kecamatan: 'Menganti', lat: -7.2447, lng: 112.5786, cert: 'MENUNGGU_VERIFIKASI',
      products: [
        { cat: 'Daging Ayam', name: 'Ayam Kampung Utuh', price: 38000, stock: 30, unit: 'kg', panenJamLalu: 6 },
        { cat: 'Daging Ayam', name: 'Fillet Ayam Broiler', price: 36000, stock: 50, unit: 'kg', panenJamLalu: 4, b2bPrice: 33000, b2bMinQty: 25 },
        { cat: 'Telur', name: 'Telur Ayam Kampung', price: 30000, stock: 40, unit: 'kg', panenJamLalu: 10 },
      ],
    },
    {
      email: 'sayur.kebomas@gfresh.id', owner: 'Bu Retno', farm: 'Hidroponik Kebomas Segar',
      kecamatan: 'Kebomas', lat: -7.1631, lng: 112.6089, cert: 'TERVERIFIKASI', certType: 'Halal',
      products: [
        { cat: 'Sayur', name: 'Selada Hidroponik', price: 7500, stock: 55, unit: 'pack', panenJamLalu: 2 },
        { cat: 'Sayur', name: 'Pakcoy Hidroponik', price: 7000, stock: 48, unit: 'pack', panenJamLalu: 2, b2bPrice: 5800, b2bMinQty: 40 },
        { cat: 'Sayur', name: 'Tomat Cherry', price: 18000, stock: 30, unit: 'kg', panenJamLalu: 9 },
      ],
    },
    {
      email: 'umkm.gresik@gfresh.id', owner: 'Bu Lilis', farm: 'UMKM Olahan Bu Lilis',
      kecamatan: 'Gresik', lat: -7.1554, lng: 112.6512, cert: 'TERVERIFIKASI', certType: 'P-IRT',
      products: [
        { cat: 'Olahan UMKM', name: 'Otak-otak Bandeng', price: 25000, stock: 40, unit: 'pack', panenJamLalu: 14 },
        { cat: 'Olahan UMKM', name: 'Kerupuk Ikan Payus', price: 20000, stock: 60, unit: 'pack', panenJamLalu: 20, b2bPrice: 17000, b2bMinQty: 30 },
        { cat: 'Olahan UMKM', name: 'Sambal Bandeng Asap', price: 28000, stock: 25, unit: 'pack', panenJamLalu: 16 },
      ],
    },
    {
      email: 'tani.balongpanggang@gfresh.id', owner: 'Pak Darmaji', farm: 'Gapoktan Balongpanggang',
      kecamatan: 'Balongpanggang', lat: -7.2158, lng: 112.4694, cert: 'BELUM_DIAJUKAN',
      products: [
        { cat: 'Beras', name: 'Beras IR64 Premium', price: 13500, stock: 300, unit: 'kg', panenJamLalu: 96, b2bPrice: 12000, b2bMinQty: 100 },
        { cat: 'Sayur', name: 'Jagung Manis', price: 8000, stock: 70, unit: 'kg', panenJamLalu: 18 },
      ],
    },
    {
      email: 'buah.wringinanom@gfresh.id', owner: 'Pak Imron', farm: 'Kebun Buah Wringinanom',
      kecamatan: 'Wringinanom', lat: -7.3186, lng: 112.5439, cert: 'MENUNGGU_VERIFIKASI',
      products: [
        { cat: 'Buah', name: 'Mangga Podang', price: 22000, stock: 45, unit: 'kg', panenJamLalu: 11 },
        { cat: 'Buah', name: 'Jambu Kristal', price: 19000, stock: 38, unit: 'kg', panenJamLalu: 8 },
        { cat: 'Buah', name: 'Semangka Merah', price: 9000, stock: 80, unit: 'kg', panenJamLalu: 15 },
      ],
    },
  ];

  const produsenRefs: { producerId: string; userId: string; farm: string; lat: number; lng: number }[] = [];

  for (const P of PRODUSEN) {
    const u = await prisma.user.upsert({
      where: { email: P.email },
      update: {},
      create: {
        name: P.owner, email: P.email, phone: '0812' + Math.floor(1000000 + Math.random() * 8999999),
        passwordHash: pass, role: 'PRODUSEN', kecamatan: P.kecamatan,
        producer: {
          create: {
            farmName: P.farm, kecamatan: P.kecamatan, latitude: P.lat, longitude: P.lng,
            certStatus: P.cert, certType: P.certType,
          },
        },
      },
      include: { producer: true },
    });
    const producer = u.producer ?? (await prisma.producerProfile.findUniqueOrThrow({ where: { userId: u.id } }));
    produsenRefs.push({ producerId: producer.id, userId: u.id, farm: P.farm, lat: P.lat, lng: P.lng });

    for (const pr of P.products) {
      const existing = await prisma.product.findFirst({
        where: { producerId: producer.id, name: pr.name },
      });
      const data = {
        producerId: producer.id,
        categoryId: cat[pr.cat].id,
        name: pr.name,
        unit: pr.unit ?? cat[pr.cat].unit,
        price: pr.price,
        stock: pr.stock,
        harvestedAt: hoursAgo(pr.panenJamLalu),
        b2bPrice: pr.b2bPrice ?? null,
        b2bMinQty: pr.b2bMinQty ?? null,
      };
      if (existing) await prisma.product.update({ where: { id: existing.id }, data });
      else await prisma.product.create({ data });
    }
  }
  const totalProduk = PRODUSEN.reduce((a, p) => a + p.products.length, 0);
  console.log(`› ${PRODUSEN.length} produsen & ${totalProduk} produk siap`);

  // ---------------------------------------------------------------- Kurir
  // ktpState: 'verified' = sudah disetujui admin (ada NIK + foto).
  //           'pending'  = sudah mengajukan, menunggu admin meninjau.
  //           'none'     = belum mengajukan KTP sama sekali.
  const KURIR = [
    { email: 'kurir.budi@gfresh.id', name: 'Budi Santoso', kec: 'Kebomas', vehicle: 'Motor + cool-box 40L', ktpState: 'verified', active: true },
    { email: 'kurir.eko@gfresh.id', name: 'Eko Prasetyo', kec: 'Manyar', vehicle: 'Motor + cool-box 30L', ktpState: 'verified', active: true },
    { email: 'kurir.sari@gfresh.id', name: 'Sari Wulandari', kec: 'Cerme', vehicle: 'Motor + box thermal', ktpState: 'verified', active: true },
    { email: 'kurir.agus@gfresh.id', name: 'Agus Riyanto', kec: 'Gresik', vehicle: 'Motor viar + cool-box 80L', ktpState: 'verified', active: false },
    { email: 'kurir.dani@gfresh.id', name: 'Dani Kurniawan', kec: 'Menganti', vehicle: 'Motor + cool-box 30L', ktpState: 'pending', active: true },
  ];
  const kurirRefs: { courierId: string; userId: string; name: string }[] = [];
  let nikSeq = 3524011234560001; // NIK dummy berurutan, jelas bukan data asli
  for (const K of KURIR) {
    const verified = K.ktpState === 'verified';
    const pending = K.ktpState === 'pending';
    const u = await prisma.user.upsert({
      where: { email: K.email },
      update: {},
      create: {
        name: K.name, email: K.email, phone: '0814' + Math.floor(1000000 + Math.random() * 8999999),
        passwordHash: pass, role: 'KURIR', kecamatan: K.kec,
        courier: {
          create: {
            kecamatan: K.kec, vehicle: K.vehicle, active: K.active,
            ktpVerified: verified,
            ktpNumber: verified || pending ? String(nikSeq++) : null,
            // Placeholder — pada data asli ini akan berupa foto hasil unggahan kurir.
            ktpPhotoUrl: verified || pending ? '/placeholder-ktp.png' : null,
            ktpSubmittedAt: verified || pending ? hoursAgo(verified ? 72 : 3) : null,
          },
        },
      },
      include: { courier: true },
    });
    const c = u.courier ?? (await prisma.courierProfile.findUniqueOrThrow({ where: { userId: u.id } }));
    kurirRefs.push({ courierId: c.id, userId: u.id, name: K.name });
  }
  console.log(`› ${KURIR.length} kurir siap (4 terverifikasi, 1 menunggu tinjauan KTP)`);

  // ---------------------------------------------------------------- Konsumen
  const KONSUMEN = [
    { email: 'konsumen@gfresh.id', name: 'Rina Susanti', kec: 'Kebomas', alamat: 'Jl. Dr. Wahidin 45, Kec. Kebomas' },
    { email: 'konsumen.dewi@gfresh.id', name: 'Dewi Anggraini', kec: 'Gresik', alamat: 'Jl. Basuki Rahmat 12, Kec. Gresik' },
    { email: 'konsumen.tono@gfresh.id', name: 'Tono Wijaya', kec: 'Manyar', alamat: 'Perum Manyar Indah B-7, Kec. Manyar' },
    { email: 'konsumen.maya@gfresh.id', name: 'Maya Puspita', kec: 'Cerme', alamat: 'Jl. Raya Cerme 88, Kec. Cerme' },
  ];
  const konsumenRefs: { userId: string; name: string; alamat: string }[] = [];
  for (const K of KONSUMEN) {
    const u = await prisma.user.upsert({
      where: { email: K.email },
      update: { defaultAddress: K.alamat },
      create: {
        name: K.name, email: K.email, phone: '0813' + Math.floor(1000000 + Math.random() * 8999999),
        passwordHash: pass, role: 'KONSUMEN', kecamatan: K.kec, defaultAddress: K.alamat,
      },
    });
    konsumenRefs.push({ userId: u.id, name: K.name, alamat: K.alamat });
  }

  // Pembeli B2B (katering) — sudah terverifikasi agar bisa langsung didemokan.
  const b2bUser = await prisma.user.upsert({
    where: { email: 'katering@gfresh.id' },
    update: { defaultAddress: 'Jl. Panglima Sudirman 30, Kec. Gresik' },
    create: {
      name: 'Sri Handayani', email: 'katering@gfresh.id', phone: '0815' + Math.floor(1000000 + Math.random() * 8999999),
      passwordHash: pass, role: 'KONSUMEN', kecamatan: 'Gresik',
      defaultAddress: 'Jl. Panglima Sudirman 30, Kec. Gresik',
    },
  });
  await prisma.businessProfile.upsert({
    where: { userId: b2bUser.id },
    update: { verified: true },
    create: {
      userId: b2bUser.id, companyName: 'Katering Bu Sri', businessType: 'Katering',
      npwp: '01.234.567.8-602.000', picName: 'Sri Handayani', picPhone: '081533344455',
      billingAddress: 'Jl. Panglima Sudirman 30, Kec. Gresik', verified: true,
    },
  });
  console.log(`› ${KONSUMEN.length} konsumen + 1 pembeli B2B terverifikasi siap`);

  // ---------------------------------------------------------------- Riwayat pesanan
  // Dibuat langsung di level data agar dashboard, rating, dan riwayat langsung berisi.
  type ProdukSeed = {
    id: string; price: number; producerId: string; harvestedAt: Date;
    producer: { latitude: number | null; longitude: number | null };
  };
  const semuaProduk: ProdukSeed[] = await prisma.product.findMany({
    include: { producer: true },
    orderBy: { createdAt: 'asc' },
  });

  type Skenario = { status: string; hariLalu: number; produkIdx: number; qty: number; konsumenIdx: number; kurirIdx: number };
  const SKENARIO: Skenario[] = [
    // Mayoritas sukses agar rating produsen tinggi & subsidi ongkir aktif.
    { status: 'SELESAI', hariLalu: 12, produkIdx: 0, qty: 4, konsumenIdx: 0, kurirIdx: 0 },
    { status: 'SELESAI', hariLalu: 11, produkIdx: 4, qty: 2, konsumenIdx: 1, kurirIdx: 1 },
    { status: 'SELESAI', hariLalu: 10, produkIdx: 7, qty: 3, konsumenIdx: 2, kurirIdx: 1 },
    { status: 'SELESAI', hariLalu: 9, produkIdx: 12, qty: 5, konsumenIdx: 3, kurirIdx: 2 },
    { status: 'SELESAI', hariLalu: 8, produkIdx: 1, qty: 6, konsumenIdx: 0, kurirIdx: 0 },
    { status: 'SELESAI', hariLalu: 7, produkIdx: 15, qty: 2, konsumenIdx: 1, kurirIdx: 2 },
    { status: 'SELESAI', hariLalu: 6, produkIdx: 5, qty: 3, konsumenIdx: 2, kurirIdx: 1 },
    { status: 'SELESAI', hariLalu: 5, produkIdx: 18, qty: 4, konsumenIdx: 3, kurirIdx: 0 },
    { status: 'SELESAI', hariLalu: 4, produkIdx: 2, qty: 5, konsumenIdx: 0, kurirIdx: 2 },
    { status: 'SELESAI', hariLalu: 3, produkIdx: 9, qty: 2, konsumenIdx: 1, kurirIdx: 1 },
    // Satu refund agar rating tidak semuanya 5.0 dan grafik terlihat wajar.
    { status: 'REFUND', hariLalu: 6, produkIdx: 20, qty: 3, konsumenIdx: 2, kurirIdx: 0 },
    // Order yang sedang berjalan di berbagai tahap.
    { status: 'DIKIRIM', hariLalu: 0, produkIdx: 3, qty: 10, konsumenIdx: 0, kurirIdx: 1 },
    { status: 'DIJEMPUT_KURIR', hariLalu: 0, produkIdx: 10, qty: 2, konsumenIdx: 1, kurirIdx: 2 },
    // Menunggu diambil kurir — inilah yang "diperebutkan" saat demo.
    { status: 'DIBAYAR', hariLalu: 0, produkIdx: 6, qty: 3, konsumenIdx: 2, kurirIdx: -1 },
    { status: 'DIBAYAR', hariLalu: 0, produkIdx: 13, qty: 4, konsumenIdx: 3, kurirIdx: -1 },
    { status: 'DIBAYAR', hariLalu: 0, produkIdx: 16, qty: 2, konsumenIdx: 0, kurirIdx: -1 },
  ];

  let dibuat = 0;
  const orderIdsSengketa: { orderId: string; producerId: string; konsumenId: string }[] = [];

  for (const [i, S] of SKENARIO.entries()) {
    const p = pick(semuaProduk, S.produkIdx);
    const kons = pick(konsumenRefs, S.konsumenIdx);
    const kur = S.kurirIdx >= 0 ? pick(kurirRefs, S.kurirIdx) : null;
    const waktu = S.hariLalu > 0 ? daysAgo(S.hariLalu) : hoursAgo(1 + (i % 3));

    const subtotal = p.price * S.qty;
    const fee = ongkir(2 + (i % 5));
    const total = subtotal + fee;

    const terminal = ['SELESAI', 'REFUND'].includes(S.status);
    const order = await prisma.order.create({
      data: {
        consumerId: kons.userId,
        courierId: kur?.courierId ?? null,
        status: S.status as never,
        channel: 'B2C',
        subtotal,
        deliveryFee: fee,
        platformFee: 0,
        total,
        escrowStatus: S.status === 'SELESAI' ? 'RELEASED' : S.status === 'REFUND' ? 'REFUNDED' : 'HELD',
        paymentRef: `MOCK-SEED-${i}`,
        addressText: kons.alamat,
        destLat: -7.16 + (i % 5) * 0.01,
        destLng: 112.61 + (i % 5) * 0.01,
        gracePeriodEnd: terminal ? new Date(waktu.getTime() + 7_200_000) : null,
        createdAt: waktu,
        items: {
          create: [{
            productId: p.id,
            qty: S.qty,
            unitPrice: p.price,
            lineTotal: subtotal,
            traceCode: traceCode(),
            harvestedAt: p.harvestedAt,
            producerLat: p.producer.latitude,
            producerLng: p.producer.longitude,
          }],
        },
        events: {
          create: [
            { status: 'MENUNGGU_BAYAR', note: 'Order dibuat (data demo).', createdAt: waktu },
            { status: 'DIBAYAR', note: 'Pembayaran diterima, dana ditahan escrow.', createdAt: new Date(waktu.getTime() + 300_000) },
            ...(S.status !== 'DIBAYAR'
              ? [{ status: S.status as never, note: 'Status akhir data demo.', createdAt: new Date(waktu.getTime() + 3_600_000) }]
              : []),
          ],
        },
      },
    });
    dibuat++;

    if (S.status === 'REFUND') {
      orderIdsSengketa.push({ orderId: order.id, producerId: p.producerId, konsumenId: kons.userId });
    }
  }
  console.log(`› ${dibuat} pesanan riwayat dibuat`);

  // ---------------------------------------------------------------- Komplain demo
  // 1) Komplain lama yang sudah diputus (untuk halaman riwayat).
  if (orderIdsSengketa.length > 0) {
    const s = orderIdsSengketa[0];
    await prisma.complaint.create({
      data: {
        orderId: s.orderId,
        reporterId: s.konsumenId,
        reason: 'Sayur yang datang sudah layu dan berbau, tidak layak konsumsi.',
        evidenceUrls: [],
        status: 'VALID',
        producerStance: 'SETUJU',
        producerResponse: 'Mohon maaf, terjadi kesalahan pemilihan ikatan saat pengemasan.',
        producerRespondedAt: daysAgo(6),
        reviewNote: 'Diselesaikan tanpa admin: produsen menyetujui komplain.',
        riskScore: 10,
        riskFlags: [],
        createdAt: daysAgo(6),
      },
    });
  }

  // 2) Komplain aktif dalam masa sanggah produsen (untuk demo hak jawab).
  const orderSengketa = await prisma.order.findFirst({
    where: { status: 'DIKIRIM' },
    include: { items: { include: { product: true } } },
  });
  if (orderSengketa) {
    await prisma.order.update({
      where: { id: orderSengketa.id },
      data: { status: 'SENGKETA', gracePeriodEnd: new Date(Date.now() + 3_600_000) },
    });
    await prisma.complaint.create({
      data: {
        orderId: orderSengketa.id,
        reporterId: orderSengketa.consumerId,
        reason: 'Beras yang diterima kurang 1 kg dari yang dipesan.',
        evidenceUrls: [],
        status: 'MENUNGGU_SANGGAHAN',
        responseDeadline: new Date(Date.now() + 10 * 3_600_000),
        riskScore: 20,
        riskFlags: ['TANPA_BUKTI'],
        createdAt: hoursAgo(2),
      },
    });
    console.log('› 1 komplain menunggu sanggahan produsen (demo hak jawab)');
  }

  // ---------------------------------------------------------------- Rating
  // Hitung ulang dari riwayat agar konsisten dengan lib/rating.ts.
  for (const pr of produsenRefs) {
    const rows = await prisma.order.findMany({
      where: {
        items: { some: { product: { producerId: pr.producerId } } },
        status: { in: ['SELESAI', 'REFUND', 'REFUND_SEBAGIAN'] },
      },
      select: { status: true },
    });
    const good = rows.filter((r) => r.status === 'SELESAI').length;
    const bad = rows.length - good;
    await prisma.producerProfile.update({
      where: { id: pr.producerId },
      data: { ratingScore: computeRating(good, bad) },
    });
  }
  for (const k of kurirRefs) {
    const good = await prisma.order.count({ where: { courierId: k.courierId, status: 'SELESAI' } });
    const bad = await prisma.order.count({
      where: { courierId: k.courierId, status: { in: ['REFUND', 'REFUND_SEBAGIAN'] } },
    });
    await prisma.courierProfile.update({
      where: { id: k.courierId },
      data: { ratingScore: computeRating(good, bad) },
    });
  }
  console.log('› rating produsen & kurir dihitung dari riwayat');

  // ---------------------------------------------------------------- Ringkasan
  console.log('\n═══ SEED SELESAI ═══');
  console.log('Semua akun memakai kata sandi: password123\n');
  console.log('PEMKAB    pemkab@gresik.go.id');
  console.log('ADMIN     admin@gfresh.id');
  console.log('PRODUSEN  ' + PRODUSEN.map((p) => p.email).join('\n          '));
  console.log('KURIR     ' + KURIR.map((k) => k.email).join('\n          '));
  console.log('KONSUMEN  ' + KONSUMEN.map((k) => k.email).join('\n          '));
  console.log('B2B       katering@gfresh.id  (Katering Bu Sri — terverifikasi)');
  console.log('\n3 pesanan berstatus DIBAYAR menunggu diambil kurir — pakai ini untuk');
  console.log('mendemokan perebutan tugas antar kurir.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

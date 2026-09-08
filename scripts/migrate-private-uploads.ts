/**
 * Pemindahan sekali jalan: public/uploads/{ktp,cert,complaints} → private-uploads/,
 * sekaligus menulis ulang URL di database dari /uploads/… menjadi /api/files/….
 *
 * Jalankan SETELAH `prisma db push` (butuh model FileAccessLog) dan SEBELUM
 * menyalakan aplikasi versi baru.
 *
 *   npx tsx scripts/migrate-private-uploads.ts            # lihat rencananya saja
 *   npx tsx scripts/migrate-private-uploads.ts --apply    # kerjakan
 *
 * Aman diulang. Berkas dipindahkan (bukan disalin) supaya tidak ada salinan
 * yang tertinggal di public/ — salinan yang tertinggal berarti kebocorannya
 * belum benar-benar ditutup.
 *
 * Kalau kamu memang mereset dengan `npm run db:seed`, skrip ini tidak perlu:
 * seed membangun ulang semuanya dari nol di lokasi yang benar.
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const KINDS = ['ktp', 'cert', 'complaints'] as const;

const publicRoot = path.join(process.cwd(), 'public', 'uploads');
const privateRoot = process.env.PRIVATE_UPLOAD_DIR || path.join(process.cwd(), 'private-uploads');

let movedFiles = 0;
let rewrittenRows = 0;

function toPrivateUrl(url: string): string | null {
  const m = /^\/uploads\/(ktp|cert|complaints)\/([A-Za-z0-9._-]+)$/.exec(url);
  return m ? `/api/files/${m[1]}/${m[2]}` : null;
}

function moveFiles() {
  for (const kind of KINDS) {
    const from = path.join(publicRoot, kind);
    if (!fs.existsSync(from)) continue;
    const to = path.join(privateRoot, kind);
    if (APPLY) fs.mkdirSync(to, { recursive: true, mode: 0o700 });

    for (const name of fs.readdirSync(from)) {
      const src = path.join(from, name);
      if (!fs.statSync(src).isFile()) continue;
      console.log(`  ${kind}/${name}`);
      if (APPLY) {
        fs.renameSync(src, path.join(to, name));
        fs.chmodSync(path.join(to, name), 0o600);
      }
      movedFiles++;
    }
    if (APPLY && fs.readdirSync(from).length === 0) fs.rmdirSync(from);
  }
}

async function rewriteUrls() {
  // Foto KTP kurir
  for (const c of await prisma.courierProfile.findMany({
    where: { ktpPhotoUrl: { startsWith: '/uploads/' } },
    select: { id: true, ktpPhotoUrl: true },
  })) {
    const next = toPrivateUrl(c.ktpPhotoUrl!);
    if (!next) continue;
    console.log(`  CourierProfile ${c.id}: ${c.ktpPhotoUrl} → ${next}`);
    if (APPLY) {
      await prisma.courierProfile.update({ where: { id: c.id }, data: { ktpPhotoUrl: next } });
    }
    rewrittenRows++;
  }

  // Salinan sertifikat produsen
  for (const p of await prisma.producerProfile.findMany({
    where: { certDocUrl: { startsWith: '/uploads/' } },
    select: { id: true, certDocUrl: true },
  })) {
    const next = toPrivateUrl(p.certDocUrl!);
    if (!next) continue;
    console.log(`  ProducerProfile ${p.id}: ${p.certDocUrl} → ${next}`);
    if (APPLY) {
      await prisma.producerProfile.update({ where: { id: p.id }, data: { certDocUrl: next } });
    }
    rewrittenRows++;
  }

  // Bukti komplain: dua array, keduanya perlu dipetakan per elemen.
  for (const c of await prisma.complaint.findMany({
    select: { id: true, evidenceUrls: true, producerEvidence: true },
  })) {
    const evidenceUrls = c.evidenceUrls.map((u) => toPrivateUrl(u) ?? u);
    const producerEvidence = c.producerEvidence.map((u) => toPrivateUrl(u) ?? u);
    const changed =
      evidenceUrls.some((u, i) => u !== c.evidenceUrls[i]) ||
      producerEvidence.some((u, i) => u !== c.producerEvidence[i]);
    if (!changed) continue;

    console.log(`  Complaint ${c.id}: ${c.evidenceUrls.length + c.producerEvidence.length} bukti`);
    if (APPLY) {
      await prisma.complaint.update({ where: { id: c.id }, data: { evidenceUrls, producerEvidence } });
    }
    rewrittenRows++;
  }
}

async function main() {
  console.log(APPLY ? '== MENJALANKAN pemindahan ==' : '== SIMULASI (tambahkan --apply untuk benar-benar jalan) ==');
  console.log(`\nBerkas: ${publicRoot} → ${privateRoot}`);
  moveFiles();
  console.log('\nURL di database:');
  await rewriteUrls();
  console.log(`\nRingkasan: ${movedFiles} berkas, ${rewrittenRows} baris DB.`);
  if (!APPLY && (movedFiles || rewrittenRows)) console.log('Belum ada yang diubah. Jalankan ulang dengan --apply.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

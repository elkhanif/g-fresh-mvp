import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

// Penyimpanan file. DUA KELAS, sengaja dipisah:
//
// 1. PUBLIK (foto produk) — ditulis ke public/uploads → dilayani Next langsung.
//    Boleh diakses siapa pun; /pasar/[slug] memang halaman tanpa login.
//    - "local" (default): public/uploads/…  (VM self-host / localhost)
//    - "supabase": bucket publik. Untuk deploy serverless (FS read-only).
//
// 2. PRIVAT (foto KTP, salinan sertifikat, bukti komplain) — ditulis ke
//    private-uploads/ DI LUAR public/, jadi Next tidak bisa menyajikannya
//    secara statis. Satu-satunya jalan baca adalah GET /api/files/[kind]/[name]
//    yang memeriksa sesi + kepemilikan dan mencatat setiap akses.
//
//    Data KTP tunduk UU PDP. Nama file acak BUKAN kontrol akses: siapa pun
//    yang pernah melihat URL-nya (riwayat browser, log proxy, screenshot,
//    forward WhatsApp) bisa membukanya selamanya tanpa login.
//
//    Kelas privat SELALU ke disk lokal, apa pun STORAGE_PROVIDER-nya.
//    Konsekuensi: mode privat tidak jalan di serverless. Kalau nanti deploy
//    ke Vercel, yang perlu diganti hanya putPrivate() + readPrivate() ke
//    bucket privat + signed URL — route /api/files dan matriks otorisasinya
//    tidak berubah.
const provider = process.env.STORAGE_PROVIDER || 'local';

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB / file
const IMAGE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const VIDEO_EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

/** Subdir yang WAJIB privat. Menambah jenis dokumen sensitif baru? Daftar di sini. */
export const PRIVATE_KINDS = ['ktp', 'cert', 'complaints'] as const;
export type PrivateKind = (typeof PRIVATE_KINDS)[number];

export function isPrivateKind(v: string): v is PrivateKind {
  return (PRIVATE_KINDS as readonly string[]).includes(v);
}

/** Akar penyimpanan privat. Di luar public/ — itu inti pengamanannya. */
export function privateRoot(): string {
  return process.env.PRIVATE_UPLOAD_DIR || path.join(process.cwd(), 'private-uploads');
}

/**
 * Path absolut sebuah berkas privat, atau null bila namanya tidak aman.
 *
 * Dua lapis penjagaan, sengaja tidak cuma satu:
 *  1. nama file harus lolos daftar-putih karakter (tidak ada "/", "\", "..");
 *  2. hasil resolve harus tetap berada DI DALAM privateRoot()/kind.
 * Tanpa lapis kedua, `/api/files/ktp/..%2f..%2f.env` bisa jadi jalan tol.
 */
export function privateFilePath(kind: string, name: string): string | null {
  if (!isPrivateKind(kind)) return null;
  if (!/^[A-Za-z0-9._-]+$/.test(name)) return null;
  if (name.includes('..') || name.startsWith('.')) return null;

  const dir = path.resolve(privateRoot(), kind);
  const full = path.resolve(dir, name);
  if (full !== path.join(dir, path.basename(full))) return null;
  if (!full.startsWith(dir + path.sep)) return null;
  return full;
}

/** Content-Type dari ekstensi. Dipakai /api/files saat menyajikan berkas. */
export function contentTypeFor(name: string): string {
  const ext = path.extname(name).slice(1).toLowerCase();
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    pdf: 'application/pdf',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
  };
  return map[ext] || 'application/octet-stream';
}

export interface IncomingFile {
  type: string;
  buf: Buffer;
}

// Bukti komplain: gambar ATAU video, maksimal 4 file. PRIVAT.
export async function uploadEvidence(files: IncomingFile[]): Promise<string[]> {
  if (files.length > 4) throw new Error('Maksimal 4 file bukti.');
  return uploadMany(files, 'complaints', { ...IMAGE_EXT, ...VIDEO_EXT });
}

// Gambar: foto produk (publik) atau foto KTP (privat, subdir 'ktp').
export async function uploadImages(files: IncomingFile[], subdir = 'products'): Promise<string[]> {
  return uploadMany(files, subdir, IMAGE_EXT);
}

// Dokumen bukti (salinan sertifikat): gambar ATAU PDF. PRIVAT.
// Banyak produsen kecil memotret sertifikatnya dengan HP, bukan memindai —
// jadi jangan batasi ke PDF.
export async function uploadDocuments(files: IncomingFile[], subdir = 'docs'): Promise<string[]> {
  return uploadMany(files, subdir, { ...IMAGE_EXT, 'application/pdf': 'pdf' });
}

async function uploadMany(
  files: IncomingFile[],
  subdir: string,
  allowedExt: Record<string, string>,
): Promise<string[]> {
  const urls: string[] = [];
  for (const f of files) {
    const ext = allowedExt[f.type];
    if (!ext) throw new Error(`Tipe file tidak didukung: ${f.type}`);
    if (f.buf.length > MAX_BYTES) throw new Error('Ukuran file melebihi 15 MB.');

    const key = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;

    if (isPrivateKind(subdir)) {
      urls.push(await putPrivate(subdir, key, f));
    } else {
      urls.push(provider === 'supabase' ? await putSupabase(subdir, key, f) : await putLocal(subdir, key, f));
    }
  }
  return urls;
}

/** Tulis berkas privat + kembalikan URL route ber-autentikasi (bukan path statis). */
async function putPrivate(kind: PrivateKind, key: string, f: IncomingFile): Promise<string> {
  const dir = path.join(privateRoot(), kind);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  await fs.writeFile(path.join(dir, key), f.buf, { mode: 0o600 });
  return `/api/files/${kind}/${key}`;
}

/** Baca berkas privat. Pemanggil WAJIB sudah lolos otorisasi lebih dulu. */
export async function readPrivate(kind: string, name: string): Promise<Buffer | null> {
  const full = privateFilePath(kind, name);
  if (!full) return null;
  return fs.readFile(full).catch(() => null);
}

async function putLocal(subdir: string, key: string, f: IncomingFile): Promise<string> {
  const dir = path.join(process.cwd(), 'public', 'uploads', subdir);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, key), f.buf);
  return `/uploads/${subdir}/${key}`;
}

async function putSupabase(subdir: string, key: string, f: IncomingFile): Promise<string> {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_BUCKET || 'gfresh-public';
  if (!url || !serviceKey) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi.');

  // Import dinamis: dependency @supabase/supabase-js hanya dibutuhkan mode ini.
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(url, serviceKey);
  const filePath = `${subdir}/${key}`;
  const { error } = await supabase.storage.from(bucket).upload(filePath, f.buf, {
    contentType: f.type,
    upsert: false,
  });
  if (error) throw new Error(`Gagal unggah ke Supabase: ${error.message}`);
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

// Penyimpanan file publik (bukti komplain & foto produk).
// - "local" (default): tulis ke public/uploads → dilayani Next langsung.
//   Cocok untuk VM self-host / localhost. TIDAK jalan di serverless (FS read-only).
// - "supabase": unggah ke Supabase Storage bucket. Untuk deploy serverless.
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

export interface IncomingFile {
  type: string;
  buf: Buffer;
}

// Bukti komplain: gambar ATAU video, maksimal 4 file.
export async function uploadEvidence(files: IncomingFile[]): Promise<string[]> {
  if (files.length > 4) throw new Error('Maksimal 4 file bukti.');
  return uploadMany(files, 'complaints', { ...IMAGE_EXT, ...VIDEO_EXT });
}

// Foto produk / gambar publik lain: hanya gambar.
export async function uploadImages(files: IncomingFile[], subdir = 'products'): Promise<string[]> {
  return uploadMany(files, subdir, IMAGE_EXT);
}

// Dokumen bukti (salinan sertifikat): gambar ATAU PDF. Banyak produsen kecil
// memotret sertifikatnya dengan HP, bukan memindai — jadi jangan batasi ke PDF.
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
    urls.push(provider === 'supabase' ? await putSupabase(subdir, key, f) : await putLocal(subdir, key, f));
  }
  return urls;
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

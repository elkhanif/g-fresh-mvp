import { NextResponse } from 'next/server';
import { apiUser } from '@/lib/rbac';
import { uploadImages, type IncomingFile } from '@/lib/storage';

// POST /api/upload — unggah satu gambar (mis. foto produk).
// Multipart form-data, field "file". Dipakai produsen saat menambah produk.
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user || (user.role !== 'PRODUSEN' && user.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Tidak berhak mengunggah.' }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'File tidak ada.' }, { status: 400 });
  }

  try {
    const incoming: IncomingFile = { type: file.type, buf: Buffer.from(await file.arrayBuffer()) };
    const [url] = await uploadImages([incoming], 'products');
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 422 });
  }
}

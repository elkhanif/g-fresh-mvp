import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';
import { uploadImages, type IncomingFile } from '@/lib/storage';
import { notifyRole } from '@/lib/notification';

const NIK_RE = /^\d{16}$/;

// POST /api/courier/ktp — kurir mengajukan (atau mengajukan ulang) verifikasi KTP.
// multipart/form-data: nik (16 digit), photo (file, wajib).
// Tidak bisa diajukan ulang bila sudah terverifikasi — harus lewat admin
// untuk mencabut status dulu bila datanya perlu diperbaiki.
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user || user.role !== 'KURIR') {
    return NextResponse.json({ error: 'Hanya kurir.' }, { status: 403 });
  }

  const courier = await prisma.courierProfile.findUnique({ where: { userId: user.id } });
  if (!courier) return NextResponse.json({ error: 'Profil kurir tidak ada.' }, { status: 400 });
  if (courier.ktpVerified) {
    return NextResponse.json({ error: 'KTP Anda sudah terverifikasi.' }, { status: 409 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Format tidak valid.' }, { status: 400 });

  const nik = String(form.get('nik') || '').trim();
  if (!NIK_RE.test(nik)) {
    return NextResponse.json({ error: 'NIK harus 16 digit angka.' }, { status: 400 });
  }

  const file = form.get('photo');
  let ktpPhotoUrl = courier.ktpPhotoUrl;
  if (file instanceof File && file.size > 0) {
    try {
      const incoming: IncomingFile = { type: file.type, buf: Buffer.from(await file.arrayBuffer()) };
      [ktpPhotoUrl] = await uploadImages([incoming], 'ktp');
    } catch (e) {
      return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 422 });
    }
  }
  if (!ktpPhotoUrl) {
    return NextResponse.json({ error: 'Foto KTP wajib diunggah.' }, { status: 400 });
  }

  const updated = await prisma.courierProfile.update({
    where: { id: courier.id },
    data: {
      ktpNumber: nik,
      ktpPhotoUrl,
      ktpSubmittedAt: new Date(),
      ktpRejectedReason: null, // pengajuan baru menghapus alasan penolakan lama
    },
  });

  await notifyRole('ADMIN', {
    kind: 'AKUN',
    title: 'Pengajuan verifikasi KTP',
    body: `${user.name} mengajukan verifikasi KTP.`,
    href: '/app/admin',
  });

  return NextResponse.json({
    ktpNumber: updated.ktpNumber,
    ktpPhotoUrl: updated.ktpPhotoUrl,
    ktpSubmittedAt: updated.ktpSubmittedAt,
  });
}

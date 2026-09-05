import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';
import { uploadDocuments, type IncomingFile } from '@/lib/storage';
import { notifyRole } from '@/lib/notification';
import { CERT_TYPES } from '@/lib/cert';

/**
 * POST /api/cert/submit — produsen mengajukan (atau mengajukan ulang)
 * verifikasi sertifikasi.
 *
 * Sebelum ini tidak ada pintu masuknya sama sekali: satu-satunya cara sebuah
 * profil berstatus MENUNGGU_VERIFIKASI adalah lewat seed. Antrean kerja dinas
 * praktis tidak pernah bertambah.
 *
 * multipart/form-data: certType, certNumber (wajib), certIssuer, issuedAt,
 * expiresAt, doc (file, OPSIONAL).
 */
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user || user.role !== 'PRODUSEN') {
    return NextResponse.json({ error: 'Hanya produsen.' }, { status: 403 });
  }

  const producer = await prisma.producerProfile.findUnique({ where: { userId: user.id } });
  if (!producer) return NextResponse.json({ error: 'Profil produsen tidak ada.' }, { status: 400 });

  if (producer.certStatus === 'MENUNGGU_VERIFIKASI') {
    return NextResponse.json(
      { error: 'Pengajuan Anda sedang ditinjau dinas. Tunggu hasilnya dulu.' },
      { status: 409 },
    );
  }
  if (producer.certStatus === 'TERVERIFIKASI') {
    return NextResponse.json(
      { error: 'Sertifikasi Anda masih berlaku. Ajukan lagi bila sudah diperpanjang penerbitnya.' },
      { status: 409 },
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Format tidak valid.' }, { status: 400 });

  const certType = String(form.get('certType') || '').trim();
  if (!(CERT_TYPES as readonly string[]).includes(certType)) {
    return NextResponse.json({ error: 'Pilih jenis sertifikat.' }, { status: 400 });
  }

  const certNumber = String(form.get('certNumber') || '').trim();
  if (certNumber.length < 4) {
    return NextResponse.json({ error: 'Nomor sertifikat wajib diisi.' }, { status: 400 });
  }

  const certIssuer = String(form.get('certIssuer') || '').trim() || null;
  const issuedRaw = String(form.get('issuedAt') || '').trim();
  const expiresRaw = String(form.get('expiresAt') || '').trim();
  const issuedAt = issuedRaw ? new Date(issuedRaw) : null;
  const expiresAt = expiresRaw ? new Date(expiresRaw) : null;

  if (issuedAt && Number.isNaN(issuedAt.getTime())) {
    return NextResponse.json({ error: 'Tanggal terbit tidak valid.' }, { status: 400 });
  }
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    return NextResponse.json({ error: 'Tanggal kedaluwarsa tidak valid.' }, { status: 400 });
  }
  if (issuedAt && expiresAt && expiresAt <= issuedAt) {
    return NextResponse.json(
      { error: 'Tanggal kedaluwarsa harus setelah tanggal terbit.' },
      { status: 422 },
    );
  }
  if (expiresAt && expiresAt.getTime() < Date.now()) {
    return NextResponse.json(
      { error: 'Sertifikat ini sudah kedaluwarsa. Ajukan sertifikat yang masih berlaku.' },
      { status: 422 },
    );
  }

  // Dokumen opsional — nomor sertifikat tetap bisa diverifikasi silang manual
  // oleh petugas ke penerbitnya.
  let certDocUrl = producer.certDocUrl;
  const file = form.get('doc');
  if (file instanceof File && file.size > 0) {
    try {
      const incoming: IncomingFile = { type: file.type, buf: Buffer.from(await file.arrayBuffer()) };
      [certDocUrl] = await uploadDocuments([incoming], 'cert');
    } catch (e) {
      return NextResponse.json(
        { error: String(e instanceof Error ? e.message : e) },
        { status: 422 },
      );
    }
  }

  const fromStatus = producer.certStatus;
  await prisma.$transaction(async (tx) => {
    await tx.producerProfile.update({
      where: { id: producer.id },
      data: {
        certStatus: 'MENUNGGU_VERIFIKASI',
        certType,
        certNumber,
        certIssuer,
        certIssuedAt: issuedAt,
        certExpiresAt: expiresAt,
        certDocUrl,
        certSubmittedAt: new Date(),
        // Pengajuan baru menghapus catatan keputusan lama supaya produsen
        // tidak melihat alasan penolakan yang sudah tidak relevan.
        certNote: null,
      },
    });
    await tx.certReview.create({
      data: {
        producerId: producer.id,
        fromStatus,
        toStatus: 'MENUNGGU_VERIFIKASI',
        certType,
        certNumber,
        note: 'Pengajuan oleh produsen',
        actorId: user.id,
        actorName: user.name,
      },
    });
  });

  await notifyRole('PEMKAB', {
    kind: 'AKUN',
    title: 'Pengajuan sertifikasi produsen',
    body: `${producer.farmName} mengajukan verifikasi ${certType}.`,
    href: '/app/pemkab',
  });

  return NextResponse.json({ ok: true });
}

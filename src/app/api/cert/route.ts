import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';
import { notify, userIdOfProducer } from '@/lib/notification';
import {
  CERT_ACTIONS,
  CERT_ACTION_LABEL,
  CERT_ACTION_RESULT,
  CERT_TYPES,
  allowedActions,
  needsCertDataForAction,
  noteRequiredForAction,
} from '@/lib/cert';

/**
 * POST /api/cert — keputusan sertifikasi oleh dinas (PEMKAB).
 *
 * Berbasis AKSI, bukan "set status apa saja". Bedanya penting: dengan
 * `status` bebas, klien bisa melompati alur (mis. langsung TERVERIFIKASI dari
 * DITOLAK tanpa pengajuan ulang). Dengan aksi, transisi yang sah ditentukan
 * server lewat `allowedActions()`.
 *
 * Fase pilot: verifikasi tetap MANUAL, tanpa integrasi API ke penerbit
 * sertifikat. Yang dijamin sistem adalah keputusannya tercatat, ada alasannya,
 * ada nama petugasnya — bukan kebenaran isi sertifikatnya.
 */
const schema = z.object({
  producerId: z.string().min(1),
  action: z.enum(CERT_ACTIONS),
  note: z.string().max(500).optional(),
  certType: z.string().optional(),
  certNumber: z.string().max(60).optional(),
  certIssuer: z.string().max(120).optional(),
  expiresAt: z.string().optional(),
  // Status yang dilihat petugas saat membuka panel. Dipakai untuk mencegah
  // dua petugas memutus perkara yang sama tanpa sadar.
  expectedStatus: z.string().optional(),
});

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user || user.role !== 'PEMKAB') {
    return NextResponse.json({ error: 'Hanya Pemkab (dinas) yang memverifikasi.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
  const d = parsed.data;

  const producer = await prisma.producerProfile.findUnique({ where: { id: d.producerId } });
  if (!producer) return NextResponse.json({ error: 'Produsen tidak ditemukan.' }, { status: 404 });

  // Kunci optimistik: kalau petugas lain sudah memutus duluan, tolak alih-alih
  // menimpa diam-diam.
  if (d.expectedStatus && d.expectedStatus !== producer.certStatus) {
    return NextResponse.json(
      {
        error: 'Status sudah berubah — kemungkinan petugas lain baru memutus. Muat ulang halaman.',
        currentStatus: producer.certStatus,
      },
      { status: 409 },
    );
  }

  if (!allowedActions(producer.certStatus).includes(d.action)) {
    return NextResponse.json(
      { error: `Aksi "${CERT_ACTION_LABEL[d.action]}" tidak berlaku untuk status saat ini.` },
      { status: 422 },
    );
  }

  const note = d.note?.trim() || '';
  if (noteRequiredForAction(d.action) && note.length < 5) {
    return NextResponse.json(
      { error: 'Aksi ini wajib disertai alasan tertulis (min. 5 karakter).' },
      { status: 422 },
    );
  }

  const toStatus = CERT_ACTION_RESULT[d.action];
  const now = new Date();

  // Nilai sertifikat: pakai kiriman petugas bila ada, kalau tidak pertahankan
  // yang diajukan produsen.
  const certType = d.certType?.trim() || producer.certType;
  const certNumber = d.certNumber?.trim() || producer.certNumber;
  const certIssuer = d.certIssuer?.trim() || producer.certIssuer;
  let certExpiresAt = producer.certExpiresAt;

  if (d.expiresAt) {
    const parsedDate = new Date(d.expiresAt);
    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'Tanggal kedaluwarsa tidak valid.' }, { status: 400 });
    }
    certExpiresAt = parsedDate;
  }

  if (needsCertDataForAction(d.action)) {
    if (!certType || !(CERT_TYPES as readonly string[]).includes(certType)) {
      return NextResponse.json({ error: 'Jenis sertifikat wajib dipilih.' }, { status: 422 });
    }
    if (!certNumber || certNumber.length < 4) {
      return NextResponse.json(
        { error: 'Nomor sertifikat wajib diisi sebelum diverifikasi.' },
        { status: 422 },
      );
    }
    if (!certExpiresAt) {
      return NextResponse.json(
        { error: 'Masa berlaku wajib diisi — tanpa itu badge "tersertifikasi" berlaku selamanya.' },
        { status: 422 },
      );
    }
    if (certExpiresAt.getTime() <= now.getTime()) {
      return NextResponse.json(
        { error: 'Masa berlaku sudah lewat. Isi tanggal kedaluwarsa yang baru.' },
        { status: 422 },
      );
    }
  }

  const fromStatus = producer.certStatus;
  await prisma.$transaction(async (tx) => {
    await tx.producerProfile.update({
      where: { id: producer.id },
      data: {
        certStatus: toStatus,
        certType,
        certNumber,
        certIssuer,
        certExpiresAt,
        certNote: note || null,
        certReviewedAt: now,
      },
    });
    await tx.certReview.create({
      data: {
        producerId: producer.id,
        fromStatus,
        toStatus,
        certType,
        certNumber,
        note: note || CERT_ACTION_LABEL[d.action],
        actorId: user.id,
        actorName: user.name,
      },
    });
  });

  const produsenUserId = await userIdOfProducer(producer.id);
  if (produsenUserId) {
    await notify({
      userId: produsenUserId,
      kind: 'AKUN',
      title: `Sertifikasi: ${CERT_ACTION_LABEL[d.action]}`,
      body: note || `Status sertifikasi Anda kini ${toStatus.toLowerCase().replace(/_/g, ' ')}.`,
      href: '/app/produsen/sertifikasi',
    });
  }

  return NextResponse.json({ ok: true, status: toStatus });
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';
import { notify } from '@/lib/notification';

const schema = z.object({
  courierId: z.string(),
  decision: z.enum(['VERIFIKASI', 'TOLAK', 'CABUT']),
  reason: z.string().optional(), // wajib untuk TOLAK
});

// POST /api/admin/courier-verify — ADMIN meninjau pengajuan KTP kurir.
//   VERIFIKASI → ktpVerified = true
//   TOLAK      → ktpVerified = false, tercatat alasan; kurir bisa ajukan ulang
//   CABUT      → mencabut verifikasi yang sudah diberikan (mis. data ternyata keliru)
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Hanya admin.' }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const d = parsed.data;

  const courier = await prisma.courierProfile.findUnique({ where: { id: d.courierId } });
  if (!courier) return NextResponse.json({ error: 'Kurir tidak ditemukan.' }, { status: 404 });

  if (d.decision === 'VERIFIKASI' && !courier.ktpPhotoUrl) {
    return NextResponse.json(
      { error: 'Kurir belum mengajukan foto KTP — tidak ada yang bisa diverifikasi.' },
      { status: 409 },
    );
  }
  if (d.decision === 'TOLAK' && (!d.reason || d.reason.trim().length < 5)) {
    return NextResponse.json({ error: 'Alasan penolakan wajib diisi (min. 5 karakter).' }, { status: 400 });
  }

  const updated = await prisma.courierProfile.update({
    where: { id: d.courierId },
    data: {
      ktpVerified: d.decision === 'VERIFIKASI',
      ktpRejectedReason: d.decision === 'TOLAK' ? d.reason!.trim() : null,
    },
  });

  await notify({
    userId: courier.userId,
    kind: 'AKUN',
    title:
      d.decision === 'VERIFIKASI' ? 'KTP Anda terverifikasi'
      : d.decision === 'TOLAK' ? 'Pengajuan KTP ditolak'
      : 'Verifikasi KTP dicabut',
    body:
      d.decision === 'VERIFIKASI' ? 'Anda kini bisa mengambil tugas pengiriman.'
      : d.decision === 'TOLAK' ? `Alasan: ${d.reason}. Silakan ajukan ulang.`
      : 'Hubungi admin untuk informasi lebih lanjut.',
    href: '/app/kurir/verifikasi',
    alsoWhatsApp: true,
  });

  return NextResponse.json(updated);
}

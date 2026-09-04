import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';
import { transitionOrder } from '@/lib/escrow';

const schema = z.object({
  decision: z.enum(['VALID', 'VALID_SEBAGIAN', 'DITOLAK']),
  reviewNote: z.string().optional(),
  refundAmount: z.number().int().positive().optional(), // wajib untuk VALID_SEBAGIAN
});

// PATCH /api/complaints/[id] — ADMIN memutuskan komplain (verifikasi berlapis).
// VALID  → order REFUND (dana kembali ke konsumen)
// DITOLAK → order SELESAI (dana diteruskan ke produsen)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await apiUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Hanya admin operator.' }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const d = parsed.data;

  const complaint = await prisma.complaint.findUnique({ where: { id: params.id } });
  if (!complaint) return NextResponse.json({ error: 'Komplain tidak ada.' }, { status: 404 });
  // Admin hanya memutuskan komplain yang sudah dieskalasi (produsen menolak
  // atau tidak merespon). Komplain dalam masa sanggah belum boleh diputus.
  if (complaint.status !== 'DITINJAU') {
    return NextResponse.json(
      { error: 'Komplain belum dieskalasi — produsen masih dalam masa sanggah.' },
      { status: 409 },
    );
  }

  // Muat order untuk validasi nominal refund sebagian.
  const order0 = await prisma.order.findUnique({ where: { id: complaint.orderId } });
  if (!order0) return NextResponse.json({ error: 'Order tidak ada.' }, { status: 404 });

  if (d.decision === 'VALID_SEBAGIAN') {
    if (!d.refundAmount || d.refundAmount >= order0.total) {
      return NextResponse.json(
        { error: `Nominal refund sebagian harus di antara 1 dan ${order0.total - 1}.` },
        { status: 400 },
      );
    }
  }

  // Status komplain internal: VALID_SEBAGIAN dicatat sebagai VALID (tetap memihak konsumen sebagian).
  await prisma.complaint.update({
    where: { id: params.id },
    data: { status: d.decision === 'DITOLAK' ? 'DITOLAK' : 'VALID', reviewNote: d.reviewNote },
  });

  const target =
    d.decision === 'VALID' ? 'REFUND'
    : d.decision === 'VALID_SEBAGIAN' ? 'REFUND_SEBAGIAN'
    : 'SELESAI';

  const order = await transitionOrder(complaint.orderId, target, {
    actorId: user.id,
    refundAmount: d.refundAmount,
    note:
      d.decision === 'VALID_SEBAGIAN'
        ? `Keputusan admin: refund sebagian ${d.refundAmount}.`
        : `Keputusan admin: komplain ${d.decision}.`,
  });

  return NextResponse.json({ decision: d.decision, order });
}

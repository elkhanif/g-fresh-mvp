import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';
import { transitionOrder } from '@/lib/escrow';

const schema = z.object({
  decision: z.enum(['VALID', 'DITOLAK']),
  reviewNote: z.string().optional(),
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

  await prisma.complaint.update({
    where: { id: params.id },
    data: { status: d.decision, reviewNote: d.reviewNote },
  });

  const target = d.decision === 'VALID' ? 'REFUND' : 'SELESAI';
  const order = await transitionOrder(complaint.orderId, target, {
    actorId: user.id,
    note: `Keputusan admin: komplain ${d.decision}.`,
  });

  return NextResponse.json({ decision: d.decision, order });
}

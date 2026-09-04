import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';
import { transitionOrder } from '@/lib/escrow';
import { canProducerRespond, adminDeadlineFrom } from '@/lib/complaint';
import { uploadEvidence, type IncomingFile } from '@/lib/storage';

// POST /api/complaints/[id]/respond — hak sanggah produsen.
// multipart/form-data: stance = SETUJU | TOLAK, response (teks), evidence (file, opsional)
//
//   SETUJU → refund diproses LANGSUNG, tanpa menunggu admin.
//   TOLAK  → dieskalasi ke admin beserta sanggahan & bukti tandingan.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await apiUser();
  if (!user || user.role !== 'PRODUSEN') {
    return NextResponse.json({ error: 'Hanya produsen.' }, { status: 403 });
  }

  const guard = await canProducerRespond(params.id, user.id);
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: 409 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Format tidak valid.' }, { status: 400 });

  const stance = String(form.get('stance') || '');
  const response = String(form.get('response') || '').trim();
  if (stance !== 'SETUJU' && stance !== 'TOLAK') {
    return NextResponse.json({ error: 'Pilih SETUJU atau TOLAK.' }, { status: 400 });
  }
  if (stance === 'TOLAK' && response.length < 10) {
    return NextResponse.json(
      { error: 'Sanggahan wajib disertai penjelasan minimal 10 karakter.' },
      { status: 400 },
    );
  }

  // Bukti tandingan (opsional, hanya relevan saat menyanggah).
  let producerEvidence: string[] = [];
  const files = form.getAll('evidence').filter((x): x is File => x instanceof File && x.size > 0);
  if (files.length > 0) {
    try {
      const incoming: IncomingFile[] = [];
      for (const f of files) {
        incoming.push({ type: f.type, buf: Buffer.from(await f.arrayBuffer()) });
      }
      producerEvidence = await uploadEvidence(incoming);
    } catch (e) {
      return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 422 });
    }
  }

  if (stance === 'SETUJU') {
    // Produsen mengakui → selesaikan sekarang, konsumen tidak perlu menunggu admin.
    await prisma.complaint.update({
      where: { id: params.id },
      data: {
        producerStance: 'SETUJU',
        producerResponse: response || 'Produsen menyetujui komplain.',
        producerEvidence,
        producerRespondedAt: new Date(),
        status: 'VALID',
        reviewNote: 'Diselesaikan tanpa admin: produsen menyetujui komplain.',
      },
    });
    const order = await transitionOrder(guard.complaint.orderId, 'REFUND', {
      actorId: user.id,
      note: 'Produsen menyetujui komplain — dana dikembalikan ke konsumen.',
    });
    return NextResponse.json({ stance, resolved: true, order });
  }

  // TOLAK → naik ke meja admin.
  const updated = await prisma.complaint.update({
    where: { id: params.id },
    data: {
      producerStance: 'TOLAK',
      producerResponse: response,
      producerEvidence,
      producerRespondedAt: new Date(),
      status: 'DITINJAU',
      adminDeadline: adminDeadlineFrom(),
    },
  });
  return NextResponse.json({ stance, resolved: false, complaint: updated });
}

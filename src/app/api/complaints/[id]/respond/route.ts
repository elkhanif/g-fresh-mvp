import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';
import { transitionOrder } from '@/lib/escrow';
import { canProducerRespond, adminDeadlineFrom } from '@/lib/complaint';
import { uploadEvidence, type IncomingFile } from '@/lib/storage';
import { notify } from '@/lib/notification';

// POST /api/complaints/[id]/respond — hak sanggah & tawar produsen.
// multipart/form-data: stance = SETUJU | TAWAR | TOLAK, response (teks),
// amount (wajib untuk TAWAR), evidence (file, opsional)
//
//   SETUJU → refund PENUH diproses LANGSUNG, tanpa menunggu admin.
//   TAWAR  → mengajukan nominal refund sebagian, menunggu keputusan konsumen.
//   TOLAK  → dieskalasi ke admin beserta sanggahan & bukti tandingan (final, mengikat).
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
  const amountRaw = form.get('amount');
  const amount = amountRaw ? Number(amountRaw) : null;

  if (!['SETUJU', 'TAWAR', 'TOLAK'].includes(stance)) {
    return NextResponse.json({ error: 'Pilih SETUJU, TAWAR, atau TOLAK.' }, { status: 400 });
  }
  if (stance === 'TOLAK' && response.length < 10) {
    return NextResponse.json(
      { error: 'Sanggahan wajib disertai penjelasan minimal 10 karakter.' },
      { status: 400 },
    );
  }
  if (stance === 'TAWAR') {
    const order = await prisma.order.findUnique({ where: { id: guard.complaint.orderId } });
    if (!amount || amount < 1 || amount >= (order?.total ?? 0)) {
      return NextResponse.json(
        { error: `Nominal tawaran harus antara 1 dan ${(order?.total ?? 1) - 1}.` },
        { status: 400 },
      );
    }
  }

  // Bukti tandingan (opsional, relevan untuk TAWAR maupun TOLAK).
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

  // ---- SETUJU: selesai langsung, refund penuh ----
  if (stance === 'SETUJU') {
    await prisma.complaint.update({
      where: { id: params.id },
      data: {
        producerStance: 'SETUJU',
        producerResponse: response || 'Produsen menyetujui komplain sepenuhnya.',
        producerEvidence,
        producerRespondedAt: new Date(),
        status: 'VALID',
        reviewNote: 'Diselesaikan tanpa admin: produsen menyetujui penuh.',
      },
    });
    const order = await transitionOrder(guard.complaint.orderId, 'REFUND', {
      actorId: user.id,
      note: 'Produsen menyetujui komplain — dana dikembalikan penuh ke konsumen.',
    });
    return NextResponse.json({ stance, resolved: true, order });
  }

  // ---- TAWAR: ajukan nominal, menunggu keputusan konsumen ----
  if (stance === 'TAWAR') {
    const nextRound = guard.complaint.round + 1;
    const [complaint] = await prisma.$transaction([
      prisma.complaint.update({
        where: { id: params.id },
        data: {
          producerStance: 'TAWAR',
          producerResponse: response || null,
          producerEvidence,
          producerRespondedAt: new Date(),
          status: 'MENUNGGU_PERSETUJUAN',
          round: nextRound,
        },
      }),
      prisma.complaintOffer.create({
        data: {
          complaintId: params.id,
          round: nextRound,
          amount: amount as number,
          note: response || null,
        },
      }),
    ]);

    await notify({
      userId: guard.complaint.reporterId,
      kind: 'KOMPLAIN',
      title: 'Produsen mengajukan tawaran refund',
      body: `Produsen menawarkan pengembalian sebagian. Silakan tinjau dan tanggapi.`,
      href: `/app/konsumen/pesanan/${guard.complaint.orderId}`,
    });

    return NextResponse.json({ stance, resolved: false, complaint });
  }

  // ---- TOLAK: naik ke meja admin (final, mengikat) ----
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

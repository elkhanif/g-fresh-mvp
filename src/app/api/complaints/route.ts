import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';
import { transitionOrder } from '@/lib/escrow';
import { uploadEvidence, type IncomingFile } from '@/lib/storage';
import { responseDeadlineFrom, producerIdOfOrder } from '@/lib/complaint';
import { assessClaim } from '@/lib/fraud';
import { notify, userIdOfProducer } from '@/lib/notification';

// POST /api/complaints — konsumen melaporkan produk tidak sesuai.
// Menerima multipart/form-data: orderId, reason, dan file "evidence" (bisa banyak).
// Hanya sah saat order DITERIMA dan grace period belum lewat.
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user || user.role !== 'KONSUMEN') {
    return NextResponse.json({ error: 'Hanya konsumen.' }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Format tidak valid.' }, { status: 400 });

  const orderId = String(form.get('orderId') || '');
  const reason = String(form.get('reason') || '').trim();
  if (!orderId || reason.length < 5) {
    return NextResponse.json({ error: 'Alasan komplain minimal 5 karakter.' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: 'Order tidak ada.' }, { status: 404 });
  if (order.consumerId !== user.id) return NextResponse.json({ error: 'Bukan order Anda.' }, { status: 403 });
  if (order.status !== 'DITERIMA') {
    return NextResponse.json({ error: 'Komplain hanya bisa saat status DITERIMA.' }, { status: 409 });
  }
  if (order.gracePeriodEnd && order.gracePeriodEnd < new Date()) {
    return NextResponse.json({ error: 'Masa garansi (2 jam) sudah lewat.' }, { status: 409 });
  }

  // Kumpulkan & unggah bukti (opsional tapi dianjurkan).
  let evidenceUrls: string[] = [];
  const rawFiles = form.getAll('evidence').filter((x): x is File => x instanceof File && x.size > 0);
  if (rawFiles.length > 0) {
    try {
      const incoming: IncomingFile[] = [];
      for (const file of rawFiles) {
        incoming.push({ type: file.type, buf: Buffer.from(await file.arrayBuffer()) });
      }
      evidenceUrls = await uploadEvidence(incoming);
    } catch (e) {
      return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 422 });
    }
  }

  // #7 Penilaian anti-penyalahgunaan: batas keras + skor risiko.
  const assessment = await assessClaim({
    userId: user.id,
    gracePeriodEnd: order.gracePeriodEnd,
    hasEvidence: evidenceUrls.length > 0,
  });
  if (!assessment.allowed) {
    return NextResponse.json({ error: assessment.reason }, { status: 429 });
  }

  // Komplain masuk masa sanggah produsen lebih dulu (hak jawab), bukan langsung ke admin.
  const complaint = await prisma.complaint.create({
    data: {
      orderId: order.id,
      reporterId: user.id,
      reason,
      evidenceUrls,
      status: 'MENUNGGU_SANGGAHAN',
      responseDeadline: responseDeadlineFrom(),
      riskScore: assessment.riskScore,
      riskFlags: assessment.flags,
    },
  });

  // Order → SENGKETA (menahan auto-settle sampai admin memutuskan).
  await transitionOrder(order.id, 'SENGKETA', {
    actorId: user.id,
    note: 'Konsumen mengajukan komplain kesegaran.',
  });

  // #6 Beri tahu produsen bahwa ia punya hak & tenggat untuk menyanggah.
  const pid = await producerIdOfOrder(order.id);
  if (pid) {
    const uid = await userIdOfProducer(pid);
    if (uid) {
      await notify({
        userId: uid,
        kind: 'KOMPLAIN',
        title: 'Komplain perlu tanggapan Anda',
        body: `Pesanan #${order.id.slice(-6)} dikomplain. Anda punya 12 jam untuk menyetujui atau menyanggah.`,
        href: '/app/produsen/komplain',
        alsoWhatsApp: true,
      });
    }
  }

  return NextResponse.json(complaint, { status: 201 });
}

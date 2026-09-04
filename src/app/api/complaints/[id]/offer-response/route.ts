import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiUser } from '@/lib/rbac';
import { canConsumerRespondToOffer, acceptOffer, rejectOffer, producerIdOfOrder } from '@/lib/complaint';
import { notify, userIdOfProducer } from '@/lib/notification';

const schema = z.object({
  accept: z.boolean(),
  forceEscalate: z.boolean().optional(), // konsumen minta langsung ke admin, lewati putaran berikutnya
});

// POST /api/complaints/[id]/offer-response — konsumen menerima atau menolak
// tawaran refund sebagian yang diajukan produsen.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await apiUser();
  if (!user || user.role !== 'KONSUMEN') {
    return NextResponse.json({ error: 'Hanya konsumen.' }, { status: 403 });
  }

  const guard = await canConsumerRespondToOffer(params.id, user.id);
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: 409 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });

  if (parsed.data.accept) {
    const order = await acceptOffer(
      guard.complaint.id,
      guard.offer.id,
      guard.complaint.orderId,
      guard.offer.amount,
    );
    return NextResponse.json({ accepted: true, order });
  }

  const complaint = await rejectOffer(
    guard.complaint.id,
    guard.offer.id,
    guard.complaint.round,
    !!parsed.data.forceEscalate,
  );

  const pid = await producerIdOfOrder(guard.complaint.orderId);
  const producerUid = pid ? await userIdOfProducer(pid) : null;
  if (producerUid) {
    await notify({
      userId: producerUid,
      kind: 'KOMPLAIN',
      title: complaint.status === 'DITINJAU' ? 'Kasus dieskalasi ke admin' : 'Tawaran Anda ditolak',
      body:
        complaint.status === 'DITINJAU'
          ? 'Konsumen meminta keputusan admin. Keputusan admin bersifat final.'
          : 'Konsumen menolak tawaran Anda. Silakan tanggapi kembali.',
      href: '/app/produsen/komplain',
      alsoWhatsApp: true,
    });
  }

  return NextResponse.json({ accepted: false, complaint });
}

import { prisma } from './db';
import { transitionOrder } from './escrow';
import { MAX_NEGOTIATION_ROUNDS } from './negotiation';
import { notify, userIdOfProducer } from './notification';

// Batas waktu produsen menyanggah komplain sebelum dieskalasi ke admin.
// Dibuat pendek karena komoditas pangan segar butuh penyelesaian cepat.
export const RESPONSE_WINDOW_MS = 12 * 60 * 60 * 1000;

// Fitur #2: batas waktu ADMIN memutus komplain yang sudah dieskalasi.
// Lewat tenggat ini tanpa keputusan → auto-refund ke konsumen (buyer protection)
// agar dana tidak menggantung selamanya bila operator lambat.
export const ADMIN_WINDOW_MS = 48 * 60 * 60 * 1000;
export function adminDeadlineFrom(now: Date = new Date()): Date {
  return new Date(now.getTime() + ADMIN_WINDOW_MS);
}

export function responseDeadlineFrom(now: Date = new Date()): Date {
  return new Date(now.getTime() + RESPONSE_WINDOW_MS);
}

/**
 * Produsen yang bertanggung jawab atas sebuah order.
 * Checkout MVP bersifat satu-order-satu-produsen, jadi diambil dari item pertama.
 */
export async function producerIdOfOrder(orderId: string): Promise<string | null> {
  const item = await prisma.orderItem.findFirst({
    where: { orderId },
    select: { product: { select: { producerId: true } } },
  });
  return item?.product.producerId ?? null;
}

/** Apakah user (produsen) berhak menyanggah komplain ini, dan masih dalam tenggat. */
export async function canProducerRespond(complaintId: string, userId: string) {
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
  if (!complaint) return { ok: false as const, reason: 'Komplain tidak ditemukan.' };
  if (complaint.status !== 'MENUNGGU_SANGGAHAN') {
    return { ok: false as const, reason: 'Komplain ini sudah tidak dalam masa sanggah.' };
  }
  if (complaint.responseDeadline && complaint.responseDeadline < new Date()) {
    return { ok: false as const, reason: 'Batas waktu sanggah sudah lewat.' };
  }
  const producer = await prisma.producerProfile.findUnique({ where: { userId } });
  if (!producer) return { ok: false as const, reason: 'Profil produsen tidak ada.' };

  const owner = await producerIdOfOrder(complaint.orderId);
  if (owner !== producer.id) {
    return { ok: false as const, reason: 'Komplain ini bukan untuk produk Anda.' };
  }
  return { ok: true as const, complaint, producer };
}

/** Apakah user (konsumen pelapor) berhak merespon tawaran aktif komplain ini. */
export async function canConsumerRespondToOffer(complaintId: string, userId: string) {
  const complaint = await prisma.complaint.findUnique({
    where: { id: complaintId },
    include: { offers: { where: { status: 'MENUNGGU' }, orderBy: { round: 'desc' }, take: 1 } },
  });
  if (!complaint) return { ok: false as const, reason: 'Komplain tidak ditemukan.' };
  if (complaint.reporterId !== userId) {
    return { ok: false as const, reason: 'Ini bukan komplain Anda.' };
  }
  if (complaint.status !== 'MENUNGGU_PERSETUJUAN' || complaint.offers.length === 0) {
    return { ok: false as const, reason: 'Tidak ada tawaran aktif untuk direspon.' };
  }
  return { ok: true as const, complaint, offer: complaint.offers[0] };
}

/**
 * Konsumen menerima tawaran refund sebagian dari produsen — selesai langsung
 * tanpa admin, dana dipecah otomatis via transitionOrder(REFUND_SEBAGIAN).
 */
export async function acceptOffer(complaintId: string, offerId: string, orderId: string, amount: number) {
  await prisma.$transaction([
    prisma.complaintOffer.update({
      where: { id: offerId },
      data: { status: 'DITERIMA', respondedAt: new Date() },
    }),
    prisma.complaint.update({
      where: { id: complaintId },
      data: { status: 'VALID', reviewNote: 'Diselesaikan tanpa admin: konsumen menerima tawaran produsen.' },
    }),
  ]);
  return transitionOrder(orderId, 'REFUND_SEBAGIAN', {
    refundAmount: amount,
    note: 'Konsumen menerima tawaran refund sebagian dari produsen.',
  });
}

/**
 * Konsumen menolak tawaran. Bila masih ada jatah putaran dan konsumen tidak
 * memaksa eskalasi, bola kembali ke produsen untuk menawar ulang (tenggat 12
 * jam baru). Bila putaran sudah habis atau konsumen memilih langsung minta
 * keputusan admin, kasus dieskalasi — final dan mengikat.
 */
export async function rejectOffer(
  complaintId: string,
  offerId: string,
  currentRound: number,
  forceEscalate: boolean,
) {
  await prisma.complaintOffer.update({
    where: { id: offerId },
    data: { status: 'DITOLAK', respondedAt: new Date() },
  });

  const habis = currentRound >= MAX_NEGOTIATION_ROUNDS;
  if (habis || forceEscalate) {
    return prisma.complaint.update({
      where: { id: complaintId },
      data: {
        status: 'DITINJAU',
        adminDeadline: adminDeadlineFrom(),
        reviewNote: habis
          ? `Negosiasi mencapai batas ${MAX_NEGOTIATION_ROUNDS} putaran tanpa kesepakatan — dieskalasi ke admin.`
          : 'Konsumen meminta keputusan admin.',
      },
    });
  }

  return prisma.complaint.update({
    where: { id: complaintId },
    data: {
      status: 'MENUNGGU_SANGGAHAN',
      responseDeadline: responseDeadlineFrom(),
      reviewNote: null,
    },
  });
}

/**
 * Eskalasi komplain yang tenggat sanggahnya lewat tanpa respons produsen.
 * Order tetap SENGKETA (dana tertahan); hanya status komplain yang berubah
 * agar masuk antrian keputusan admin.
 */
export async function escalateExpiredResponses(now: Date = new Date()) {
  const due = await prisma.complaint.findMany({
    where: {
      status: 'MENUNGGU_SANGGAHAN',
      responseDeadline: { lte: now },
    },
    select: { id: true },
  });

  const ids = due.map((d) => d.id);
  if (ids.length === 0) return [];

  await prisma.complaint.updateMany({
    where: { id: { in: ids } },
    data: {
      status: 'DITINJAU',
      adminDeadline: adminDeadlineFrom(),
      reviewNote: 'Dieskalasi otomatis: produsen tidak merespon dalam batas waktu sanggah.',
    },
  });
  return ids;
}

/**
 * Eskalasi tawaran refund sebagian yang tidak direspons konsumen dalam waktu
 * yang sama dengan jendela sanggah produsen (12 jam). Mencegah kasus
 * menggantung selamanya bila konsumen diam terhadap tawaran yang diajukan.
 */
export async function escalateStaleOffers(now: Date = new Date()) {
  const due = await prisma.complaint.findMany({
    where: {
      status: 'MENUNGGU_PERSETUJUAN',
      offers: { some: { status: 'MENUNGGU', createdAt: { lte: new Date(now.getTime() - RESPONSE_WINDOW_MS) } } },
    },
    select: { id: true, orderId: true, offers: { where: { status: 'MENUNGGU' }, select: { id: true } } },
  });
  if (due.length === 0) return [];

  for (const c of due) {
    await prisma.$transaction([
      ...c.offers.map((o) =>
        prisma.complaintOffer.update({ where: { id: o.id }, data: { status: 'DITOLAK', respondedAt: now } }),
      ),
      prisma.complaint.update({
        where: { id: c.id },
        data: {
          status: 'DITINJAU',
          adminDeadline: adminDeadlineFrom(),
          reviewNote: 'Dieskalasi otomatis: konsumen tidak menanggapi tawaran dalam batas waktu.',
        },
      }),
    ]);

    // Beri tahu produsen (best-effort) bahwa kasusnya kini di tangan admin.
    const pid = await producerIdOfOrder(c.orderId);
    const uid = pid ? await userIdOfProducer(pid) : null;
    if (uid) {
      await notify({
        userId: uid,
        kind: 'KOMPLAIN',
        title: 'Kasus dieskalasi ke admin',
        body: 'Konsumen tidak menanggapi tawaran Anda dalam waktu 12 jam — admin akan memutuskan.',
        href: '/app/produsen/komplain',
      });
    }
  }
  return due.map((d) => d.id);
}


/**
 * Fitur #2 — SLA admin. Komplain berstatus DITINJAU yang tenggat keputusan
 * adminnya sudah lewat diselesaikan otomatis dengan refund penuh ke konsumen
 * (default buyer-protection). Dipanggil dari cron terjadwal.
 */
export async function autoResolveStaleAdminDisputes(now: Date = new Date()) {
  const due = await prisma.complaint.findMany({
    where: { status: 'DITINJAU', adminDeadline: { lte: now } },
    select: { id: true, orderId: true },
  });

  const results = [];
  for (const c of due) {
    try {
      await prisma.complaint.update({
        where: { id: c.id },
        data: {
          status: 'VALID',
          reviewNote: 'Auto-refund: admin tidak memutus dalam batas waktu (perlindungan konsumen).',
        },
      });
      await transitionOrder(c.orderId, 'REFUND', {
        note: 'Auto-refund SLA: komplain tidak diputus admin tepat waktu.',
      });
      results.push({ id: c.id, ok: true });
    } catch (e) {
      results.push({ id: c.id, ok: false, error: String(e) });
    }
  }
  return results;
}

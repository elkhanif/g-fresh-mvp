import { prisma } from './db';

// Batas waktu produsen menyanggah komplain sebelum dieskalasi ke admin.
// Dibuat pendek karena komoditas pangan segar butuh penyelesaian cepat.
export const RESPONSE_WINDOW_MS = 12 * 60 * 60 * 1000;

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
      reviewNote: 'Dieskalasi otomatis: produsen tidak merespon dalam batas waktu sanggah.',
    },
  });
  return ids;
}
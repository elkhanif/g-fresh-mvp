import { OrderStatus, EscrowStatus } from '@prisma/client';
import { prisma } from './db';
import { releaseFunds, refundFunds } from './providers/payment';
import { computeRating } from './rating';

// Grace period garansi kesegaran setelah barang DITERIMA (proposal: 2 jam).
export const GRACE_PERIOD_MS = 2 * 60 * 60 * 1000;

// Transisi status yang sah. Menolak lompatan status ilegal (mis. langsung
// DIBAYAR → SELESAI tanpa pengiriman) di satu tempat, bukan tersebar.
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  MENUNGGU_BAYAR: ['DIBAYAR', 'DIBATALKAN'],
  DIBAYAR: ['DIJEMPUT_KURIR', 'DIBATALKAN'],
  DIJEMPUT_KURIR: ['DIKIRIM'],
  DIKIRIM: ['DITERIMA'],
  DITERIMA: ['SELESAI', 'SENGKETA'],
  SENGKETA: ['REFUND', 'SELESAI'],
  SELESAI: [],
  DIBATALKAN: [],
  REFUND: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export class TransitionError extends Error {}

interface TransitionOpts {
  note?: string;
  actorId?: string;
}

/**
 * Hitung ulang skor performa produsen & kurir dari riwayat order terminal.
 * Dipanggil setelah order mencapai SELESAI atau REFUND. Recompute (bukan
 * increment) supaya bebas drift dan self-correcting.
 *
 * `tx` adalah client transaksi Prisma yang sedang aktif.
 */
async function recomputeParticipantRatings(tx: any, orderId: string) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { items: { select: { product: { select: { producerId: true } } } } },
  });
  if (!order) return;

  // Produsen unik dalam order ini.
  const producerIds = [...new Set(order.items.map((i: any) => i.product.producerId))] as string[];
  for (const pid of producerIds) {
    const rows = await tx.order.findMany({
      where: {
        items: { some: { product: { producerId: pid } } },
        status: { in: ['SELESAI', 'REFUND'] },
      },
      select: { status: true },
    });
    const good = rows.filter((r: any) => r.status === 'SELESAI').length;
    const bad = rows.filter((r: any) => r.status === 'REFUND').length;
    await tx.producerProfile.update({
      where: { id: pid },
      data: { ratingScore: computeRating(good, bad) },
    });
  }

  // Kurir order ini.
  if (order.courierId) {
    const good = await tx.order.count({ where: { courierId: order.courierId, status: 'SELESAI' } });
    const bad = await tx.order.count({ where: { courierId: order.courierId, status: 'REFUND' } });
    await tx.courierProfile.update({
      where: { id: order.courierId },
      data: { ratingScore: computeRating(good, bad) },
    });
  }
}

/**
 * Pindahkan order ke status baru dalam satu transaksi DB, sekaligus
 * mengurus efek samping escrow dan pemutakhiran rating. Semua perpindahan
 * status order HARUS lewat sini.
 */
export async function transitionOrder(
  orderId: string,
  to: OrderStatus,
  opts: TransitionOpts = {},
) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new TransitionError('Order tidak ditemukan.');

    if (!canTransition(order.status, to)) {
      throw new TransitionError(`Transisi ${order.status} → ${to} tidak diizinkan.`);
    }

    const data: Record<string, unknown> = { status: to };

    // Efek samping per status.
    if (to === 'DITERIMA') {
      data.gracePeriodEnd = new Date(Date.now() + GRACE_PERIOD_MS);
    }

    if (to === 'SELESAI') {
      if (order.escrowStatus === EscrowStatus.HELD && order.paymentRef) {
        await releaseFunds(order.paymentRef);
      }
      data.escrowStatus = EscrowStatus.RELEASED;
    }

    if (to === 'REFUND' || to === 'DIBATALKAN') {
      if (order.escrowStatus === EscrowStatus.HELD && order.paymentRef) {
        await refundFunds(order.paymentRef);
        data.escrowStatus = EscrowStatus.REFUNDED;
      }
    }

    const updated = await tx.order.update({ where: { id: orderId }, data });
    await tx.orderEvent.create({
      data: { orderId, status: to, note: opts.note, actorId: opts.actorId },
    });

    // Rating dihitung ulang saat order mencapai status terminal transaksi.
    if (to === 'SELESAI' || to === 'REFUND') {
      await recomputeParticipantRatings(tx, orderId);
    }

    return updated;
  });
}

/**
 * Auto-settle: order berstatus DITERIMA yang grace period-nya sudah lewat
 * dan tanpa komplain aktif → otomatis SELESAI (dana ke produsen).
 * Dipanggil dari cron/endpoint terjadwal.
 */
export async function settleExpiredGracePeriods(now: Date = new Date()) {
  const due = await prisma.order.findMany({
    where: {
      status: OrderStatus.DITERIMA,
      gracePeriodEnd: { lte: now },
      complaint: { is: null },
    },
    select: { id: true },
  });

  const results = [];
  for (const o of due) {
    try {
      await transitionOrder(o.id, 'SELESAI', {
        note: 'Auto-settle: grace period lewat tanpa komplain.',
      });
      results.push({ id: o.id, ok: true });
    } catch (e) {
      results.push({ id: o.id, ok: false, error: String(e) });
    }
  }
  return results;
}

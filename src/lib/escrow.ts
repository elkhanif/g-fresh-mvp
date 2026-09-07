import { OrderStatus, EscrowStatus } from '@prisma/client';
import { prisma } from './db';
import { kreditOngkir } from './wallet';
import { releaseFunds, refundFunds } from './providers/payment';
import { computeRating } from './rating';
import { notify, userIdOfProducer, userIdOfCourier } from './notification';

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
  SENGKETA: ['REFUND', 'REFUND_SEBAGIAN', 'SELESAI'],
  SELESAI: [],
  DIBATALKAN: [],
  REFUND: [],
  REFUND_SEBAGIAN: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export class TransitionError extends Error {}

interface TransitionOpts {
  note?: string;
  actorId?: string;
  refundAmount?: number; // untuk REFUND_SEBAGIAN
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
        status: { in: ['SELESAI', 'REFUND', 'REFUND_SEBAGIAN'] },
      },
      select: { status: true },
    });
    const good = rows.filter((r: any) => r.status === 'SELESAI').length;
    const bad = rows.filter((r: any) => r.status !== 'SELESAI').length;
    await tx.producerProfile.update({
      where: { id: pid },
      data: { ratingScore: computeRating(good, bad) },
    });
  }

  // Kurir order ini.
  if (order.courierId) {
    const good = await tx.order.count({ where: { courierId: order.courierId, status: 'SELESAI' } });
    const bad = await tx.order.count({
      where: { courierId: order.courierId, status: { in: ['REFUND', 'REFUND_SEBAGIAN'] } },
    });
    await tx.courierProfile.update({
      where: { id: order.courierId },
      data: { ratingScore: computeRating(good, bad) },
    });
  }
}

// #6 Pesan notifikasi per status, dikirim setelah transaksi DB sukses.
const NOTIF_COPY: Partial<Record<OrderStatus, { title: string; body: string }>> = {
  DIBAYAR: { title: 'Pembayaran diterima', body: 'Dana ditahan sistem sampai pesanan Anda tiba.' },
  DIJEMPUT_KURIR: { title: 'Kurir menuju produsen', body: 'Pesanan Anda sedang dijemput kurir.' },
  DIKIRIM: { title: 'Pesanan dikirim', body: 'Kurir sedang membawa pesanan ke alamat Anda.' },
  DITERIMA: { title: 'Pesanan tiba', body: 'Masa garansi kesegaran 2 jam dimulai sekarang.' },
  SELESAI: { title: 'Pesanan selesai', body: 'Dana telah diteruskan ke produsen. Terima kasih!' },
  SENGKETA: { title: 'Komplain diterima', body: 'Dana ditahan sementara sampai kasus diputuskan.' },
  REFUND: { title: 'Dana dikembalikan', body: 'Refund penuh telah diproses ke metode pembayaran Anda.' },
  REFUND_SEBAGIAN: { title: 'Refund sebagian diproses', body: 'Sebagian dana dikembalikan sesuai keputusan.' },
  DIBATALKAN: { title: 'Pesanan dibatalkan', body: 'Pesanan Anda telah dibatalkan.' },
};

/**
 * Sebar notifikasi ke pihak-pihak terkait setelah status berubah.
 * Best-effort: dijalankan di luar transaksi DB agar kegagalan notifikasi
 * tidak me-rollback perubahan status.
 */
async function fanoutStatusNotifications(orderId: string, to: OrderStatus) {
  const copy = NOTIF_COPY[to];
  if (!copy) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { select: { product: { select: { producerId: true } } } } },
  });
  if (!order) return;

  const shortId = orderId.slice(-6);
  const body = `Pesanan #${shortId} — ${copy.body}`;

  // Konsumen selalu diberi tahu.
  await notify({
    userId: order.consumerId,
    kind: 'ORDER',
    title: copy.title,
    body,
    href: `/app/konsumen/pesanan/${orderId}`,
  });

  // Produsen: saat pesanan dibayar, selesai, atau berujung refund.
  if (['DIBAYAR', 'SELESAI', 'REFUND', 'REFUND_SEBAGIAN', 'SENGKETA'].includes(to)) {
    const producerIds = Array.from(
      new Set(order.items.map((i: { product: { producerId: string } }) => i.product.producerId)),
    ) as string[];
    for (const pid of producerIds) {
      const uid = await userIdOfProducer(pid);
      if (uid) {
        await notify({
          userId: uid,
          kind: to === 'SENGKETA' ? 'KOMPLAIN' : 'ORDER',
          title: to === 'DIBAYAR' ? 'Pesanan baru masuk' : copy.title,
          body,
          href: to === 'SENGKETA' ? '/app/produsen/komplain' : '/app/produsen/pesanan',
        });
      }
    }
  }

  // Kurir: saat pesanan tuntas agar pendapatannya terkonfirmasi.
  if (order.courierId && to === 'SELESAI') {
    const uid = await userIdOfCourier(order.courierId);
    if (uid) {
      await notify({
        userId: uid,
        kind: 'ORDER',
        title: 'Pengiriman tuntas',
        body: `Pesanan #${shortId} selesai — ongkir masuk ke pendapatan Anda.`,
        href: '/app/kurir/riwayat',
      });
    }
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
  const result = await prisma.$transaction(async (tx) => {
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
      // Upah antar masuk ke dompet kurir. Aman dipanggil berulang: baris
      // ongkir per order dijaga unique di basis data.
      if (order.courierId) {
        await kreditOngkir(order.courierId, order.id, order.deliveryFee);
      }
    }

    if (to === 'REFUND' || to === 'DIBATALKAN') {
      if (order.escrowStatus === EscrowStatus.HELD && order.paymentRef) {
        await refundFunds(order.paymentRef);
        data.escrowStatus = EscrowStatus.REFUNDED;
      }
    }

    if (to === 'REFUND_SEBAGIAN') {
      const refund = Math.max(0, Math.min(order.total, opts.refundAmount ?? 0));
      if (refund <= 0 || refund >= order.total) {
        throw new TransitionError('Nominal refund sebagian harus di antara 0 dan total pesanan.');
      }
      if (order.escrowStatus === EscrowStatus.HELD && order.paymentRef) {
        await refundFunds(order.paymentRef, refund); // sebagian ke konsumen
        await releaseFunds(order.paymentRef, order.total - refund); // sisa ke produsen
        data.escrowStatus = EscrowStatus.REFUNDED;
      }
      data.refundAmount = refund;
    }

    const updated = await tx.order.update({ where: { id: orderId }, data });
    await tx.orderEvent.create({
      data: { orderId, status: to, note: opts.note, actorId: opts.actorId },
    });

    // Rating dihitung ulang saat order mencapai status terminal transaksi.
    if (to === 'SELESAI' || to === 'REFUND' || to === 'REFUND_SEBAGIAN') {
      await recomputeParticipantRatings(tx, orderId);
    }

    return updated;
  });

  // Notifikasi di luar transaksi (best-effort, tidak memblokir bisnis).
  await fanoutStatusNotifications(orderId, to);
  return result;
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

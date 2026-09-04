import { prisma } from './db';
import { sendWhatsApp } from './providers/notify';

type Kind = 'ORDER' | 'KOMPLAIN' | 'AKUN' | 'TAGIHAN';

interface NotifyInput {
  userId: string;
  kind?: Kind;
  title: string;
  body: string;
  href?: string;
  alsoWhatsApp?: boolean; // teruskan ke gateway WA (mode mock = log saja)
}

/**
 * Buat notifikasi in-app. Sengaja dibuat "best effort": kegagalan kirim
 * notifikasi TIDAK boleh menggagalkan transaksi bisnis yang memicunya.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        kind: input.kind ?? 'ORDER',
        title: input.title,
        body: input.body,
        href: input.href,
      },
    });

    if (input.alsoWhatsApp) {
      const u = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { phone: true },
      });
      if (u?.phone) await sendWhatsApp(u.phone, `${input.title} — ${input.body}`);
    }
  } catch (e) {
    console.error('[notify] gagal membuat notifikasi:', e);
  }
}

/** Kirim ke banyak penerima sekaligus. */
export async function notifyMany(userIds: string[], input: Omit<NotifyInput, 'userId'>) {
  const unique = [...new Set(userIds)].filter(Boolean);
  await Promise.all(unique.map((userId) => notify({ ...input, userId })));
}

/** Semua user dengan peran tertentu — dipakai untuk memberi tahu operator/dinas. */
export async function notifyRole(role: 'ADMIN' | 'PEMKAB', input: Omit<NotifyInput, 'userId'>) {
  const users = await prisma.user.findMany({ where: { role }, select: { id: true } });
  await notifyMany(users.map((u) => u.id), input);
}

/** Pemilik akun (User.id) dari sebuah produsen — untuk menotifikasi produsen. */
export async function userIdOfProducer(producerId: string): Promise<string | null> {
  const p = await prisma.producerProfile.findUnique({
    where: { id: producerId },
    select: { userId: true },
  });
  return p?.userId ?? null;
}

/** Pemilik akun dari kurir yang ditugaskan pada sebuah order. */
export async function userIdOfCourier(courierId: string): Promise<string | null> {
  const c = await prisma.courierProfile.findUnique({
    where: { id: courierId },
    select: { userId: true },
  });
  return c?.userId ?? null;
}

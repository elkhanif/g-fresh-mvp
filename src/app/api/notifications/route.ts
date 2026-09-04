import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';

// GET /api/notifications — daftar notifikasi + jumlah belum dibaca.
// Dipanggil berkala (polling) oleh lonceng di header.
export async function GET() {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: 'Perlu login.' }, { status: 401 });

  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return NextResponse.json({ items, unread });
}

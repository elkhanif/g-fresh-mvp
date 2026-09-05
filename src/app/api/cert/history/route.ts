import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';

// GET /api/cert/history?producerId=... — jejak keputusan sertifikasi.
// Dinas boleh melihat semua; produsen hanya miliknya sendiri. Riwayat ini
// sengaja dibuka ke produsen: keputusan yang menyangkut dirinya tidak boleh
// jadi kotak hitam.
export async function GET(req: Request) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: 'Tidak berhak.' }, { status: 403 });

  const producerId = new URL(req.url).searchParams.get('producerId');
  if (!producerId) return NextResponse.json({ error: 'producerId wajib.' }, { status: 400 });

  if (user.role === 'PRODUSEN') {
    const own = await prisma.producerProfile.findUnique({ where: { userId: user.id } });
    if (!own || own.id !== producerId) {
      return NextResponse.json({ error: 'Tidak berhak.' }, { status: 403 });
    }
  } else if (user.role !== 'PEMKAB' && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Tidak berhak.' }, { status: 403 });
  }

  const reviews = await prisma.certReview.findMany({
    where: { producerId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  return NextResponse.json({ reviews });
}

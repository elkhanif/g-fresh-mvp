import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// WAJIB. Health check yang di-cache selalu menjawab 'ok' dari hasil build,
// termasuk ketika database sedang mati — pemeriksaan yang tidak pernah bisa
// gagal tidak memeriksa apa pun.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', db: 'up', time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: 'degraded', db: 'down' }, { status: 503 });
  }
}

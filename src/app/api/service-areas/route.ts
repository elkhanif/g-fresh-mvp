import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/service-areas — daftar kecamatan yang saat ini dilayani (publik).
// Dipakai halaman registrasi agar pilihan kecamatan tidak hardcoded dan bisa
// diperluas Admin tanpa deploy ulang.
export async function GET() {
  const areas = await prisma.serviceArea.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { name: true },
  });
  return NextResponse.json(areas.map((a) => a.name));
}

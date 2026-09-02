import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/rbac';

const schema = z.object({
  producerId: z.string(),
  status: z.enum(['MENUNGGU_VERIFIKASI', 'TERVERIFIKASI', 'DITOLAK']),
  certType: z.string().optional(),
  certNote: z.string().optional(),
});

// POST /api/cert — verifikasi sertifikasi produsen (MANUAL, oleh PEMKAB).
// Fase pilot: tidak ada integrasi API ke penerbit sertifikat (roadmap lanjutan).
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user || user.role !== 'PEMKAB') {
    return NextResponse.json({ error: 'Hanya Pemkab (dinas) yang memverifikasi.' }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
  const d = parsed.data;

  const updated = await prisma.producerProfile.update({
    where: { id: d.producerId },
    data: { certStatus: d.status, certType: d.certType, certNote: d.certNote },
  });
  return NextResponse.json(updated);
}

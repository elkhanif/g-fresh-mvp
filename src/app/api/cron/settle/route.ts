import { NextResponse } from 'next/server';
import { settleExpiredGracePeriods } from '@/lib/escrow';
import { escalateExpiredResponses } from '@/lib/complaint';

// GET /api/cron/settle — dipanggil terjadwal (mis. tiap 10 menit) untuk
// menyelesaikan order yang grace period-nya lewat tanpa komplain.
// Lindungi dengan header: Authorization: Bearer $CRON_SECRET
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Tidak berhak.' }, { status: 401 });
    }
  }
  const results = await settleExpiredGracePeriods();
  // Komplain yang tenggat sanggah produsennya lewat → naik ke antrian admin.
  const escalated = await escalateExpiredResponses();
  return NextResponse.json({
    settled: results.length,
    escalated: escalated.length,
    results,
  });
}

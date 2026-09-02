import { NextResponse } from 'next/server';
import { settleExpiredGracePeriods } from '@/lib/escrow';

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
  return NextResponse.json({ settled: results.length, results });
}

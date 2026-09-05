import { NextResponse } from 'next/server';
import { settleExpiredGracePeriods } from '@/lib/escrow';
import { escalateExpiredResponses, escalateStaleOffers, autoResolveStaleAdminDisputes } from '@/lib/complaint';
import { markOverdueInvoices } from '@/lib/b2b';
import { markExpiredCertifications } from '@/lib/cert-expiry';

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
  // Tawaran refund sebagian yang tidak direspons konsumen → naik ke admin.
  const staleOffers = await escalateStaleOffers();
  // Komplain yang tenggat keputusan adminnya lewat → auto-refund ke konsumen.
  const autoRefunded = await autoResolveStaleAdminDisputes();
  // #8: invoice B2B yang melewati jatuh tempo ditandai JATUH_TEMPO.
  const overdue = await markOverdueInvoices();
  // Sertifikasi produsen yang masa berlakunya lewat → KEDALUWARSA + jejak audit.
  const expiredCerts = await markExpiredCertifications();
  return NextResponse.json({
    settled: results.length,
    escalated: escalated.length,
    staleOffersEscalated: staleOffers.length,
    autoRefunded: autoRefunded.length,
    overdueInvoices: overdue,
    expiredCertifications: expiredCerts.length,
    results,
  });
}

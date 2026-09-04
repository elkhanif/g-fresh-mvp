import { prisma } from './db';

// #7 Pencegahan penyalahgunaan mekanisme klaim (proposal 11.3).
//
// Dua lapis:
//   1. HARD LIMIT — batas jumlah klaim per akun per 30 hari. Melebihi = ditolak.
//   2. RISK SCORE — pola mencurigakan diberi skor & penanda, TIDAK memblokir
//      klaim, tapi ditampilkan ke admin sebagai bahan pertimbangan.
//
// Filosofi: jangan menghukum konsumen yang memang sedang dirugikan; cukup
// beri admin konteks agar keputusan lebih adil.

export const CLAIM_LIMIT_PER_30D = 3;
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

// Ambang rasio klaim (klaim / pesanan diterima) yang dianggap tidak wajar.
const HIGH_RATIO = 0.4;
// Klaim yang diajukan pada menit-menit terakhir masa garansi.
const LAST_MINUTE_MS = 15 * 60 * 1000;

export interface ClaimAssessment {
  allowed: boolean;
  reason?: string;
  riskScore: number; // 0-100
  flags: string[];
  claimsIn30d: number;
  deliveredOrders: number;
}

export const FLAG_LABEL: Record<string, string> = {
  RASIO_TINGGI: 'Rasio klaim tinggi',
  MENIT_AKHIR: 'Diajukan di menit akhir garansi',
  KLAIM_BERULANG: 'Klaim berulang dalam 30 hari',
  TANPA_BUKTI: 'Tidak melampirkan bukti',
  AKUN_BARU: 'Akun baru (< 7 hari)',
};

/**
 * Nilai kelayakan & risiko sebuah klaim SEBELUM komplain dibuat.
 * `gracePeriodEnd` dipakai untuk mendeteksi klaim menit-menit terakhir.
 */
export async function assessClaim(opts: {
  userId: string;
  gracePeriodEnd: Date | null;
  hasEvidence: boolean;
  now?: Date;
}): Promise<ClaimAssessment> {
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - WINDOW_MS);

  const [claimsIn30d, deliveredOrders, user] = await Promise.all([
    prisma.complaint.count({ where: { reporterId: opts.userId, createdAt: { gte: since } } }),
    prisma.order.count({
      where: {
        consumerId: opts.userId,
        status: { in: ['DITERIMA', 'SELESAI', 'SENGKETA', 'REFUND', 'REFUND_SEBAGIAN'] },
      },
    }),
    prisma.user.findUnique({ where: { id: opts.userId }, select: { createdAt: true } }),
  ]);

  const flags: string[] = [];
  let riskScore = 0;

  // Hard limit.
  if (claimsIn30d >= CLAIM_LIMIT_PER_30D) {
    return {
      allowed: false,
      reason:
        `Anda sudah mengajukan ${claimsIn30d} klaim dalam 30 hari terakhir ` +
        `(batas ${CLAIM_LIMIT_PER_30D}). Hubungi operator G-Fresh bila ada masalah mendesak.`,
      riskScore: 100,
      flags: ['KLAIM_BERULANG'],
      claimsIn30d,
      deliveredOrders,
    };
  }

  if (claimsIn30d >= 2) {
    flags.push('KLAIM_BERULANG');
    riskScore += 25;
  }

  const ratio = deliveredOrders > 0 ? claimsIn30d / deliveredOrders : 0;
  if (deliveredOrders >= 3 && ratio >= HIGH_RATIO) {
    flags.push('RASIO_TINGGI');
    riskScore += 30;
  }

  if (opts.gracePeriodEnd) {
    const sisa = opts.gracePeriodEnd.getTime() - now.getTime();
    if (sisa > 0 && sisa <= LAST_MINUTE_MS) {
      flags.push('MENIT_AKHIR');
      riskScore += 20;
    }
  }

  if (!opts.hasEvidence) {
    flags.push('TANPA_BUKTI');
    riskScore += 20;
  }

  if (user && now.getTime() - user.createdAt.getTime() < 7 * 24 * 60 * 60 * 1000) {
    flags.push('AKUN_BARU');
    riskScore += 10;
  }

  return {
    allowed: true,
    riskScore: Math.min(100, riskScore),
    flags,
    claimsIn30d,
    deliveredOrders,
  };
}

export function riskLabel(score: number): { text: string; tone: 'green' | 'amber' | 'red' } {
  if (score >= 60) return { text: `Risiko tinggi (${score})`, tone: 'red' };
  if (score >= 30) return { text: `Perlu dicermati (${score})`, tone: 'amber' };
  return { text: `Risiko rendah (${score})`, tone: 'green' };
}

import crypto from 'crypto';
import QRCode from 'qrcode';

const SECRET = process.env.TRACE_SECRET || 'dev-trace-secret-change-me';

/**
 * Kode traceability per item order. Formatnya: <random>.<sig>
 * - random: 10 byte acak (base64url) → tidak bisa ditebak
 * - sig: HMAC-SHA256(random) 8 byte pertama → deteksi kode palsu tanpa query DB
 *
 * Ini BUKAN bukti keaslian panen. Ini memastikan kode berasal dari sistem
 * (anti-tebak/anti-palsu), sementara data waktu panen tetap deklarasi produsen.
 */
export function makeTraceCode(): string {
  const rand = crypto.randomBytes(10).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SECRET)
    .update(rand)
    .digest('base64url')
    .slice(0, 11);
  return `${rand}.${sig}`;
}

export function isValidTraceCodeShape(code: string): boolean {
  const [rand, sig] = code.split('.');
  if (!rand || !sig) return false;
  const expected = crypto
    .createHmac('sha256', SECRET)
    .update(rand)
    .digest('base64url')
    .slice(0, 11);
  // timing-safe compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** URL publik yang di-encode ke dalam QR. */
export function traceUrl(code: string): string {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return `${base}/trace/${encodeURIComponent(code)}`;
}

/** Data-URL PNG QR untuk ditampilkan/di-print produsen. */
export async function qrDataUrl(code: string): Promise<string> {
  return QRCode.toDataURL(traceUrl(code), {
    margin: 1,
    width: 320,
    errorCorrectionLevel: 'M',
  });
}

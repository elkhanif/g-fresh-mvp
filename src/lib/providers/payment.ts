// Abstraksi payment gateway berbentuk escrow.
// CATATAN JUJUR: "escrow" di sini = fitur hold/delayed-settlement dari
// payment gateway (Midtrans/Xendit), BUKAN escrow berlisensi tersendiri.
// Operator tidak menyimpan dana pelanggan → mematuhi arah regulasi BI.
//
// Mode "mock" (default) mensimulasikan alur tanpa memanggil API eksternal,
// supaya prototipe bisa didemokan tanpa kredensial. Ganti PAYMENT_PROVIDER=midtrans
// dan implementasikan pemanggilan Snap/Core API di titik yang ditandai TODO.

export interface ChargeInput {
  orderId: string;
  amount: number;
  customer: { name: string; email: string; phone: string };
}

export interface ChargeResult {
  paymentRef: string; // referensi transaksi di gateway
  redirectUrl?: string; // URL pembayaran (Snap) bila ada
  status: 'pending' | 'held';
}

const provider = process.env.PAYMENT_PROVIDER || 'mock';

export async function createEscrowCharge(input: ChargeInput): Promise<ChargeResult> {
  if (provider === 'midtrans') {
    // TODO(midtrans): panggil Snap createTransaction, set custom_expiry,
    // dan pakai fitur penundaan settlement / manual capture agar dana ditahan.
    throw new Error('Integrasi Midtrans belum dikonfigurasi (isi MIDTRANS_SERVER_KEY).');
  }
  // Mock: anggap dana langsung "held".
  return {
    paymentRef: `MOCK-${input.orderId}-${Date.now()}`,
    status: 'held',
  };
}

export async function releaseFunds(paymentRef: string, amount?: number): Promise<void> {
  if (provider === 'midtrans') {
    // TODO(midtrans): capture / approve settlement ke akun produsen.
    throw new Error('Release Midtrans belum dikonfigurasi.');
  }
  const suffix = amount != null ? ` sebesar ${amount}` : '';
  console.log(`[payment.mock] RELEASE dana ke produsen untuk ${paymentRef}${suffix}`);
}

export async function refundFunds(paymentRef: string, amount?: number): Promise<void> {
  if (provider === 'midtrans') {
    // TODO(midtrans): panggil refund API (partial refund bila amount diisi).
    throw new Error('Refund Midtrans belum dikonfigurasi.');
  }
  const suffix = amount != null ? ` sebesar ${amount}` : ' penuh';
  console.log(`[payment.mock] REFUND dana ke konsumen untuk ${paymentRef}${suffix}`);
}

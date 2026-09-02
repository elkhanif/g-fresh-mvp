// Abstraksi notifikasi (OTP & update transaksi) via WA/SMS gateway.
// Mode "mock" hanya nge-log; ganti NOTIFY_PROVIDER=wa untuk pakai gateway asli.

const provider = process.env.NOTIFY_PROVIDER || 'mock';

export async function sendWhatsApp(to: string, message: string): Promise<void> {
  if (provider === 'wa') {
    const url = process.env.WA_GATEWAY_URL;
    const token = process.env.WA_GATEWAY_TOKEN;
    if (!url) throw new Error('WA_GATEWAY_URL belum diisi.');
    // TODO(wa): sesuaikan payload dengan gateway yang dipakai (mis. Fonnte/Wablas).
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token ?? '' },
      body: JSON.stringify({ target: to, message }),
    });
    return;
  }
  console.log(`[notify.mock] WA → ${to}: ${message}`);
}

export async function sendOtp(phone: string, code: string): Promise<void> {
  await sendWhatsApp(phone, `Kode verifikasi G-Fresh Anda: ${code}. Jangan bagikan ke siapa pun.`);
}

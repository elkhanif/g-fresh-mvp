'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

// Komponen lama, dipertahankan sebagai fallback sederhana bila dibutuhkan
// di tempat lain — untuk panel verifikasi KTP yang sebenarnya, pakai
// KtpReviewCard di bawah (menampilkan bukti sebelum admin memutuskan).
export function CourierVerifyButton({ courierId, verified }: { courierId: string; verified: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function toggle() {
    setLoading(true);
    await fetch('/api/admin/courier-verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courierId, decision: verified ? 'CABUT' : 'VERIFIKASI' }),
    });
    setLoading(false);
    router.refresh();
  }
  return (
    <Button variant={verified ? 'outline' : 'primary'} onClick={toggle} disabled={loading}>
      {verified ? 'Cabut verifikasi' : 'Verifikasi KTP'}
    </Button>
  );
}

// Panel review KTP dengan bukti (NIK + foto) sebelum admin memutuskan.
// Menggantikan toggle biner — admin harus melihat data yang diajukan
// sebelum menyetujui, dan wajib memberi alasan bila menolak.
export function KtpReviewCard({
  courierId, ktpNumber, ktpPhotoUrl, ktpVerified,
}: {
  courierId: string; ktpNumber: string | null; ktpPhotoUrl: string | null; ktpVerified: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');

  async function decide(decision: 'VERIFIKASI' | 'TOLAK' | 'CABUT') {
    setLoading(decision);
    setMsg('');
    const res = await fetch('/api/admin/courier-verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courierId, decision, reason }),
    });
    setLoading('');
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error || 'Gagal.');
      return;
    }
    setShowReject(false);
    router.refresh();
  }

  if (ktpVerified) {
    return (
      <div className="flex items-center gap-2">
        {ktpPhotoUrl && (
          <a href={ktpPhotoUrl} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ktpPhotoUrl} alt="Foto KTP" className="h-12 w-16 rounded border border-leaf-100 object-cover" />
          </a>
        )}
        <Button variant="outline" onClick={() => decide('CABUT')} disabled={!!loading}>
          {loading === 'CABUT' ? '…' : 'Cabut verifikasi'}
        </Button>
      </div>
    );
  }

  if (!ktpPhotoUrl) {
    return <span className="text-xs text-ink/45">Belum mengajukan KTP</span>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <a href={ktpPhotoUrl} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ktpPhotoUrl} alt="Foto KTP" className="h-14 w-20 rounded border border-leaf-100 object-cover" />
        </a>
        <span className="text-sm text-ink/70">NIK: {ktpNumber ?? '—'}</span>
      </div>
      {!showReject ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => decide('VERIFIKASI')} disabled={!!loading}>
            {loading === 'VERIFIKASI' ? '…' : 'Verifikasi'}
          </Button>
          <Button variant="outline" onClick={() => setShowReject(true)} disabled={!!loading}>
            Tolak
          </Button>
        </div>
      ) : (
        <div className="space-y-2 rounded-lg border border-leaf-100 p-2">
          <input
            className="w-full rounded-lg border border-leaf-200 px-3 py-2 text-sm"
            placeholder="Alasan penolakan (mis. foto buram, NIK tidak terbaca)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => decide('TOLAK')} disabled={!!loading || reason.trim().length < 5}>
              {loading === 'TOLAK' ? 'Mengirim…' : 'Kirim penolakan'}
            </Button>
            <Button variant="ghost" onClick={() => setShowReject(false)}>Batal</Button>
          </div>
        </div>
      )}
      {msg && <p className="text-sm text-red-600">{msg}</p>}
    </div>
  );
}

export function ComplaintDecision({ complaintId, orderTotal }: { complaintId: string; orderTotal: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState('');
  const [note, setNote] = useState('');
  const [showPartial, setShowPartial] = useState(false);
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState('');

  async function decide(
    decision: 'VALID' | 'VALID_SEBAGIAN' | 'DITOLAK',
    refundAmount?: number,
  ) {
    setLoading(decision); setMsg('');
    const res = await fetch(`/api/complaints/${complaintId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, reviewNote: note, refundAmount }),
    });
    setLoading('');
    if (!res.ok) { const j = await res.json().catch(() => ({})); setMsg(j.error || 'Gagal.'); return; }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <input
        className="w-full rounded-lg border border-leaf-200 px-3 py-2 text-sm"
        placeholder="Catatan keputusan (opsional)"
        value={note} onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="danger" onClick={() => decide('VALID')} disabled={!!loading}>
          Refund penuh → konsumen
        </Button>
        <Button variant="outline" onClick={() => setShowPartial((v) => !v)} disabled={!!loading}>
          Refund sebagian
        </Button>
        <Button variant="outline" onClick={() => decide('DITOLAK')} disabled={!!loading}>
          Tolak → dana ke produsen
        </Button>
      </div>

      {showPartial && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-leaf-100 p-2">
          <span className="text-sm text-ink/70">Kembalikan Rp</span>
          <input
            type="number" min={1} max={orderTotal - 1} value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-32 rounded-lg border border-leaf-200 px-2 py-1 text-sm"
            placeholder={`1 – ${orderTotal - 1}`}
          />
          <span className="text-xs text-ink/50">dari total {orderTotal.toLocaleString('id-ID')}</span>
          <Button
            variant="danger"
            onClick={() => decide('VALID_SEBAGIAN', Number(amount))}
            disabled={!!loading || !amount || Number(amount) < 1 || Number(amount) >= orderTotal}
          >
            Proses refund sebagian
          </Button>
        </div>
      )}
      {msg && <p className="text-sm text-red-600">{msg}</p>}
    </div>
  );
}

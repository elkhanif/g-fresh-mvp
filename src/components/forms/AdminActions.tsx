'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export function CourierVerifyButton({ courierId, verified }: { courierId: string; verified: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function toggle() {
    setLoading(true);
    await fetch('/api/admin/courier-verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courierId, verified: !verified }),
    });
    setLoading(false);
    router.refresh();
  }
  return (
    <Button variant={verified ? 'outline' : 'primary'} onClick={toggle} disabled={loading}>
      {verified ? 'Batalkan verifikasi' : 'Verifikasi KTP'}
    </Button>
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

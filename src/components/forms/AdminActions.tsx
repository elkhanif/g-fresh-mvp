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

export function ComplaintDecision({ complaintId }: { complaintId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState('');
  const [note, setNote] = useState('');
  async function decide(decision: 'VALID' | 'DITOLAK') {
    setLoading(decision);
    await fetch(`/api/complaints/${complaintId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, reviewNote: note }),
    });
    setLoading('');
    router.refresh();
  }
  return (
    <div className="space-y-2">
      <input
        className="w-full rounded-lg border border-leaf-200 px-3 py-2 text-sm"
        placeholder="Catatan keputusan (opsional)"
        value={note} onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-2">
        <Button variant="danger" onClick={() => decide('VALID')} disabled={!!loading}>
          Valid → refund konsumen
        </Button>
        <Button variant="outline" onClick={() => decide('DITOLAK')} disabled={!!loading}>
          Tolak → teruskan ke produsen
        </Button>
      </div>
    </div>
  );
}

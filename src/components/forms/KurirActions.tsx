'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import type { OrderStatus } from '@prisma/client';

export function KurirAccept({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  async function accept() {
    setLoading(true); setMsg('');
    const res = await fetch(`/api/orders/${orderId}/accept`, { method: 'POST' });
    setLoading(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setMsg(j.error || 'Gagal.'); return; }
    router.refresh();
  }
  return (
    <div>
      <Button onClick={accept} disabled={loading}>{loading ? '…' : 'Ambil tugas'}</Button>
      {msg && <p className="mt-1 text-xs text-red-600">{msg}</p>}
    </div>
  );
}

export function KurirAdvance({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const next = status === 'DIJEMPUT_KURIR' ? 'DIKIRIM' : status === 'DIKIRIM' ? 'DITERIMA' : null;
  const label = next === 'DIKIRIM' ? 'Barang diambil → mulai kirim' : 'Sampai → tandai diterima';
  if (!next) return null;
  async function advance() {
    setLoading(true);
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: next }),
    });
    setLoading(false);
    if (res.ok) router.refresh();
  }
  return <Button onClick={advance} disabled={loading}>{loading ? '…' : label}</Button>;
}

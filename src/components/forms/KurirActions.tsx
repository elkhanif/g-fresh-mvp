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

export function AvailabilityToggle({ active }: { active: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function toggle() {
    setLoading(true);
    await fetch('/api/courier/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    });
    setLoading(false);
    router.refresh();
  }
  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={
        'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ' +
        (active
          ? 'bg-leaf-100 text-leaf-800 hover:bg-leaf-200'
          : 'bg-gray-200 text-gray-600 hover:bg-gray-300')
      }
    >
      <span className={'h-2.5 w-2.5 rounded-full ' + (active ? 'bg-leaf-600' : 'bg-gray-400')} />
      {loading ? 'Memperbarui…' : active ? 'Sedang aktif — terima tugas' : 'Nonaktif — tidak terima tugas'}
    </button>
  );
}

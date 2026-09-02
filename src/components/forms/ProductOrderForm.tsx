'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { rupiah } from '@/lib/utils';

export function ProductOrderForm({ productId, price, unit, maxStock }: {
  productId: string; price: number; unit: string; maxStock: number;
}) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [address, setAddress] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function order(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg('');
    // 1) buat order
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId, qty }], addressText: address }),
    });
    const order = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(order.error || 'Gagal membuat pesanan.'); setLoading(false); return; }
    // 2) langsung bayar (dana ke escrow)
    const pay = await fetch(`/api/orders/${order.id}/pay`, { method: 'POST' });
    setLoading(false);
    if (!pay.ok) { setMsg('Pesanan dibuat, tetapi pembayaran gagal.'); return; }
    router.push(`/app/konsumen/pesanan/${order.id}`);
  }

  return (
    <form onSubmit={order} className="space-y-3">
      <div className="flex items-end gap-3">
        <div className="w-28">
          <Label>Jumlah ({unit})</Label>
          <Input type="number" min={1} max={maxStock} value={qty}
            onChange={(e) => setQty(Math.max(1, Math.min(maxStock, Number(e.target.value))))} />
        </div>
        <div className="pb-2 text-sm text-ink/70">Subtotal: <b>{rupiah(price * qty)}</b> + ongkir</div>
      </div>
      <div>
        <Label>Alamat pengiriman</Label>
        <Input value={address} onChange={(e) => setAddress(e.target.value)} required placeholder="Jl. …, Kec. …" />
      </div>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      <Button type="submit" disabled={loading || maxStock < 1} className="w-full">
        {loading ? 'Memproses…' : 'Bayar & pesan (dana ditahan escrow)'}
      </Button>
    </form>
  );
}

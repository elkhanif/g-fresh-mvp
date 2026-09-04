'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { rupiah } from '@/lib/utils';

export function ProductOrderForm({
  productId, price, unit, maxStock,
  defaultAddress = '', subsidyPct = 0,
  b2bPrice = null, b2bMinQty = null, b2bEligible = false, billingAddress = '',
}: {
  productId: string; price: number; unit: string; maxStock: number;
  defaultAddress?: string; subsidyPct?: number;
  b2bPrice?: number | null; b2bMinQty?: number | null;
  b2bEligible?: boolean; billingAddress?: string;
}) {
  const router = useRouter();
  const [channel, setChannel] = useState<'B2C' | 'B2B'>('B2C');
  const [qty, setQty] = useState(1);
  const [address, setAddress] = useState(defaultAddress);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const grosirAktif =
    channel === 'B2B' && b2bPrice != null && b2bMinQty != null && qty >= b2bMinQty;
  const hargaSatuan = grosirAktif ? (b2bPrice as number) : price;
  const subtotal = hargaSatuan * qty;
  const fee = channel === 'B2B' ? Math.round((subtotal * 0.025) / 100) * 100 : 0;

  function pilihKanal(c: 'B2C' | 'B2B') {
    setChannel(c);
    setMsg('');
    if (c === 'B2B' && b2bMinQty && qty < b2bMinQty) setQty(b2bMinQty);
    if (c === 'B2B' && billingAddress) setAddress(billingAddress);
    if (c === 'B2C') setAddress(defaultAddress);
  }

  async function order(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg('');
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId, qty }], addressText: address, channel }),
    });
    const order = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(order.error || 'Gagal membuat pesanan.'); setLoading(false); return; }

    if (channel === 'B2B') {
      // B2B dibayar bertermin lewat invoice — tidak langsung bayar sekarang.
      setLoading(false);
      router.push(`/app/konsumen/pesanan/${order.id}`);
      return;
    }
    const pay = await fetch(`/api/orders/${order.id}/pay`, { method: 'POST' });
    setLoading(false);
    if (!pay.ok) { setMsg('Pesanan dibuat, tetapi pembayaran gagal.'); return; }
    router.push(`/app/konsumen/pesanan/${order.id}`);
  }

  return (
    <form onSubmit={order} className="space-y-3">
      {b2bEligible && (
        <div className="flex gap-2 rounded-lg bg-leaf-50 p-1">
          {(['B2C', 'B2B'] as const).map((c) => (
            <button
              key={c} type="button" onClick={() => pilihKanal(c)}
              className={
                'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ' +
                (channel === c ? 'bg-white text-leaf-800 shadow-sm' : 'text-ink/60')
              }
            >
              {c === 'B2C' ? 'Beli pribadi' : 'Beli untuk usaha (B2B)'}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-3">
        <div className="w-28">
          <Label>Jumlah ({unit})</Label>
          <Input type="number" min={1} max={maxStock} value={qty}
            onChange={(e) => setQty(Math.max(1, Math.min(maxStock, Number(e.target.value))))} />
        </div>
        <div className="pb-2 text-sm text-ink/70">
          Subtotal: <b>{rupiah(subtotal)}</b>
          {grosirAktif && <span className="ml-1 text-leaf-700">(harga grosir)</span>}
        </div>
      </div>

      {channel === 'B2B' && b2bPrice != null && b2bMinQty != null && !grosirAktif && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Pesan minimal <b>{b2bMinQty} {unit}</b> untuk mendapat harga grosir {rupiah(b2bPrice)}/{unit}.
        </p>
      )}

      {channel === 'B2B' && (
        <div className="rounded-lg bg-leaf-50 px-3 py-2 text-xs text-ink/70">
          <div className="flex justify-between"><span>Biaya layanan platform (2,5%)</span><b>{rupiah(fee)}</b></div>
          <p className="mt-1 text-ink/50">
            Ditagihkan lewat invoice dengan termin 14 hari. Biaya ini mendanai subsidi ongkir
            bagi konsumen rumah tangga.
          </p>
        </div>
      )}

      {channel === 'B2C' && subsidyPct > 0 && (
        <p className="rounded-lg bg-leaf-50 px-3 py-2 text-xs text-leaf-800">
          🎉 Produsen berkinerja baik — Anda dapat <b>subsidi ongkir {subsidyPct}%</b> untuk pesanan ini.
        </p>
      )}

      <div>
        <Label>{channel === 'B2B' ? 'Alamat pengiriman / penagihan' : 'Alamat pengiriman'}</Label>
        <Input value={address} onChange={(e) => setAddress(e.target.value)} required placeholder="Jl. …, Kec. …" />
        {address && (address === defaultAddress || address === billingAddress) && (
          <p className="mt-1 text-xs text-ink/45">Terisi otomatis dari profil Anda.</p>
        )}
      </div>

      {msg && <p className="text-sm text-red-600">{msg}</p>}
      <Button type="submit" disabled={loading || maxStock < 1} className="w-full">
        {loading ? 'Memproses…'
          : channel === 'B2B' ? 'Buat pesanan & terbitkan invoice'
          : 'Bayar & pesan (dana ditahan escrow)'}
      </Button>
    </form>
  );
}

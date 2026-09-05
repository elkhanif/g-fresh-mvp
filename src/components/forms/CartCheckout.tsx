'use client';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { rupiah } from '@/lib/utils';
import { useCart, unitPriceOf } from '@/lib/cart';

const B2B_MIN_SUBTOTAL = 500_000;

/**
 * Halaman checkout keranjang.
 *
 * Satu pesanan boleh memuat produk dari beberapa penjual — model `Order`
 * memang sudah menampung banyak `OrderItem`, dan `/api/orders` sudah menerima
 * array `items` sejak awal. Yang belum ada selama ini cuma antarmukanya.
 *
 * Semua angka di layar ini PERKIRAAN. Harga final, ongkir, subsidi, dan biaya
 * platform dihitung ulang server saat pesanan dibuat.
 */
export function CartCheckout({
  defaultAddress,
  billingAddress,
  b2bEligible,
}: {
  defaultAddress: string;
  billingAddress: string;
  b2bEligible: boolean;
}) {
  const router = useRouter();
  const { items, setQty, remove, clear, ready } = useCart();
  const [channel, setChannel] = useState<'B2C' | 'B2B'>('B2C');
  const [address, setAddress] = useState(defaultAddress);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const subtotal = items.reduce((a, i) => a + unitPriceOf(i, channel) * i.qty, 0);
  const feeB2b = channel === 'B2B' ? Math.round((subtotal * 0.025) / 100) * 100 : 0;
  const kurangB2b = channel === 'B2B' && subtotal < B2B_MIN_SUBTOTAL;

  // Dikelompokkan per penjual supaya pembeli paham barangnya datang dari
  // beberapa kios/petani, bukan satu gudang.
  const perPenjual = items.reduce<Record<string, typeof items>>((acc, i) => {
    (acc[i.producerName] ||= []).push(i);
    return acc;
  }, {});

  function gantiKanal(c: 'B2C' | 'B2B') {
    setChannel(c);
    setMsg('');
    setAddress(c === 'B2B' && billingAddress ? billingAddress : defaultAddress);
  }

  async function checkout() {
    setLoading(true);
    setMsg('');
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
        addressText: address,
        channel,
      }),
    });
    const order = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(order.error || 'Gagal membuat pesanan.');
      setLoading(false);
      return;
    }

    if (channel === 'B2B') {
      // B2B tidak dibayar sekarang — ditagihkan lewat invoice bertermin.
      clear();
      router.push(`/app/konsumen/pesanan/${order.id}`);
      return;
    }

    const pay = await fetch(`/api/orders/${order.id}/pay`, { method: 'POST' });
    setLoading(false);
    if (!pay.ok) {
      // Pesanan sudah terbentuk, jadi keranjang tetap dikosongkan supaya
      // pembeli tidak memesan dua kali. Pembayaran bisa diulang dari halaman
      // pesanan.
      clear();
      router.push(`/app/konsumen/pesanan/${order.id}`);
      return;
    }
    clear();
    router.push(`/app/konsumen/pesanan/${order.id}`);
  }

  if (!ready) return <Card><p className="text-ink/50">Memuat keranjang…</p></Card>;

  if (items.length === 0) {
    return (
      <Card className="text-center">
        <p className="text-ink/60">Keranjang Anda masih kosong.</p>
        <Link
          href="/app/konsumen"
          className="mt-3 inline-block rounded-lg bg-leaf-600 px-4 py-2 text-sm font-medium text-white hover:bg-leaf-700"
        >
          Mulai belanja
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,20rem]">
      <div className="space-y-4">
        {Object.entries(perPenjual).map(([penjual, baris]) => (
          <Card key={penjual} className="space-y-3">
            <p className="text-sm font-medium">{penjual}</p>
            {baris.map((i) => {
              const harga = unitPriceOf(i, channel);
              const grosir = harga !== i.price;
              return (
                <div key={i.productId} className="flex items-start gap-3 border-t border-leaf-50 pt-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-leaf-50">
                    {i.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.photoUrl} alt={i.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-leaf-300"><Icon name="basket" size={24} /></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{i.name}</p>
                    <p className="text-sm text-ink/60">
                      {rupiah(harga)}/{i.unit}
                      {grosir && <span className="ml-1 text-leaf-700">(grosir)</span>}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex items-center rounded-lg border border-leaf-200">
                        <button
                          type="button"
                          onClick={() => setQty(i.productId, i.qty - 1)}
                          className="px-2.5 py-1 text-leaf-700"
                          aria-label="Kurangi"
                        >
                          −
                        </button>
                        <span className="min-w-[2.5rem] text-center text-sm">{i.qty}</span>
                        <button
                          type="button"
                          onClick={() => setQty(i.productId, i.qty + 1)}
                          className="px-2.5 py-1 text-leaf-700 disabled:opacity-40"
                          disabled={i.qty >= i.stock}
                          aria-label="Tambah"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(i.productId)}
                        className="text-xs text-ink/50 hover:text-red-600"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                  <p className="font-medium">{rupiah(harga * i.qty)}</p>
                </div>
              );
            })}
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        <Card className="space-y-3">
          {b2bEligible && (
            <div className="flex gap-2 rounded-lg bg-leaf-50 p-1">
              {(['B2C', 'B2B'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => gantiKanal(c)}
                  className={
                    'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ' +
                    (channel === c ? 'bg-white text-leaf-800 shadow-sm' : 'text-ink/60')
                  }
                >
                  {c === 'B2C' ? 'Eceran' : 'Grosir (B2B)'}
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-between text-sm">
            <span className="text-ink/60">Subtotal ({items.length} produk)</span>
            <b>{rupiah(subtotal)}</b>
          </div>
          {channel === 'B2B' && (
            <div className="flex justify-between text-sm">
              <span className="text-ink/60">Biaya layanan (2,5%)</span>
              <b>{rupiah(feeB2b)}</b>
            </div>
          )}
          <p className="text-xs text-ink/50">
            Ongkir dan subsidi dihitung server saat pesanan dibuat, berdasarkan jarak dan reputasi
            produsen.
          </p>

          {kurangB2b && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Pesanan grosir minimal {rupiah(B2B_MIN_SUBTOTAL)}. Tambah lagi{' '}
              {rupiah(B2B_MIN_SUBTOTAL - subtotal)} atau pindah ke Eceran.
            </p>
          )}

          <div>
            <Label>{channel === 'B2B' ? 'Alamat pengiriman / penagihan' : 'Alamat pengiriman'}</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              placeholder="Jl. …, Kec. …"
            />
          </div>

          {msg && <p className="text-sm text-red-600">{msg}</p>}

          <Button
            variant="cta"
            className="w-full"
            disabled={loading || kurangB2b || !address.trim()}
            onClick={checkout}
          >
            {loading
              ? 'Memproses…'
              : channel === 'B2B'
                ? 'Buat pesanan & terbitkan invoice'
                : 'Bayar & pesan (dana ditahan escrow)'}
          </Button>

          <p className="text-xs text-ink/50">
            {channel === 'B2B'
              ? 'Ditagihkan lewat invoice dengan termin 14 hari.'
              : 'Setelah bayar, dana ditahan sistem (escrow) dan baru diteruskan ke produsen setelah Anda menerima pesanan.'}
          </p>
        </Card>

        <button
          type="button"
          onClick={clear}
          className="w-full text-xs text-ink/50 hover:text-red-600"
        >
          Kosongkan keranjang
        </button>
      </div>
    </div>
  );
}

'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useCart, type CartItem } from '@/lib/cart';

/**
 * Tombol "+ Keranjang".
 *
 * Dua tampilan: `compact` untuk kartu produk di katalog (satu tombol), dan
 * penuh untuk halaman detail (stepper − 1 + lalu tombol).
 */
export function AddToCart({
  item,
  compact = false,
}: {
  item: Omit<CartItem, 'qty'>;
  compact?: boolean;
}) {
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [masuk, setMasuk] = useState(false);
  const habis = item.stock < 1;

  function tambah() {
    add(item, compact ? 1 : qty);
    setMasuk(true);
    // Konfirmasi singkat, lalu kembali ke keadaan semula supaya tombolnya
    // bisa dipakai lagi tanpa memuat ulang halaman.
    setTimeout(() => setMasuk(false), 1800);
  }

  if (compact) {
    return (
      <Button
        className="w-full"
        disabled={habis}
        onClick={(e) => {
          // Kartu produk dibungkus <Link>; tanpa ini klik tombol ikut
          // membuka halaman detail.
          e.preventDefault();
          e.stopPropagation();
          tambah();
        }}
      >
        {habis ? 'Stok habis' : masuk ? '✓ Masuk keranjang' : '+ Keranjang'}
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-lg border border-leaf-200">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="px-3 py-2 text-lg leading-none text-leaf-700 disabled:opacity-40"
            disabled={qty <= 1 || habis}
            aria-label="Kurangi"
          >
            −
          </button>
          <span className="min-w-[3rem] text-center font-medium">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(item.stock, q + 1))}
            className="px-3 py-2 text-lg leading-none text-leaf-700 disabled:opacity-40"
            disabled={qty >= item.stock || habis}
            aria-label="Tambah"
          >
            +
          </button>
        </div>
        <span className="text-sm text-ink/60">
          {item.stock} {item.unit} tersedia
        </span>
      </div>

      <Button className="w-full" disabled={habis} onClick={tambah}>
        {habis ? 'Stok habis' : masuk ? '✓ Masuk keranjang' : '+ Keranjang'}
      </Button>

      {masuk && (
        <Link
          href="/app/konsumen/keranjang"
          className="block rounded-lg bg-accent-500 px-4 py-2 text-center text-sm font-medium text-white hover:bg-accent-600"
        >
          Lihat keranjang & bayar
        </Link>
      )}
    </div>
  );
}

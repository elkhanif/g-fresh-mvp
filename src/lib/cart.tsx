'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Keranjang belanja lintas penjual ("troli tunggal pasar").
 *
 * Sengaja disimpan di localStorage, bukan tabel database. Alasannya: isi
 * keranjang belum jadi komitmen apa pun — belum ada uang, belum ada stok yang
 * direservasi. Menyimpannya di server berarti menambah tabel, endpoint, dan
 * pertanyaan "kapan keranjang basi" tanpa manfaat nyata di fase ini.
 *
 * Harga di sini cuma untuk TAMPILAN. Harga yang mengikat tetap dihitung ulang
 * server saat checkout (`/api/orders` membaca harga produk dari database),
 * jadi keranjang yang basi atau diutak-atik lewat devtools tidak bisa
 * menggeser harga sepeser pun.
 */

export type CartItem = {
  productId: string;
  name: string;
  unit: string;
  price: number;
  b2bPrice: number | null;
  b2bMinQty: number | null;
  stock: number;
  photoUrl: string | null;
  producerId: string;
  producerName: string;
  qty: number;
};

type CartCtx = {
  items: CartItem[];
  count: number;
  add: (item: Omit<CartItem, 'qty'>, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  ready: boolean;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = 'gfresh.cart.v1';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  // `ready` mencegah kedipan: sebelum localStorage terbaca, jumlah keranjang
  // masih 0 dan badge akan berkedip dari 0 ke angka sebenarnya.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // Isi rusak (versi lama / diutak-atik) — mulai dari keranjang kosong.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      // Kuota penuh atau mode privat: keranjang tetap jalan untuk sesi ini.
    }
  }, [items, ready]);

  const api = useMemo<CartCtx>(
    () => ({
      items,
      count: items.reduce((a, i) => a + i.qty, 0),
      ready,
      add: (item, qty = 1) =>
        setItems((cur) => {
          const ada = cur.find((i) => i.productId === item.productId);
          if (ada) {
            return cur.map((i) =>
              i.productId === item.productId
                ? { ...i, qty: Math.min(i.stock, i.qty + qty) }
                : i,
            );
          }
          return [...cur, { ...item, qty: Math.min(item.stock, qty) }];
        }),
      setQty: (productId, qty) =>
        setItems((cur) =>
          cur.map((i) =>
            i.productId === productId ? { ...i, qty: Math.max(1, Math.min(i.stock, qty)) } : i,
          ),
        ),
      remove: (productId) => setItems((cur) => cur.filter((i) => i.productId !== productId)),
      clear: () => setItems([]),
    }),
    [items, ready],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCart harus dipakai di dalam <CartProvider>.');
  return c;
}

// Harga satuan yang berlaku untuk sebuah baris keranjang pada kanal tertentu.
// Dipakai hanya untuk menampilkan perkiraan; server tetap menghitung ulang.
export function unitPriceOf(item: CartItem, channel: 'B2C' | 'B2B') {
  const grosir =
    channel === 'B2B' && item.b2bPrice != null && item.b2bMinQty != null && item.qty >= item.b2bMinQty;
  return grosir ? (item.b2bPrice as number) : item.price;
}

'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';

/**
 * Kolom pencarian katalog.
 *
 * Dropdown kategori DIHAPUS: baris ikon kategori tepat di atasnya melakukan
 * hal yang sama persis, dan dua kontrol untuk satu fungsi membuat layar
 * mobile penuh tanpa menambah kemampuan apa pun.
 *
 * Tinggi ditekan ke ~38px (dari ~48px). Elemen tertinggi di dalam kotak ini
 * adalah tombol "Cari", bukan input-nya — jadi padding tombol yang dikecilkan
 * lebih dulu, baru padding kotak. Angka ini masih jauh di bawah `max-h-20`
 * di StickyCatalogBar, jadi animasi buka-tutupnya tidak perlu disetel ulang.
 */
export function SearchFilter({ initialQ, initialCat }: { initialQ: string; initialCat: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);

  function apply(nextQ: string, nextCat: string) {
    const p = new URLSearchParams();
    if (nextQ.trim()) p.set('q', nextQ.trim());
    if (nextCat) p.set('kategori', nextCat);
    router.push('/app/konsumen' + (p.toString() ? `?${p}` : ''));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        apply(q, initialCat);
      }}
      className="mb-3"
    >
      <div className="flex items-center gap-2 rounded-lg border border-leaf-200 bg-white px-3 py-1.5 focus-within:border-leaf-400">
        <span className="text-ink/40">
          <Icon name="search" size={16} />
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari bayam, bandeng, beras…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-hidden placeholder:text-ink/35"
        />
        {(q || initialQ || initialCat) && (
          <button
            type="button"
            onClick={() => {
              setQ('');
              apply('', '');
            }}
            className="shrink-0 text-xs text-ink/45 hover:text-red-600"
          >
            Reset
          </button>
        )}
        <button
          type="submit"
          className="shrink-0 rounded-md bg-leaf-600 px-3 py-1 text-xs font-medium text-white hover:bg-leaf-700"
        >
          Cari
        </button>
      </div>
    </form>
  );
}
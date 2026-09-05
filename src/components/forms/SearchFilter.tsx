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
      className="mb-4"
    >
      <div className="flex items-center gap-2 rounded-xl border border-leaf-200 bg-white px-3 py-2 focus-within:border-leaf-400">
        <span className="text-ink/40">
          <Icon name="search" size={19} />
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari bayam, bandeng, beras…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35"
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
          className="shrink-0 rounded-lg bg-leaf-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-leaf-700"
        >
          Cari
        </button>
      </div>
    </form>
  );
}

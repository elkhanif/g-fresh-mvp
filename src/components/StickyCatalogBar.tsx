'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Bilah katalog yang menempel di bawah header.
 *
 * Isinya dua bagian dengan perlakuan berbeda:
 *  - `tabs` (Eceran/Grosir) SELALU terlihat. Kanal harga menentukan arti
 *    seluruh angka di halaman; menyembunyikannya saat scroll berarti orang
 *    bisa lupa sedang melihat harga grosir.
 *  - `search` menyusut saat scroll ke BAWAH dan muncul lagi saat scroll ke
 *    ATAS. Gerakan ke atas hampir selalu berarti "aku mau cari lagi", jadi
 *    kolom cari dimunculkan tepat saat dibutuhkan tanpa memakan layar
 *    selamanya.
 *
 * `top-12` mengunci ke tinggi header (h-12 di src/app/app/layout.tsx).
 * Kalau tinggi header diubah, angka ini WAJIB ikut diubah — kalau tidak,
 * akan ada celah atau tumpang tindih.
 *
 * Saat tersembunyi kolom cari diberi `invisible`, bukan cuma `max-h-0`.
 * Tanpa itu input-nya masih bisa dicapai lewat tombol Tab meski tidak
 * terlihat — fokus keyboard melompat ke tempat yang tidak ada di layar.
 */
export function StickyCatalogBar({
  tabs,
  search,
}: {
  tabs: React.ReactNode;
  search: React.ReactNode;
}) {
  const [tampilCari, setTampilCari] = useState(true);
  const terakhir = useRef(0);

  useEffect(() => {
    terakhir.current = window.scrollY;

    function onScroll() {
      const y = window.scrollY;
      const delta = y - terakhir.current;

      // Ambang 6px: tanpa ini getaran kecil saat menyentuh layar sudah
      // cukup untuk memicu buka-tutup dan kolomnya berkedip.
      if (Math.abs(delta) < 6) return;

      // Dekat puncak halaman selalu tampil, apa pun arah scroll-nya.
      if (y < 80) setTampilCari(true);
      else setTampilCari(delta < 0);

      terakhir.current = y;
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="sticky top-12 z-20 -mx-5 mb-4 border-b border-leaf-100 bg-white/95 px-5 pt-3 backdrop-blur">
      {tabs}
      <div
        className={
          'overflow-hidden transition-all duration-200 ' +
          (tampilCari ? 'max-h-20 opacity-100' : 'invisible max-h-0 opacity-0')
        }
      >
        {search}
      </div>
    </div>
  );
}

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
 *    ATAS. Gerakan ke atas hampir selalu berarti "aku mau cari lagi".
 *
 * DUA angka mengunci ke src/app/app/layout.tsx, dan keduanya wajib ikut
 * berubah kalau layout diubah:
 *  - `top-12` → tinggi header (h-12)
 *  - `-mt-6`  → padding atas container (pt-6)
 *
 * Soal `-mt-6`: `-mx-5` sudah membatalkan `px-5` container, tapi `pt-6`-nya
 * dulu dibiarkan. Akibatnya di scrollY 0 bilah ini duduk di 48+24=72px,
 * sementara titik lengketnya 48px — selisih 24px itu tampil sebagai pita
 * latar abu di antara header dan tab Eceran/Grosir, dan hilang sendiri
 * begitu di-scroll turun. Terlihat seperti glitch render, padahal murni
 * jarak. `-mt-6` membuat bilah rata dengan header di SEMUA posisi scroll.
 *
 * ---------------------------------------------------------------------------
 * KENAPA ADA COOLDOWN + overflow-anchor: none
 *
 * Menyusutkan kolom cari MENGUBAH TINGGI DOKUMEN. Chrome punya scroll
 * anchoring: kalau konten di atas viewport berubah tinggi, browser menggeser
 * scrollY agar tampilan tetap stabil. Akibatnya terbentuk loop:
 *
 *   scroll turun → cari disembunyikan → dokumen menyusut → browser menggeser
 *   scrollY ke atas → handler membacanya sebagai "scroll ke atas" → cari
 *   dimunculkan → dokumen tumbuh → browser menggeser lagi → dan seterusnya.
 *
 * Kolomnya berkedip terus di posisi scroll tertentu. Tiga penangkal, dan
 * ketiganya perlu — bukan salah satu:
 *   1. `overflow-anchor: none` → minta browser TIDAK mengompensasi.
 *      Sudah menutup sebagian besar kasus, tapi tidak semua mesin browser
 *      menghormatinya, jadi tidak boleh jadi satu-satunya pertahanan.
 *   2. Cooldown 400ms setelah tiap perubahan (transisi 200ms) → geseran
 *      apa pun yang lahir dari perubahan kita sendiri diabaikan, dan
 *      titik acuan di-nol-kan ulang ke posisi baru.
 *   3. Ambang 14px → getaran sentuhan dan sisa geseran kecil tidak cukup
 *      untuk memicu apa pun.
 * ---------------------------------------------------------------------------
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
  const beku = useRef(0); // performance.now() sampai kapan scroll diabaikan
  const nilaiKini = useRef(true); // cermin state, dibaca di dalam listener
  const menunggu = useRef(false); // throttle satu frame

  useEffect(() => {
    terakhir.current = window.scrollY;

    function periksa() {
      menunggu.current = false;
      const y = window.scrollY;
      const now = performance.now();

      // Masih dalam cooldown: jangan ambil keputusan, cuma perbarui acuan.
      // Tanpa ini geseran hasil perubahan kita sendiri terbaca sebagai
      // gerakan pengguna dan loop-nya hidup lagi.
      if (now < beku.current) {
        terakhir.current = y;
        return;
      }

      const delta = y - terakhir.current;
      if (Math.abs(delta) < 14) return;
      terakhir.current = y;

      // Dekat puncak halaman selalu tampil, apa pun arah scroll-nya.
      const berikut = y < 80 ? true : delta < 0;
      if (berikut === nilaiKini.current) return;

      nilaiKini.current = berikut;
      setTampilCari(berikut);
      beku.current = now + 400; // > durasi transisi (200ms)
    }

    function onScroll() {
      if (menunggu.current) return;
      menunggu.current = true;
      requestAnimationFrame(periksa);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className="sticky top-12 z-20 -mx-5 -mt-6 mb-4 border-b border-leaf-100 bg-white/95 px-5 pt-3 backdrop-blur"
      style={{ overflowAnchor: 'none' }}
    >
      {tabs}
      {/* `invisible` saat tersembunyi, bukan cuma max-h-0: tanpa itu input-nya
          masih bisa dicapai lewat tombol Tab meski tidak terlihat. */}
      <div
        className={
          'overflow-hidden transition-all duration-200 ' +
          (tampilCari ? 'max-h-20 opacity-100' : 'invisible max-h-0 opacity-0')
        }
        style={{ overflowAnchor: 'none' }}
      >
        {search}
      </div>
    </div>
  );
}
'use client';
import { useEffect } from 'react';

/**
 * Panel yang muncul dari bawah di HP dan mengapung di tengah pada layar lebar.
 *
 * Bentuk dan ukurannya disamakan dengan modal yang sudah dipakai
 * `ProductActions` ("Ubah harga", "Sesuaikan stok"), supaya produsen melihat
 * satu pola yang sama untuk semua form: naik dari bawah, sudut atas membulat,
 * tinggi maksimum 85vh. Modal di ProductActions masih versi lokalnya sendiri;
 * memindahkannya ke komponen ini tinggal ganti impor, dan lebih baik dikerjakan
 * terpisah supaya perubahan tampilan tidak bercampur dengan perubahan form
 * harga/stok yang sudah jalan.
 *
 * Tiga hal yang ditambahkan dibanding modal lokal tersebut:
 *  - tombol Esc menutup panel (formulir panjang di HP hampir mustahil ditutup
 *    kalau tombol × ter-scroll ke atas);
 *  - scroll halaman di belakang dikunci, jadi menggeser di dalam form tidak
 *    ikut menggeser daftar produk di belakangnya;
 *  - `role="dialog"` + `aria-modal` + `aria-label`, sehingga pembaca layar
 *    mengumumkan panelnya alih-alih membacakan halaman di belakangnya.
 *
 * Klik pada latar gelap menutup panel, tapi klik di dalam panel tidak —
 * `stopPropagation` di sini penting karena form di dalamnya punya banyak
 * kontrol, dan satu klik yang salah menutup panel akan membuang seluruh isian.
 */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const sebelumnya = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = sebelumnya;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 shadow-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="font-semibold tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl leading-none text-ink/50 hover:bg-leaf-50"
            aria-label="Tutup"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

import { cn } from '@/lib/utils';

/**
 * Logo aplikasi. SATU tempat yang tahu nama berkasnya.
 *
 * Sebelum komponen ini ada, `/logo.svg` cuma dipakai di header /app, sementara
 * halaman login, daftar, dan landing memakai wordmark teks. Menambahkannya satu
 * per satu berarti empat tempat yang harus diingat waktu logonya ganti lagi.
 *
 * `<img>` biasa, BUKAN `next/image`, mengikuti pemakaian yang sudah ada di
 * header /app. Untuk SVG statis di `public/`, `next/image` tidak
 * mengoptimalkan apa pun — cuma menambah keharusan menulis width/height yang
 * rasionya wajib cocok dengan viewBox, dan kalau meleset gambarnya melar
 * halus tanpa error apa pun.
 *
 * Tingginya diatur pemanggil lewat `className` (`h-7`, `h-8`, …); lebarnya
 * `w-auto` supaya rasio aslinya tidak pernah dipaksa.
 */
export function Logo({
  className,
  /**
   * Kosongkan bila logo ini berada di dalam elemen yang sudah punya nama
   * sendiri — misalnya `<Link aria-label="G-Fresh">` — supaya pembaca layar
   * tidak menyebut "G-Fresh" dua kali.
   */
  alt = 'G-Fresh',
}: {
  className?: string;
  alt?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo.svg" alt={alt} className={cn('h-7 w-auto', className)} />
  );
}

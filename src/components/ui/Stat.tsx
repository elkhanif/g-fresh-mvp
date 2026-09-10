import { cn } from '@/lib/utils';

/**
 * Angka ringkasan.
 *
 * SENGAJA BUKAN <Card>. Sebelumnya stat, kartu tugas, kartu produk, peringatan,
 * dan empty state semuanya memakai <Card> yang sama — putih, border leaf-100,
 * radius sama, shadow sama. Halaman jadi tumpukan kotak kembar dan tidak ada
 * satu pun yang terbaca lebih penting. Angka ringkasan itu latar belakang
 * pekerjaan, bukan pekerjaannya, jadi di sini dia diberi latar hijau sangat
 * muda tanpa border: mundur satu lapis dari latar halaman (#f8f9fa), sehingga
 * kartu putih di sekitarnya justru maju ke depan. Hierarki datang dari
 * perbedaan ini, bukan dari mengecilkan huruf.
 *
 * `tabular-nums` wajib: tanpa itu digit di Rp1.250.000 punya lebar berbeda dan
 * tiga kotak bersebelahan tidak sejajar.
 *
 * Ukuran angka DIKUNCI di satu nilai. Dulu halaman produsen memakai text-2xl
 * untuk jumlah pesanan tapi text-lg untuk omzet, semata karena rupiah lebih
 * panjang. Hasilnya baris angka bergelombang. Solusinya bukan mengecilkan satu
 * angka, tapi memberi rupiah ruang: di layar sempit grid-nya 2 kolom, bukan 3.
 */
export function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string;
  /** `warn` hanya untuk angka yang menuntut tindakan, mis. stok habis > 0. */
  tone?: 'default' | 'warn';
}) {
  return (
    <div className="rounded-xl bg-leaf-50/70 px-3.5 py-3">
      <p className="text-xs text-ink/55">{label}</p>
      <p
        className={cn(
          'mt-1 text-xl font-semibold tabular-nums sm:text-2xl',
          tone === 'warn' ? 'text-accent-700' : 'text-leaf-700',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs leading-snug text-ink/45">{hint}</p>}
    </div>
  );
}

/**
 * Pembungkus baris stat. Di bawah `sm` selalu 2 kolom supaya nilai rupiah
 * punya ~160px dan tidak terpotong di HP 360px.
 */
export function StatRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>;
}

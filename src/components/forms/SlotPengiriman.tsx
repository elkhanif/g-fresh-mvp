'use client';
import { labelTutup, type Jendela } from '@/lib/slot';

/**
 * Pemilih jendela pengiriman.
 *
 * DAFTARNYA DATANG DARI SERVER, tidak dihitung di sini. Yang menolak pesanan
 * saat tombol bayar ditekan adalah jam server; kalau komponen ini menghitung
 * sendiri dari jam HP — yang sering salah beberapa menit sampai beberapa jam —
 * pembeli bisa memilih jendela yang tampak terbuka lalu ditolak tanpa sebab
 * yang terlihat. Satu jam untuk menampilkan dan memutuskan.
 *
 * YANG SUDAH TUTUP TIDAK DITAMPILKAN, bukan ditampilkan dalam keadaan mati.
 * Pukul 14.00, rit pagi dan siang hari ini sudah lewat; menampilkan keduanya
 * sebagai tombol kelabu berarti dua per tiga pilihan di layar tidak bisa
 * diketuk. Yang ditampilkan adalah jendela terdekat yang masih bisa dipesan,
 * dengan tanggalnya melekat — karena "pagi" tanpa tanggal tidak menjawab
 * apa pun bagi orang yang memesan malam hari.
 */
export function SlotPengiriman({
  jendela,
  value,
  onChange,
}: {
  jendela: Jendela[];
  value: string | null;
  onChange: (nilai: string) => void;
}) {
  if (jendela.length === 0) {
    return (
      <div>
        <p className="mb-1 text-sm font-medium">Jendela pengiriman</p>
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
          Belum ada rit yang bisa dipesan saat ini. Coba lagi beberapa saat lagi.
        </p>
      </div>
    );
  }

  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">Jendela pengiriman</legend>
      <div className="space-y-2">
        {jendela.map((j) => {
          const dipilih = value === j.nilai;
          return (
            <label
              key={j.nilai}
              className={
                'flex cursor-pointer items-baseline gap-2 rounded-lg border px-3 py-2 transition ' +
                (dipilih
                  ? 'border-leaf-600 bg-leaf-50 ring-1 ring-leaf-600/25'
                  : 'border-leaf-200 hover:bg-leaf-50/60')
              }
            >
              {/* Radio asli tetap ada meski disembunyikan: tanpa itu, pilihan
                  tidak bisa dipindah dengan panah keyboard dan pembaca layar
                  tidak tahu ini satu kelompok pilihan. */}
              <input
                type="radio"
                name="jendela-pengiriman"
                className="sr-only"
                checked={dipilih}
                onChange={() => onChange(j.nilai)}
              />
              <span className={'text-sm font-medium ' + (dipilih ? 'text-leaf-800' : 'text-ink')}>
                {j.labelHari}
              </span>
              <span className="text-sm tabular-nums text-ink/70">{j.labelJam}</span>
              <span className="ms-auto shrink-0 text-xs text-ink/45">{labelTutup(j.kode)}</span>
            </label>
          );
        })}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-ink/50">
        Pengiriman jalan tiga kali sehari: 06.00–08.00, 10.00–13.00, 15.00–18.00. Rit yang sudah
        lewat batas pesan tidak ditampilkan.
      </p>
    </fieldset>
  );
}

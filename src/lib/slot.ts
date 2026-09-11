/**
 * Jendela pengiriman (tiga rit per hari).
 *
 * Barang segar tidak diantar satu-satu begitu pesanan masuk — kurir
 * mengumpulkan beberapa pesanan lalu jalan sekali per rit. Jadwalnya:
 * pagi 06.00–08.00, siang 10.00–13.00, sore 15.00–18.00.
 *
 * TIGA HAL YANG MEMBUAT BERKAS INI ADA, dan bukan sekadar array jam:
 *
 * 1. ZONA WAKTU DITULIS EKSPLISIT, TIDAK MEWARISI JAM SERVER.
 *    Aplikasi ini jalan di Vercel, yang servernya berzona UTC. `new Date()
 *    .getHours()` di server mengembalikan 7 jam lebih awal daripada jam
 *    dinding Gresik: pukul 14.00 WIB terbaca 07.00, jadi slot sore yang
 *    seharusnya sudah tutup masih dianggap terbuka — dan slot pagi yang
 *    sudah lewat ikut terbuka. Kesalahan jenis ini lolos semua typecheck dan
 *    baru ketahuan dari keluhan. Karena itu seluruh perhitungan di sini
 *    memakai "menit sejak tengah malam WIB" yang dihitung sendiri dari
 *    offset tetap +07.00. WIB tidak punya DST, jadi offset tetap aman —
 *    inilah satu-satunya alasan cara ini boleh dipakai.
 *
 * 2. SETIAP SLOT PUNYA BATAS PEMESANAN (CUTOFF).
 *    Tanpa itu, ada yang memesan pukul 07.55 untuk rit 06.00–08.00 yang
 *    motornya sudah di jalan. Cutoff-nya bukan "x menit sebelum mulai" tapi
 *    jam yang disebutkan sendiri, karena kurir harus menjemput ke produsen
 *    lebih dulu.
 *
 *    🔴 Akibat yang perlu disadari: rit pagi tutup pukul 21.00 HARI
 *    SEBELUMNYA. Rit pagi memang barang pre-order — panennya subuh. Jadi
 *    sepanjang hari, pilihan "pagi" yang muncul selalu pagi besok, bukan
 *    pagi hari ini.
 *
 * 3. JENDELA ADALAH TANGGAL + KODE, BUKAN KODE SAJA.
 *    "Pagi" sendirian tidak menjawab apa pun bagi orang yang memesan pukul
 *    20.00. Karena itu satu pilihan selalu membawa tanggal WIB-nya, dan
 *    keduanya disimpan di `Order`.
 */

export type KodeSlot = 'PAGI' | 'SIANG' | 'SORE';

type DefinisiSlot = {
  kode: KodeSlot;
  mulaiMenit: number;
  selesaiMenit: number;
  /**
   * Batas pemesanan. `hariSebelum: true` berarti jamnya jatuh pada H-1 dari
   * hari pengiriman.
   */
  tutup: { hariSebelum: boolean; menit: number };
};

const JAM = (j: number, m = 0) => j * 60 + m;

/**
 * Jam rit. Kalau nanti berubah, berkas INI yang diubah — jangan menyalin
 * angkanya ke komponen. Perlu diingat saat mengubah: pesanan lama menyimpan
 * kode slot, bukan jamnya, jadi mengubah tabel ini ikut mengubah cara pesanan
 * lama dibaca. Untuk MVP itu masih dapat diterima; begitu jadwal benar-benar
 * bergeser dan riwayat harus tetap jujur, simpan jam mulai/selesai di `Order`
 * saat pesanan dibuat.
 */
export const SLOT: DefinisiSlot[] = [
  { kode: 'PAGI', mulaiMenit: JAM(6), selesaiMenit: JAM(8), tutup: { hariSebelum: true, menit: JAM(21) } },
  { kode: 'SIANG', mulaiMenit: JAM(10), selesaiMenit: JAM(13), tutup: { hariSebelum: false, menit: JAM(8, 30) } },
  { kode: 'SORE', mulaiMenit: JAM(15), selesaiMenit: JAM(18), tutup: { hariSebelum: false, menit: JAM(13, 30) } },
];

const SEHARI = 24 * 60;
const OFFSET_WIB = 7 * 60; // menit

function definisi(kode: KodeSlot): DefinisiSlot | undefined {
  return SLOT.find((s) => s.kode === kode);
}

/** Tanggal (YYYY-MM-DD) dan menit sejak tengah malam, keduanya di WIB. */
export function sekarangWib(now: Date = new Date()): { tanggal: string; menit: number } {
  // Timestamp digeser +7 jam lalu dibaca dengan getUTC*/toISOString. Hasilnya
  // jam dinding WIB, tanpa bergantung pada zona waktu proses Node.
  const geser = new Date(now.getTime() + OFFSET_WIB * 60_000);
  return {
    tanggal: geser.toISOString().slice(0, 10),
    menit: geser.getUTCHours() * 60 + geser.getUTCMinutes(),
  };
}

function hariEpoch(tanggal: string): number {
  return Math.round(Date.parse(`${tanggal}T00:00:00Z`) / 86_400_000);
}

function tanggalDariHari(hari: number): string {
  return new Date(hari * 86_400_000).toISOString().slice(0, 10);
}

function jjmm(menit: number): string {
  return `${String(Math.floor(menit / 60)).padStart(2, '0')}.${String(menit % 60).padStart(2, '0')}`;
}

/** "06.00–08.00" */
export function labelJam(kode: KodeSlot): string {
  const d = definisi(kode);
  if (!d) return '—';
  return `${jjmm(d.mulaiMenit)}–${jjmm(d.selesaiMenit)}`;
}

/** Jam tutup pemesanan dalam bentuk yang bisa dibaca pengguna. */
export function labelTutup(kode: KodeSlot): string {
  const d = definisi(kode);
  if (!d) return '—';
  return d.tutup.hariSebelum
    ? `tutup ${jjmm(d.tutup.menit)} sehari sebelumnya`
    : `tutup ${jjmm(d.tutup.menit)}`;
}

/** Menit absolut sejak epoch WIB — satuan pembanding tunggal di berkas ini. */
function menitAbsolut(tanggal: string, menit: number): number {
  return hariEpoch(tanggal) * SEHARI + menit;
}

export function slotMasihBuka(kode: KodeSlot, tanggal: string, now: Date = new Date()): boolean {
  const d = definisi(kode);
  if (!d) return false;
  const hariKirim = hariEpoch(tanggal);
  const tutup = (hariKirim - (d.tutup.hariSebelum ? 1 : 0)) * SEHARI + d.tutup.menit;
  const s = sekarangWib(now);
  return menitAbsolut(s.tanggal, s.menit) < tutup;
}

export type Jendela = {
  kode: KodeSlot;
  /** Tanggal pengiriman di WIB, YYYY-MM-DD. */
  tanggal: string;
  /** "Hari ini" / "Besok" / "Sen, 14 Sep" */
  labelHari: string;
  /** "15.00–18.00" */
  labelJam: string;
  /** Satu nilai untuk dipakai sebagai value radio: "2026-09-12|PAGI". */
  nilai: string;
};

function labelHari(tanggal: string, tanggalKini: string): string {
  const selisih = hariEpoch(tanggal) - hariEpoch(tanggalKini);
  if (selisih === 0) return 'Hari ini';
  if (selisih === 1) return 'Besok';
  // timeZone UTC, bukan Asia/Jakarta: yang diformat adalah tengah malam UTC
  // dari tanggal KALENDER, bukan sebuah titik waktu. Memformatnya di zona
  // lain akan menggeser tanggalnya.
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${tanggal}T00:00:00Z`));
}

/**
 * Jendela yang masih bisa dipesan, paling dekat lebih dulu.
 *
 * Dihitung di SERVER lalu diturunkan sebagai prop, bukan dihitung di browser.
 * Dua alasan: (a) jam HP sering salah, dan yang menolak pesanan saat submit
 * adalah jam server — kalau keduanya berbeda, pilihan yang tampak terbuka bisa
 * langsung ditolak; (b) menghitungnya di komponen klien membuat hasil render
 * server dan klien berbeda, dan React mengeluh soal hydration.
 */
export function jendelaTersedia(now: Date = new Date(), banyak = 4): Jendela[] {
  const s = sekarangWib(now);
  const mulaiHari = hariEpoch(s.tanggal);
  const hasil: Jendela[] = [];

  for (let geser = 0; geser < 4 && hasil.length < banyak; geser++) {
    const tanggal = tanggalDariHari(mulaiHari + geser);
    for (const d of SLOT) {
      if (hasil.length >= banyak) break;
      if (!slotMasihBuka(d.kode, tanggal, now)) continue;
      hasil.push({
        kode: d.kode,
        tanggal,
        labelHari: labelHari(tanggal, s.tanggal),
        labelJam: labelJam(d.kode),
        nilai: `${tanggal}|${d.kode}`,
      });
    }
  }
  return hasil;
}

/** Pisah nilai radio jadi dua bagian, dengan pemeriksaan bentuk. */
export function pecahNilai(nilai: string): { tanggal: string; kode: KodeSlot } | null {
  const [tanggal, kode] = nilai.split('|');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal ?? '')) return null;
  if (!SLOT.some((s) => s.kode === kode)) return null;
  return { tanggal, kode: kode as KodeSlot };
}

/**
 * Tanggal WIB → nilai kolom `Order.slotDate` (`DateTime @db.Date`).
 * Disimpan sebagai tengah malam UTC dari tanggal kalendernya.
 */
export function tanggalKeKolom(tanggal: string): Date {
  return new Date(`${tanggal}T00:00:00Z`);
}

/** Kolom `Order.slotDate` → tanggal WIB (YYYY-MM-DD). */
export function kolomKeTanggal(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Label siap tampil untuk pesanan yang sudah tersimpan, mis.
 * "Besok · 10.00–13.00". `null` bila pesanan dibuat sebelum fitur ini ada —
 * pemanggil yang memutuskan mau menampilkan apa untuk kasus itu.
 */
export function labelJendela(
  kode: KodeSlot | null | undefined,
  slotDate: Date | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!kode || !slotDate) return null;
  const tanggal = kolomKeTanggal(slotDate);
  const s = sekarangWib(now);
  return `${labelHari(tanggal, s.tanggal)} · ${labelJam(kode)}`;
}

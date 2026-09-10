/**
 * Satu sumber untuk semua hal berbau peta.
 *
 * Sebelumnya URL peta ditulis ulang di lima tempat (`kurir/page.tsx` 3 baris,
 * `kurir/tugas/[id]/page.tsx` 2 baris) dengan aturan yang tidak sama: satu
 * memakai `dir/?api=1` (navigasi), satu memakai `search/?api=1` (lihat titik),
 * dan satu di antaranya mengirim TEKS alamat padahal koordinatnya tersedia di
 * baris yang sama. Aturan yang disalin lima kali akan berbeda di salah satunya.
 */

export type Tujuan = {
  lat?: number | null;
  lng?: number | null;
  /** Dipakai hanya bila koordinat tidak ada. */
  teks?: string | null;
};

function adaKoordinat(t: Tujuan): t is { lat: number; lng: number; teks?: string | null } {
  return typeof t.lat === 'number' && typeof t.lng === 'number';
}

/**
 * URL untuk MENAVIGASI ke satu tujuan — dibuka di aplikasi peta bawaan HP,
 * lengkap dengan suara, rerouting, dan info macet.
 *
 * Navigasi sengaja TIDAK dibangun di dalam aplikasi. Turn-by-turn yang layak
 * dipakai kurir motor butuh routing engine, data lalu lintas, dan panduan
 * suara; semuanya sudah ada gratis di HP kurir. Yang jadi tugas aplikasi ini
 * hanya menyerahkan tujuan yang BENAR.
 *
 * Koordinat selalu diutamakan di atas teks alamat. Menyerahkan teks berarti
 * menyerahkan geocoding, dan alamat Indonesia yang menyebut gang, RT/RW, atau
 * patokan ("belakang SD Negeri 2") sering jatuh ratusan meter dari titik
 * sebenarnya — kurir berhenti di mulut gang yang salah, lalu menelepon.
 */
export function urlNavigasi(t: Tujuan): string | null {
  if (adaKoordinat(t)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}`;
  }
  if (t.teks?.trim()) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(t.teks.trim())}`;
  }
  return null;
}

/**
 * URL untuk MELIHAT satu titik tanpa memulai navigasi (mis. mengecek arah
 * sebelum memutuskan mengambil tugas). Sama seperti di atas, koordinat dulu.
 */
export function urlTitik(t: Tujuan): string | null {
  if (adaKoordinat(t)) {
    return `https://www.google.com/maps/search/?api=1&query=${t.lat},${t.lng}`;
  }
  if (t.teks?.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.teks.trim())}`;
  }
  return null;
}

/**
 * Pusat peta saat pengguna belum menaruh titik apa pun: Kabupaten Gresik.
 *
 * TIDAK dipakai sebagai nilai bawaan koordinat tujuan — cuma sebagai posisi
 * awal tampilan peta. Menjadikannya nilai bawaan berarti setiap pesanan tanpa
 * pin akan mengaku berada di pusat kabupaten, dan ongkirnya salah tanpa ada
 * yang tahu.
 */
export const PUSAT_GRESIK = { lat: -7.1554, lng: 112.6526 };

/**
 * Sumber tile peta.
 *
 * 🔴 `tile.openstreetmap.org` adalah server sukarela dan Tile Usage Policy-nya
 * TIDAK mengizinkan pemakaian aplikasi bervolume. Untuk MVP dan demo ini masih
 * wajar; begitu ada trafik nyata, pindah ke penyedia tile (MapTiler, Carto,
 * Protomaps) dengan mengisi `NEXT_PUBLIC_TILE_URL` — tanpa menyentuh satu pun
 * komponen. Itu sebabnya nilainya dibaca dari env, bukan ditulis di komponen.
 *
 * Atribusi WAJIB tampil (lisensi ODbL) dan sudah dipasang di `PinLokasi`
 * lewat opsi `attribution` Leaflet, sama seperti peta di paspor mutu.
 */
export const TILE_URL =
  process.env.NEXT_PUBLIC_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_TILE_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

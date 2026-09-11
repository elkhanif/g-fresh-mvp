import { distanceKm, estimateDeliveryFee } from './utils';
import { deliverySubsidyFactor, subsidyPercent } from './rating';

/**
 * Perhitungan ongkir, dipisah dari `/api/orders`.
 *
 * KENAPA DIPISAH. Sampai sekarang rumusnya hidup di dalam blok transaksi
 * `POST /api/orders`, jadi satu-satunya cara mengetahui ongkir adalah dengan
 * membuat pesanan. Akibatnya konsumen baru melihat ongkir di halaman
 * pembayaran — tempat paling mahal untuk kaget — dan checkout cuma bisa
 * menulis "dihitung server nanti".
 *
 * Yang TIDAK dilakukan: menyalin rumusnya ke komponen klien supaya bisa
 * ditampilkan. Angka di layar akan pelan-pelan berbeda dari yang ditagih,
 * dan tidak ada yang tahu kapan mulai berbeda. Rumusnya tinggal di satu
 * tempat ini, dipakai oleh pembuat pesanan DAN oleh `POST /api/orders/quote`
 * yang dipanggil checkout. Angka yang tampil adalah angka yang ditagih.
 */

/**
 * Jarak yang diasumsikan bila konsumen tidak menaruh pin. Nilai ini sudah
 * dipakai sejak awal (`estimateDeliveryFee(3)`); di sini ia diberi nama
 * supaya bisa disebut di antarmuka: "ongkir memakai perkiraan 3 km".
 */
export const KM_TANPA_PIN = 3;

export type Titik = { lat: number; lng: number };

export type BarisAcuan = {
  lat: number | null;
  lng: number | null;
  rating: number;
};

export type Acuan = {
  /** Titik jemput yang dipakai menghitung jarak. */
  koordinat: Titik | null;
  /** Rating produsen yang menentukan besar subsidi. */
  rating: number;
};

/**
 * Memilih produsen acuan dari isi keranjang.
 *
 * Satu pesanan boleh memuat barang dari beberapa penjual, tapi ongkirnya satu.
 * Aturan yang berlaku sejak awal: jarak diukur dari penjual PERTAMA yang punya
 * koordinat, subsidi mengikuti rating penjual pada baris pertama. Aturannya
 * ditaruh di sini — bukan diulang di dua tempat — supaya pembuat pesanan dan
 * penghitung perkiraan tidak bisa memilih acuan yang berbeda dan menghasilkan
 * dua angka untuk keranjang yang sama.
 */
export function acuanOngkir(baris: BarisAcuan[]): Acuan {
  const berkoordinat = baris.find((b) => b.lat && b.lng);
  return {
    koordinat: berkoordinat ? { lat: berkoordinat.lat as number, lng: berkoordinat.lng as number } : null,
    rating: baris[0]?.rating ?? 5,
  };
}

export type RincianOngkir = {
  /** null = tanpa pin, dihitung dengan KM_TANPA_PIN. */
  km: number | null;
  /** Ongkir sebelum subsidi. */
  dasar: number;
  /** Persentase subsidi menurut tier produsen (0 / 15 / 30). */
  subsidiPersen: number;
  /** Rupiah yang ditanggung platform — selisih nyata setelah pembulatan. */
  subsidi: number;
  /** Yang dibayar konsumen. */
  ongkir: number;
};

export function hitungOngkir(args: {
  acuan: Acuan;
  tujuan: Titik | null;
  channel: 'B2C' | 'B2B';
}): RincianOngkir {
  const { acuan, tujuan, channel } = args;

  const km = acuan.koordinat && tujuan ? distanceKm(acuan.koordinat, tujuan) : null;
  const dasar = estimateDeliveryFee(km ?? KM_TANPA_PIN);

  // Subsidi ongkir hanya untuk B2C — kanal B2B justru yang mendanainya.
  // Pembulatan ke Rp500 dipertahankan persis seperti sebelumnya supaya nilai
  // yang dibuat paket ini identik dengan pesanan yang sudah ada.
  const ongkir =
    channel === 'B2C'
      ? Math.round((dasar * deliverySubsidyFactor(acuan.rating)) / 500) * 500
      : dasar;

  return {
    km,
    dasar,
    subsidiPersen: channel === 'B2C' ? subsidyPercent(acuan.rating) : 0,
    subsidi: dasar - ongkir,
    ongkir,
  };
}

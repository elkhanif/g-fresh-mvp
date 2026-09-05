import type { Role } from '@prisma/client';
import type { IconName } from '@/components/ui/Icon';

export type NavItem = { href: string; label: string; short: string; icon: IconName };

/**
 * Sumber tunggal daftar navigasi.
 *
 * Dipakai dua tempat: menu mendatar di header (layar lebar) dan bottom
 * navigation (layar sempit). Sebelumnya daftar ini cuma ada di layout dan
 * ditampilkan dua kali bertumpuk di mobile — dua baris menu memakan hampir
 * seperlima tinggi layar sebelum isi apa pun terlihat.
 *
 * `short` dipakai di bottom nav: label panjang akan terpotong di lebar ~72px.
 * Maksimal 5 butir per peran, karena butir keenam membuat sasaran sentuh
 * lebih sempit dari 44px.
 */
export const NAV: Record<Role, NavItem[]> = {
  KONSUMEN: [
    { href: '/app/konsumen', label: 'Belanja', short: 'Belanja', icon: 'home' },
    { href: '/app/konsumen/keranjang', label: 'Keranjang', short: 'Keranjang', icon: 'cart' },
    { href: '/app/konsumen/pesanan', label: 'Pesanan saya', short: 'Pesanan', icon: 'receipt' },
    { href: '/app/konsumen/scan', label: 'Scan QR', short: 'Scan', icon: 'qr' },
    { href: '/app/akun', label: 'Akun', short: 'Akun', icon: 'user' },
  ],
  PRODUSEN: [
    { href: '/app/produsen', label: 'Produk', short: 'Produk', icon: 'box' },
    { href: '/app/produsen/pesanan', label: 'Pesanan masuk', short: 'Pesanan', icon: 'receipt' },
    { href: '/app/produsen/komplain', label: 'Komplain', short: 'Komplain', icon: 'alert' },
    { href: '/app/produsen/sertifikasi', label: 'Sertifikasi', short: 'Sertifikat', icon: 'badge' },
    { href: '/app/akun', label: 'Akun', short: 'Akun', icon: 'user' },
  ],
  KURIR: [
    { href: '/app/kurir', label: 'Tugas kurir', short: 'Tugas', icon: 'truck' },
    { href: '/app/kurir/riwayat', label: 'Riwayat & pendapatan', short: 'Riwayat', icon: 'receipt' },
    { href: '/app/kurir/verifikasi', label: 'Verifikasi KTP', short: 'Verifikasi', icon: 'badge' },
    { href: '/app/akun', label: 'Akun', short: 'Akun', icon: 'user' },
  ],
  ADMIN: [
    { href: '/app/admin', label: 'Operasional', short: 'Operasi', icon: 'shield' },
    { href: '/app/admin/riwayat', label: 'Riwayat', short: 'Riwayat', icon: 'receipt' },
    { href: '/app/akun', label: 'Akun', short: 'Akun', icon: 'user' },
  ],
  PEMKAB: [
    { href: '/app/pemkab', label: 'Dashboard Pemkab', short: 'Dashboard', icon: 'building' },
    { href: '/app/pemkab/harga', label: 'Pantauan harga', short: 'Harga', icon: 'chart' },
    { href: '/app/pemkab/produsen', label: 'Direktori produsen', short: 'Produsen', icon: 'store' },
    { href: '/app/akun', label: 'Akun', short: 'Akun', icon: 'user' },
  ],
};

// Menu bisnis hanya relevan untuk konsumen yang punya profil usaha; disisipkan
// ke menu header (bukan bottom nav) agar bottom nav tetap 5 butir.
export const NAV_BISNIS: NavItem = {
  href: '/app/konsumen/bisnis',
  label: 'Akun bisnis',
  short: 'Bisnis',
  icon: 'briefcase',
};

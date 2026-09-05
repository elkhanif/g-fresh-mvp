import type { CertStatus } from '@prisma/client';

/**
 * Aturan domain sertifikasi produsen.
 *
 * File ini sengaja bebas dari import Prisma/auth supaya bisa dipakai juga
 * oleh komponen klien (label & daftar aksi), bukan cuma route handler.
 */

export const CERT_STATUS_LABEL: Record<CertStatus, string> = {
  BELUM_DIAJUKAN: 'Belum diajukan',
  MENUNGGU_VERIFIKASI: 'Menunggu verifikasi',
  MENUNGGU_PERBAIKAN: 'Perlu perbaikan',
  TERVERIFIKASI: 'Tersertifikasi',
  DITOLAK: 'Ditolak',
  KEDALUWARSA: 'Kedaluwarsa',
  DICABUT: 'Dicabut',
};

export const CERT_TYPES = ['P-IRT', 'Halal', 'BPOM'] as const;

export const CERT_ISSUERS = [
  'Dinas Kesehatan Kab. Gresik',
  'BPJPH / LPH',
  'BPOM RI',
  'Dinas Pertanian Kab. Gresik',
  'Lainnya',
] as const;

// Aksi yang tersedia bagi dinas. Sengaja bukan cuma verifikasi/tolak:
// di praktik nyata yang paling sering dipakai justru "minta perbaikan".
export const CERT_ACTIONS = [
  'VERIFIKASI',
  'MINTA_PERBAIKAN',
  'TOLAK',
  'CABUT',
  'PERPANJANG',
] as const;
export type CertAction = (typeof CERT_ACTIONS)[number];

export const CERT_ACTION_LABEL: Record<CertAction, string> = {
  VERIFIKASI: 'Verifikasi',
  MINTA_PERBAIKAN: 'Minta perbaikan',
  TOLAK: 'Tolak',
  CABUT: 'Cabut sertifikasi',
  PERPANJANG: 'Perpanjang',
};

// Hasil status untuk tiap aksi.
export const CERT_ACTION_RESULT: Record<CertAction, CertStatus> = {
  VERIFIKASI: 'TERVERIFIKASI',
  MINTA_PERBAIKAN: 'MENUNGGU_PERBAIKAN',
  TOLAK: 'DITOLAK',
  CABUT: 'DICABUT',
  PERPANJANG: 'TERVERIFIKASI',
};

/**
 * Aksi apa yang masuk akal dari status sekarang.
 *
 * Ini yang bikin panel lama salah: tombol "Verifikasi" tetap muncul untuk
 * produsen yang SUDAH terverifikasi. Panel harus sadar status — kalau sudah
 * terbit, yang relevan itu cabut atau perpanjang, bukan verifikasi ulang.
 */
export function allowedActions(status: CertStatus): CertAction[] {
  switch (status) {
    case 'MENUNGGU_VERIFIKASI':
      return ['VERIFIKASI', 'MINTA_PERBAIKAN', 'TOLAK'];
    case 'MENUNGGU_PERBAIKAN':
      // Masih boleh diputus langsung bila dinas sudah cukup yakin.
      return ['VERIFIKASI', 'TOLAK'];
    case 'TERVERIFIKASI':
      return ['PERPANJANG', 'CABUT'];
    case 'KEDALUWARSA':
      return ['PERPANJANG', 'CABUT'];
    case 'DITOLAK':
    case 'DICABUT':
      // Bola ada di produsen: harus mengajukan ulang dengan data baru.
      return [];
    case 'BELUM_DIAJUKAN':
    default:
      return [];
  }
}

// Aksi yang WAJIB disertai alasan tertulis. Keputusan yang merugikan produsen
// tanpa alasan tidak bisa diperbaiki maupun dibanding — itu bukan administrasi,
// itu sekadar tombol.
export function noteRequiredForAction(action: CertAction): boolean {
  return action === 'TOLAK' || action === 'MINTA_PERBAIKAN' || action === 'CABUT';
}

// Aksi yang butuh data sertifikat lengkap (nomor + masa berlaku).
export function needsCertDataForAction(action: CertAction): boolean {
  return action === 'VERIFIKASI' || action === 'PERPANJANG';
}

export const EXPIRY_WARNING_DAYS = 60;

export function daysUntil(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

export function isExpiringSoon(status: CertStatus, expiresAt: Date | string | null | undefined) {
  if (status !== 'TERVERIFIKASI') return false;
  const d = daysUntil(expiresAt);
  return d !== null && d >= 0 && d <= EXPIRY_WARNING_DAYS;
}

// Antrean kerja dinas: yang butuh tindakan naik ke atas.
export const CERT_QUEUE_RANK: Record<CertStatus, number> = {
  MENUNGGU_VERIFIKASI: 0,
  MENUNGGU_PERBAIKAN: 1,
  KEDALUWARSA: 2,
  BELUM_DIAJUKAN: 3,
  DITOLAK: 4,
  DICABUT: 5,
  TERVERIFIKASI: 6,
};

export function needsAction(status: CertStatus): boolean {
  return status === 'MENUNGGU_VERIFIKASI' || status === 'MENUNGGU_PERBAIKAN' || status === 'KEDALUWARSA';
}

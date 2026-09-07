'use client';
import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { Button } from './ui/Button';

export function SignOutButton() {
  const [keluar, setKeluar] = useState(false);

  /**
   * Logout tanpa menyerahkan pengalihan ke NextAuth.
   *
   * `signOut({ callbackUrl: '/' })` menyusun URL tujuan dari `NEXTAUTH_URL` di
   * server, bukan dari alamat yang sedang dibuka pengunjung. Akibatnya, saat
   * aplikasi diakses lewat ngrok atau IP jaringan lokal, pengunjung dilempar
   * ke `localhost:3000` milik perangkatnya sendiri — dan gagal.
   *
   * `redirect: false` membuat NextAuth hanya menghapus sesi, lalu kita pindah
   * halaman memakai origin yang sedang aktif. Ini benar di localhost, ngrok,
   * IP LAN, maupun domain produksi tanpa perlu menyetel apa pun.
   */
  async function handleKeluar() {
    setKeluar(true);
    try {
      await signOut({ redirect: false });
    } finally {
      window.location.href = '/';
    }
  }

  return (
    <Button variant="ghost" className="px-2 py-1.5 text-sm" disabled={keluar} onClick={handleKeluar}>
      {keluar ? 'Keluar…' : 'Keluar'}
    </Button>
  );
}
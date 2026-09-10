'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { AddProductForm, type ProducerFormCtx } from '@/components/forms/AddProductForm';

type Cat = { id: string; name: string; unit: string };

/**
 * Tombol "Tambah produk" beserta panel formulirnya.
 *
 * Sebelumnya formulir ini terpasang permanen di `<aside>` selebar 360px di
 * kanan daftar produk. Dua alasan memindahkannya ke panel:
 *
 * 1. Di HP, kolom itu jatuh DI BAWAH seluruh daftar produk. Produsen dengan
 *    20 produk harus menggulir melewati semuanya untuk menambah satu barang —
 *    padahal menambah barang adalah pekerjaan hariannya, bukan tindakan
 *    sesekali. Panel membuat jaraknya satu ketukan dari mana saja.
 * 2. Formulir yang selalu terbuka memakan lebar yang sebenarnya dibutuhkan
 *    daftar produk. Satu baris produk berisi foto, nama, kategori, harga,
 *    stok, dan empat tombol aksi; pada 1fr dari 1024px dikurangi 360px, tombol
 *    aksinya membungkus ke dua baris.
 *
 * `onDone` dipakai supaya panel menutup sendiri setelah produk tersimpan.
 * Tanpa itu produsen melihat pesan "Produk ditambahkan." tapi daftar barunya
 * tertutup panel, dan mudah mengira simpanan gagal lalu menekan simpan lagi.
 *
 * Dipakai di dua tempat (tombol di kepala bagian dan tombol di keadaan
 * kosong), masing-masing sebagai instans sendiri. Itu sengaja: keduanya tidak
 * pernah terlihat bersamaan, dan mengangkat state-nya ke halaman akan memaksa
 * halaman produsen jadi client component hanya demi satu boolean.
 */
export function AddProductSheet({
  categories,
  producer,
  label = 'Tambah produk',
  variant = 'primary',
}: {
  categories: Cat[];
  producer: ProducerFormCtx;
  label?: string;
  variant?: 'primary' | 'outline';
}) {
  const [buka, setBuka] = useState(false);

  return (
    <>
      <Button variant={variant} onClick={() => setBuka(true)}>
        {label}
      </Button>

      {buka && (
        <Sheet title="Tambah produk" onClose={() => setBuka(false)}>
          <AddProductForm
            categories={categories}
            producer={producer}
            onDone={() => setBuka(false)}
          />
          <p className="mt-3 border-t border-leaf-50 pt-3 text-xs leading-relaxed text-ink/50">
            Harga ditolak otomatis bila melebihi HET yang ditetapkan Pemkab untuk kategori
            tersebut.
          </p>
        </Sheet>
      )}
    </>
  );
}

# Foto produk

Taruh berkas di folder ini. `prisma/seed.ts` mencocokkannya otomatis dari
slug nama produk — tidak ada kolom yang perlu diisi manual, tidak ada
`db:push`. Yang belum ada fotonya jatuh ke placeholder ikon kategori, jadi
foto bisa dicicil tanpa ada gambar rusak di katalog.

Ekstensi yang dikenali, dicoba berurutan: `.jpg` `.jpeg` `.png` `.webp`

Setelah menambah berkas: `npm run db:seed`

## Panduan singkat

- **Rasio 5:3 mendatar** (kartu katalog memotong ke rasio ini). Foto tegak
  akan terpotong atas-bawah — subjeknya hilang.
- **Sisi terpanjang 1000–1400px**, kualitas JPG ~80. Lebih besar dari itu
  hanya memperlambat PWA tanpa terlihat bedanya di layar HP.
- **Satu produk per foto, latar polos.** Foto meja penuh dagangan terlihat
  bagus di layar besar dan jadi tidak terbaca di kartu selebar 160px.
- Cahaya alami dekat jendela. Hindari lampu kuning dalam ruangan — sayur
  hijau jadi kecoklatan dan terlihat tidak segar.

## Daftar berkas yang dicari

### Sayur
- [ ] `bayam-segar` — Bayam Segar
- [ ] `kangkung` — Kangkung
- [ ] `sawi-hijau` — Sawi Hijau
- [ ] `terong-ungu` — Terong Ungu
- [ ] `kacang-panjang` — Kacang Panjang
- [ ] `selada-hidroponik` — Selada Hidroponik
- [ ] `pakcoy-hidroponik` — Pakcoy Hidroponik
- [ ] `tomat-cherry` — Tomat Cherry
- [ ] `jagung-manis` — Jagung Manis

### Ikan
- [ ] `bandeng-segar` — Bandeng Segar
- [ ] `bandeng-cabut-tulang` — Bandeng Cabut Tulang
- [ ] `udang-vaname` — Udang Vaname

### Buah
- [ ] `pepaya-california` — Pepaya California
- [ ] `mangga-podang` — Mangga Podang
- [ ] `jambu-kristal` — Jambu Kristal
- [ ] `semangka-merah` — Semangka Merah

### Beras
- [ ] `beras-merah-lokal` — Beras Merah Lokal
- [ ] `beras-ir64-premium` — Beras IR64 Premium

### Daging Ayam
- [ ] `ayam-kampung-utuh` — Ayam Kampung Utuh
- [ ] `fillet-ayam-broiler` — Fillet Ayam Broiler

### Telur
- [ ] `telur-ayam-kampung` — Telur Ayam Kampung

### Olahan UMKM
- [ ] `otak-otak-bandeng` — Otak-otak Bandeng
- [ ] `kerupuk-ikan-payus` — Kerupuk Ikan Payus
- [ ] `sambal-bandeng-asap` — Sambal Bandeng Asap

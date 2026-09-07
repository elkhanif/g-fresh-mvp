# G-Fresh — Memory / Handoff Proyek

> **Cara pakai dokumen ini:** upload file ini di awal chat baru, bersamaan dengan
> zip project terbaru (`gfresh-lengkap-v17.zip` atau yang lebih baru). Dengan dua
> file itu, sesi baru bisa langsung tahu posisi proyek tanpa diceritakan ulang.
>
> Update §3 (Status) dan §9 (Roadmap & keputusan tertunda) tiap ada progres —
> dua bagian itu yang paling cepat basi.

---

## 1. Apa ini

**G-Fresh** — marketplace pangan segar *hyperlocal* untuk **Gresik Inovasi
Kompetisi (GIK) 2026**. Menghubungkan produsen (petani/petambak/peternak/UMKM)
langsung ke konsumen B2C & B2B tanpa gudang transit.

Tiga pilar: **QR-traceability**, **escrow + garansi kesegaran 2 jam**, dan
**kemitraan Pemkab (HET + sertifikasi)**. Komisi produsen 0% — pendapatan
operator dari platform fee B2B 2,5%, yang mendanai subsidi ongkir B2C
(lintas-subsidi).

**Keputusan arsitektur utama:** SATU codebase **Next.js 14 (App Router) PWA**
yang melayani aplikasi mobile-first (produsen/konsumen/kurir) DAN dashboard web
(admin/Pemkab) via role-based routing — BUKAN Flutter/RN + web terpisah.

**Repo:** `https://github.com/elkhanif/g-fresh-mvp` (branch `main`)

---

## 2. Stack & environment

Next.js **14.2.35** (jangan naik ke 15/16 — lihat §11) · TypeScript · Tailwind
· Prisma 5 · **PostgreSQL Neon** · NextAuth (Credentials + JWT) · bcryptjs ·
qrcode · html5-qrcode · zod.

**Database: Neon.** Pola dual-URL:
- `DATABASE_URL` = pooled (hostname ada `-pooler`)
- `DIRECT_URL` = direct (tanpa `-pooler`), untuk `prisma db push`
- Project: `gfresh` · role `gfresh_owner` · region `ap-southeast-1`
- **Cold start:** Neon scale-to-zero setelah 5 menit idle → request pertama
  lambat 1–3 detik. Tambahkan `connect_timeout=15` di connection string.
  Buka app dulu sebelum demo biar compute-nya "panas".

**Storage:** mode `local` (default) → `public/uploads/{products,complaints,ktp}/`.
Di-`.gitignore`. Lihat §9 soal foto KTP — belum ada access control.

**Provider:** payment & notify masih mode `mock` (simulasi penuh).

### Cara run
```bash
npm install             # kalau kena approve-scripts (npm 11/12): npm approve-scripts --all
cp .env.example .env    # isi DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, TRACE_SECRET
npm run db:push
npm run db:generate
npm run db:seed
npm run dev
```

---

## 3. STATUS: semua fitur #1-#12 SUDAH DITERAPKAN

Zip project terbaru berisi project utuh, sudah lolos typecheck bersih
(diverifikasi clean-room: extract lalu `npm install` lalu `tsc --noEmit`).

| # | Fitur | Inti implementasi |
|---|---|---|
| - | HET enforcement | Validasi harga server-side, batas atas + floorPrice |
| - | Escrow + garansi 2 jam | transitionOrder() satu titik, atomik $transaction |
| - | QR traceability | Kode HMAC per item order, halaman /trace/[code] publik |
| - | RBAC 5 peran | NextAuth JWT + middleware.ts + requireRole() |
| - | Rating + sanksi bertingkat | Recompute dari riwayat; < 3.0 = auto-suspend |
| - | KPI dashboard Pemkab | Target 10.1 dengan progress bar |
| - | Foto produk & scan QR kamera | Upload /api/upload, html5-qrcode ke /trace |
| 1 | Subsidi ongkir per tier | >=4.5 -> 30% · >=4.0 -> 15% · hanya kanal B2C |
| 2 | SLA admin 48 jam | Lewat tenggat -> auto-refund ke konsumen |
| 3 | Search & filter marketplace | URL params ?q= & ?kategori= |
| 4 | Halaman akun | /app/akun -- profil, sandi, alamat tersimpan |
| 5 | Refund parsial | Status REFUND_SEBAGIAN, dana dipecah otomatis |
| 6 | Notifikasi in-app | Lonceng + polling 30s, fanout ke pihak terkait |
| 7 | Anti-fraud klaim | Batas 3 klaim/30 hari + skor risiko 0-100 (5 pola) |
| 8 | B2B | Harga grosir, fee 2,5%, invoice net-14 auto, halaman cetak |
| 9 | Seed demo + fix race kurir | 8 produsen, 5 kurir, 24 produk; klaim tugas atomik |
| 10 | Negosiasi komplain | Kategori terstruktur, saran refund, tawar-menawar 3 ronde, SLA dua arah |
| 11 | Fix keamanan kebocoran data | producer?.id / courier?.id di query Prisma -> guard eksplisit (lihat §11) |
| 12 | Wilayah layanan + KYC KTP | ServiceArea dikelola Admin; kurir submit NIK+foto, admin review dengan bukti |
| 13 | Edit harga & stok produsen (**Opsi B**) | Dua aksi dipisah: harga (PriceHistory + validasi HET) & stok (StockMovement, delta atomik) |
| 14 | Panel sertifikasi dinas (**Opsi B**) | 5 aksi sadar-status, alasan wajib, bukti (nomor wajib + file opsional), CertReview audit log, alur pengajuan produsen |
| 15 | Pantauan harga Pemkab | Rekonstruksi harga historis dari PriceHistory, grafik SVG tanpa library, deteksi lonjakan >=15% |
| 16 | Mode demo lokal + palet poster | Postgres lokal via Docker, 6 skrip demo, DEMO.md; skala `leaf` disusun ulang agar leaf-600 = #2E7D32 |
| 17 | Keranjang belanja + poles tampilan | Troli lintas penjual (localStorage), banner HET, badge panen segar, paspor mutu dirapikan |
| 18 | Bottom nav + ikon SVG | Header jadi satu baris, nav pindah ke bawah di layar sempit, nol emoji, nav.ts satu sumber |
| 19 | Ganti ke lucide-react | Ikon buatan tangan gagal di ukuran kecil; Icon.tsx jadi lapisan tipis di atas lucide |
| 20 | Ringkasan penjual + langkah kurir | 3 kartu hari ini untuk produsen, langkah 1-2-3 + tombol navigasi peta untuk kurir |
| 21 | Dompet kurir + angsuran coolbox + toggle grosir | WalletTx append-only, ToolkitPlan, mode Eceran/Grosir di katalog |
| 22 | Pasar & Kios | 7 pasar SIBAPO, SellerType TANI/PASAR, halaman publik /pasar/[slug], simpul Kios di paspor mutu |

**Belum di-apply:** tidak ada. Semua batch di atas sudah diterapkan ke kode
dan sudah dikirim ke user dalam bentuk zip lengkap (terbaru:
`gfresh-lengkap-v17.zip`).

### Catatan batch #13 (keputusan: Opsi B, sudah selesai)

Dulu produsen tidak bisa mengubah produk yang sudah dibuat sama sekali (endpoint
`PATCH` ada, UI-nya tidak). Tiga opsi diajukan; **user memilih Opsi B** dan sudah
diimplementasikan penuh. Opsi C (penjadwalan harga, lot/batch per panen, bulk
edit, ambang stok minimum) sengaja TIDAK dikerjakan.

Yang ada sekarang:
- Model `PriceHistory` (old/new price + snapshot HET saat perubahan) &
  `StockMovement` (delta/before/after/reason/note/orderId/actorId).
- Enum `StockReason`: RESTOCK · TERJUAL_MANUAL · RUSAK · KOREKSI ·
  PENJUALAN_APP. Yang terakhir HANYA ditulis sistem, tidak diterima dari klien.
- Endpoint: `PATCH /api/products/[id]/price`, `POST /api/products/[id]/stock`,
  `GET /api/products/[id]/history`.
- `PATCH /api/products/[id]` DIPERSEMPIT jadi hanya `active` + `harvestedAt`;
  `price`/`stock` ditolak 400 supaya tidak ada jalur pintas yang melewati
  riwayat.
- Checkout (`api/orders/route.ts`) ikut menulis mutasi `PENJUALAN_APP` dan
  potongan stoknya jadi atomik (sebelumnya read-then-write).
- Alasan wajib bercatatan: RUSAK & KOREKSI. Arah dipaksa per alasan
  (RESTOCK harus +, TERJUAL_MANUAL/RUSAK harus −, KOREKSI bebas).

### Catatan batch #14 (sertifikasi — Opsi B, sudah selesai)

Panel lama cuma punya Verifikasi/Tolak, tanpa bukti, tanpa alasan, tanpa jejak;
dan produsen tidak punya cara mengajukan sama sekali (status MENUNGGU hanya
lahir dari seed). Sekarang:
- `CertStatus` +3 nilai: MENUNGGU_PERBAIKAN, KEDALUWARSA, DICABUT.
- `ProducerProfile` +7 kolom: certNumber, certIssuer, certIssuedAt,
  certExpiresAt, certDocUrl, certSubmittedAt, certReviewedAt.
- Model `CertReview` (append-only): fromStatus/toStatus/note/actorName.
  Penandaan otomatis oleh cron ber-actorId null = "Sistem".
- 5 aksi: Verifikasi / Minta perbaikan / Tolak / Cabut / Perpanjang, ditentukan
  `allowedActions()` di `lib/cert.ts`. `/api/cert` menerima `action`, BUKAN
  `status` bebas -- transisi sah diputuskan server.
- Alasan WAJIB untuk Tolak/Minta perbaikan/Cabut. Verifikasi & Perpanjang wajib
  nomor sertifikat + tanggal kedaluwarsa.
- Bukti: nomor WAJIB, dokumen OPSIONAL (gambar atau PDF, `uploadDocuments()`).
  Keputusan sadar konteks: produsen kecil banyak yang belum punya salinan
  digital; mewajibkan file akan mengunci mereka dari sistem.
- Panel: tab Perlu tindakan / Kedaluwarsa & segera (ambang 60 hari) / Semua,
  + pencarian, + `expectedStatus` (petugas kedua dapat 409, bukan menimpa).
- Produsen: halaman `/app/produsen/sertifikasi` untuk mengajukan, membaca
  alasan, dan memperbaiki. Riwayat keputusan dibuka ke produsen ybs.
- Cron `settle` menyapu sertifikat lewat masa berlaku -> KEDALUWARSA di
  DATABASE (bukan dihitung saat render, supaya status basi tidak ikut terbawa
  ke katalog konsumen).
- `CertVerifyForm` di PemkabForms.tsx DIHAPUS (dua jalur tulis status yang sama
  akan saling melangkahi).

### Catatan batch #16-#22 (sudah selesai semua)

**#16 Mode demo lokal & palet.** `docker-compose.demo.yml` (Postgres 16, port
5433 supaya tidak bentrok), `.env.demo.example`, `DEMO.md`, 6 skrip npm
(`demo:up/down/reset/setup/build/start`). Skala `leaf` di tailwind.config
disusun ulang agar **leaf-600 = #2E7D32** -- seluruh aplikasi ganti warna tanpa
menyentuh satu komponen. Skala baru: `accent` (#FF8F00), `info` (#1565C0),
`surface` (#F8F9FA). Varian tombol `cta` (oranye) dipakai HANYA di 3 aksi
puncak: bayar & pesan, bayar sekarang, konfirmasi terima. Alasan oranye bukan
sekadar ikut poster: hijau di atas putih luntur saat diproyeksikan.

**#17 Keranjang.** Troli lintas penjual. Backend sudah mendukung sejak awal
(`Order` punya banyak `OrderItem`, `/api/orders` menerima array `items`) -- yang
belum ada cuma antarmukanya. Isi keranjang di **localStorage, bukan database**:
belum ada uang/stok yang direservasi, jadi menyimpannya di server hanya
menambah tabel + pertanyaan "kapan basi" tanpa manfaat. Harga di keranjang cuma
perkiraan; server menghitung ulang saat checkout. `ProductOrderForm.tsx`
DIHAPUS -- dua jalur pemesanan berarti dua tempat memperbaiki aturan harga.

**#18-#19 Navigasi & ikon.** Dua baris nav jadi satu + `BottomNav` (hanya layar
sempit), `src/lib/nav.ts` jadi satu sumber menu (maks 5 butir/peran, butir ke-6
bikin sasaran sentuh < 44px). Ikon: awalnya digambar tangan dan GAGAL di 20px
(telur kebaca angka nol, daging seperti tetesan air) -> diganti `lucide-react`.
`Icon.tsx` tetap memakai nama lokal (`'cart'`, `'fish'`) yang dipetakan ke
lucide, supaya pustaka bisa diganti tanpa menyisir seluruh aplikasi.

**#20 Ringkasan penjual & langkah kurir.** Omzet produsen dihitung dari
`OrderItem` miliknya, BUKAN dari `Order` -- satu order bisa memuat barang
beberapa penjual, menghitung per order melebih-lebihkan angka semua orang di
dalamnya. Kurir dapat langkah bernomor + tombol navigasi ke Google Maps
(koordinat produsen saat menjemput, alamat konsumen setelah barang di tangan).

**#21 Dompet kurir.** `WalletTx` append-only + `ToolkitPlan`.
- **Saldo TIDAK disimpan sebagai kolom** -- selalu dijumlahkan dari WalletTx.
  Dua sumber kebenaran untuk uang yang sama = selisih yang tak bisa dijelaskan.
- Upah ganda dicegah `@@unique([orderId, kind])` di level DB, bukan `if` di
  kode yang bisa kalah balapan.
- Angsuran coolbox: hanya dipotong pada hari kurir benar-benar mengantar
  (sakit/libur tidak menggerus saldo), tidak memotong bila saldo kurang
  (angsuran mundur sehari, dompet tidak minus), cicilan terakhir menyesuaikan
  sisa supaya total tepat Rp350.000. Dipanggil dari cron `settle`.
- Toggle Eceran/Grosir di katalog murni tampilan; kanal pesanan tetap
  ditentukan di keranjang, jadi tidak ada jalur baru menembus minimum Rp500rb.

**#22 Pasar & Kios.** `Market` (7 pasar SIBAPO: baru, kota, giri, sidomoro,
sidayu, dukun, driyorejo) + `SellerType` (TANI/PASAR) + `marketId`/`kioskName`
di ProducerProfile. Halaman **`/pasar/[slug]` PUBLIK tanpa login** -- ini tujuan
deep-link dari portal SIBAPO; tautan yang mengharuskan login duluan kehilangan
sebagian besar pengunjung. Paspor mutu jadi 4 simpul untuk barang pasar
(Produsen -> Kios -> Kurir -> Anda). **"Pasar terdekat X km" SENGAJA TIDAK
diklaim** -- koordinat pengguna belum ada, dan angka jarak karangan lebih buruk
daripada tidak ada.

### Catatan batch #15 (pantauan harga Pemkab, sudah selesai)

Halaman `/app/pemkab/harga`. TANPA perubahan schema -- murni memakai
PriceHistory + HetPrice.
- Harga historis DIREKONSTRUKSI, tidak ada tabel snapshot harian: harga produk
  pada waktu T = `oldPrice` perubahan pertama SETELAH T, kalau tidak ada berarti
  harga sekarang. (`lib/price-monitor.ts`)
- Grafik SVG buatan sendiri (`components/charts/LineChart.tsx`), komponen
  server murni, nol JS ke klien. Sengaja TIDAK pakai Recharts/Chart.js demi
  ukuran bundle PWA.
- Isi: ringkasan per kategori (rata-rata, HET, % terhadap HET, tren, mepet
  HET), grafik kategori terpilih + garis HET/harga dasar, deteksi kenaikan
  >=15% ("layak ditanyakan", bukan tuduhan), tabel perubahan terbaru.
- Periode 7/30/90 hari lewat query string (bisa di-bookmark untuk presentasi).
- Seed berubah: createdAt produk dimundurkan ~130 hari, HET dapat periode kedua
  (120 hari lalu, 8% lebih longgar), dan 2-5 perubahan harga per produk dibuat
  dengan PRNG deterministik. Rantai dibangun MUNDUR dari harga sekarang --
  kalau rantai oldPrice/newPrice putus, grafiknya melompat palsu.
- Batas jujur tercetak di kaki halaman: ini harga tayang di G-Fresh, bukan
  survei pasar tradisional.
- Performa: buildCategorySummaries() memanggil buildCategorySeries() per
  kategori. Aman skala pilot; perlu agregasi SQL kalau produk sudah ribuan.

---

## 4. Peran & alur

- **PRODUSEN** -- kelola produk (harga <= HET, harga grosir opsional; setelah
  produk tayang bisa ubah harga, sesuaikan stok +/- dengan alasan, lihat
  riwayat keduanya, dan aktif/nonaktifkan produk -- batch #13), cetak label QR,
  lihat rating sendiri, menyanggah/menawar komplain (12 jam, maks 3 ronde
  negosiasi).
- **KONSUMEN** -- belanja (cari/filter), bayar (escrow), scan QR, ajukan
  komplain berkategori + bukti, terima/tolak tawaran refund, kelola akun &
  alamat, daftar akun bisnis B2B.
- **KURIR** -- ambil tugas (rebutan, klaim atomik), submit KTP untuk
  verifikasi (NIK + foto, bisa ditolak dengan alasan & diajukan ulang),
  toggle ketersediaan, detail tugas + peta, riwayat & pendapatan.
- **ADMIN** -- verifikasi KTP kurir (lihat bukti dulu, bukan toggle buta) &
  pembeli B2B, kelola wilayah layanan (aktifkan/nonaktifkan kecamatan),
  putuskan komplain yang tereskalasi (lihat riwayat negosiasi lengkap),
  tandai invoice lunas, riwayat. TIDAK bisa ubah HET.
- **PEMKAB** -- tetapkan HET, verifikasi sertifikasi, KPI target 10.1,
  direktori produsen, transparansi lintas-subsidi B2B. Read-only operasional.

### State machine order
```
MENUNGGU_BAYAR -> DIBAYAR(HELD) -> DIJEMPUT_KURIR -> DIKIRIM -> DITERIMA(grace 2j)
                                                               |
                                    (diam/konfirmasi)     (komplain)
                                    |                          |
                                    v                          v
                          SELESAI(RELEASED)                SENGKETA (dana HELD)
                                                               |
                                            produsen: SETUJU  -> REFUND langsung
                                            produsen: TAWAR   -> MENUNGGU_PERSETUJUAN
                                            produsen: TOLAK   -> admin memutus (final)
                                            tak respon 12j    -> admin memutus
                                                               |
                              [bila TAWAR] konsumen TERIMA -> REFUND_SEBAGIAN langsung
                                           konsumen TOLAK  -> produsen tawar ulang (maks 3 ronde)
                                                              atau langsung minta admin
                                           konsumen diam 12j -> admin memutus
                                                               |
                                    VALID -> REFUND · SEBAGIAN -> REFUND_SEBAGIAN
                                    DITOLAK -> SELESAI · admin idle 48j -> auto-REFUND
```
Semua transisi lewat `transitionOrder()` di `src/lib/escrow.ts`.

### Alur kurir: REBUTAN (first-come-first-served)
Klaim atomik via `updateMany` dengan syarat `courierId: null` di dalam
WHERE -- yang kalah cepat dapat HTTP 409, bukan menimpa data kurir lain.
Syarat klaim: KTP terverifikasi, ketersediaan menyala, rating >= ambang.

### Alur negosiasi komplain (batch #10)
```
Konsumen ajukan komplain + kategori (kurang timbangan/rusak/tidak segar/
salah produk/lainnya) -> jika "kurang timbangan": sistem hitung saran refund
  -> MENUNGGU_SANGGAHAN (produsen 12 jam)

Produsen: SETUJU (refund 100% langsung) | TAWAR (nominal, prefill saran
sistem) | TOLAK (wajib alasan >=10 karakter, ke admin langsung)

[Jika TAWAR] Konsumen: TERIMA (refund sebagian langsung) | TOLAK ->
  "produsen tawar ulang" (ronde+1, maks 3) atau "minta admin putuskan"

Auto-eskalasi ke admin (cron): produsen diam 12j, konsumen diam atas
tawaran 12j, atau sudah 3 ronde tanpa sepakat.

Admin (final): VALID / VALID_SEBAGIAN / DITOLAK -- melihat SELURUH riwayat
tawaran sebagai konteks sebelum memutus.
```

---

## 5. Struktur kode

```
src/
  app/
    (auth)/login, register        <- kecamatan sekarang fetch dari /api/service-areas
    trace/[code]/                 telusur publik (hasil scan QR)
    app/
      layout.tsx                  shell + nav per peran + NotificationBell
      akun/                       pengaturan akun (semua peran)
      produsen/                   produk ; pesanan (label QR) ; komplain (hak sanggah+tawar)
      konsumen/                   marketplace ; produk/[id] ; pesanan ; scan ;
                                  bisnis (B2B) ; invoice/[id] (cetak)
      kurir/                      tugas ; riwayat ; tugas/[id] (detail+peta) ; verifikasi (KTP)
      admin/                      operasional (+ wilayah layanan + review KTP) ; riwayat
      pemkab/                     KPI + HET ; produsen (direktori)
    api/
      products/[id]/price/ products/[id]/stock/ products/[id]/history/  <- batch #13
      orders/ products/ complaints/ complaints/[id]/respond/
      complaints/[id]/offer-response/ het/ cert/ account/ business/
      invoices/[id]/pay/ notifications/ courier/availability/ courier/ktp/
      service-areas/ admin/service-areas/ admin/courier-verify/
      upload/ cron/settle/ auth/
  lib/
    het.ts          validasi harga vs HET
    inventory.ts    adjustStock (delta atomik) + applyPriceChange + label alasan
    product-owner.ts requireOwnedProduct -- guard kepemilikan produk (1 tempat)
    escrow.ts        state machine + efek escrow + hook rating + fanout notifikasi
    rating.ts        computeRating, tierOf, SUSPEND_RATING, deliverySubsidyFactor
    complaint.ts     SLA sanggah 12j, SLA admin 48j, eskalasi otomatis, accept/rejectOffer
    negotiation.ts   MAX_NEGOTIATION_ROUNDS, CATEGORY_LABEL, suggestedRefundFor
    fraud.ts         assessClaim -- batas 3/30hari + skor risiko
    b2b.ts           platformFeeOf, unitPriceFor, nextInvoiceNumber, markOverdue
    notification.ts  notify / notifyMany / notifyRole
    storage.ts       upload bukti/foto/KTP (local | supabase) -- subdir per jenis
    qr.ts            kode telusur HMAC + generate QR
    providers/       payment (escrow) & notify -- mock + stub
    rbac.ts, auth.ts, db.ts, utils.ts
prisma/  schema.prisma (19 model, +PriceHistory +StockMovement) · seed.ts
         (data demo lengkap, reset total tiap run, + saldo awal buku besar stok)
```

### Konstanta penting
| Konstanta | Nilai | Lokasi |
|---|---|---|
| Grace period garansi | 2 jam | escrow.ts |
| SLA sanggah produsen | 12 jam | complaint.ts |
| SLA tawaran ke konsumen | 12 jam | complaint.ts |
| SLA keputusan admin | 48 jam | complaint.ts |
| Maks ronde negosiasi | 3 | negotiation.ts |
| Ambang penangguhan rating | 3.0 | rating.ts |
| Subsidi ongkir | 30% / 15% / 0% | rating.ts |
| Platform fee B2B | 2,5% | b2b.ts |
| Termin invoice | 14 hari | b2b.ts |
| Minimum order B2B | Rp500.000 | b2b.ts |
| Batas klaim komplain | 3 per 30 hari | fraud.ts |
| NIK KTP | 16 digit numerik | api/courier/ktp/route.ts |

---

## 6. Akun demo (kata sandi semua: password123)

| Peran | Email | Catatan |
|---|---|---|
| Pemkab | pemkab@gresik.go.id | |
| Admin | admin@gfresh.id | |
| Produsen (8) | tani.cerme@ · tambak.manyar@ · tani.duduk@ · ayam.menganti@ · sayur.kebomas@ · umkm.gresik@ · tani.balongpanggang@ · buah.wringinanom@ (semua gfresh.id) | status sertifikat bervariasi |
| Kurir (5) | kurir.budi@ · kurir.eko@ · kurir.sari@ (KTP terverifikasi) · kurir.agus@ (KTP terverifikasi, nonaktif) · kurir.dani@ (KTP pending review -- buat demo panel admin) | (semua gfresh.id) |
| Konsumen (4) | konsumen@ · konsumen.dewi@ · konsumen.tono@ · konsumen.maya@ (semua gfresh.id) | |
| B2B | katering@gfresh.id (Katering Bu Sri -- sudah terverifikasi) | |

Seed: 7 kategori + HET, 18 kecamatan (8 aktif untuk pilot), 24 produk (10
harga grosir), 16 pesanan riwayat (3 sengaja DIBAYAR untuk demo rebutan
kurir), 2 komplain demo, rating dihitung dari riwayat.

`db:seed` menghapus total data pengguna/katalog/transaksi lalu membangun
ulang dari nol (bukan cuma data transaksi) -- supaya deterministik berapa kali
pun dijalankan, dari versi seed manapun sebelumnya. Aman dijalankan berulang.

Efek samping reset total: sesi login (JWT) yang aktif sebelum `db:seed`
dijalankan jadi basi (nunjuk ke user ID yang sudah dihapus). Logout lalu
login ulang setelah tiap `db:seed`.

---

## 7. Dokumen pendamping

- `Bab_Arsitektur_G-Fresh_Monolitik.docx` -- bab arsitektur versi monolitik MVP
  (§8.1-8.8) dengan 5 diagram tertanam, mirror struktur docx enterprise.
- 5 PNG diagram terpisah (konteks, komponen, alur swimlane, topologi, keamanan)
  untuk slide presentasi.

---

## 8. Preferensi kerja (untuk sesi lanjutan)

- Bahasa Indonesia informal, langsung ke inti.
- Perbaikan tertarget dengan lokasi file jelas, bukan rebuild total.
- Perubahan lebih dari 3 file: verifikasi typecheck dulu sebelum diserahkan
  (pakai shim @prisma/client karena prisma generate butuh network yang
  kadang diblok sandbox).
- Tandai eksplisit tiap kali batch butuh db:push vs cukup ganti kode.
- Kalau satu file kena dua batch berbeda, kasih versi gabungan -- jangan
  biarkan user apply berurutan dan saling menimpa.
- Sebelum menyerahkan project zip, verifikasi clean-room sekali: extract ke
  folder terpisah -> npm install -> tsc --noEmit -> baru kasih ke user.
- Kalau user minta "opsi pengembangan" / "pikirkan secara enterprise" --
  itu sinyal untuk PRESENTASIKAN PILIHAN dengan trade-off dulu, jangan
  langsung ngoding. Tunggu keputusan eksplisit.
- Jujur soal keterbatasan/risiko yang belum dibereskan (lihat §9) -- jangan
  dibiarkan diam-diam, sebutkan eksplisit tiap relevan.

---

## 9. Roadmap, keputusan tertunda & risiko terbuka

### Keputusan tertunda
Tidak ada. Keputusan terakhir: edit harga & stok produk -> **Opsi B dipilih
& sudah selesai** (batch #13, lihat §3).

### Risiko keamanan terbuka (perlu dibereskan sebelum produksi nyata)

**Foto KTP kurir DAN salinan sertifikat usaha tidak punya access control.** Mode storage local
menyimpan foto di `public/uploads/ktp/` dan `public/uploads/cert/` (batch #14)
yang bisa diakses siapa pun yang tahu URL -- nama file acak bukan proteksi sungguhan. Data KTP itu sensitif
(tunduk UU PDP). Wajib diperbaiki sebelum go-live: pindah ke bucket
privat + signed URL, atau serve lewat route ber-autentikasi.
Per September 2026 ini ITEM TERBUKA PALING MENDESAK; sudah tiga kali
direkomendasikan dan tiga kali ditunda demi fitur. Tiap batch baru cenderung
menambah dokumen sensitif ke folder yang sama.

Pola bug `X?.id` yang dipakai langsung di where Prisma (lihat §11) sudah
disapu bersih per batch #11, tapi selalu cek pola ini setiap menambah
query baru yang bergantung pada profil (ProducerProfile/CourierProfile)
yang bisa saja null.

### Gap fitur tersisa (belum dikerjakan, di luar cakupan batch manapun)
1. Notifikasi WA nyata -- provider sudah distub, tinggal isi kredensial gateway.
2. Laporan ekspor PDF/Excel untuk Pemkab.
3. Offline-first sync (antrian order saat sinyal hilang, pesisir/tambak).
4. Integrasi sertifikasi ke instansi penerbit (Halal/P-IRT/BPOM) -- masih manual.
5. Integrasi payment gateway asli (Midtrans/Xendit) -- titik TODO sudah ditandai.
6. Unit test untuk het.ts, escrow.ts, rating.ts, fraud.ts, b2b.ts,
   complaint.ts, negotiation.ts.
7. Model penugasan kurir lanjutan (penawaran bergilir/dispatcher) -- butuh
   koordinat kurir real-time yang belum ada.
8. Rate limit per akun untuk endpoint umum (bukan cuma klaim komplain).
9. ServiceArea baru membatasi pilihan di form pendaftaran; belum dipakai
   untuk membatasi jangkauan pengiriman/pencocokan kurir secara geografis.
10. OCR/validasi NIK ke Dukcapil -- verifikasi KTP masih manual oleh admin.
11. (selesai di batch #15 -- pantauan harga Pemkab sudah ada.)
12. Ambang stok minimum + notifikasi stok menipis (bagian Opsi C) tidak
    dikerjakan. Begitu juga penjadwalan harga & lot/batch per panen.
13. Hitung mundur "Ambil Pesanan (00:45)" dari poster BELUM dibuat. Perlu
    keputusan sadar: tugas kurir sekarang rebutan bebas, dan hitung mundur
    menyiratkan penawaran yang kedaluwarsa -- padahal adegan rebutan 409 justru
    salah satu yang paling meyakinkan di demo.
14. Logo header masih hasil konversi JPG (ada kotak putih). Menunggu berkas
    latar transparan dari user. Ikon PWA menunggu versi latar solid.
15. Foto produk baru 9 (semua kategori Sayur). Kategori Ikan, Buah, Daging,
    Telur, Beras, Olahan masih placeholder.
16. `StockMovement` belum dipakai untuk rekonsiliasi otomatis (mis. alarm bila
    akumulasi mutasi != stok). Saat ini konsistensi dijaga oleh disiplin kode:
    semua perubahan stok WAJIB lewat `adjustStock()`.

---

## 10. Catatan kejujuran teknis (untuk juri / QnA)

- Waktu panen = self-declared produsen. Sistem menjamin kode QR otentik
  (anti-palsu via HMAC), BUKAN kebenaran klaim panennya.
- "Escrow" memanfaatkan fitur hold/delayed-settlement payment gateway,
  BUKAN lembaga escrow berlisensi. Operator tidak menyimpan dana pelanggan.
- Pesanan B2B tidak lewat escrow -- bayar bertermin via invoice, operator
  menanggung risiko kredit. Mitigasi: verifikasi profil bisnis + cabut akses
  bila menunggak.
- Subsidi ongkir sengaja hanya B2C -- kanal B2B yang mendanainya.
- Anti-fraud tidak memblokir klaim wajar -- batas keras 3/30hari yang
  menolak; sisanya skor risiko sebagai bahan pertimbangan admin.
- Verifikasi KTP kini punya alur submission nyata (NIK + foto), tapi
  peninjauannya tetap manual oleh admin -- bukan verifikasi ke Dukcapil.
- Wilayah layanan dikelola Admin (bukan hardcode) -- cerminan model pilot
  yang bisa diperluas bertahap.
- HET batas atas lindungi konsumen, floorPrice lindungi produsen. Dasar
  hukum kewenangan HET tingkat kabupaten perlu ditinjau bagian hukum Pemkab.
- Notifikasi best-effort -- kegagalan kirim tidak pernah menggagalkan
  transaksi bisnis (try/catch, di luar transaksi DB).
- Penyesuaian stok manual produsen (Restock/Terjual manual/Rusak/Koreksi)
  adalah SELF-REPORTED, sama seperti waktu panen. Yang dijamin sistem: setiap
  penyesuaian tercatat, ada alasannya, dan tidak bisa mengubah stok tanpa jejak
  -- BUKAN kebenaran angka yang dilaporkan. Baris seed ditandai "(data demo)".
- Mode mock (payment/notify) & local (storage) memungkinkan demo penuh
  tanpa kredensial eksternal -- tapi storage local punya risiko akses yang
  dicatat di §9.

---

## 11. Troubleshooting yang pernah kejadian

- **npm 11/12 blok install script** -> `npm approve-scripts --all` (prisma,
  @prisma/client, @prisma/engines, esbuild semua legit), lalu install ulang
  bersih supaya script benar-benar jalan.
- **"Invalid hook call / useContext null"** -> React dobel di dependency tree.
  Fix: hapus node_modules + package-lock.json, npm install ulang.
- **Next.js versi terlalu baru** -> sempat ke-install Next 16, bikin params
  jadi async & error runtime. Wajib tetap di 14.2.35 (versi 14.x terakhir
  yang ditambal CVE bypass middleware CVSS 9.1). Jangan pakai 14.2.5 (rentan).
- **Module not found '@supabase/supabase-js'** saat storage mode local ->
  dynamic import harus webpackIgnore: true via variabel, bukan @ts-ignore.
- **ts(2882) globals.css / next/navigation no declaration** -> cache
  TS server editor. Restart TS Server + Select Workspace Version.
- **git push ditolak (fetch first)** pada repo GitHub baru dengan README
  default -> git pull origin main --allow-unrelated-histories, resolve
  conflict README dengan git checkout --ours.
- **`prisma generate` / `prisma validate` gagal di sandbox** -> host
  `binaries.prisma.sh` dibalas 403 (bukan masalah di lokal user).
  Konsekuensi penting: typecheck sesi Claude dijalankan pakai shim
  `@prisma/client`, jadi hasil query Prisma bertipe `any` -- nama field/model
  Prisma TIDAK ikut terverifikasi. Sisa error TS7006/TS7031 di output typecheck
  adalah artefak shim, bukan bug. Selalu jalankan `prisma db push` di lokal
  dulu untuk memvalidasi schema.
- **`signOut({ callbackUrl })` memakai `NEXTAUTH_URL` server, bukan origin
  pengunjung** -> logout lewat ngrok/IP LAN melempar ke `localhost` dan gagal.
  Perbaikan: `signOut({ redirect: false })` lalu `window.location.href = '/'`.
  Benar di localhost, ngrok, LAN, dan produksi tanpa menyetel apa pun.
- **Ikon PWA jangan transparan & jangan mepet tepi** -> Android memotong ikon
  `purpose: "any maskable"` jadi lingkaran dan mengisi transparansi dengan
  HITAM. Butuh latar solid + lambang di 80% area tengah. Sementara diturunkan
  ke `"any"` sampai berkas ikonnya diperbaiki.
- **JPG yang "dikonversi" jadi SVG bukan vektor** -> cuma bitmap dibungkus
  wadah SVG; latar putihnya ikut, tetap pecah saat diperbesar. Logo header
  butuh latar TRANSPARAN, ikon PWA butuh latar SOLID -- dua ekspor berbeda dari
  satu sumber.
- **Foto produk dicocokkan dari slug nama** (`Tomat Cherry` ->
  `tomat-cherry.jpg`) di `public/img/produk/`, dengan `fs.existsSync` -- yang
  belum ada jatuh ke placeholder, jadi foto bisa dicicil tanpa gambar rusak.
- **Neon cold start** -> request pertama setelah idle lambat 1-3 detik. Cron
  settle tiap 10 menit kebetulan membantu menjaga compute tetap hidup.
- **Unique constraint failed on phone saat db:seed** -> email akun sistem
  (mis. pemkab) berubah antar versi seed, baris lama dengan HP sama masih
  nyangkut. Fix permanen: upsertSystemUser() di seed mencocokkan
  berdasarkan email ATAU HP, bukan email saja.
- **Data produsen/produk dobel setelah ganti seed** -> root cause: seed lama
  cuma bersihkan data transaksi, bukan User/Product. Fix: seed sekarang
  reset total (hapus semua User/Product/HetPrice sebelum membangun ulang).
- **"Profil produsen/kurir tidak ada" padahal data seharusnya ada** -> gejala
  sesi JWT basi setelah db:seed (lihat §6) ATAU bug nyata: query yang pakai
  producer?.id / courier?.id langsung di where Prisma. Prisma memperlakukan
  undefined sebagai "abaikan filter ini", BUKAN "jangan cocokkan apa pun" --
  akibatnya query bisa balik menampilkan data SEMUA producer/kurir, termasuk
  endpoint API (bukan cuma halaman). Disapu bersih di batch #11: selalu guard
  eksplisit if (!producer) return ... sebelum query, jangan andalkan ?.

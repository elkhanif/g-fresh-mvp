# G-Fresh — Memory / Handoff Proyek

> **Cara pakai dokumen ini:** upload file ini di awal chat baru, bersamaan dengan
> zip project terbaru (`gfresh-lengkap-v24.zip` atau yang lebih baru). Dengan dua
> file itu, sesi baru bisa langsung tahu posisi proyek tanpa diceritakan ulang.
>
> Update §3 (Status) dan §9 (Roadmap & risiko terbuka) tiap ada progres —
> dua bagian itu yang paling cepat basi.
>
> **Versi zip terakhir: v24.** Perubahan v18–v24 dirangkum di §12.

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
**Folder lokal:** `C:\Users\m.khanif\Downloads\gfresh` (Windows / PowerShell)

**Status presentasi GIK: BELUM.** Ini yang menentukan prioritas — lihat §13.

---

## 2. Stack & environment

Next.js **14.2.35** (jangan naik ke 15/16 — lihat §11) · TypeScript ·
**Tailwind v4.3.3** (bukan v3 lagi — lihat §12.2) · Prisma 5 ·
**PostgreSQL Neon** · NextAuth (Credentials + JWT) · bcryptjs · qrcode ·
html5-qrcode · zod · lucide-react.

**Database: Neon.** Pola dual-URL:
- `DATABASE_URL` = pooled (hostname ada `-pooler`)
- `DIRECT_URL` = direct (tanpa `-pooler`), untuk `prisma db push`
- Project: `gfresh` · role `gfresh_owner` · region `ap-southeast-1`
- **Cold start:** Neon scale-to-zero setelah 5 menit idle → request pertama
  lambat 1–3 detik. Tambahkan `connect_timeout=15` di connection string.
  Buka app dulu sebelum demo biar compute-nya "panas".

**Storage: DUA KELAS, sengaja dipisah** (lihat §12.1):
- **Publik** — foto produk → `public/uploads/products/` + `public/img/produk/`
- **Privat** — foto KTP, salinan sertifikat, bukti komplain →
  `private-uploads/` DI LUAR `public/`, hanya bisa dibaca lewat
  `GET /api/files/[kind]/[name]`

**Provider:** payment & notify masih mode `mock` (simulasi penuh).

### Cara run (PowerShell — `rm -rf` tidak ada di Windows)
```powershell
Remove-Item -Recurse -Force node_modules, package-lock.json, .next -ErrorAction SilentlyContinue
npm install             # kalau kena approve-scripts (npm 11/12): npm approve-scripts --all
Copy-Item .env.example .env   # isi DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, TRACE_SECRET
npm run db:push
npm run db:generate
npm run db:seed
npm run build           # WAJIB sekali — lihat §11 soal keterbatasan shim Prisma
npm run dev
```

---

## 3. STATUS: fitur #1–#22 SUDAH DITERAPKAN

> Catatan: header bagian ini di dokumen memory versi lama masih menulis
> "#1–#12" padahal tabelnya sampai #22. Sudah diperbaiki di sini.

| # | Fitur | Inti implementasi |
|---|---|---|
| - | HET enforcement | Validasi harga server-side, batas atas + floorPrice |
| - | Escrow + garansi 2 jam | transitionOrder() satu titik, atomik $transaction |
| - | QR traceability | Kode HMAC per item order, halaman /trace/[code] publik |
| - | RBAC 5 peran | NextAuth JWT + middleware.ts + requireRole() |
| - | Rating + sanksi bertingkat | Recompute dari riwayat; < 3.0 = auto-suspend |
| - | KPI dashboard Pemkab | Target 10.1 dengan progress bar |
| - | Foto produk & scan QR kamera | Upload /api/upload, html5-qrcode ke /trace |
| 1 | Subsidi ongkir per tier | >=4.5 → 30% · >=4.0 → 15% · hanya kanal B2C |
| 2 | SLA admin 48 jam | Lewat tenggat → auto-refund ke konsumen |
| 3 | Search & filter marketplace | URL params ?q= & ?kategori= |
| 4 | Halaman akun | /app/akun — profil, sandi, alamat tersimpan |
| 5 | Refund parsial | Status REFUND_SEBAGIAN, dana dipecah otomatis |
| 6 | Notifikasi in-app | Lonceng + polling 30s, fanout ke pihak terkait |
| 7 | Anti-fraud klaim | Batas 3 klaim/30 hari + skor risiko 0-100 (5 pola) |
| 8 | B2B | Harga grosir, fee 2,5%, invoice net-14 auto, halaman cetak |
| 9 | Seed demo + fix race kurir | 8 produsen, 5 kurir, 24 produk; klaim tugas atomik |
| 10 | Negosiasi komplain | Kategori terstruktur, saran refund, 3 ronde, SLA dua arah |
| 11 | Fix kebocoran data | producer?.id / courier?.id di where Prisma → guard eksplisit |
| 12 | Wilayah layanan + KYC KTP | ServiceArea dikelola Admin; kurir submit NIK+foto |
| 13 | Edit harga & stok produsen (**Opsi B**) | PriceHistory + StockMovement, delta atomik |
| 14 | Panel sertifikasi dinas (**Opsi B**) | 5 aksi sadar-status, CertReview audit log |
| 15 | Pantauan harga Pemkab | Rekonstruksi dari PriceHistory, grafik SVG, deteksi >=15% |
| 16 | Mode demo lokal + palet poster | Docker Postgres 5433, 6 skrip demo, leaf-600 = #2E7D32 |
| 17 | Keranjang belanja | Troli lintas penjual (localStorage), banner HET |
| 18 | Bottom nav + ikon SVG | nav.ts satu sumber, maks 5 butir/peran |
| 19 | Ganti ke lucide-react | Icon.tsx jadi lapisan tipis di atas lucide |
| 20 | Ringkasan penjual + langkah kurir | 3 kartu produsen, langkah 1-2-3 + navigasi peta |
| 21 | Dompet kurir + angsuran coolbox | WalletTx append-only, ToolkitPlan |
| 22 | Pasar & Kios | 7 pasar SIBAPO, SellerType TANI/PASAR, /pasar/[slug] publik |

Detail per batch #13–#22 ada di dokumen memory versi sebelumnya — tidak diulang
di sini karena sudah stabil dan tidak jadi sumber pertanyaan lagi.

---

## 4. Peran & alur

- **PRODUSEN** — kelola produk (harga <= HET, harga grosir opsional; ubah harga,
  sesuaikan stok +/- dengan alasan, lihat riwayat keduanya, aktif/nonaktifkan),
  cetak label QR, lihat rating sendiri, menyanggah/menawar komplain (12 jam,
  maks 3 ronde), ajukan sertifikasi.
- **KONSUMEN** — belanja (cari/filter), bayar (escrow), scan QR, ajukan komplain
  berkategori + bukti, terima/tolak tawaran refund, kelola akun & alamat,
  daftar akun bisnis B2B.
- **KURIR** — ambil tugas (rebutan, klaim atomik), submit KTP untuk verifikasi,
  toggle ketersediaan, detail tugas + peta, riwayat & pendapatan, dompet.
- **ADMIN** — verifikasi KTP kurir & pembeli B2B, kelola wilayah layanan,
  putuskan komplain tereskalasi, tandai invoice lunas. TIDAK bisa ubah HET.
- **PEMKAB** — tetapkan HET, verifikasi sertifikasi, KPI target 10.1, direktori
  produsen, pantauan harga, transparansi lintas-subsidi. Read-only operasional.
  **TIDAK punya akses foto KTP** (lihat §12.1).

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
                              [bila TAWAR] konsumen TERIMA -> REFUND_SEBAGIAN
                                           konsumen TOLAK  -> tawar ulang (maks 3)
                                           konsumen diam 12j -> admin memutus
                                                               |
                                    VALID -> REFUND · SEBAGIAN -> REFUND_SEBAGIAN
                                    DITOLAK -> SELESAI · admin idle 48j -> auto-REFUND
```
Semua transisi lewat `transitionOrder()` di `src/lib/escrow.ts`.

### Alur kurir: REBUTAN (first-come-first-served)
Klaim atomik via `updateMany` dengan syarat `courierId: null` di dalam WHERE —
yang kalah cepat dapat HTTP 409. Syarat klaim: KTP terverifikasi, ketersediaan
menyala, rating >= ambang.

---

## 5. Struktur kode

```
src/
  app/
    (auth)/login, register        <- kecamatan fetch dari /api/service-areas
    trace/[code]/                 telusur publik (hasil scan QR)
    pasar/[slug]/                 halaman pasar PUBLIK tanpa login
    app/
      layout.tsx                  shell + nav per peran + NotificationBell
                                  header TINGGINYA h-12 EKSPLISIT (lihat §12.4)
      akun/ produsen/ konsumen/ kurir/ admin/ pemkab/
    api/
      files/[kind]/[name]/        <- BARU: satu-satunya jalan baca berkas privat
      products/[id]/price|stock|history/
      orders/ complaints/ het/ cert/ account/ business/ invoices/
      courier/availability|ktp/ service-areas/ admin/*
      upload/ cron/settle/ health/ auth/
  components/
    StickyCatalogBar.tsx          <- BARU: bilah katalog menempel (lihat §12.4)
    CertBadge.tsx                 punya mode `compact` untuk chip di atas foto
    BottomNav.tsx CartLink.tsx NotificationBell.tsx OrderStatusBadge.tsx
    charts/LineChart.tsx  forms/*  ui/*
  lib/
    file-access.ts  <- BARU: matriks otorisasi baca berkas privat + log akses
    storage.ts      dua kelas: publik (local|supabase) & privat (selalu disk)
    het.ts inventory.ts product-owner.ts escrow.ts rating.ts complaint.ts
    negotiation.ts fraud.ts b2b.ts notification.ts qr.ts cert.ts cert-expiry.ts
    wallet.ts price-monitor.ts providers/ rbac.ts auth.ts db.ts utils.ts nav.ts
scripts/
  migrate-private-uploads.ts      pindah public/uploads/{ktp,cert,complaints}
  cek-foto-produk.ts              laporan cakupan foto produk
prisma/
  schema.prisma (20 model, +FileAccessLog) · seed.ts · assets/placeholder-ktp.png
public/
  img/produk/README.md            checklist 24 nama berkas foto produk
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
| Maks ukuran unggahan | 15 MB/file | storage.ts |
| Tinggi header app | h-12 (48px) | app/app/layout.tsx |

---

## 6. Akun demo (kata sandi semua: password123)

| Peran | Email |
|---|---|
| Pemkab | pemkab@gresik.go.id |
| Admin | admin@gfresh.id |
| Produsen (8) | tani.cerme@ · tambak.manyar@ · tani.duduk@ · ayam.menganti@ · sayur.kebomas@ · umkm.gresik@ · tani.balongpanggang@ · buah.wringinanom@ |
| Kurir (5) | kurir.budi@ · kurir.eko@ · kurir.sari@ (KTP verified) · kurir.agus@ (verified, nonaktif) · kurir.dani@ (KTP pending — demo panel admin) |
| Konsumen (4) | konsumen@ · konsumen.dewi@ · konsumen.tono@ · konsumen.maya@ |
| B2B | katering@gfresh.id (Katering Bu Sri — terverifikasi) |

Semua domain `gfresh.id` kecuali Pemkab.

Seed: 7 kategori + HET, 18 kecamatan (8 aktif untuk pilot), 24 produk (10 harga
grosir), 16 pesanan riwayat (3 sengaja DIBAYAR untuk demo rebutan kurir),
2 komplain demo, 7 pasar SIBAPO, rating dihitung dari riwayat.

`db:seed` menghapus TOTAL data pengguna/katalog/transaksi lalu membangun ulang
dari nol — deterministik berapa kali pun dijalankan. Foto KTP demo di-stage ke
`private-uploads/ktp/placeholder-ktp.png` (BUKAN ke `public/`), jadi demo pun
menempuh route ber-autentikasi dan tercatat di FileAccessLog.

**Efek samping reset total:** sesi login (JWT) yang aktif sebelum `db:seed` jadi
basi. Logout lalu login ulang setelah tiap `db:seed`.

---

## 7. Dokumen pendamping

- `Bab_Arsitektur_G-Fresh_Monolitik.docx` — bab arsitektur versi monolitik MVP
- 5 PNG diagram terpisah (konteks, komponen, swimlane, topologi, keamanan)
- `public/img/produk/README.md` — checklist + panduan pemotretan foto produk

---

## 8. Preferensi kerja (untuk sesi lanjutan)

- Bahasa Indonesia informal, langsung ke inti.
- Perbaikan tertarget dengan lokasi file jelas, bukan rebuild total.
- Zip lengkap (timpa folder), bukan patch per file.
- Tandai eksplisit tiap kali batch butuh `db:push` vs cukup ganti kode.
- Kalau satu file kena dua batch berbeda, kasih versi gabungan.
- Kalau user minta "opsi pengembangan" / "pikirkan secara enterprise" — itu
  sinyal untuk PRESENTASIKAN PILIHAN dengan trade-off dulu, jangan langsung
  ngoding. Tunggu keputusan eksplisit.
- Jujur soal keterbatasan/risiko yang belum dibereskan — sebutkan eksplisit
  tiap relevan, jangan dibiarkan diam-diam.
- **Perintah shell untuk PowerShell**, bukan bash (`Remove-Item -Recurse -Force`,
  bukan `rm -rf`).

---

## 9. Roadmap, keputusan tertunda & risiko terbuka

### Keputusan tertunda
Tidak ada. Keputusan terakhir (sesi v18–v24): KTP privat = **route ber-auth,
file tetap di disk**; cakupan = **KTP + sertifikat + bukti komplain**;
PEMKAB = **tanpa akses KTP**; log akses = **ya**; Tailwind = **migrasi v4
sekarang**.

### ✅ SELESAI: risiko keamanan foto KTP
Item yang tiga kali ditunda demi fitur akhirnya ditutup di v18. Detail §12.1.
Terverifikasi end-to-end: admin 200 · PEMKAB 404 · jalur statis lama 404 ·
FileAccessLog terisi.

### 🐞 Bug terbuka yang diketahui

**1. Kolom cari di bilah katalog masih berkedip** (`StickyCatalogBar.tsx`).
Perilaku sembunyi-saat-scroll-turun / muncul-saat-scroll-naik memicu loop
umpan balik: menyusutkan kolom mengubah tinggi dokumen → browser menggeser
scrollY (scroll anchoring) → geseran itu terbaca sebagai gerakan pengguna →
kolom berubah lagi. Sudah dicoba 3 penangkal sekaligus (`overflow-anchor:
none`, cooldown 400ms + re-baseline, ambang 14px + rAF throttle) dan **masih
belum bersih** di posisi scroll tertentu (sekitar setelah baris pasar).

> **Jalan keluar paling aman sebelum demo:** buat kolom cari selalu terlihat.
> Di `StickyCatalogBar.tsx`, ganti isi `className` wadah `search` jadi tetap
> `max-h-20 opacity-100` (atau hapus wadah kondisionalnya). Nol risiko kedip,
> ongkosnya ~56px ruang permanen. Perilaku sembunyi-muncul memang selalu
> berkelahi dengan tinggi dokumen yang berubah; di halaman yang blok atasnya
> banyak seperti ini, belum tentu sepadan.

**2. Halaman baca FileAccessLog belum ada.** Log-nya masih write-only, cuma
kebaca lewat `npm run db:studio`. Cukup untuk GIK. Kalau pilot jadi, halaman
"riwayat akses dokumen saya" di `/app/akun` yang mengubahnya dari catatan
internal jadi hak subjek data (UU PDP).

### ⚠️ Perlu dicek user
**Isi `CRON_SECRET` di `.env`.** Sebelum v22, `/api/cron/settle` ikut
di-prerender statis, artinya logikanya berpotensi **jalan saat `npm run build`**
kalau `CRON_SECRET` kosong — build pernah menyentuh database Neon (order
di-settle, invoice ditandai jatuh tempo, angsuran coolbox dipotong).
`npm run db:seed` membersihkannya. **Jangan pernah `npm run build` dengan
`.env` yang menunjuk database produksi.**

### Gap fitur tersisa (belum dikerjakan)
1. **Foto produk masih sebagian.** Folder `public/img/produk/` di zip cuma berisi
   README (foto tidak ikut dipaketkan agar tidak menimpa milik user). Jalankan
   `npx tsx scripts/cek-foto-produk.ts` untuk laporan cakupan. Rasio wajib
   **5:3 mendatar** — kartu memotong ke rasio itu, foto tegak kehilangan subjek.
2. Notifikasi WA nyata — provider distub, tinggal isi kredensial gateway.
3. Laporan ekspor PDF/Excel untuk Pemkab.
4. Offline-first sync (antrian order saat sinyal hilang, pesisir/tambak).
5. Integrasi sertifikasi ke instansi penerbit (Halal/P-IRT/BPOM) — masih manual.
6. Integrasi payment gateway asli (Midtrans/Xendit) — titik TODO sudah ditandai.
   **Konsekuensi jujur: klaim "escrow" masih bersandar pada gateway mock.**
7. Unit test untuk het.ts, escrow.ts, rating.ts, fraud.ts, b2b.ts, complaint.ts,
   negotiation.ts, wallet.ts. **Nol test di modul yang megang uang.**
8. Model penugasan kurir lanjutan (dispatcher/penawaran bergilir) — butuh
   koordinat kurir real-time yang belum ada.
9. Rate limit per akun untuk endpoint umum.
10. ServiceArea belum dipakai membatasi jangkauan pengiriman secara geografis.
11. OCR/validasi NIK ke Dukcapil — verifikasi KTP masih manual oleh admin.
12. Ambang stok minimum + notifikasi stok menipis (bagian Opsi C, sengaja skip).
13. Hitung mundur "Ambil Pesanan (00:45)" dari poster BELUM dibuat — perlu
    keputusan sadar, karena adegan rebutan 409 justru paling meyakinkan di demo.
14. Logo header masih hasil konversi JPG (ada kotak putih). Ikon PWA menunggu
    versi latar solid.
15. `StockMovement` belum dipakai untuk rekonsiliasi otomatis.
16. **Kelas storage privat selalu ke disk lokal** → tidak jalan di serverless.
    Kalau deploy ke Vercel, yang perlu diganti hanya `putPrivate()` +
    `readPrivate()` ke bucket privat + signed URL; route `/api/files` dan
    matriks otorisasinya TIDAK berubah. Boundary-nya sudah benar.

---

## 10. Catatan kejujuran teknis (untuk juri / QnA)

- Waktu panen = self-declared produsen. Sistem menjamin kode QR otentik
  (anti-palsu via HMAC), BUKAN kebenaran klaim panennya.
- "Escrow" memanfaatkan fitur hold/delayed-settlement payment gateway, BUKAN
  lembaga escrow berlisensi. Operator tidak menyimpan dana pelanggan.
  **Saat ini gateway-nya masih mock.**
- Pesanan B2B tidak lewat escrow — bayar bertermin via invoice, operator
  menanggung risiko kredit.
- Subsidi ongkir sengaja hanya B2C — kanal B2B yang mendanainya.
- Anti-fraud tidak memblokir klaim wajar — batas keras 3/30hari yang menolak;
  sisanya skor risiko sebagai bahan pertimbangan admin.
- Verifikasi KTP punya alur submission nyata, tapi peninjauannya manual oleh
  admin — bukan verifikasi ke Dukcapil.
- HET batas atas lindungi konsumen, floorPrice lindungi produsen. Dasar hukum
  kewenangan HET tingkat kabupaten perlu ditinjau bagian hukum Pemkab.
- Notifikasi best-effort — kegagalan kirim tidak pernah menggagalkan transaksi.
- Penyesuaian stok manual produsen adalah SELF-REPORTED. Yang dijamin sistem:
  setiap penyesuaian tercatat, ada alasannya, tidak bisa tanpa jejak — BUKAN
  kebenaran angka yang dilaporkan.
- Pantauan harga Pemkab = harga tayang di G-Fresh, BUKAN survei pasar
  tradisional. Batas ini tercetak di kaki halaman.
- **Foto KTP/sertifikat/bukti komplain sekarang punya kontrol akses nyata**
  (route ber-auth + otorisasi dari DB + log akses), bukan sekadar nama file acak.
- "Pasar terdekat X km" SENGAJA TIDAK diklaim — koordinat pengguna belum ada,
  dan angka jarak karangan lebih buruk daripada tidak ada.

---

## 11. Troubleshooting yang pernah kejadian

- **`rm -rf` gagal di PowerShell** (`A parameter cannot be found that matches
  parameter name 'rf'`) → `rm` adalah alias `Remove-Item`. Pakai
  `Remove-Item -Recurse -Force <a>, <b> -ErrorAction SilentlyContinue`.
- **`prisma generate` gagal di sandbox Claude** → host `binaries.prisma.sh`
  dibalas 403. **Konsekuensi paling penting: typecheck sesi Claude memakai shim
  `@prisma/client`, jadi hasil query Prisma bertipe `any` dan NAMA FIELD/MODEL
  PRISMA TIDAK IKUT TERVERIFIKASI.** Ini bukan teori — di v21 lolos bug
  `prod.lat`/`prod.lng` yang seharusnya `latitude`/`longitude` (lihat §12.5).
  **Selalu `npm run build` di lokal sebelum percaya kode dari sesi Claude.**
  Sisa error TS7006/TS7031/TS2693 di output typecheck sesi Claude adalah
  artefak shim, bukan bug.
- **`next build` menandai route API sebagai `○ (Static)`** → handler GET yang
  tidak dianggap dinamis akan dibuat SEKALI saat build lalu disajikan dari
  cache. Untuk endpoint yang membaca/menulis DB ini merusak. Wajib
  `export const dynamic = 'force-dynamic'`. Cara mendeteksi: di output
  `npm run build`, semua route `/api/*` harus `ƒ`, bukan `○`.
- **npm 11/12 blok install script** → `npm approve-scripts --all` (prisma,
  @prisma/client, @prisma/engines, esbuild semua legit), lalu install ulang.
- **"Invalid hook call / useContext null"** → React dobel di dependency tree.
  Hapus node_modules + package-lock.json, install ulang.
- **Next.js versi terlalu baru** → sempat ke-install Next 16, bikin params jadi
  async & error runtime. Wajib tetap di 14.2.x. Floor di package.json sudah
  dinaikkan ke `^14.2.35` — jangan turunkan, 14.2.5 rentan bypass middleware
  (CVSS 9.1).
- **Tailwind v4: `theme()` sudah tidak ada** → pakai `var(--color-leaf-600)`.
  Ini gagal keras saat compile, jadi tidak bisa lolos diam-diam.
- **Tailwind v4: state hover/aktif tidak kelihatan** → chip kategori memakai
  `bg-leaf-50` untuk hover DAN untuk aktif, sementara latar halaman juga
  `leaf-50`. Efeknya nol. Pelajaran: **jangan pakai token warna yang sama
  dengan latar halaman untuk state interaktif.**
- **Module not found '@supabase/supabase-js'** saat storage mode local →
  dynamic import harus `webpackIgnore: true` via variabel, bukan `@ts-ignore`.
- **ts(2882) globals.css / next/navigation no declaration** → cache TS server.
  Restart TS Server + Select Workspace Version.
- **`signOut({ callbackUrl })` memakai `NEXTAUTH_URL` server** → logout lewat
  ngrok/IP LAN melempar ke localhost. Fix: `signOut({ redirect: false })` lalu
  `window.location.href = '/'`.
- **Ikon PWA jangan transparan & jangan mepet tepi** → Android memotong ikon
  `purpose: "any maskable"` jadi lingkaran dan mengisi transparansi dengan
  HITAM. Butuh latar solid + lambang di 80% area tengah.
- **JPG yang "dikonversi" jadi SVG bukan vektor** → logo header butuh latar
  TRANSPARAN, ikon PWA butuh latar SOLID: dua ekspor berbeda dari satu sumber.
- **Foto produk dicocokkan dari slug nama** (`Tomat Cherry` →
  `tomat-cherry.jpg`) di `public/img/produk/`, dengan `fs.existsSync` — yang
  belum ada jatuh ke placeholder, jadi foto bisa dicicil.
- **Neon cold start** → request pertama setelah idle lambat 1–3 detik.
- **Unique constraint failed on phone saat db:seed** → `upsertSystemUser()`
  mencocokkan berdasarkan email ATAU HP.
- **Data produsen/produk dobel setelah ganti seed** → seed sekarang reset total.
- **"Profil produsen/kurir tidak ada" padahal data ada** → sesi JWT basi setelah
  db:seed, ATAU bug nyata: `producer?.id` dipakai langsung di where Prisma.
  Prisma memperlakukan `undefined` sebagai "abaikan filter ini", BUKAN "jangan
  cocokkan apa pun" — query bisa balik menampilkan data SEMUA producer.
  Disapu bersih di #11, tapi selalu cek pola ini di query baru.

---

## 12. Perubahan v18 → v24 (sesi September 2026)

### 12.1 Berkas privat (KTP / sertifikat / bukti komplain) — SELESAI

Sebagian sudah ada di v17 (belum tercatat di memory lama). Yang ditambahkan
di v18: **PEMKAB dicabut dari daftar yang boleh membuka foto KTP.**

**Arsitektur:**
- `private-uploads/{ktp,cert,complaints}/` di luar `public/`, mode 0700/0600
- `GET /api/files/[kind]/[name]` — satu-satunya jalan baca
- `src/lib/file-access.ts` — matriks otorisasi + `logFileAccess()`
- Model `FileAccessLog` (butuh `db:push`)
- `scripts/migrate-private-uploads.ts` — pemindah sekali jalan, aman diulang

**Matriks akses:**

| Jenis | Yang boleh membuka |
|---|---|
| `ktp` | kurir ybs + ADMIN |
| `cert` | produsen ybs + PEMKAB + ADMIN |
| `complaints` | pelapor + produsen tersanggah + ADMIN |

PEMKAB tetap dapat `cert` karena di situ dinas memang pihak yang memutus
(verifikasi/tolak/cabut). PEMKAB **tidak** dapat `ktp` karena verifikasi KTP
kurir dikerjakan ADMIN — tidak ada alur kerja yang membutuhkannya. Prinsipnya:
**log itu pengawasan, bukan izin.** Peran yang tidak memerlukan sebuah data
tidak boleh bisa membukanya sekalipun aksesnya tercatat.

**Keputusan desain yang penting dipertahankan:**
- **Otorisasi dari DATABASE, bukan dari nama file.** URL dicari di kolom
  pemiliknya (`CourierProfile.ktpPhotoUrl`, `ProducerProfile.certDocUrl`,
  `Complaint.evidenceUrls`/`producerEvidence`), lalu kepemilikan record itu yang
  memutuskan. Berkas yang record-nya sudah terhapus otomatis tidak bisa dibaca
  siapa pun — itu perilaku yang diinginkan.
- **Semua penolakan menjawab 404, bukan 403.** Membedakan "tidak ada" dari
  "tidak boleh" memberi tahu penyerang bahwa foto KTP seseorang MEMANG ADA.
  Alasan sebenarnya tetap tercatat di FileAccessLog. **Konsekuensi saat
  debugging: 404 punya 5 sebab berbeda** (jenis tidak dikenal / nama tidak aman
  / belum login / bukan pemilik / berkas tidak ada di disk) — jangan menilai
  hasil tes dari status code saja, cek `reason` di FileAccessLog.
- **`FileAccessLog` tanpa foreign key ke User** — kalau ada FK, `db:seed` yang
  menghapus User akan ikut menghapus jejak auditnya. Nama pelaku disalin saat
  kejadian, pola sama dengan `CertReview`.
- **Penolakan juga dicatat**, bukan cuma akses yang berhasil.
- **Penulisan log best-effort** — kegagalannya tidak menggagalkan penyajian
  berkas (mengunci berkas gara-gara log gagal akan mematikan panel admin di saat
  paling tidak tepat), tapi dicetak keras ke console. Kalau kepatuhan menuntut
  "tidak ada akses tanpa jejak", tukar `console.error` jadi `throw`.
- **Fallback nama pelaku BUKAN 'Anonim'** — label itu khusus permintaan tanpa
  sesi. Menyamakannya membuat jejak audit menyesatkan. Dipakai `'(nama kosong)'`.
- `Cache-Control: private, no-store` + `X-Content-Type-Options: nosniff` +
  `Referrer-Policy: no-referrer`. Tanpa yang pertama, CDN/proxy di depan bisa
  menyimpan foto KTP di simpul tepi dan menyajikannya tanpa cek sesi.
- Guard path traversal dua lapis: daftar-putih karakter nama file, DAN hasil
  `path.resolve` harus tetap di dalam `privateRoot()/kind`.

**Cara memverifikasi (jangan diskip setelah perubahan apa pun di area ini):**
1. Login PEMKAB → buka `/api/files/ktp/placeholder-ktp.png` → harus **404**,
   dan `FileAccessLog` dapat baris `allowed:false reason:BUKAN_PEMILIK`
2. Login ADMIN → URL sama → harus **200** + gambar muncul
3. Tanpa login → `/uploads/ktp/placeholder-ktp.png` → harus **404**
   (ini yang membuktikan kebocoran lamanya beneran ketutup)

### 12.2 Migrasi Tailwind v3.4 → v4.3.3

- `tailwind.config.ts` **DIHAPUS**; tema pindah ke `@theme` di
  `src/app/globals.css`
- `@tailwind base/components/utilities` → `@import "tailwindcss"`
- postcss: `tailwindcss` + `autoprefixer` → satu plugin `@tailwindcss/postcss`
  (autoprefixer & postcss-import sudah di dalamnya)
- `theme('colors.leaf.600')` → `var(--color-leaf-600)`
- Rename yang menjaga tampilan tetap identik: `shadow-sm`→`shadow-xs` (5 titik),
  `rounded`→`rounded-sm` (2), `outline-none`→`outline-hidden` (5)
- **Yang WAJIB dijaga:** `leaf-600` harus tetap tepat `#2E7D32`, dan varian
  tombol `cta` oranye `#FF8F00` harus tetap nyala di 3 aksi puncak. Alasan
  oranye bukan sekadar ikut poster: hijau di atas putih luntur saat
  diproyeksikan.
- **Perubahan v4 paling berbahaya TIDAK berdampak di project ini:** border
  default jadi `currentColor`, tapi seluruh 159 pemakaian `border` di `src/`
  sudah punya warna eksplisit. Nol `divide-*`, nol `ring` polos. Jadi tidak ada
  compat-layer yang perlu dipasang. **Kalau nanti menambah `border` tanpa warna,
  garisnya akan ikut warna teks.**
- Risiko browser v4 (Safari 16.4+ / Chrome 111+) **sudah diterima secara sadar**.
  iPhone yang stuck di iOS 15 akan pecah tampilannya. Cek sekali di HP Android
  termurah yang ada sebelum demo.
- Floor `next` dinaikkan `^14.2.5` → `^14.2.35` (range lama masih mengizinkan
  lockfile lama memasang 14.2.5 yang rentan).

### 12.3 Katalog 2 kolom + kartu produk dirapikan

- Grid katalog konsumen & `/pasar/[slug]`: `1 kolom → sm:2 → lg:3` menjadi
  **`2 kolom → lg:3`**
- Kartu disesuaikan untuk lebar ~160px: `p-4`→`p-3 sm:p-4`, nama produk
  `line-clamp-2`, nama produsen `line-clamp-1`, harga `text-lg`→`text-base
  sm:text-lg`
- **Badge sertifikasi pindah jadi chip DI ATAS foto** (pojok kiri bawah,
  `bg-white/90` + blur tipis). Sebelumnya "✓ Tersertifikasi · P-IRT" pecah dua
  baris di atas badge kategori — ~60px chrome yang mendorong nama dan harga
  keluar layar. Mode `compact` di `CertBadge` melepas nama skema sertifikat
  (tetap ada di halaman detail produk).
- **Status negatif TIDAK disembunyikan** di mode compact. "Belum bersertifikat"
  adalah label terpanjang dan godaan menyembunyikannya besar, tapi kartu tanpa
  badge akan terbaca seolah aman — padahal sebaliknya.

### 12.4 Halaman katalog dirampingkan

- Judul "Belanja pangan segar" jadi **`sr-only`**, bukan dihapus — dia memakan
  seluruh lipatan pertama tanpa memberi informasi baru, tapi pembaca layar
  tetap butuh dan struktur heading tidak boleh bolong. Subjudul dibuang total.
- Banner HET dari kotak 2 baris jadi **satu baris** tipis.
- Toggle Eceran/Grosir + kolom cari masuk ke `StickyCatalogBar.tsx`, menempel
  di `top-12`. **Tinggi header di `layout.tsx` disetel EKSPLISIT `h-12`** —
  sebelumnya 48px kebetulan hasil `py-2.5`. Kalau tinggi header diubah, angka
  `top-12` WAJIB ikut diubah; ada komentar silang di kedua file.
- Header `z-10` → `z-30` supaya selalu di atas bilah katalog (`z-20`).
- **Tab Eceran/Grosir sengaja TIDAK ikut sembunyi saat scroll** — kanal harga
  menentukan arti seluruh angka di halaman; kalau tab-nya hilang, orang bisa
  lupa sedang melihat harga grosir. Itu salah baca yang mahal.
- Kolom cari sembunyi/muncul mengikuti arah scroll — **MASIH BERKEDIP, lihat
  §9 bug #1.**
- Chip kategori: penanda aktif pindah ke lingkaran ikon (aktif = hijau penuh
  isi putih, tidak aktif = putih bergaris, hover = hijau muda). Sebelumnya
  aktif & hover dua-duanya `bg-leaf-50` di atas latar `leaf-50` → tidak
  kelihatan, dan penanda tampak nyangkut di "Semua".
- Baris pasar: hanya pasar yang **benar-benar punya kios** (`producers: { some:
  {} }`, difilter di query bukan di render, jadi kalau nol pasar seluruh
  barisnya hilang sendiri). "Pasar Dukun · 0 kios" adalah tawaran kosong.
- **Latar halaman jadi token satu titik ganti:** `--color-page` di
  `globals.css`. Sekarang `#f8f9fa`. Pilihan lain sudah ditulis di komentar:
  `#ffffff` (putih murni — tapi kartu `bg-white` jadi menyatu dengan latar) dan
  `#e8f5e9` (hijau muda, tampilan sebelum v23). Ganti nilainya saja, tidak ada
  file lain yang perlu disentuh.

### 12.5 Bug nyata yang ditemukan `npm run build` (bukan oleh sesi Claude)

1. **`prod.lat` / `prod.lng` seharusnya `latitude` / `longitude`**
   (`app/app/kurir/page.tsx`). Bukan cuma type error — **fiturnya memang tidak
   pernah jalan.** `prod?.lat` selalu `undefined`, jadi cek `!= null` selalu
   gagal, jadi tombol "Navigasi ke lokasi jemput" SELALU jatuh ke cabang
   terakhir: `maps/search?query=<nama kebun>`. Kurir dapat pencarian nama
   tempat, bukan koordinat presisi produsen. Ini bagian batch #20.
2. **`session.user.name` bertipe `string | null | undefined`** (konvensi
   next-auth) padahal `Requester.name` menuntut `string` → `next build` gagal.
3. **`/api/cron/settle`, `/api/health`, `/api/service-areas` di-prerender
   statis** → `force-dynamic` ditambahkan ke ketiganya. Yang paling merugikan:
   `/api/service-areas` dipakai form registrasi supaya Admin bisa memperluas
   wilayah layanan tanpa deploy ulang — kalau statis, isinya terkunci di saat
   build dan alasan endpoint itu dibuat hilang.

**Pelajaran utama: shim Prisma di sesi Claude tidak bisa menangkap nama field
yang salah. `npm run build` di lokal adalah satu-satunya verifikasi nyata.**

### 12.6 Alat baru
- `scripts/cek-foto-produk.ts` — laporan cakupan foto produk, dibaca dari
  DATABASE (bukan dari seed), sekaligus menandai berkas yang ada tapi tidak
  cocok nama produk mana pun (penyebab tersering: salah ejaan slug)
- `public/img/produk/README.md` — checklist 24 nama berkas + panduan foto
- `.env.example` — didokumentasikan `PRIVATE_UPLOAD_DIR`

---

## 13. Prioritas berikutnya (presentasi GIK belum lewat)

**Sebelum demo:**
1. Foto produk — masih yang paling terlihat langsung di layar
2. Putuskan kolom cari: perbaiki kedipnya, atau buat selalu terlihat (§9 bug #1)
3. Cek `CRON_SECRET` (§9)
4. Cek tampilan di HP Android termurah yang ada (risiko browser Tailwind v4)
5. Logo header latar transparan + ikon PWA latar solid

**Setelah GIK — arah strategis yang sudah dibahas:**
- **Pilot nyata satu pasar / satu kecamatan.** 5 pedagang asli, order asli,
  uang asli. Mengubah demo jadi bukti. Juri kompetisi inovasi hampir selalu
  tanya "sudah ada yang pakai belum?" — dan "5 pedagang Pasar Baru, 40
  transaksi dalam 2 minggu" beda kelas dari "sistemnya sudah siap".
  **Jalur kritisnya bukan teknis: surat ke Diskoperindag masih belum dikirim.**
  Tanpa pintu masuk institusional, tidak ada akses ke pedagang pasar.
- **Reposisi: bukan marketplace, tapi instrumen Pemkab.** Sebagai marketplace,
  G-Fresh lawan Sayurbox dan kalah di ongkir. Yang tidak bisa ditiru siapa pun
  adalah HET enforcement + pantauan harga + traceability sebagai alat kebijakan.
  `/pasar/[slug]` publik sudah setengah jalan ke sana. Kelanjutan logisnya:
  data harga jadi API/open data, pipeline sertifikasi nyambung ke instansi
  penerbit. Marketplace-nya jadi cara mengumpulkan data, bukan produknya.
- **Production hardening** (security · testing · payment asli · observability ·
  reliability) — berharga kalau pilot jadi, hampir tak terlihat kalau tidak.

**Catatan strategis:** dompet kurir + angsuran coolbox membuat G-Fresh jadi
*operator*, bukan platform. Fitur bagus, tapi model bisnisnya jadi lebih berat
dan lebih susah discale. Pastikan itu keputusan sadar, bukan konsekuensi.

---

## 14. Prinsip utama untuk sesi pengembangan berikutnya

1. Jangan rebuild total jika cukup patch tertarget.
2. Jangan menambah fitur tanpa mengecek business invariant.
3. Semua perubahan uang harus atomic dan auditable.
4. Semua perubahan stok harus melalui domain function (`adjustStock()`).
5. Semua state transition harus ditentukan server (`transitionOrder()`).
6. Client tidak boleh menjadi sumber kebenaran business rule.
7. Data sensitif tidak boleh public — dan otorisasinya diputuskan dari DB,
   bukan dari nama berkas.
8. Jangan gunakan `undefined` Prisma sebagai authorization mechanism.
9. Critical business logic wajib punya test (masih nol — §9 gap #7).
10. Jangan menyebut sistem enterprise-ready sebelum security, testing,
    observability, backup, dan operational readiness selesai.
11. Pertahankan modular monolith sampai ada alasan operasional nyata untuk
    memecah service.
12. UI harus memakai design system/token, bukan styling random per halaman.
13. Jangan pakai token warna yang sama dengan latar halaman untuk state
    interaktif — efeknya nol dan sulit dilacak.
14. **`npm run build` di lokal sebelum percaya kode apa pun dari sesi Claude.**
    Semua route `/api/*` harus `ƒ`, bukan `○`.
15. Prioritaskan kualitas dan consistency daripada jumlah fitur.

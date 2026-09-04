# G-Fresh — Memory / Handoff Proyek

> **Cara pakai dokumen ini:** upload file ini di awal chat baru, bersamaan dengan
> `gfresh-lengkap-v2.zip`. Dengan dua file itu, sesi baru bisa langsung tahu posisi
> proyek tanpa perlu diceritakan ulang.
>
> Update bagian §3 (Status) dan §8 (Roadmap) setiap kali ada progres — dua bagian
> itu yang paling cepat basi.

---

## 1. Apa ini

**G-Fresh** — marketplace pangan segar *hyperlocal* untuk **Gresik Inovasi Kompetisi
(GIK) 2026**. Menghubungkan produsen (petani/petambak/peternak/UMKM) langsung ke
konsumen B2C & B2B tanpa gudang transit.

Tiga pilar: **QR-traceability**, **escrow + garansi kesegaran 2 jam**, dan
**kemitraan Pemkab (HET + sertifikasi)**. Komisi produsen 0% — pendapatan operator
dari platform fee B2B 2,5%, yang mendanai subsidi ongkir B2C (lintas-subsidi).

**Keputusan arsitektur utama:** SATU codebase **Next.js 14 (App Router) PWA** yang
melayani aplikasi mobile-first (produsen/konsumen/kurir) DAN dashboard web
(admin/Pemkab) via role-based routing — BUKAN Flutter/RN + web terpisah.

**Repo:** `https://github.com/elkhanif/g-fresh-mvp` (branch `main`)

---

## 2. Stack & environment

Next.js 14.2.35 · TypeScript · Tailwind · Prisma 5 · **PostgreSQL Neon** ·
NextAuth (Credentials + JWT) · bcryptjs · qrcode · html5-qrcode · zod.

**Database: Neon** (sudah migrasi dari Supabase). Pola dual-URL:
- `DATABASE_URL` = pooled (hostname ada `-pooler`)
- `DIRECT_URL` = direct (tanpa `-pooler`), untuk `prisma db push`
- Project: `gfresh` · role `gfresh_owner` · region `ap-southeast-1`
- **Catatan penting:** Neon scale-to-zero setelah 5 menit idle → ada cold start
  1–3 detik pada request pertama. Tambahkan `connect_timeout=15` di connection
  string. Sebelum demo, buka app dulu biar compute-nya "panas".

**Storage:** mode `local` (default) → `public/uploads/{products,complaints}/`.
Sudah di-`.gitignore`. Untuk serverless, ganti ke Supabase Storage via env.

**Provider:** payment & notify masih mode `mock` (simulasi penuh, tanpa kredensial).

### Cara run
```bash
npm install            # kalau kena approve-scripts (npm 11/12): npm approve-scripts --all
cp .env.example .env   # isi DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, TRACE_SECRET
npm run db:push
npm run db:generate
npm run db:seed
npm run dev
```

---

## 3. ⚠️ STATUS: semua fitur #1–#9 SUDAH ADA di dalam zip

`gfresh-lengkap-v2.zip` berisi project **utuh dengan semua batch sudah diterapkan
dan sudah lolos typecheck**. Tidak ada checklist apply yang tersisa.

Yang sudah jadi:

| # | Fitur | Inti implementasi |
|---|---|---|
| — | HET enforcement | Validasi harga server-side, batas atas + `floorPrice` |
| — | Escrow + garansi 2 jam | `transitionOrder()` satu titik, atomik `$transaction` |
| — | QR traceability | Kode HMAC per item order, halaman `/trace/[code]` publik |
| — | RBAC 5 peran | NextAuth JWT + `middleware.ts` + `requireRole()` |
| — | Rating + sanksi bertingkat | Recompute dari riwayat; < 3.0 = auto-suspend |
| — | Upload bukti komplain | Foto/video, maks 4 file 15 MB |
| — | Hak sanggah produsen | SETUJU → refund langsung · TOLAK → eskalasi admin · SLA 12 jam |
| — | KPI dashboard Pemkab | Target 10.1 dengan progress bar |
| — | Direktori produsen | Read-only, sebaran per kecamatan |
| — | Foto produk | `/api/upload`, tampil di marketplace & detail |
| — | Scan QR kamera | html5-qrcode → redirect `/trace` |
| — | Kurir lengkap | Statistik, toggle ketersediaan, detail tugas + peta, riwayat + pendapatan |
| — | Admin lengkap | Statistik pengguna, riwayat + filter, komplain dua sisi |
| 1 | Subsidi ongkir per tier | ≥4.5 → 30% · ≥4.0 → 15% · hanya B2C |
| 2 | SLA admin 48 jam | Lewat tenggat → auto-refund ke konsumen |
| 3 | Search & filter marketplace | URL params `?q=` & `?kategori=` |
| 4 | Halaman akun | `/app/akun` — profil, sandi, alamat tersimpan |
| 5 | Refund parsial | Status `REFUND_SEBAGIAN`, dana dipecah otomatis |
| 6 | Notifikasi in-app | Lonceng + polling 30s, fanout ke pihak terkait |
| 7 | Anti-fraud klaim | Batas 3 klaim/30 hari + skor risiko 0–100 (5 pola) |
| 8 | B2B | Harga grosir, fee 2,5%, invoice net-14 auto, halaman cetak |
| 9 | Seed demo + fix race kurir | 8 produsen, 5 kurir, 24 produk, 16 order riwayat |

**Format untuk mencatat pekerjaan yang belum di-apply nanti:**
```
### BELUM di-apply (per <tanggal>)
- [ ] <fitur> → <file> → <tujuan>
```

---

## 4. Peran & alur

- **PRODUSEN** — kelola produk (harga ≤ HET, harga grosir opsional), cetak label QR,
  lihat rating sendiri, **menyanggah komplain** (12 jam).
- **KONSUMEN** — belanja (cari/filter), bayar (escrow), scan QR, komplain + bukti,
  kelola akun & alamat, **daftar akun bisnis B2B**.
- **KURIR** — ambil tugas (**rebutan**), toggle ketersediaan, detail tugas + peta,
  riwayat & pendapatan ongkir.
- **ADMIN** — verifikasi KTP kurir & pembeli B2B, putuskan komplain (refund penuh /
  sebagian / tolak), tandai invoice lunas, riwayat. **TIDAK bisa ubah HET.**
- **PEMKAB** — tetapkan HET, verifikasi sertifikasi, KPI target 10.1, direktori
  produsen, transparansi lintas-subsidi B2B. Read-only untuk operasional.

### State machine order
```
MENUNGGU_BAYAR → DIBAYAR(HELD) → DIJEMPUT_KURIR → DIKIRIM → DITERIMA(grace 2j)
                                                               │
                                    ┌──────────────────────────┤
                              diam/konfirmasi             komplain
                                    │                          │
                                    ▼                          ▼
                          SELESAI(RELEASED)                SENGKETA
                                                    (dana tetap HELD)
                                                               │
                                            produsen: SETUJU → REFUND langsung
                                            produsen: TOLAK  → admin memutus
                                            tak respon 12j   → admin memutus
                                                               │
                                    VALID → REFUND · SEBAGIAN → REFUND_SEBAGIAN
                                    DITOLAK → SELESAI · admin idle 48j → auto-REFUND
```
Semua transisi lewat `transitionOrder()` di `src/lib/escrow.ts`.

### Alur kurir: REBUTAN (first-come-first-served)
Tidak ada dispatcher. Kurir mengklaim sendiri order berstatus `DIBAYAR` yang belum
bertuan. Klaim bersifat **atomik** via `updateMany` dengan syarat `courierId: null`
di dalam `WHERE` — yang kalah cepat dapat HTTP 409. Syarat klaim: KTP terverifikasi,
ketersediaan menyala, rating ≥ ambang.

Alternatif bila volume naik (belum dikerjakan): penawaran bergilir dengan timeout,
atau dispatcher otomatis ke kurir terdekat. Keduanya butuh koordinat kurir real-time
yang belum ada (`CourierProfile` baru simpan kecamatan).

---

## 5. Struktur kode

```
src/
  app/
    (auth)/login, register
    trace/[code]/            telusur publik (hasil scan QR)
    app/
      layout.tsx             shell + nav per peran + NotificationBell
      akun/                  pengaturan akun (semua peran)
      produsen/              produk ; pesanan (label QR) ; komplain (hak sanggah)
      konsumen/              marketplace ; produk/[id] ; pesanan ; scan ;
                             bisnis (B2B) ; invoice/[id] (cetak)
      kurir/                 tugas ; riwayat ; tugas/[id] (detail + peta)
      admin/                 operasional ; riwayat
      pemkab/                KPI + HET ; produsen (direktori)
    api/
      orders/ products/ complaints/ het/ cert/ account/ business/
      invoices/[id]/pay/ notifications/ courier/availability/
      upload/ cron/settle/ admin/courier-verify/ auth/
  lib/
    het.ts          validasi harga vs HET
    escrow.ts       state machine + efek escrow + hook rating + fanout notifikasi
    rating.ts       computeRating, tierOf, SUSPEND_RATING, deliverySubsidyFactor
    complaint.ts    SLA sanggah 12j + SLA admin 48j + eskalasi otomatis
    fraud.ts        assessClaim — batas 3/30hari + skor risiko
    b2b.ts          platformFeeOf, unitPriceFor, nextInvoiceNumber, markOverdue
    notification.ts notify / notifyMany / notifyRole
    storage.ts      upload bukti & foto (local | supabase)
    qr.ts           kode telusur HMAC + generate QR
    providers/      payment (escrow) & notify — mock + stub
    rbac.ts, auth.ts, db.ts, utils.ts
prisma/  schema.prisma (14 model) · seed.ts (data demo lengkap)
```

### Konstanta penting
| Konstanta | Nilai | Lokasi |
|---|---|---|
| Grace period garansi | 2 jam | `escrow.ts` |
| SLA sanggah produsen | 12 jam | `complaint.ts` |
| SLA keputusan admin | 48 jam | `complaint.ts` |
| Ambang penangguhan rating | 3.0 | `rating.ts` |
| Subsidi ongkir | 30% / 15% / 0% | `rating.ts` |
| Platform fee B2B | 2,5% | `b2b.ts` |
| Termin invoice | 14 hari | `b2b.ts` |
| Minimum order B2B | Rp500.000 | `b2b.ts` |
| Batas klaim | 3 per 30 hari | `fraud.ts` |

---

## 6. Akun demo (kata sandi semua: `password123`)

| Peran | Email |
|---|---|
| Pemkab | `pemkab@gresik.go.id` |
| Admin | `admin@gfresh.id` |
| Produsen (8) | `tani.cerme@` · `tambak.manyar@` · `tani.duduk@` · `ayam.menganti@` · `sayur.kebomas@` · `umkm.gresik@` · `tani.balongpanggang@` · `buah.wringinanom@` (semua `gfresh.id`) |
| Kurir (5) | `kurir.budi@` · `kurir.eko@` · `kurir.sari@` · `kurir.agus@` (nonaktif) · `kurir.dani@` (KTP belum verif) |
| Konsumen (4) | `konsumen@` · `konsumen.dewi@` · `konsumen.tono@` · `konsumen.maya@` |
| B2B | `katering@gfresh.id` (Katering Bu Sri — terverifikasi) |

Seed menghasilkan: 7 kategori + HET, 24 produk (10 punya harga grosir), 16 pesanan
riwayat (10 selesai, 1 refund, 2 berjalan, **3 menunggu diambil kurir** untuk demo
rebutan), 2 komplain (1 diputus, 1 menunggu sanggahan produsen), rating dihitung
dari riwayat.

`db:seed` menghapus data transaksi lama tapi mempertahankan master data (upsert) —
aman dijalankan berulang.

---

## 7. Dokumen pendamping

- `Bab_Arsitektur_G-Fresh_Monolitik.docx` — bab arsitektur versi monolitik MVP
  (§8.1–8.8) dengan 5 diagram tertanam, mirror struktur docx enterprise. Untuk
  disandingkan dengan Bab 8 versi enterprise di proposal.
- 5 PNG diagram terpisah (konteks, komponen, alur swimlane, topologi, keamanan)
  untuk dipakai di slide presentasi.

---

## 8. Roadmap / gap tersisa

1. **Notifikasi WA nyata** — provider sudah distub di `lib/providers/notify.ts`,
   tinggal isi kredensial gateway (Fonnte/Wablas) & sesuaikan payload.
2. **Laporan ekspor PDF/Excel** untuk Pemkab — dashboard KPI baru bisa dilihat di
   layar, belum bisa diunduh untuk rapat/arsip.
3. **Offline-first sync** — service worker baru cache app-shell; belum ada antrian
   order offline yang sync otomatis (mitigasi internet pesisir/tambak, proposal 11.3).
4. **Integrasi sertifikasi** ke instansi penerbit (Halal/P-IRT/BPOM) — masih manual
   oleh dinas.
5. **Integrasi payment gateway asli** (Midtrans/Xendit) — titik TODO sudah ditandai.
6. **Unit test** untuk `het.ts`, `escrow.ts`, `rating.ts`, `fraud.ts`, `b2b.ts`
   (skill `senior-qa` tersedia di environment).
7. **Model penugasan kurir lanjutan** — penawaran bergilir atau dispatcher (butuh
   koordinat kurir real-time).
8. **Rate limit per akun** untuk endpoint umum (bukan cuma klaim komplain).

---

## 9. Catatan kejujuran teknis (untuk juri / QnA)

- **Waktu panen = self-declared** produsen. Sistem menjamin kode QR otentik
  (anti-palsu via HMAC), BUKAN kebenaran klaim panennya. Verifikasi independen = roadmap.
- **"Escrow"** memanfaatkan fitur hold/delayed-settlement payment gateway, BUKAN
  lembaga escrow berlisensi. Operator tidak menyimpan dana pelanggan.
- **Pesanan B2B tidak lewat escrow** — bayar bertermin via invoice, jadi operator
  menanggung risiko kredit. Mitigasi: verifikasi profil bisnis + cabut akses bila menunggak.
- **Subsidi ongkir sengaja hanya B2C** — kanal B2B yang mendanainya; memberi subsidi
  ke B2B akan meniadakan mekanisme lintas-subsidinya.
- **Anti-fraud tidak memblokir klaim wajar** — hanya batas keras 3/30hari yang menolak;
  sisanya skor risiko sebagai bahan pertimbangan admin.
- **Sertifikasi** diverifikasi manual Pemkab pada pilot.
- **HET** batas atas lindungi konsumen, `floorPrice` lindungi produsen. Dasar hukum
  kewenangan HET tingkat kabupaten perlu ditinjau bareng bagian hukum Pemkab — ini
  bukan sesuatu yang bisa diselesaikan lewat kode.
- **Notifikasi best-effort** — kegagalan kirim tidak pernah menggagalkan transaksi
  bisnis (try/catch, di luar transaksi DB).
- Mode `mock` (payment/notify) & `local` (storage) memungkinkan demo penuh tanpa
  kredensial eksternal apa pun.

---

## 10. Troubleshooting yang pernah kejadian

- **npm 11/12 blok install script** → `npm approve-scripts --all` (prisma,
  @prisma/client, @prisma/engines, esbuild semua legit), lalu install ulang bersih
  supaya script benar-benar jalan.
- **"Invalid hook call / useContext null"** → React dobel di dependency tree. Fix:
  hapus `node_modules` + `package-lock.json`, `npm install` ulang. Cek `npm ls react`
  harus satu versi.
- **Next.js versi terlalu baru** → pernah ke-install Next 16, bikin `params` jadi
  async & error runtime. **Wajib tetap di 14.2.35** (versi 14.x terakhir yang sudah
  ditambal CVE bypass middleware CVSS 9.1). Jangan pakai 14.2.5 (rentan).
- **`Module not found: '@supabase/supabase-js'`** saat storage mode local → dynamic
  import harus disembunyikan dari bundler:
  ```ts
  const pkg = '@supabase/supabase-js';
  const { createClient } = await import(/* webpackIgnore: true */ pkg);
  ```
  `@ts-ignore` saja TIDAK cukup (itu cuma bungkam TypeScript, bukan webpack).
- **`Cannot find module './globals.css'` ts(2882)** atau **`next/navigation` no
  declaration** → cuma cache/versi TS server di editor. `Ctrl+Shift+P` →
  "TypeScript: Restart TS Server", lalu "Select TypeScript Version" → Use Workspace
  Version. `npx tsc --noEmit` untuk memastikan bukan bug nyata.
- **`git push` ditolak (`fetch first`)** pada repo GitHub baru yang punya README
  default → `git pull origin main --allow-unrelated-histories`, kalau conflict di
  README: `git checkout --ours README.md && git add README.md && git commit`.
- **Peringatan `LF will be replaced by CRLF`** di Windows → normal, bukan error.
- **Neon cold start** → request pertama setelah idle 5 menit lambat 1–3 detik.
  Bukan bug. Cron `/api/cron/settle` tiap 10 menit kebetulan membantu menjaga
  compute tetap hidup selama app dipakai.

---

## 11. Deploy ke VPS (ringkas)

Arsitektur ini memang didesain untuk VM tunggal. Jalur Docker:

1. `next.config.mjs` → tambah `output: 'standalone'`
2. Dockerfile multi-stage (deps → builder dengan `prisma generate` + `next build`
   → runner `node server.js`)
3. `docker-compose.yml` dengan **volume `./public/uploads:/app/public/uploads`** —
   wajib, kalau tidak semua foto produk & bukti komplain hilang tiap rebuild
4. `.env`: ganti `NEXTAUTH_URL` ke domain. **JANGAN ganti `TRACE_SECRET`** kalau
   sudah ada label QR tercetak — semua kode lama akan gagal validasi
5. Nginx reverse proxy ke `127.0.0.1:3000` + `certbot --nginx` (HTTPS wajib untuk
   PWA install & kamera scan QR)
6. Crontab: `*/10 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://domain/api/cron/settle`
7. `ufw allow OpenSSH, 80, 443` — port 3000 tidak perlu dibuka ke publik

Update selanjutnya: `git pull && docker compose up -d --build` (+ `prisma db push`
bila schema berubah).

Alternatif lebih ringan tanpa Docker: `npm run build` lalu PM2
(`pm2 start npm --name gfresh -- start`).

---

## 12. Preferensi kerja (untuk sesi lanjutan)

- Komunikasi Bahasa Indonesia informal, langsung ke inti.
- Perbaikan tertarget, bukan rebuild — sebut file & lokasi tujuan dengan jelas.
- Untuk perubahan >3 file: verifikasi typecheck dulu sebelum diserahkan.
- Selalu tandai eksplisit bila suatu batch butuh `db:push`.
- Bila satu file disentuh oleh dua batch, berikan **versi gabungan**, jangan biarkan
  saling menimpa.
- Sebutkan konsekuensi/trade-off desain secara jujur, termasuk yang belum dikerjakan.

# G-Fresh — Memory / Handoff Proyek

> Dokumen lanjutan (continuation) buat ngelanjutin build G-Fresh nanti. Taruh di
> `docs/GFRESH_MEMORY.md` dalam repo biar keikut git dan gampang dibuka lagi.
> Update seiring progres — terutama bagian 6 (Status apply) & 8 (Roadmap).
>
> **Terakhir diperbarui:** semua fitur di bawah sudah di-apply ke kode DAN sudah
> di-push ke `github.com/elkhanif/g-fresh-mvp` (branch `main`).

---

## 1. Apa ini

**G-Fresh** — marketplace pangan segar *hyperlocal* untuk **Gresik Inovasi Kompetisi (GIK) 2026**.
Menghubungkan produsen (petani/petambak/peternak/UMKM) langsung ke konsumen B2C & B2B,
tanpa gudang transit, dengan 3 pilar: **QR-traceability**, **escrow + garansi kesegaran**,
dan **kemitraan Pemkab (HET + sertifikasi)**. Komisi produsen 0%.

**Keputusan arsitektur utama:** SATU codebase **Next.js 14 (App Router) PWA** yang melayani
mobile-first app (produsen/konsumen/kurir) **dan** dashboard web (admin/Pemkab) via role-based
routing — BUKAN Flutter/RN + web terpisah. Alasan: satu deploy, satu DB, satu bahasa, cocok
dengan skill existing.

---

## 2. Stack

Next.js 14 · TypeScript · Tailwind · Prisma 5 · PostgreSQL (Supabase) · NextAuth (Credentials + JWT)
· bcryptjs · qrcode · zod · html5-qrcode (scan). Storage bukti/foto: lokal (default) atau Supabase Storage
(opsional, butuh `@supabase/supabase-js` — lihat §6 catatan dynamic import).

---

## 3. Cara run

```bash
npm install           # kalau kena approve-scripts (npm 11/12): npm approve-scripts --all
cp .env.example .env  # isi DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, TRACE_SECRET
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

**Akun demo (sandi semua `password123`):**
`pemkab@gresih.go.id` · `admin@gfresh.id` · `tani@gfresh.id` · `tambak@gfresh.id`
· `konsumen@gfresh.id` · `kurir@gfresh.id`

**Uji di HP:** pakai ngrok/Tailscale (HTTPS) — wajib untuk kamera scan QR & PWA install.

**Repo:** `https://github.com/elkhanif/g-fresh-mvp` (branch `main`).

---

## 4. Peran (RBAC)

- **PRODUSEN** — kelola produk (harga dibatasi HET, foto opsional), lihat pesanan masuk + cetak QR, lihat rating performa sendiri.
- **KONSUMEN** — belanja (dengan foto produk), bayar (escrow), scan QR pakai kamera, komplain + upload bukti foto/video.
- **KURIR** — ambil tugas (butuh KTP terverifikasi & tidak ditangguhkan), majukan status kirim.
- **ADMIN** (operator swasta) — verifikasi KTP kurir, putuskan komplain (lihat bukti). TIDAK bisa ubah HET.
- **PEMKAB** — tetapkan HET, verifikasi sertifikasi, dashboard KPI (target 10.1) + direktori semua produsen terintegrasi. Read-only ops.

---

## 5. Status fitur vs proposal (5.2)

| Pilar / alur | Status | Catatan |
|---|---|---|
| 1. Onboarding + HET batas atas otomatis | ✅ Selesai | + floorPrice (lindungi produsen) |
| 2. QR-Traceability | ⚠️ Sebagian | Kode HMAC per item + scan kamera; panen self-declared; lokasi = kecamatan; sertifikasi MANUAL (belum integrasi instansi) |
| 3. Pemesanan + logistik hyperlocal | ✅ Mostly | Belum: same-day/cool-box (fisik), subsidi ongkir per tier |
| 4. Escrow + garansi kesegaran | ✅ + upload bukti | Belum: auto pre-check fraud, batas klaim/akun |
| 5. Rating performa + sanksi bertingkat | ✅ Selesai | Rating recompute dari riwayat; <3.0 = ditangguhkan (produk disembunyikan, kurir diblok ambil tugas) |
| Governance two-tier (11.1) | ✅ Selesai | Pemkab set HET/cert; Admin ops; Admin tak bisa ubah HET |
| KPI dashboard (target 10.1) | ✅ Selesai | Produsen 100+, kurir 50+, sukses >98%, komplain <2% — dengan progress bar |
| Foto produk | ✅ Selesai | Upload lokal/Supabase, tampil di marketplace/detail/dashboard produsen |
| Scan QR kamera | ✅ Selesai | html5-qrcode → redirect ke /trace/[code] |
| Direktori produsen terintegrasi | ✅ Selesai | Halaman `pemkab/produsen`, read-only, sebaran per kecamatan |

---

## 6. ⚠️ STATUS APPLY — SEMUA SUDAH DI-APPLY & DI-PUSH

Per titik ini, seluruh fitur berikut **sudah diterapkan ke kode dan sudah di-push ke git**:

- ✅ Base build v1 (semua pilar inti — HET, escrow, QR, RBAC, semua halaman per peran)
- ✅ Pemkab: versi tampilkan semua produsen (bukan cuma pending) + halaman direktori terpisah
- ✅ Batch rating engine (computeRating, tierOf, SUSPEND_RATING, hook di transitionOrder, enforcement di orders/accept/products)
- ✅ Batch upload bukti komplain (form file di OrderActions, endpoint terima multipart, tampil di admin)
- ✅ Fitur 1: KPI dashboard Pemkab (target 10.1, progress bar per metrik)
- ✅ Fitur 2: Foto produk (endpoint `/api/upload`, AddProductForm dengan input file, tampil di marketplace/detail/dashboard produsen)
- ✅ Fitur 3: Scan QR kamera (`konsumen/scan`, html5-qrcode, nav item)

**Tidak ada checklist apply yang tersisa dari sesi-sesi sebelumnya.** Kalau membuka file ini lagi nanti
dan ada fitur baru yang didiskusikan tapi belum di-apply, catat di bagian ini dengan format:

```
### BELUM di-apply (per <tanggal/sesi>)
- [ ] <nama fitur> → <file yang perlu ditimpa/ditambah> → <lokasi tujuan>
```

### Catatan instalasi yang sudah dilakukan
- `npm install html5-qrcode` — untuk fitur scan QR.
- Storage foto/bukti pakai mode **local** (default) — file masuk `public/uploads/{products,complaints}/`,
  sudah di-`.gitignore`. Kalau nanti pindah ke Supabase Storage: `npm install @supabase/supabase-js`,
  set `.env`: `STORAGE_PROVIDER=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET`.
- **Dynamic import Supabase di `lib/storage.ts`:** karena `@supabase/supabase-js` belum ter-install
  di mode lokal, baris `await import('@supabase/supabase-js')` perlu dilindungi dari bundler Next
  supaya tidak error "Module not found" saat build. Pola yang dipakai:
  ```typescript
  const pkg = '@supabase/supabase-js';
  const { createClient } = await import(/* webpackIgnore: true */ pkg);
  ```
  Ini membuat webpack tidak ikut resolve modul saat `STORAGE_PROVIDER` bukan `supabase`.
  Jangan pakai `// @ts-ignore` saja — itu cuma bungkam TypeScript, bukan bundler Next/webpack.
- Tidak ada perubahan schema Prisma sepanjang batch #4, #5, dan fitur 1–3 (`ratingScore`,
  `evidenceUrls`, `photoUrl` semua sudah ada sejak schema awal) — jadi tidak perlu `db:push` ulang
  untuk fitur-fitur ini.

---

## 7. Struktur kode

```
src/
  app/
    (auth)/login, register
    trace/[code]/          telusur publik (hasil scan QR)
    app/                   area terautentikasi
      layout.tsx           shell + nav per peran (termasuk "Scan QR" utk konsumen)
      produsen/            produk (foto+PerfBadge) + AddProductForm ; pesanan/ (QR label)
      konsumen/            marketplace (foto) ; produk/[id] (foto) ; pesanan ; scan/ (kamera)
      kurir/               tugas + accept/advance (diblok jika ditangguhkan)
      admin/               ops: verifikasi kurir + komplain (dengan bukti foto/video)
      pemkab/              KPI (target 10.1) + HET + semua produsen ; produsen/ (direktori)
    api/
      upload/               endpoint unggah foto produk
      products/, orders/, complaints/, het/, cert/, admin/courier-verify/, cron/settle/, auth/
  lib/
    het.ts                 validasi harga vs HET
    escrow.ts              state machine order + efek escrow + hook recompute rating
    rating.ts              computeRating, tierOf, SUSPEND_RATING
    qr.ts                  kode telusur HMAC + generate QR (untuk label produsen)
    storage.ts             upload bukti komplain & foto produk (local | supabase)
    providers/             payment (escrow) & notify — mock + stub integrasi asli
    rbac.ts, auth.ts       otorisasi & NextAuth
  components/
    ui/, forms/ (AddProductForm, OrderActions, KurirActions, AdminActions, PemkabForms, ProductOrderForm)
    PerfBadge, OrderStatusBadge, CertBadge, Providers, SignOutButton
prisma/  schema.prisma, seed.ts
```

**State machine order:**
```
MENUNGGU_BAYAR → DIBAYAR(escrow HELD) → DIJEMPUT_KURIR → DIKIRIM → DITERIMA(grace 2j)
                                                                       │
                                              ┌────────────────────────┤
                                        diam/konfirmasi           komplain
                                              │                        │
                                              ▼                        ▼
                                        SELESAI(RELEASED)          SENGKETA
                                                              admin memutuskan
                                                          ┌──────────┴──────────┐
                                                       VALID                DITOLAK
                                                          ▼                    ▼
                                                REFUND(REFUNDED)      SELESAI(RELEASED)
```
Semua transisi lewat `transitionOrder()` di `lib/escrow.ts` — satu tempat, transisi ilegal ditolak.

**Rating engine:** recompute dari riwayat (bukan increment) tiap order mencapai SELESAI/REFUND.
`bad=0` → selalu 5.0. Tier: ≥4.5 Sangat baik · ≥4.0 Baik · ≥3.0 Perlu pembinaan · <3.0 **Ditangguhkan**
(produk hilang dari marketplace konsumen, produsen tak bisa terima order baru, kurir diblok ambil tugas).

---

## 8. Roadmap / gap tersisa (prioritas)

1. **Anti-fraud komplain** — auto pre-check (pola: komplain menit akhir grace period, rasio komplain
   tinggi per akun) sebelum masuk antrian admin, + batas jumlah klaim per akun. (proposal 5.2 & 11.3)
2. **Subsidi ongkir per tier produsen** — `tier.restricted` dari `rating.ts` sudah ada, tinggal
   disambungkan ke `estimateDeliveryFee()` di `lib/utils.ts`. (paling cepat dikerjakan)
3. **Keadilan sengketa** — refund parsial (per item/persen, bukan biner), hak sanggah produsen
   sebelum admin memutuskan, SLA timeout supaya dana tak nyangkut selamanya kalau admin idle.
4. **B2B beneran** — flow volume + platform fee 2–3% + invoice (mesin cross-subsidy di proposal 11.2).
   Sekarang baru ada flag `channel: B2C/B2B` di schema, checkout selalu B2C.
5. **Notifikasi WA nyata** — provider sudah distub di `lib/providers/notify.ts`, tinggal isi kredensial
   gateway (Fonnte/Wablas dll) dan sesuaikan payload.
6. **Offline-first sync** — service worker baru cache app-shell; belum ada antrian order offline yang
   sync otomatis saat online lagi (mitigasi internet pesisir/tambak, proposal 11.3).
7. **Integrasi sertifikasi** ke instansi penerbit (Halal/P-IRT/BPOM) — sekarang manual oleh Pemkab.
8. **Unit test** untuk `het.ts`, `escrow.ts`, `rating.ts` (skill `senior-qa` tersedia di environment).

---

## 9. Catatan kejujuran teknis (buat juri / sesi QnA)

- **Waktu panen = self-declared** oleh produsen. Sistem menjamin kode QR otentik (anti-palsu via
  HMAC), BUKAN kebenaran klaim panennya. Verifikasi independen = roadmap lanjutan.
- **"Escrow"** memanfaatkan fitur hold/delayed-settlement payment gateway (Midtrans/Xendit), BUKAN
  lembaga escrow berlisensi tersendiri. Operator tidak menyimpan dana pelanggan.
- **Sertifikasi** diverifikasi manual oleh Pemkab pada fase pilot; integrasi API ke instansi penerbit
  adalah roadmap lanjutan, bukan fitur MVP saat ini.
- **HET** berfungsi sebagai batas atas yang melindungi konsumen; `floorPrice` opsional melindungi
  produsen. Dasar hukum kewenangan penetapan HET di tingkat kabupaten perlu ditinjau bersama bagian
  hukum Pemkab — ini bukan sesuatu yang bisa diselesaikan lewat kode.
- Mode `mock` (payment & notify) dan `local` (storage) memungkinkan demo penuh tanpa kredensial
  eksternal apa pun; titik integrasi asli semuanya ditandai `TODO` di kode.

---

## 10. Troubleshooting yang sudah pernah kejadian (dan solusinya)

- **npm 11/12 blok install script** (`prisma`, `@prisma/client`, `@prisma/engines`, `esbuild`) →
  `npm approve-scripts --all` (semua legit, wajib buat native binary), lalu install ulang bersih
  supaya script benar-benar jalan (approve saja tidak retroaktif menjalankan yang sudah di-skip).
- **"Invalid hook call / Cannot read properties of null (useContext)"** → React ada dua kopi di
  dependency tree (biasanya gara-gara lockfile lama/campur). Fix: hapus `node_modules` +
  `package-lock.json`, `npm install` ulang dari nol. Cek `npm ls react react-dom` harus cuma 1 versi.
- **`Module not found: Can't resolve '@supabase/supabase-js'`** saat pakai storage mode local →
  lihat §6, pakai `webpackIgnore` di dynamic import, bukan `@ts-ignore`.
- **`Could not find a declaration file for module 'next/navigation'`** di editor (padahal `next dev`
  jalan normal) → biasanya cache TS server. Restart: `Ctrl+Shift+P` → "TypeScript: Restart TS Server".
  Kalau masih merah, `next-env.d.ts` & `tsconfig.json` `include` harus tetap seperti bawaan (jangan
  diedit manual), lalu clean reinstall `node_modules` + `package-lock.json` kalau perlu.
- **`git push` ditolak (`fetch first` / `non-fast-forward`)** saat push pertama ke repo GitHub baru
  yang sempat dibuat dengan README/.gitignore default → `git fetch origin`, cek isinya
  (`git log origin/main --oneline`), lalu `git pull origin main --allow-unrelated-histories`.
  Kalau conflict di `README.md`: `git checkout --ours README.md && git add README.md && git commit`,
  baru `git push -u origin main`.
- **Peringatan `LF will be replaced by CRLF`** saat `git add` di Windows → normal, bukan error,
  aman diabaikan (perilaku default normalisasi line-ending Git di Windows).

---

## 11. Untuk sesi lanjutan berikutnya

Kalau membuka chat baru untuk melanjutkan development, upload file ini di awal percakapan supaya
Claude langsung tahu posisi terakhir tanpa perlu diceritakan ulang dari nol. Update bagian §6 dan
§8 setiap kali ada fitur baru yang selesai di-apply — dua bagian itu yang paling cepat basi.

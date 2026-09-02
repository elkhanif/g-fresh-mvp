# G-Fresh — Memory / Handoff Proyek

> Dokumen lanjutan (continuation) buat ngelanjutin build G-Fresh nanti. Simpan di
> repo (`docs/`) atau di mana aja yang gampang dibuka. Update seiring progres.
> Terakhir diperbarui: sesuai sesi build MVP.

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
· bcryptjs · qrcode · zod · html5-qrcode (scan). Storage bukti/foto: lokal (default) atau Supabase Storage.

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

---

## 4. Peran (RBAC)

- **PRODUSEN** — kelola produk (harga dibatasi HET), lihat pesanan masuk + cetak QR.
- **KONSUMEN** — belanja, bayar (escrow), scan QR, komplain + upload bukti.
- **KURIR** — ambil tugas (butuh KTP terverifikasi), majukan status kirim.
- **ADMIN** (operator swasta) — verifikasi KTP kurir, putuskan komplain. TIDAK bisa ubah HET.
- **PEMKAB** — tetapkan HET, verifikasi sertifikasi, dashboard KPI + direktori produsen. Read-only ops.

---

## 5. Status fitur vs proposal (5.2)

| Pilar / alur | Status | Catatan |
|---|---|---|
| 1. Onboarding + HET batas atas otomatis | ✅ Selesai | + floorPrice (lindungi produsen) |
| 2. QR-Traceability | ⚠️ Sebagian | Kode HMAC per item; panen self-declared; lokasi = kecamatan; sertifikasi MANUAL (belum integrasi instansi) |
| 3. Pemesanan + logistik hyperlocal | ✅ Mostly | Belum: same-day/cool-box (fisik), subsidi ongkir |
| 4. Escrow + garansi kesegaran | ✅ + upload bukti | Belum: auto pre-check fraud, batas klaim/akun |
| 5. Rating performa + sanksi bertingkat | ✅ Engine + soft-suspend | Rating recompute dari riwayat; <3.0 = ditangguhkan (produk disembunyikan, kurir diblok) |
| Governance two-tier (11.1) | ✅ Selesai | Pemkab set HET/cert; Admin ops; Admin tak bisa ubah HET |
| KPI dashboard (target 10.1) | ✅ Selesai | Produsen 100+, kurir 50+, sukses >98%, komplain <2% |
| Foto produk | ✅ Selesai | Upload lokal/Supabase, tampil di marketplace/detail/produsen |
| Scan QR kamera | ✅ Selesai | html5-qrcode → /trace |

---

## 6. ⚠️ STATUS APPLY (PENTING — di mana aku sekarang)

**Sudah di-apply ke kode:**
- Base build v1 (semua pilar inti)
- Pemkab page versi "semua produsen"
- Direktori produsen (`pemkab/produsen`) + nav layout

**BELUM di-apply (file siap di folder outputs sesi terakhir):**
- Batch #5 Rating engine
- Batch #4 Upload bukti komplain
- Fitur 1 (KPI), 2 (foto produk), 3 (scan QR)

### Checklist apply (urut) — timpa/tambah sesuai kolom

**Batch #5 Rating**
- `rating.ts` → `src/lib/rating.ts` (baru)
- `escrow.ts` → `src/lib/escrow.ts`
- `orders-route.ts` → `src/app/api/orders/route.ts`
- `accept-route.ts` → `src/app/api/orders/[id]/accept/route.ts`
- `PerfBadge.tsx` → `src/components/PerfBadge.tsx` (baru)

**Batch #4 Bukti komplain**
- `complaints-route.ts` → `src/app/api/complaints/route.ts`
- `OrderActions.tsx` → `src/components/forms/OrderActions.tsx`
- `admin-page.tsx` → `src/app/app/admin/page.tsx`

**Fitur 1–3**
- `pemkab-page.tsx` → `src/app/app/pemkab/page.tsx` (KPI, sudah termasuk daftar produsen)
- `storage.ts` → `src/lib/storage.ts` (GABUNGAN bukti+foto — pakai ini)
- `upload-route.ts` → `src/app/api/upload/route.ts` (baru)
- `products-route.ts` → `src/app/api/products/route.ts` (GABUNGAN rating+foto)
- `konsumen-page.tsx` → `src/app/app/konsumen/page.tsx` (GABUNGAN rating+foto)
- `AddProductForm.tsx` → `src/components/forms/AddProductForm.tsx`
- `konsumen-produk-detail-page.tsx` → `src/app/app/konsumen/produk/[id]/page.tsx`
- `produsen-page.tsx` → `src/app/app/produsen/page.tsx`
- `scan-page.tsx` → `src/app/app/konsumen/scan/page.tsx` (baru)
- `layout.tsx` → `src/app/app/layout.tsx`

**Install & catatan:**
- Fitur 3 butuh: `npm install html5-qrcode`
- Foto mode default (lokal): tambah `public/uploads` ke `.gitignore`. Mode Supabase: `npm install @supabase/supabase-js` + set env `STORAGE_PROVIDER=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET=gfresh-public`.
- **Tidak perlu `db:push`/`db:generate`** — tidak ada perubahan schema (field `ratingScore`, `evidenceUrls`, `photoUrl` sudah ada sejak awal).
- Restart `npm run dev` sekali (ada route folder baru: `konsumen/scan`, `api/upload`).

---

## 7. Struktur kode

```
src/
  app/
    (auth)/login, register
    trace/[code]/          telusur publik (hasil scan QR)
    app/                   area terautentikasi
      layout.tsx           shell + nav per peran
      produsen/            produk + AddProductForm ; pesanan/ (QR label)
      konsumen/            marketplace ; produk/[id] ; pesanan ; scan/
      kurir/               tugas + accept/advance
      admin/               ops: verifikasi kurir + komplain
      pemkab/              KPI + HET + cert ; produsen/ (direktori)
    api/                   semua mutasi + enforcement
  lib/
    het.ts                 validasi harga vs HET
    escrow.ts              state machine order + efek escrow + hook rating
    rating.ts              computeRating, tier, SUSPEND_RATING
    qr.ts                  kode telusur HMAC + QR
    storage.ts             upload bukti/foto (local | supabase)
    providers/             payment (escrow) & notify — mock + stub
    rbac.ts, auth.ts       otorisasi & NextAuth
  components/
    ui/, forms/, PerfBadge, OrderStatusBadge, CertBadge
prisma/  schema.prisma, seed.ts
```

**State machine order:**
`MENUNGGU_BAYAR → DIBAYAR(escrow HELD) → DIJEMPUT_KURIR → DIKIRIM → DITERIMA(grace 2j) → SELESAI(RELEASED)`
cabang: `DITERIMA → SENGKETA → REFUND(REFUNDED) / SELESAI`. Semua lewat `transitionOrder()`.

**Rating:** recompute dari riwayat tiap order terminal. `bad=0`→5.0. Tier: ≥4.5 Sangat baik,
≥4.0 Baik, ≥3.0 Perlu pembinaan, <3.0 Ditangguhkan (produk hilang dari marketplace, kurir diblok ambil tugas).

---

## 8. Roadmap / gap tersisa (prioritas)

1. **Anti-fraud komplain** — auto pre-check (pola: komplain menit akhir grace, rasio komplain tinggi per akun) + batas klaim/akun. Nyambung ke fitur bukti. (proposal 5.2 & 11.3)
2. **Subsidi ongkir per tier produsen** — `tier.restricted` sudah ada, tinggal sambung ke perhitungan ongkir. (cepat)
3. **Keadilan sengketa** — refund parsial, hak sanggah produsen, SLA timeout (dana tak nyangkut selamanya).
4. **B2B beneran** — flow volume + platform fee 2–3% + invoice (mesin cross-subsidy 11.2). Sekarang baru flag `channel`.
5. **Notifikasi WA nyata** — provider sudah distub di `lib/providers/notify.ts`.
6. **Offline-first sync** — antrian order offline (mitigasi internet pesisir/tambak, 11.3).
7. **Integrasi sertifikasi** ke instansi penerbit (Halal/P-IRT/BPOM).
8. **Unit test** het/escrow/rating (ada skill QA).

---

## 9. Catatan kejujuran teknis (buat juri / QnA)

- **Waktu panen = self-declared** produsen. Sistem menjamin QR otentik (anti-palsu HMAC), bukan kebenaran klaim panen.
- **"Escrow"** = fitur hold/delayed-settlement payment gateway (Midtrans/Xendit), bukan lembaga escrow berlisensi. Operator tak simpan dana pelanggan.
- **Sertifikasi** diverifikasi manual Pemkab pada pilot; integrasi instansi penerbit = roadmap.
- **HET** batas atas lindungi konsumen; `floorPrice` opsional lindungi produsen. Dasar hukum kewenangan HET tingkat kabupaten perlu ditinjau bareng bagian hukum Pemkab.
- Mode `mock` (payment/notify) & `local` (storage) bikin demo jalan penuh tanpa kredensial.

---

## 10. Troubleshooting yang sudah pernah kejadian

- **npm 11/12 blok install script** → `npm approve-scripts --all` (prisma, @prisma/client, @prisma/engines, esbuild semua legit), lalu install ulang bersih agar script kejalan.
- **"Invalid hook call / useContext null"** → React dobel di tree. Fix: hapus `node_modules` + `package-lock.json`, `npm install` ulang. Pastikan `npm ls react` cuma satu.
- **Prisma engine gagal di sandbox** (binaries.prisma.sh diblok) → cuma masalah environment build tertentu; di lokal normal.

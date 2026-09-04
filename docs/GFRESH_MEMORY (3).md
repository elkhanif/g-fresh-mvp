# G-Fresh — Memory / Handoff Proyek

> **Cara pakai dokumen ini:** upload file ini di awal chat baru, bersamaan dengan
> zip project terbaru (`gfresh-lengkap-v7.zip` atau yang lebih baru). Dengan dua
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

**Belum di-apply:** tidak ada. Semua batch di atas sudah diterapkan ke kode
dan sudah dikirim ke user dalam bentuk zip lengkap.

**Sedang dipertimbangkan user (BELUM diimplementasikan):**

Edit harga & update stok produk oleh produsen. Endpoint `PATCH /api/products/[id]`
sudah ada dari awal (validasi HET included), tapi tidak ada UI yang
memanggilnya -- produsen saat ini tidak bisa mengubah produk yang sudah dibuat
sama sekali. Tiga opsi sudah diajukan ke user, menunggu keputusan:

- **Opsi A (quick fix):** tombol edit + modal, langsung pakai endpoint yang ada.
- **Opsi B (direkomendasikan):** pisah jadi dua aksi -- "Ubah harga" (tersimpan
  riwayat via model `PriceHistory` baru) dan "Sesuaikan stok" (delta +/- dengan
  alasan wajib: Restock/Terjual manual/Rusak-busuk/Koreksi, tersimpan via model
  `StockMovement` baru, pakai increment/decrement atomik agar aman dari race
  condition dengan checkout yang sedang berjalan).
- **Opsi C (kemungkinan overkill untuk pilot):** semua di B + penjadwalan
  harga + lot/batch tracking per panen + bulk edit + ambang stok minimum.

Kalau nanti dikerjakan, catat di sini fitur mana yang dipilih dan tandai selesai.

---

## 4. Peran & alur

- **PRODUSEN** -- kelola produk (harga <= HET, harga grosir opsional -- tapi
  lihat catatan "sedang dipertimbangkan" di atas: belum ada UI edit setelah
  produk dibuat), cetak label QR, lihat rating sendiri, menyanggah/menawar
  komplain (12 jam, maks 3 ronde negosiasi).
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
      orders/ products/ complaints/ complaints/[id]/respond/
      complaints/[id]/offer-response/ het/ cert/ account/ business/
      invoices/[id]/pay/ notifications/ courier/availability/ courier/ktp/
      service-areas/ admin/service-areas/ admin/courier-verify/
      upload/ cron/settle/ auth/
  lib/
    het.ts          validasi harga vs HET
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
prisma/  schema.prisma (17 model) · seed.ts (data demo lengkap, reset total tiap run)
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

### Keputusan tertunda (user sedang mempertimbangkan)
Edit harga & stok produk -- lihat §3, tiga opsi (A/B/C) sudah diajukan,
menunggu pilihan user.

### Risiko keamanan terbuka (perlu dibereskan sebelum produksi nyata)

**Foto KTP kurir tidak punya access control.** Mode storage local
menyimpan foto di `public/uploads/ktp/` yang bisa diakses siapa pun yang
tahu URL -- nama file acak bukan proteksi sungguhan. Data KTP itu sensitif
(tunduk UU PDP). Wajib diperbaiki sebelum go-live: pindah ke bucket
privat + signed URL, atau serve lewat route ber-autentikasi.

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

# G-Fresh — MVP

Marketplace pangan segar *hyperlocal* untuk Kabupaten Gresik. Satu basis kode
**Next.js 14 (App Router) + PWA** yang melayani aplikasi mobile-first (produsen,
konsumen, kurir) sekaligus dashboard web (admin operator, Pemkab) — tanpa aplikasi
native terpisah.

Tiga pilar yang diimplementasikan sebagai kode nyata, bukan sekadar mockup:

1. **HET enforcement** — Harga Eceran Tertinggi ditetapkan Pemkab per kategori per
   tanggal; harga produk divalidasi di server setiap kali dibuat/diubah.
2. **Escrow + garansi kesegaran** — dana ditahan (`HELD`) saat bayar, baru
   diteruskan ke produsen (`RELEASED`) setelah barang diterima dan masa garansi
   2 jam lewat tanpa komplain; komplain valid → `REFUNDED`.
3. **QR-traceability** — tiap item pesanan punya kode telusur ber-HMAC; halaman
   publik `/trace/[code]` menampilkan waktu panen (dilaporkan produsen), asal
   produksi tingkat kecamatan, dan status sertifikasi.

## Stack

Next.js 14 · TypeScript · Tailwind · Prisma 5 · PostgreSQL (Supabase) ·
NextAuth (Credentials + JWT) · bcrypt · qrcode · zod.

## Setup

```bash
npm install
cp .env.example .env        # isi DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, TRACE_SECRET
npm run db:generate         # prisma generate
npm run db:push             # buat skema di database
npm run db:seed             # data contoh + akun demo
npm run dev
```

Buka http://localhost:3000. Untuk uji PWA/mobile, jalankan lewat ngrok atau
Tailscale (service worker perlu HTTPS di perangkat lain).

### Variabel lingkungan penting

| Var | Fungsi |
|-----|--------|
| `DATABASE_URL` / `DIRECT_URL` | koneksi pooled (runtime) & direct (migrate) Supabase |
| `NEXTAUTH_SECRET` | signing sesi JWT — `openssl rand -base64 32` |
| `TRACE_SECRET` | HMAC untuk kode QR telusur |
| `PAYMENT_PROVIDER` | `mock` (default, simulasi) atau `midtrans` |
| `NOTIFY_PROVIDER` | `mock` (log) atau `wa` |
| `CRON_SECRET` | opsional, proteksi endpoint auto-settle |

## Akun demo (kata sandi semua: `password123`)

| Peran | Email |
|-------|-------|
| Pemkab | `pemkab@gresih.go.id` |
| Admin operator | `admin@gfresh.id` |
| Produsen | `tani@gfresh.id`, `tambak@gfresh.id` |
| Konsumen | `konsumen@gfresh.id` |
| Kurir | `kurir@gfresh.id` |

## Alur demo cepat

1. Login **konsumen** → *Belanja* → pilih produk → *Bayar & pesan* (dana ke escrow).
2. Login **kurir** → *Order tersedia* → **Ambil tugas** → *Barang diambil* → *Sampai/diterima*.
3. Kembali ke **konsumen** → *Pesanan saya* → **Konfirmasi selesai** (atau ajukan komplain saat masih masa garansi).
4. Login **produsen** → *Pesanan masuk* → cetak label QR; buka `/trace/<kode>` untuk lihat halaman telusur.
5. Login **Pemkab** → tetapkan HET (coba set HET Sayur di bawah harga produk → produsen tak bisa naik di atasnya) & verifikasi sertifikasi.
6. Login **admin** → putuskan komplain, verifikasi KTP kurir.

## Struktur

```
src/
  app/
    (auth)/            login, register
    trace/[code]/      halaman telusur publik
    app/               area terautentikasi (per peran)
    api/               route handler (semua mutasi + enforcement)
  lib/
    het.ts             validasi harga vs HET
    escrow.ts          state machine order + efek escrow
    qr.ts              kode telusur ber-HMAC + QR
    providers/         payment (escrow) & notify — mock + stub integrasi
    rbac.ts, auth.ts   otorisasi & NextAuth
prisma/
  schema.prisma        model data
  seed.ts              data contoh
```

## State machine order

```
MENUNGGU_BAYAR → DIBAYAR → DIJEMPUT_KURIR → DIKIRIM → DITERIMA → SELESAI
                    │                                    │
                    └→ DIBATALKAN            SENGKETA ←──┘→ REFUND / SELESAI
```

Semua transisi lewat `transitionOrder()` di `lib/escrow.ts` — transisi ilegal ditolak
di satu tempat, dan efek escrow (release/refund) menyatu dalam satu transaksi DB.

## Auto-settle (cron)

`GET /api/cron/settle` menyelesaikan order `DITERIMA` yang masa garansinya lewat tanpa
komplain. Jadwalkan tiap ~10 menit (Vercel Cron / cron server). Lindungi dengan
`Authorization: Bearer $CRON_SECRET`.

## Catatan kejujuran teknis (untuk dewan juri)

- **Waktu panen bersifat *self-declared*** oleh produsen. Sistem menjamin kode QR
  otentik (anti-palsu via HMAC), bukan kebenaran klaim panen. Verifikasi independen
  = roadmap lanjutan.
- **"Escrow"** memanfaatkan fitur penahanan/penundaan settlement payment gateway
  (Midtrans/Xendit), bukan lembaga escrow berlisensi. Operator tidak menyimpan dana
  pelanggan.
- **HET sebagai batas atas** melindungi konsumen; `floorPrice` opsional melindungi
  produsen. Dasar hukum kewenangan penetapan HET di tingkat kabupaten perlu ditinjau
  bersama bagian hukum Pemkab.
- Mode `mock` untuk payment & notifikasi memungkinkan demo penuh tanpa kredensial;
  titik integrasi asli ditandai `TODO` di `lib/providers/`.

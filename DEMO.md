# DEMO.md — Runbook demo langsung G-Fresh

Tujuan berkas ini: demo berjalan **tanpa internet sama sekali**, dan lu punya
urutan yang sama persis tiap latihan sehingga hari-H tidak ada kejutan.

---

## H-1 — Siapkan (30 menit, sekali saja)

```bash
# 1. Simpan .env produksi supaya gampang dikembalikan nanti
cp .env .env.neon

# 2. Pakai env demo
cp .env.demo.example .env

# 3. Nyalakan Postgres lokal (butuh Docker; ini satu-satunya langkah
#    yang perlu internet, dan hanya saat pertama kali menarik image)
npm run demo:up

# 4. Bangun skema + isi data demo
npm run demo:setup

# 5. Build produksi — JANGAN pakai `npm run dev` saat tampil.
#    Mode dev mengompilasi halaman saat pertama dibuka; jeda 2-3 detik
#    per layar baru itu terasa sangat lama saat ditonton juri.
npm run demo:build
npm run demo:start
```

Buka `http://localhost:3000`, lalu **matikan wifi laptop** dan klik-klik
seluruh alur sekali. Kalau ada yang rusak tanpa jaringan, ketahuan sekarang,
bukan besok.

## Hari-H — sebelum naik panggung

```bash
npm run demo:up      # kalau laptop habis restart
npm run demo:start   # tidak perlu build ulang
```

**Jangan jalankan `npm run demo:setup` atau `db:seed` pada hari-H.** Seed
melakukan reset total dan membuat semua sesi login jadi basi — semua peran
terpaksa login ulang tepat saat lu butuh cepat.

### Checklist 10 menit sebelum tampil

- [ ] `npm run demo:start` jalan, `http://localhost:3000` terbuka
- [ ] Wifi laptop **dimatikan** (biar tidak ada kejutan di tengah demo)
- [ ] Login semua peran di jendela terpisah, urut kiri ke kanan sesuai
      skenario: Produsen → Konsumen → Kurir → Pemkab
- [ ] Notifikasi sistem laptop dimatikan (jangan sampai chat masuk saat
      layar diproyeksikan)
- [ ] Zoom browser 110–125% — proyektor ruangan besar bikin teks 100% sulit
      dibaca dari baris belakang
- [ ] Satu terminal terbuka menganggur, siap untuk `curl` cron settle
- [ ] Video demo cadangan ada di desktop

### Akun demo

Semua kata sandi: `password123`

| Peran | Email |
|---|---|
| Produsen | `tani.cerme@gfresh.id` |
| Konsumen | `konsumen@gfresh.id` |
| Kurir | `kurir.budi@gfresh.id` |
| Pemkab | `pemkab@gresik.go.id` |
| Admin | `admin@gfresh.id` |
| B2B | `katering@gfresh.id` |

---

## Perintah cadangan saat demo

```bash
# Percepat proses terjadwal (pelepasan dana yang jatuh tempo, eskalasi
# komplain, invoice jatuh tempo, sertifikat kedaluwarsa)
curl http://localhost:3000/api/cron/settle
```

Catatan: untuk memperagakan pencairan dana, **jangan** menunggu grace period
2 jam dan jangan pakai cron. Pakai tombol **"Konfirmasi pesanan baik →
selesaikan"** di sisi konsumen — dananya cair seketika. Itu jalur yang memang
dirancang untuk itu, dan sekarang tombolnya berwarna oranye supaya gampang
ditemukan di layar.

---

## Kalau ada yang salah

| Gejala | Penyebab biasa | Tindakan |
|---|---|---|
| Halaman error koneksi database | Container belum jalan | `npm run demo:up`, tunggu 5 detik |
| Semua peran tiba-tiba logout | Habis menjalankan seed | Login ulang; jangan seed lagi |
| Port 5433 bentrok | Postgres lain di port itu | Ubah port di `docker-compose.demo.yml` **dan** `.env` |
| Data demo berantakan setelah latihan | Wajar | `npm run demo:reset && npm run demo:up && npm run demo:setup` — **lakukan H-1, bukan hari-H** |
| Foto tidak muncul | Berkas unggahan latihan hilang | Foto produk seed tidak memakai berkas eksternal, jadi ini hanya terjadi pada unggahan manual lu sendiri |

---

## Kembali ke Neon setelah lomba

```bash
cp .env.neon .env
npm run demo:down     # hentikan container (data tetap tersimpan)
npm run db:generate
```

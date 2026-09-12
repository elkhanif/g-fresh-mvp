# GFRESH MEMORY v28 — Ongkir Terlihat, Jendela Pengiriman, Penghasilan Kurir

**Tanggal:** 11 September 2026
**Lanjutan dari:** `GFRESH_MEMORY_v27.md`
**Repo lokal:** `C:\Users\m.khanif\Downloads\gfresh` (Windows / PowerShell)
**Produksi:** `https://g-fresh-mvp.vercel.app`
**Paket kiriman:** `gfresh-paket-v28.zip` (14 berkas: 4 baru, 10 menimpa)

---

## 0. Perubahan status dari v27

- ✅ **v26 dan v27 sudah terpasang di repo.** Terkonfirmasi dari isi repo yang
  diunggah: `ui/PageHeader`, `ui/Stat`, `ui/Section`, `ui/EmptyState`,
  `ui/Sheet`, `forms/AddProductSheet`, `lib/maps.ts`, `components/PinLokasi.tsx`
  semuanya ada, dan `kurir/page.tsx` sudah versi tata-ulang.
- ⏳ Patch geolocation `PinLokasi` (dikirim terpisah sebelum paket ini) **belum**
  ada di repo — versinya masih yang lama. Ikut disertakan di paket v28.

---

## 1. Empat keluhan pemicu

1. "Peta di konsumen apa bisa pakai geolocation dari HP-nya, dengan tombol
   pakai lokasi saya itu?"
2. "Di bagian penghasilan kurir, tambahkan total penghasilan keseluruhan dari
   semua transaksi."
3. "Besaran ongkir perlu ditambahkan pada page checkout — saat transaksi
   konsumen belum tahu ongkirnya dan langsung muncul di payment, akan merasa
   keberatan."
4. "Soal pengiriman belum ada jam pengiriman. Sistemnya sementara pakai tiga
   kali jam pengiriman: 06–08, 10–13, 15–18."

Nomor 1 **sudah ada sejak v27** — tombolnya memanggil
`navigator.geolocation.getCurrentPosition` dengan `enableHighAccuracy`.

📝 **Cara mengetahui bahwa tombol itu belum pernah berhasil dipakai:** dari
tangkapan layar, koordinat yang tertera `-7.14000, 112.63000` — bulat persis di
dua desimal. Hasil GPS tidak pernah berbentuk begitu (`-7.14382, 112.63117`).
Angka bulat itu datang dari prefill pesanan lama/seed, bukan dari perangkat.
Membaca bentuk angkanya lebih cepat daripada bertanya "sudah dicoba belum".

---

## 2. Bug & temuan dari membaca kode

### 2.1 Total penghasilan kurir tidak boleh dijumlahkan dari daftar pesanan

`kurir/riwayat/page.tsx` mengambil pesanan dengan `take: 100`. Menjumlahkan
`deliveryFee` dari array itu benar sampai antaran ke-100, lalu **diam-diam
mengecil** — tidak ada error, tidak ada log, dan tidak ada yang sadar sampai
seseorang menghitung manual.

Sumber yang benar sudah ada: `WalletTx` baris `ONGKIR`. Itu upah yang
**benar-benar dikreditkan** (`kreditOngkir` dipanggil dari `escrow.ts` saat
status jadi SELESAI), dijaga `@@unique([orderId, kind])` sehingga tidak mungkin
ganda, dan bisa di-`aggregate` seluruhnya tanpa batas `take`.

Sekaligus memaksa memisahkan dua pertanyaan yang selama ini bercampur:

| | Isinya | Dipakai untuk |
|---|---|---|
| **Penghasilan** | Σ `WalletTx` kind=ONGKIR | "sudah dapat berapa dari narik" |
| **Saldo** | Σ SEMUA `WalletTx` | "sekarang ada berapa di dompet" |

Saldo sudah dikurangi angsuran coolbox dan penarikan. Menampilkan satu angka
saja untuk dua pertanyaan itu membuat kurir yang baru mengangsur merasa
penghasilannya hilang.

### 2.2 Rumus ongkir terkunci di dalam transaksi pembuatan pesanan

Rumusnya hidup di dalam blok `prisma.$transaction` pada `POST /api/orders`,
jadi **satu-satunya cara mengetahui ongkir adalah dengan membuat pesanan.**
Itulah sebab teknis dari keluhan nomor 3 — checkout bukan "lupa menampilkan
ongkir", ia memang belum punya cara mengetahuinya.

**Kuirk yang ditemukan saat memindahkannya** (dan sengaja dipertahankan):
jarak diukur dari penjual **pertama yang punya koordinat**, sedangkan subsidi
mengikuti rating penjual di **baris pertama** keranjang. Kalau penjual pertama
tidak punya koordinat, keduanya merujuk penjual yang berbeda. Karena aturan ini
sekarang dipakai dua pemanggil, ia ditaruh di satu fungsi `acuanOngkir()` —
bukan ditulis ulang di endpoint perkiraan, yang pasti akan memilih berbeda.

### 2.3 Biaya layanan B2B tidak pernah tampil di rincian pesanan

`konsumen/pesanan/[id]` menampilkan Subtotal + Ongkir lalu Total, sementara
`platformFee` ikut masuk `total`. Untuk pesanan B2B, jumlah baris yang terlihat
tidak sama dengan totalnya — terbaca seperti salah hitung. Ditambahkan satu
baris bersyarat.

---

## 3. Yang dikerjakan

### Baru — 4 berkas

| Berkas | Peran |
|---|---|
| `src/lib/ongkir.ts` | `acuanOngkir` (aturan pemilihan produsen acuan) + `hitungOngkir` (mengembalikan km, dasar, subsidi, ongkir) |
| `src/lib/slot.ts` | Tabel `SLOT`, cutoff, seluruh konversi WIB, `jendelaTersedia`, `slotMasihBuka`, `labelJendela` |
| `src/app/api/orders/quote/route.ts` | Perkiraan biaya, read-only |
| `src/components/forms/SlotPengiriman.tsx` | Pemilih jendela |

### Menimpa — 10 berkas

`prisma/schema.prisma`, `api/orders/route.ts`, `forms/CartCheckout.tsx`,
`components/PinLokasi.tsx`, `konsumen/keranjang/page.tsx`,
`konsumen/pesanan/[id]/page.tsx`, `kurir/page.tsx`, `kurir/riwayat/page.tsx`,
`kurir/tugas/[id]/page.tsx`, `produsen/pesanan/page.tsx`.

Schema: `enum DeliverySlot`, `Order.slot`, `Order.slotDate DateTime? @db.Date`,
`@@index([slotDate, slot])`. Murni ADD COLUMN + CREATE TYPE.

---

## 4. Keputusan arsitektur

### 4.1 Perkiraan ongkir diminta ke server, tidak dihitung ulang di klien

Cara termudah menampilkan ongkir di checkout adalah menyalin rumusnya ke
komponen React. Itu ditolak: angka di layar akan pelan-pelan berbeda dari yang
ditagih, dan **tidak ada yang tahu kapan mulai berbeda** — persis pelajaran v27
tentang aturan yang disalin ke lima tempat.

Jadi: rumus dikeluarkan ke `lib/ongkir.ts`, dipakai oleh pembuat pesanan **dan**
oleh `POST /api/orders/quote`. Checkout memanggil endpoint itu. Angka yang
tampil adalah angka yang ditagih, dari satu fungsi.

Aturan `quote/route.ts`: **tidak menulis apa pun.** Tanpa `create`, `update`,
reservasi stok, atau transaksi. Kalau suatu saat endpoint ini perlu menulis,
itu tanda ia sudah berubah jadi pembuat pesanan dan harus digabung.

Perkiraan tetap bisa berbeda dari tagihan bila harga berubah di antara dua
permintaan — selisihnya **dilaporkan** (`hargaBergeser`, `catatan[]`), bukan
disembunyikan.

### 4.2 Debounce 400 ms + `AbortController`

Ongkir berubah setiap pin digeser dan setiap jumlah barang diubah. Tanpa
debounce, satu ketukan tombol `+` = satu permintaan. Tanpa `AbortController`,
balasan permintaan lama bisa datang setelah yang baru dan menimpanya dengan
angka jarak yang sudah tidak berlaku.

🔴 `setMenghitung(false)` di `finally` **wajib dijaga `if (!signal.aborted)`**.
Tanpa itu: cleanup membatalkan fetch lama → effect baru menyalakan indikator →
penolakan fetch lama baru terselesaikan dan memadamkannya, padahal permintaan
baru masih jalan.

### 4.3 Jendela = tanggal + kode, dan tanggalnya kalender WIB

"PAGI" sendirian tidak menjawab apa pun bagi orang yang memesan pukul 20.00.
Dua kolom, dan nilai radio di UI berbentuk `"2026-09-12|PAGI"` supaya satu
pilihan tidak pernah terpisah dari tanggalnya.

`slotDate` adalah `@db.Date` — **tanggal kalender, bukan titik waktu.**
Dibentuk dan dibaca hanya lewat `tanggalKeKolom`/`kolomKeTanggal`, supaya tidak
ada satu pun tempat yang mengonversinya dengan zona waktu proses.

### 4.4 🔴 Zona waktu dihitung sendiri, tidak diwarisi dari server

Vercel menjalankan server di UTC. `new Date().getHours()` di server
mengembalikan **7 jam lebih awal** daripada jam dinding Gresik: pukul 14.00 WIB
terbaca 07.00, sehingga rit sore yang seharusnya sudah tutup masih terbuka dan
rit pagi yang sudah lewat ikut terbuka. Kesalahan ini lolos semua typecheck.

Seluruh `lib/slot.ts` bekerja dengan "menit sejak tengah malam WIB", dihitung
dari offset tetap +07.00 (`timestamp + 7 jam`, lalu dibaca dengan `getUTC*` /
`toISOString`). **WIB tidak punya DST** — itu satu-satunya alasan offset tetap
boleh dipakai; cara ini tidak boleh disalin untuk zona yang punya DST.

### 4.5 Daftar jendela dihitung di server, bukan di browser

Dua alasan: (a) jam HP sering salah, sementara yang **menolak** pesanan saat
submit adalah jam server — kalau berbeda, pilihan yang tampak terbuka bisa
langsung ditolak tanpa sebab yang terlihat; (b) menghitungnya di komponen klien
membuat hasil render server dan klien berbeda → keluhan hydration dari React.
Halaman keranjang sudah `force-dynamic`, jadi daftarnya selalu segar.

### 4.6 Cutoff jam absolut, bukan "x menit sebelum mulai"

| Rit | Jam | Tutup |
|---|---|---|
| Pagi | 06.00–08.00 | **21.00 H-1** |
| Siang | 10.00–13.00 | 08.30 hari itu |
| Sore | 15.00–18.00 | 13.30 hari itu |
| Malam | 18.30–21.00 | 16.30 hari itu |

Kurir harus menjemput ke produsen dulu, jadi jaraknya tidak seragam.

Rit malam ditambahkan setelah v28 karena konsumen yang masak makan malam tidak
terjangkau sama sekali: setelah 13.30 pilihan terdekat melompat ke besok pagi.
Cutoff 16.30 dipilih justru untuk menutup celah 13.30–16.30 itu — memajukannya
mengembalikan masalah yang sama, hanya bergeser dua jam.

🔴 Akibat yang perlu disadari: **sepanjang hari, pilihan "pagi" selalu pagi
besok.** Rit pagi memang barang pre-order — panennya subuh.

### 4.7 Jendela yang sudah tutup tidak ditampilkan

Pukul 14.00, rit pagi dan siang hari ini sudah lewat. Menampilkan keduanya
sebagai tombol kelabu berarti dua per tiga pilihan di layar tidak bisa
diketuk. Yang tampil adalah 4 jendela terdekat yang masih bisa dipesan, masing-
masing dengan label hari ("Hari ini", "Besok", "Min, 13 Sep") dan jam tutupnya.

### 4.8 Validasi ulang di server, bukan percaya klien

Halaman keranjang bisa terbuka berjam-jam. Slot yang terbuka saat halaman
dimuat mungkin sudah tutup saat tombol ditekan. `POST /api/orders` memeriksa
`slotMasihBuka` **sebelum** membuka transaksi — menolak lebih awal berarti
tidak ada stok yang sempat direservasi lalu dibatalkan. Status 409 dengan pesan
yang menyebut jam dan menyuruh muat ulang.

### 4.9 Antrean kurir diurutkan per rit, bukan waktu pesan

Pesanan yang dijanjikan 15.00–18.00 hari ini lebih mendesak daripada pesanan
yang masuk lebih dulu tapi dijanjikan besok pagi.

📝 **Yang membuat ini gratis:** `enum DeliverySlot` dideklarasikan urut jam, dan
Postgres mengurutkan enum menurut **urutan deklarasinya** — jadi
`orderBy: { slot: 'asc' }` sudah berarti pagi → siang → sore, tanpa tabel bantu
atau kolom urutan. `nulls: 'last'` ditulis eksplisit untuk pesanan lama.

### 4.10 Pesanan lama tanpa jendela tidak diberi kalimat pengganti

`labelJendela` mengembalikan `null`, dan setiap pemanggil menyembunyikan
badge-nya. Menulis "jendela tidak dipilih" pada pesanan yang dibuat sebelum
fitur ini ada akan terbaca seperti kelalaian pembeli.

### 4.11 Patch geolocation: tiga sebab kegagalan, tiga pesan

🔴 **Geolocation API hanya hidup di secure context** (HTTPS atau `localhost`).
Dibuka lewat IP LAN (`http://192.168.x.x:3000`) — cara paling wajar menguji
tampilan HP dari laptop — objek `navigator.geolocation` **tetap ada**, tapi
pemanggilannya gagal, di beberapa browser tanpa memanggil callback error sama
sekali. Gejalanya persis seperti izin ditolak.

Pesan lama ("izinkan akses lokasi di browser") mengarahkan ke pengaturan izin
untuk ketiga sebab. Sekarang dipisah: `isSecureContext` diperiksa lebih dulu,
lalu `PERMISSION_DENIED` / `TIMEOUT` / `POSITION_UNAVAILABLE` masing-masing
punya tindakan sendiri.

Ditambahkan juga **radius ketelitian** (`pos.coords.accuracy`, tampil sebagai
`±N m`): di dalam ruangan `getCurrentPosition` sering **berhasil** tapi
mengembalikan posisi router dengan akurasi ratusan meter. Tanpa angka itu, pin
yang melenceng 800 m terlihat sama meyakinkannya dengan pin GPS yang tepat.
Dikosongkan begitu penanda digeser tangan. `maximumAge: 0` menolak posisi lama
dari cache; timeout 10 → 15 detik karena `enableHighAccuracy` di dalam ruangan
sering butuh lebih dari 10.

---

## 5. Verifikasi

**Typecheck.** Stub tipe Prisma lewat `paths` di `tsconfig.check.json`
(`prisma generate` diblok — `binaries.prisma.sh` 403, sama seperti Paket A).
Stub dibangun ulang dengan **men-generate union string dari `schema.prisma`
langsung** (regex atas blok `enum`), bukan ditulis tangan.

Baseline **82** error → sesudah **83**. Setelah nomor baris dinormalkan, set
error identik kecuali satu tambahan: `quote/route.ts` TS7006 pada
`produk.find((x) => …)` — kelas yang sama dengan 82 lainnya, hilang setelah
`prisma generate`.

📝 Angka baseline di v26/v27 adalah 64; berbeda karena stub-nya berbeda, bukan
karena kodenya. **Yang dibandingkan harus dua pengukuran dengan alat yang
sama** — baseline harus diambil ulang setiap kali stubnya berubah.

**Ongkir identik.** Blok lama di `api/orders/route.ts` direplika apa adanya di
skrip uji, lalu dibandingkan dengan `hitungOngkir` pada 45 kombinasi (4 tujuan ×
5 rating × 2 kanal + 5 kasus tanpa koordinat): **0 berbeda.**

📝 Ditemukan lewat uji ini: subsidi 30% atas dasar Rp14.000 menghasilkan bayar
Rp10.000, artinya subsidi nyatanya Rp4.000, bukan Rp4.200 — karena pembulatan
ke Rp500 terjadi setelah perkalian. Karena itu UI menampilkan **selisih nyata**
(`dasar − ongkir`), bukan `persen × dasar`. Kalau dihitung dari persen, baris
rinciannya tidak akan berjumlah sama dengan totalnya.

**Logika slot.** Diuji pada 5 waktu: 07.00, 09.00, 14.00, 22.00 WIB, dan
**00.30 WIB (= 17.30 UTC hari sebelumnya)** untuk memastikan tanggal WIB tidak
ikut tanggal UTC — kasus terakhir benar menganggap 12 Sep sebagai "Hari ini".
Batas tepat: 13.29 → sore buka, 13.30 → tutup; 20.59 → pagi besok buka, 21.00 →
tutup.

⏳ **Belum dicek dengan mata dan tangan** — 7 butir, lihat
`BACA-DULU-PAKET-V28.md` bagian yang sama.

---

## 6. Pending (Prioritas)

### Baru dari paket ini

| Item | Prioritas | Status |
|---|---|---|
| Pasang v28 + `db push` + 7 verifikasi mata | **High** | Belum |
| Putuskan apakah cutoff rit pagi 21.00 H-1 sesuai kenyataan lapangan | High | Menunggu keputusan |
| Urutkan `produsen/pesanan` per rit juga (sekarang `createdAt desc`) | Medium | Belum — daftarnya memuat pesanan selesai, perlu dipikirkan dulu |
| Wajibkan `slot` di zod setelah dipastikan tidak ada jalur pembuatan pesanan lain | Low | Sengaja opsional |
| Simpan jam mulai/selesai di `Order` bila jadwal rit pernah benar-benar bergeser | Low | Belum perlu; sekarang pesanan lama ikut berubah kalau tabel SLOT diubah |
| Tampilkan jendela di `konsumen/pesanan` (daftar) dan notifikasi | Low | Belum |

### Warisan yang belum dikerjakan

| Item | Prioritas | Status |
|---|---|---|
| `git rm --cached tsconfig.tsbuildinfo` & `git rm "prisma/schema copy.prisma"` | Medium | Belum |
| Patch `src/lib/qr.ts` fallback localhost + regenerate QR lama | Medium | Belum |
| Putuskan status `/pasar/[slug]` (publik vs digate) | Medium | Belum diputuskan |
| **Paket B** — `model Certificate` + backfill, rombak `api/cert*`, `cert-expiry.ts` | High | Belum dimulai |
| Cek scope env Production/Preview di Vercel | Low | Belum |
| Halaman edit data mutu produk terbit | Medium | API siap, UI belum |
| Pindah penyedia tile sebelum trafik nyata (`NEXT_PUBLIC_TILE_URL`) | Medium | Belum |
| Pin lokasi untuk produsen (titik jemput) pakai `PinLokasi` | Low | Belum |
| Ganti `Modal` lokal di `ProductActions.tsx` dengan `ui/Sheet` | Low | Sengaja ditunda |
| Terapkan `PageHeader`/`Stat`/`Section`/`EmptyState` ke `konsumen`, `pemkab`, `admin`, `akun` | Medium | Belum |
| `loading.tsx` per rute | Medium | Belum |
| N+1 `getActiveHet` di `produsen/page.tsx` | Low | Di luar cakupan |
| Screenshot demo per peran | High | Tunggu v28 terpasang |

---

## 7. Pelajaran

- **Koordinat yang bulat sempurna bukan hasil GPS.** `-7.14000, 112.63000`
  berarti angkanya datang dari prefill atau seed. Bentuk angka bisa menjawab
  "fiturnya sudah pernah jalan belum" tanpa perlu bertanya.
- **`take: 100` pada query yang hasilnya dijumlahkan adalah bug yang menunggu
  waktu.** Benar sampai baris ke-100, lalu diam-diam salah. Total selalu
  `aggregate`, jangan `reduce` atas daftar berbatas.
- **Kalau satu angka cuma bisa diketahui dengan melakukan aksinya, aksinya yang
  harus dipecah** — bukan angkanya yang disalin ke tempat lain. Ongkir tidak
  bisa ditampilkan di checkout karena rumusnya terkunci di dalam transaksi
  pembuatan pesanan; obatnya mengeluarkan rumus, bukan menulis ulang di klien.
- **Penghasilan dan saldo adalah dua pertanyaan berbeda** dan harus jadi dua
  angka. Satu angka untuk keduanya membuat kurir yang sedang mengangsur merasa
  penghasilannya hilang.
- **Server di UTC adalah jebakan jam yang lolos semua typecheck.** Pukul 14.00
  WIB terbaca 07.00 di Vercel. Logika berbasis jam dinding wajib menghitung
  offset sendiri, dan offset tetap hanya boleh dipakai karena WIB tanpa DST.
- **Jam tanpa tanggal bukan janji.** "Pagi" bagi orang yang memesan pukul 20.00
  bisa berarti 10 jam lagi atau 34 jam lagi.
- **Pilihan yang tidak bisa diketuk sebaiknya tidak ada di layar.** Tiga slot
  yang dua di antaranya kelabu lebih buruk daripada satu slot yang hidup.
- **Urutan deklarasi enum Postgres adalah urutan `ORDER BY`-nya.** Menamai
  enum urut jam memberi pengurutan yang benar tanpa kolom tambahan.
- **Nilai yang ditampilkan harus selisih nyata, bukan hasil hitung ulang dari
  persen.** Pembulatan setelah perkalian membuat `persen × dasar` tidak sama
  dengan `dasar − bayar`, dan baris rincian jadi tidak berjumlah.
- **Baseline typecheck terikat pada alatnya.** 82 vs 64 bukan berarti kodenya
  memburuk — stubnya beda. Ambil baseline ulang setiap kali alat ukurnya
  berubah, dan bandingkan **set** error setelah nomor baris dinormalkan.
- **API yang ada tapi tidak punya secure context tetap gagal.**
  `navigator.geolocation` ada di `http://192.168.x.x`, tapi tidak bekerja — dan
  gejalanya identik dengan izin ditolak. Periksa `isSecureContext` lebih dulu,
  supaya waktu tidak habis di pengaturan izin.
- **Berhasil bukan berarti akurat.** `getCurrentPosition` di dalam ruangan
  mengembalikan posisi router dengan akurasi ratusan meter, lewat callback
  sukses. Tanpa menampilkan `accuracy`, pengguna tidak punya cara tahu.

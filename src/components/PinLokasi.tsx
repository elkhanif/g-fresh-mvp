'use client';
import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/Button';
import { PUSAT_GRESIK, TILE_ATTRIBUTION, TILE_URL } from '@/lib/maps';

export type Titik = { lat: number; lng: number };

/**
 * Pemilih titik di peta OpenStreetMap.
 *
 * KENAPA MEMILIH PIN, BUKAN GEOCODING ALAMAT.
 * Mengubah teks alamat jadi koordinat butuh layanan geocoding, dan itulah satu
 * dari dua alasan orang akhirnya harus berlangganan peta berbayar (yang lain
 * adalah routing). Untuk barang segar yang diantar dalam radius kecamatan,
 * pembeli tahu persis rumahnya di mana dan bisa menunjukkannya lebih akurat
 * daripada geocoder mana pun — terutama di gang yang tidak punya nama jalan.
 * Jadi teks alamat tetap dipakai untuk dibaca manusia, koordinat diisi pembeli
 * sendiri, dan tidak ada layanan pihak ketiga yang perlu dibayar.
 *
 * KENAPA LEAFLET LANGSUNG, BUKAN react-leaflet.
 * Peta ini hanya butuh satu penanda yang bisa digeser. Membungkusnya dengan
 * react-leaflet menambah satu lapis yang versinya harus cocok dengan versi
 * React, dan repo ini masih React 18 sementara react-leaflet sudah bergerak ke
 * React 19. Leaflet sendiri tidak peduli React versi berapa.
 *
 * Leaflet menyentuh `window` saat modulnya dimuat, jadi impornya dilakukan di
 * dalam `useEffect` (`await import('leaflet')`) — bukan di puncak berkas —
 * supaya render di server tidak pecah. CSS-nya aman diimpor di puncak karena
 * cuma berkas gaya.
 *
 * Ikon penanda digambar dengan `divIcon`, bukan ikon bawaan Leaflet. Ikon
 * bawaannya berupa berkas PNG yang jalurnya rusak di hampir semua bundler
 * (marker muncul sebagai gambar gagal) — `divIcon` sekaligus membuat warnanya
 * ikut palet poster tanpa aset tambahan.
 */
export function PinLokasi({
  value,
  onChange,
  label = 'Titik antar di peta',
}: {
  value: Titik | null;
  onChange: (t: Titik | null) => void;
  label?: string;
}) {
  const wadahRef = useRef<HTMLDivElement | null>(null);
  const petaRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);

  // `onChange` disimpan di ref supaya effect pemasang peta tidak perlu
  // memasukkannya ke daftar dependensi. Kalau ikut jadi dependensi, setiap
  // render induk (mis. pembeli mengubah jumlah barang) akan membongkar dan
  // memasang ulang seluruh peta.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [pesan, setPesan] = useState('');
  const [siap, setSiap] = useState(false);
  const [mencari, setMencari] = useState(false);

  // Radius ketelitian dari perangkat, dalam meter. Disimpan supaya pembeli
  // tahu titik hasil GPS itu layak dipakai atau cuma tebakan Wi-Fi: di dalam
  // ruangan, `getCurrentPosition` sering berhasil tapi mengembalikan posisi
  // menara/router dengan akurasi ratusan sampai ribuan meter. Tanpa angka ini,
  // titik yang melenceng 800 m terlihat sama meyakinkannya dengan titik GPS
  // yang tepat. Dikosongkan begitu penanda digeser tangan, karena angka
  // ketelitian perangkat tidak lagi menggambarkan posisi penanda.
  const [akurasi, setAkurasi] = useState<number | null>(null);

  useEffect(() => {
    let dibatalkan = false;

    (async () => {
      const L = (await import('leaflet')).default;
      if (dibatalkan || !wadahRef.current || petaRef.current) return;
      leafletRef.current = L;

      const awal = value ?? PUSAT_GRESIK;
      const peta = L.map(wadahRef.current, {
        center: [awal.lat, awal.lng],
        zoom: value ? 16 : 12,
        // Gulir halaman di HP lebih sering dibutuhkan daripada zoom peta.
        // Tanpa ini, mencoba menggulir keranjang justru menzoom peta dan
        // pembeli terjebak di tengah halaman.
        scrollWheelZoom: false,
      });

      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(peta);

      peta.on('click', (e: any) => {
        onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
        setAkurasi(null);
        setPesan('Titik dipindah. Geser penanda untuk menepatkan.');
      });

      petaRef.current = peta;
      setSiap(true);
    })();

    return () => {
      dibatalkan = true;
      petaRef.current?.remove();
      petaRef.current = null;
      markerRef.current = null;
    };
    // Sengaja hanya sekali. `value` awal dibaca di dalam, dan sinkronisasi
    // selanjutnya ditangani effect di bawah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Menyelaraskan penanda dengan `value`. Dipisah dari pemasangan peta supaya
  // mengubah titik tidak pernah memasang ulang tile.
  useEffect(() => {
    const L = leafletRef.current;
    const peta = petaRef.current;
    if (!L || !peta) return;

    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    if (!markerRef.current) {
      const ikon = L.divIcon({
        className: '',
        html:
          '<span style="display:block;width:18px;height:18px;border-radius:9999px;' +
          'background:var(--color-leaf-600);border:3px solid #fff;' +
          'box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      markerRef.current = L.marker([value.lat, value.lng], {
        draggable: true,
        icon: ikon,
        keyboard: true,
        title: 'Geser untuk menepatkan titik antar',
      }).addTo(peta);
      markerRef.current.on('dragend', () => {
        const p = markerRef.current.getLatLng();
        onChangeRef.current({ lat: p.lat, lng: p.lng });
        setAkurasi(null);
        setPesan('Titik diperbarui.');
      });
      // Penanda baru: geser tampilan supaya titiknya terlihat.
      peta.setView([value.lat, value.lng], Math.max(peta.getZoom(), 16));
    } else {
      markerRef.current.setLatLng([value.lat, value.lng]);
      // Titik yang sudah tampak di layar TIDAK memicu geser tampilan. Tanpa
      // pengecekan ini, setiap `dragend` menarik peta kembali ke tengah dan
      // pembeli yang sedang menepatkan posisi merasa petanya melawan.
      if (!peta.getBounds().contains(markerRef.current.getLatLng())) {
        peta.setView([value.lat, value.lng], Math.max(peta.getZoom(), 16));
      }
    }
    // `siap` ikut jadi dependensi karena effect ini pertama kali berjalan
    // SEBELUM peta selesai dipasang. Tanpa itu, titik yang sudah ter-prefill
    // dari pesanan sebelumnya tidak akan punya penanda sampai pembeli
    // mengubahnya — petanya terlihat kosong padahal koordinatnya ada.
  }, [value, siap]);

  function pakaiLokasiSaya() {
    if (!navigator.geolocation) {
      setPesan('Browser ini tidak punya fitur deteksi lokasi. Ketuk peta untuk menaruh titik.');
      return;
    }

    // 🔴 Geolocation API hanya hidup di secure context: HTTPS atau
    // `localhost`. Dibuka lewat IP LAN (`http://192.168.x.x:3000`) — cara
    // paling wajar menguji tampilan HP dari laptop — objek `navigator.geolocation`
    // TETAP ADA, tapi `getCurrentPosition` gagal, dan di beberapa browser
    // tanpa memanggil callback error sama sekali. Gejalanya persis seperti
    // izin ditolak, jadi tanpa pemeriksaan ini waktu habis untuk mengutak-atik
    // pengaturan izin padahal masalahnya alamat yang dipakai.
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setPesan(
        'Deteksi lokasi butuh HTTPS. Buka dari localhost atau alamat Vercel — lewat IP LAN tidak bisa. Sementara ini, ketuk peta untuk menaruh titik.',
      );
      return;
    }

    setMencari(true);
    setPesan('Mencari lokasi…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMencari(false);
        const m = Math.round(pos.coords.accuracy);
        setAkurasi(m);
        onChangeRef.current({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPesan(
          m > 100
            ? `Titik terambil, tapi ketelitiannya rendah (±${m} m) — biasanya karena GPS mati atau posisi ditebak dari Wi-Fi. Geser penanda ke rumah Anda.`
            : `Titik terambil dari perangkat (±${m} m). Geser penanda bila kurang tepat.`,
        );
      },
      (err) => {
        setMencari(false);
        // Tiga sebab kegagalan butuh tiga tindakan berbeda. Satu pesan untuk
        // semuanya mengarahkan pembeli ke pengaturan izin walau yang mati
        // sebetulnya GPS-nya.
        setPesan(
          err.code === err.PERMISSION_DENIED
            ? 'Izin lokasi ditolak. Aktifkan lewat ikon kunci di bilah alamat, lalu coba lagi — atau ketuk peta untuk menaruh titik.'
            : err.code === err.TIMEOUT
              ? 'Pencarian lokasi kelamaan. Pastikan GPS/Lokasi di HP aktif, atau ketuk peta untuk menaruh titik.'
              : 'Perangkat belum bisa menentukan lokasi (GPS mati atau sinyal terhalang di dalam ruangan). Ketuk peta untuk menaruh titik.',
        );
      },
      // `maximumAge: 0` menolak posisi lama dari cache browser: pembeli yang
      // menekan tombol ini sedang berada di tempat pengiriman sekarang, bukan
      // di tempat ia membuka peta terakhir kali. `timeout` dinaikkan ke 15 detik
      // karena `enableHighAccuracy` di dalam ruangan sering butuh lebih dari 10.
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  return (
    <div>
      <p className="mb-1 text-sm font-medium">{label}</p>
      <div className="overflow-hidden rounded-lg border border-leaf-100">
        <div
          ref={wadahRef}
          className="h-48 w-full bg-leaf-50"
          role="application"
          aria-label="Peta pemilih titik antar"
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="px-3 py-1.5 text-xs"
          onClick={pakaiLokasiSaya}
          disabled={!siap || mencari}
        >
          {mencari ? 'Mencari…' : 'Pakai lokasi saya'}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            className="px-3 py-1.5 text-xs"
            onClick={() => {
              onChange(null);
              setAkurasi(null);
              setPesan('Titik dihapus.');
            }}
          >
            Hapus titik
          </Button>
        )}
        {value && (
          <span className="text-xs tabular-nums text-ink/50">
            {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            {akurasi != null && ` · ±${akurasi} m`}
          </span>
        )}
      </div>

      <p className="mt-1 text-xs leading-relaxed text-ink/50">
        {pesan ||
          (value
            ? 'Geser penanda bila posisinya kurang tepat.'
            : 'Ketuk peta atau tekan "Pakai lokasi saya" untuk menandai tempat barang diantar.')}
      </p>
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { rupiah } from '@/lib/utils';
import { useCart, unitPriceOf } from '@/lib/cart';
import { PinLokasi, type Titik } from '@/components/PinLokasi';
import { SlotPengiriman } from '@/components/forms/SlotPengiriman';
import type { Jendela } from '@/lib/slot';

const B2B_MIN_SUBTOTAL = 500_000;

/**
 * Bentuk balasan `POST /api/orders/quote`. Sengaja dituliskan di sini alih-alih
 * diimpor dari route-nya: route adalah modul server, dan mengimpornya dari
 * komponen klien akan menarik `prisma` ke bundel browser.
 */
type Perkiraan = {
  subtotal: number;
  ongkir: {
    km: number | null;
    dasar: number;
    subsidiPersen: number;
    subsidi: number;
    ongkir: number;
  };
  platformFee: number;
  total: number;
  catatan: string[];
};

/**
 * Halaman checkout keranjang.
 *
 * Satu pesanan boleh memuat produk dari beberapa penjual — model `Order`
 * memang sudah menampung banyak `OrderItem`, dan `/api/orders` sudah menerima
 * array `items` sejak awal. Yang belum ada selama ini cuma antarmukanya.
 *
 * Semua angka di layar ini PERKIRAAN. Harga final, ongkir, subsidi, dan biaya
 * platform dihitung ulang server saat pesanan dibuat.
 */
export function CartCheckout({
  defaultAddress,
  billingAddress,
  b2bEligible,
  pinTerakhir,
  jendela,
}: {
  defaultAddress: string;
  billingAddress: string;
  b2bEligible: boolean;
  /**
   * Titik antar dari pesanan terakhir pembeli ini, dipakai sebagai nilai awal.
   * `User` belum punya kolom koordinat tersimpan, jadi alih-alih menambah
   * kolom baru, titiknya diambil dari pesanan terakhir yang punya koordinat —
   * data yang memang sudah ada di `Order.destLat/destLng`. Pembeli yang
   * memesan berulang ke rumah yang sama tidak perlu menandai lagi.
   */
  pinTerakhir: Titik | null;
  /**
   * Jendela pengiriman yang masih bisa dipesan, dihitung di server saat
   * halaman dirender (lihat lib/slot.ts). Diturunkan sebagai prop, bukan
   * dihitung di browser: jam HP sering salah, sementara yang menolak pesanan
   * saat submit adalah jam server.
   */
  jendela: Jendela[];
}) {
  const router = useRouter();
  const { items, setQty, remove, clear, ready } = useCart();
  const [channel, setChannel] = useState<'B2C' | 'B2B'>('B2C');
  const [address, setAddress] = useState(defaultAddress);
  const [pin, setPin] = useState<Titik | null>(pinTerakhir);
  // Jendela terdekat dipilih otomatis. Membiarkannya kosong berarti tombol
  // bayar mati sampai pembeli menyadari ada pilihan yang belum disentuh,
  // padahal "sesegera mungkin" hampir selalu yang dia mau.
  const [slot, setSlot] = useState<string | null>(jendela[0]?.nilai ?? null);
  const [perkiraan, setPerkiraan] = useState<Perkiraan | null>(null);
  const [menghitung, setMenghitung] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const subtotal = items.reduce((a, i) => a + unitPriceOf(i, channel) * i.qty, 0);
  const feeB2b = channel === 'B2B' ? Math.round((subtotal * 0.025) / 100) * 100 : 0;
  const kurangB2b = channel === 'B2B' && subtotal < B2B_MIN_SUBTOTAL;

  // Kunci isi keranjang sebagai string: dipakai sebagai dependensi effect
  // menggantikan `items`. Array `items` adalah objek baru setiap render, jadi
  // memakainya langsung akan memicu permintaan perkiraan terus-menerus.
  const kunciItem = items.map((i) => `${i.productId}:${i.qty}`).join(',');

  // ONGKIR DIMINTA KE SERVER, BUKAN DIHITUNG DI SINI.
  //
  // Rumus ongkir (flat + per km, lalu dikurangi subsidi menurut tier produsen)
  // hidup di lib/ongkir.ts dan dipakai juga oleh pembuat pesanan. Menyalinnya
  // ke komponen ini akan membuat angka di layar pelan-pelan berbeda dari yang
  // ditagih — dan tidak ada yang tahu kapan mulai berbeda. Jadi checkout
  // MEMINTA angkanya lewat /api/orders/quote, yang tidak menulis apa pun.
  //
  // Ditunda 400 ms supaya menaikkan jumlah barang berkali-kali atau menggeser
  // pin tidak mengirim satu permintaan per ketukan; permintaan yang keduluan
  // dibatalkan lewat AbortController agar balasan lama tidak menimpa yang baru.
  useEffect(() => {
    if (!ready || items.length === 0) {
      setPerkiraan(null);
      return;
    }
    const batal = new AbortController();
    setMenghitung(true);
    const tunda = setTimeout(async () => {
      try {
        const res = await fetch('/api/orders/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
            destLat: pin?.lat,
            destLng: pin?.lng,
            channel,
          }),
          signal: batal.signal,
        });
        if (!res.ok) throw new Error('gagal');
        setPerkiraan(await res.json());
      } catch {
        // Jaringan mati atau permintaan dibatalkan: perkiraan lama dibiarkan
        // apa adanya dan tombol bayar tetap hidup. Server tetap menghitung
        // ulang saat pesanan dibuat, jadi gagal memuat perkiraan tidak boleh
        // memblokir checkout.
      } finally {
        if (!batal.signal.aborted) setMenghitung(false);
      }
    }, 400);

    return () => {
      clearTimeout(tunda);
      batal.abort();
    };
    // `items` diwakili `kunciItem` — lihat komentar di atas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunciItem, pin?.lat, pin?.lng, channel, ready]);

  const ongkir = perkiraan?.ongkir ?? null;
  const totalTampil = perkiraan ? perkiraan.total : subtotal + feeB2b;
  // Harga bisa berubah di antara saat barang dimasukkan keranjang dan saat
  // checkout dibuka. Keranjang menyimpan harga lama; server memakai yang baru.
  const hargaBergeser = perkiraan != null && perkiraan.subtotal !== subtotal;

  // Dikelompokkan per penjual supaya pembeli paham barangnya datang dari
  // beberapa kios/petani, bukan satu gudang.
  const perPenjual = items.reduce<Record<string, typeof items>>((acc, i) => {
    (acc[i.producerName] ||= []).push(i);
    return acc;
  }, {});

  function gantiKanal(c: 'B2C' | 'B2B') {
    setChannel(c);
    setMsg('');
    setAddress(c === 'B2B' && billingAddress ? billingAddress : defaultAddress);
  }

  async function checkout() {
    setLoading(true);
    setMsg('');
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
        addressText: address,
        // `/api/orders` sudah menerima dua field ini sejak awal dan
        // memakainya untuk menghitung ongkir per-km, tapi tidak ada satu pun
        // klien yang pernah mengirimnya — jadi setiap pesanan selama ini
        // memakai ongkir perkiraan 3 km, dan badge jarak di beranda kurir
        // tidak pernah muncul. Inilah baris yang menghidupkannya.
        destLat: pin?.lat,
        destLng: pin?.lng,
        channel,
        // Dikirim sebagai "2026-09-12|SORE". Server memecah dan MEMERIKSA
        // ULANG apakah jendelanya masih terbuka — halaman keranjang bisa
        // terbuka berjam-jam, dan batas pesan rit sore jatuh pukul 13.30.
        slot: slot ?? undefined,
      }),
    });
    const order = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(order.error || 'Gagal membuat pesanan.');
      setLoading(false);
      return;
    }

    if (channel === 'B2B') {
      // B2B tidak dibayar sekarang — ditagihkan lewat invoice bertermin.
      clear();
      router.push(`/app/konsumen/pesanan/${order.id}`);
      return;
    }

    const pay = await fetch(`/api/orders/${order.id}/pay`, { method: 'POST' });
    setLoading(false);
    if (!pay.ok) {
      // Pesanan sudah terbentuk, jadi keranjang tetap dikosongkan supaya
      // pembeli tidak memesan dua kali. Pembayaran bisa diulang dari halaman
      // pesanan.
      clear();
      router.push(`/app/konsumen/pesanan/${order.id}`);
      return;
    }
    clear();
    router.push(`/app/konsumen/pesanan/${order.id}`);
  }

  if (!ready) return <Card><p className="text-ink/50">Memuat keranjang…</p></Card>;

  if (items.length === 0) {
    return (
      <Card className="text-center">
        <p className="text-ink/60">Keranjang Anda masih kosong.</p>
        <Link
          href="/app/konsumen"
          className="mt-3 inline-block rounded-lg bg-leaf-600 px-4 py-2 text-sm font-medium text-white hover:bg-leaf-700"
        >
          Mulai belanja
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,20rem]">
      <div className="space-y-4">
        {Object.entries(perPenjual).map(([penjual, baris]) => (
          <Card key={penjual} className="space-y-3">
            <p className="text-sm font-medium">{penjual}</p>
            {baris.map((i) => {
              const harga = unitPriceOf(i, channel);
              const grosir = harga !== i.price;
              return (
                <div key={i.productId} className="flex items-start gap-3 border-t border-leaf-50 pt-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-leaf-50">
                    {i.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.photoUrl} alt={i.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-leaf-300"><Icon name="basket" size={24} /></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{i.name}</p>
                    <p className="text-sm text-ink/60">
                      {rupiah(harga)}/{i.unit}
                      {grosir && <span className="ml-1 text-leaf-700">(grosir)</span>}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex items-center rounded-lg border border-leaf-200">
                        <button
                          type="button"
                          onClick={() => setQty(i.productId, i.qty - 1)}
                          className="px-2.5 py-1 text-leaf-700"
                          aria-label="Kurangi"
                        >
                          −
                        </button>
                        <span className="min-w-[2.5rem] text-center text-sm">{i.qty}</span>
                        <button
                          type="button"
                          onClick={() => setQty(i.productId, i.qty + 1)}
                          className="px-2.5 py-1 text-leaf-700 disabled:opacity-40"
                          disabled={i.qty >= i.stock}
                          aria-label="Tambah"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(i.productId)}
                        className="text-xs text-ink/50 hover:text-red-600"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                  <p className="font-medium">{rupiah(harga * i.qty)}</p>
                </div>
              );
            })}
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        <Card className="space-y-3">
          {b2bEligible && (
            <div className="flex gap-2 rounded-lg bg-leaf-50 p-1">
              {(['B2C', 'B2B'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => gantiKanal(c)}
                  className={
                    'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ' +
                    (channel === c ? 'bg-white text-leaf-800 shadow-xs' : 'text-ink/60')
                  }
                >
                  {c === 'B2C' ? 'Eceran' : 'Grosir (B2B)'}
                </button>
              ))}
            </div>
          )}

          {/* RINCIAN BIAYA, BUKAN JANJI AKAN DIHITUNG NANTI.
              Sebelumnya blok ini cuma menampilkan subtotal lalu satu kalimat
              "ongkir dihitung server saat pesanan dibuat" — jadi konsumen baru
              melihat ongkirnya di halaman pembayaran, ketika pesanan dan
              reservasi stok sudah terbentuk. Angka di bawah datang dari
              /api/orders/quote yang memakai fungsi yang sama dengan pembuat
              pesanan, jadi ini bukan tafsiran ulang rumus di sisi klien. */}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-ink/60">Subtotal ({items.length} produk)</span>
              <span className="tabular-nums">{rupiah(perkiraan?.subtotal ?? subtotal)}</span>
            </div>

            <div className="flex justify-between gap-3">
              <span className="text-ink/60">
                Ongkir
                {ongkir?.km != null && (
                  <span className="text-ink/45"> · ± {ongkir.km.toFixed(1)} km</span>
                )}
              </span>
              <span className="tabular-nums">
                {ongkir ? rupiah(ongkir.dasar) : menghitung ? 'menghitung…' : '—'}
              </span>
            </div>

            {ongkir != null && ongkir.subsidi > 0 && (
              <div className="flex justify-between gap-3">
                <span className="text-ink/60">Subsidi ongkir ({ongkir.subsidiPersen}%)</span>
                <span className="tabular-nums text-leaf-700">− {rupiah(ongkir.subsidi)}</span>
              </div>
            )}

            {channel === 'B2B' && (
              <div className="flex justify-between gap-3">
                <span className="text-ink/60">Biaya layanan (2,5%)</span>
                <span className="tabular-nums">{rupiah(perkiraan?.platformFee ?? feeB2b)}</span>
              </div>
            )}

            <div className="flex justify-between gap-3 border-t border-leaf-100 pt-1.5 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">
                {rupiah(totalTampil)}
                {menghitung && !perkiraan && <span className="font-normal text-ink/40"> …</span>}
              </span>
            </div>
          </div>

          {hargaBergeser && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
              Harga sebagian barang berubah sejak dimasukkan ke keranjang. Yang berlaku adalah
              angka di rincian ini.
            </p>
          )}

          {perkiraan?.catatan.map((c) => (
            <p
              key={c}
              className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800"
            >
              {c}
            </p>
          ))}

          {kurangB2b && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Pesanan grosir minimal {rupiah(B2B_MIN_SUBTOTAL)}. Tambah lagi{' '}
              {rupiah(B2B_MIN_SUBTOTAL - subtotal)} atau pindah ke Eceran.
            </p>
          )}

          <div>
            <Label>{channel === 'B2B' ? 'Alamat pengiriman / penagihan' : 'Alamat pengiriman'}</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              placeholder="Jl. …, Kec. …"
            />
          </div>

          {/* Teks alamat untuk dibaca kurir, titik peta untuk dituju kurir.
              Keduanya diminta karena masing-masing menjawab hal berbeda: teks
              menjelaskan "rumah yang mana" (warna pagar, nama gang, patokan),
              koordinat menjawab "ke mana motornya diarahkan". Menghapus salah
              satu memindahkan pekerjaan itu ke telepon di jalan. */}
          <PinLokasi value={pin} onChange={setPin} />

          {!pin && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
              Belum ada titik peta. Pesanan tetap bisa dibuat, tapi ongkirnya dihitung dengan
              perkiraan 3 km dan kurir hanya berpatokan teks alamat.
            </p>
          )}

          <SlotPengiriman jendela={jendela} value={slot} onChange={setSlot} />

          {msg && <p className="text-sm text-red-600">{msg}</p>}

          <Button
            variant="cta"
            className="w-full"
            disabled={
              loading || kurangB2b || !address.trim() || (jendela.length > 0 && !slot)
            }
            onClick={checkout}
          >
            {loading
              ? 'Memproses…'
              : channel === 'B2B'
                ? 'Buat pesanan & terbitkan invoice'
                : 'Bayar & pesan (dana ditahan escrow)'}
          </Button>

          <p className="text-xs text-ink/50">
            {channel === 'B2B'
              ? 'Ditagihkan lewat invoice dengan termin 14 hari.'
              : 'Setelah bayar, dana ditahan sistem (escrow) dan baru diteruskan ke produsen setelah Anda menerima pesanan.'}
          </p>
        </Card>

        <button
          type="button"
          onClick={clear}
          className="w-full text-xs text-ink/50 hover:text-red-600"
        >
          Kosongkan keranjang
        </button>
      </div>
    </div>
  );
}

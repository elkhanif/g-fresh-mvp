'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Input';
import { StratumBadge } from '@/components/StratumBadge';
import {
  CULTIVATION_LABEL,
  STRATUM_REQUIREMENTS,
  deriveStratum,
  stratumChecklist,
  stratumProgress,
} from '@/lib/trace-stratum';
import type { CultivationMethod } from '@prisma/client';

type Cat = { id: string; name: string; unit: string };

/**
 * Konteks produsen yang dibutuhkan form untuk (a) melabeli waktu sesuai jenis
 * penjual, (b) mengisi GPS lahan otomatis, dan (c) menampilkan syarat
 * sertifikat yang sudah/belum terpenuhi.
 *
 * `certVerified` dikirim sebagai boolean yang sudah dihitung di server dengan
 * certVerifiedOf(), bukan certStatus mentah — supaya definisi "sertifikat sah"
 * tetap di satu tempat dan tidak ditulis ulang di klien.
 */
export type ProducerFormCtx = {
  sellerType: 'TANI' | 'PASAR';
  latitude: number | null;
  longitude: number | null;
  certVerified: boolean;
};

export function AddProductForm({
  categories,
  producer,
  onDone,
}: {
  categories: Cat[];
  producer: ProducerFormCtx;
  /**
   * Dipanggil setelah produk berhasil tersimpan. Dipakai oleh
   * `AddProductSheet` untuk menutup panelnya sendiri. Opsional supaya form
   * ini tetap bisa dipasang langsung di halaman tanpa panel.
   */
  onDone?: () => void;
}) {
  const router = useRouter();

  // Pedagang kios pasar tidak memanen. Basis ditentukan jenis penjual dan
  // tidak bisa diubah dari sini. Server memaksakan hal yang sama, jadi ini
  // murni supaya labelnya jujur — bukan kontrol keamanan.
  const basis: 'PANEN' | 'TRANSAKSI' = producer.sellerType === 'PASAR' ? 'TRANSAKSI' : 'PANEN';
  const labelWaktu = basis === 'PANEN' ? 'Waktu panen' : 'Waktu kulakan / masuk kios';

  const [f, setF] = useState({
    name: '',
    categoryId: categories[0]?.id ?? '',
    unit: categories[0]?.unit ?? 'kg',
    price: '',
    stock: '',
    freshAt: new Date().toISOString().slice(0, 16),
    b2bPrice: '',
    b2bMinQty: '',
  });
  const [metode, setMetode] = useState<CultivationMethod | ''>('');
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(
    producer.latitude != null && producer.longitude != null
      ? { lat: producer.latitude, lng: producer.longitude }
      : null,
  );
  const [gpsMsg, setGpsMsg] = useState('');
  const [bukaMutu, setBukaMutu] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  const stratumInput = {
    freshBasis: basis,
    harvestLat: gps?.lat ?? null,
    harvestLng: gps?.lng ?? null,
    cultivationMethod: metode === '' ? null : metode,
    certVerified: producer.certVerified,
  };
  const checklist = stratumChecklist(stratumInput);
  const { done, total } = stratumProgress(stratumInput);
  const stratum = deriveStratum(stratumInput);

  function ambilLokasi() {
    if (!navigator.geolocation) {
      setGpsMsg('Perangkat ini tidak mendukung deteksi lokasi.');
      return;
    }
    setGpsMsg('Mencari lokasi…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsMsg('Lokasi diperbarui dari perangkat Anda.');
      },
      () =>
        setGpsMsg(
          'Gagal mengambil lokasi. Izinkan akses lokasi di browser, atau biarkan memakai lokasi profil.',
        ),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function pakaiLokasiProfil() {
    if (producer.latitude == null || producer.longitude == null) {
      setGpsMsg('Profil Anda belum punya koordinat. Lengkapi dulu di pengaturan profil.');
      return;
    }
    setGps({ lat: producer.latitude, lng: producer.longitude });
    setGpsMsg('Kembali memakai koordinat dari profil Anda.');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg('');

    // 1) Unggah foto lebih dulu (jika ada) → dapat URL.
    let photoUrl: string | undefined;
    if (photo) {
      const fd = new FormData();
      fd.append('file', photo);
      const up = await fetch('/api/upload', { method: 'POST', body: fd });
      const uj = await up.json().catch(() => ({}));
      if (!up.ok) {
        setMsg(uj.error || 'Gagal mengunggah foto.');
        setLoading(false);
        return;
      }
      photoUrl = uj.url;
    }

    // 2) Buat produk (harga divalidasi terhadap HET di server).
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: f.name,
        categoryId: f.categoryId,
        unit: f.unit,
        price: Number(f.price),
        stock: Number(f.stock),
        freshAt: new Date(f.freshAt).toISOString(),
        freshBasis: basis,
        cultivationMethod: metode === '' ? undefined : metode,
        harvestLat: gps?.lat,
        harvestLng: gps?.lng,
        photoUrl,
        b2bPrice: f.b2bPrice ? Number(f.b2bPrice) : undefined,
        b2bMinQty: f.b2bMinQty ? Number(f.b2bMinQty) : undefined,
      }),
    });
    setLoading(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(j.error || 'Gagal menambahkan produk.');
      return;
    }

    setF((s) => ({ ...s, name: '', price: '', stock: '', b2bPrice: '', b2bMinQty: '' }));
    setPhoto(null);
    setMsg('Produk ditambahkan.');
    router.refresh();
    onDone?.();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label>Nama produk</Label>
        <Input value={f.name} onChange={(e) => set('name', e.target.value)} required placeholder="mis. Bayam segar" />
      </div>
      <div>
        <Label>Foto produk (opsional)</Label>
        <input
          type="file" accept="image/*"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-ink/70 file:mr-3 file:rounded-lg file:border-0 file:bg-leaf-100 file:px-3 file:py-1.5 file:text-sm file:text-leaf-800"
        />
        {photo && <p className="mt-1 text-xs text-ink/50">{photo.name}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Kategori</Label>
          <Select
            value={f.categoryId}
            onChange={(e) => {
              const c = categories.find((x) => x.id === e.target.value);
              setF((s) => ({ ...s, categoryId: e.target.value, unit: c?.unit ?? s.unit }));
            }}
          >
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div>
          <Label>Satuan</Label>
          <Input value={f.unit} onChange={(e) => set('unit', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Harga / satuan (Rp)</Label>
          <Input type="number" value={f.price} onChange={(e) => set('price', e.target.value)} required min={1} />
        </div>
        <div>
          <Label>Stok</Label>
          <Input type="number" value={f.stock} onChange={(e) => set('stock', e.target.value)} required min={0} />
        </div>
      </div>
      <div className="rounded-lg border border-leaf-100 p-3">
        <p className="mb-2 text-sm font-medium">Harga grosir B2B (opsional)</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Harga grosir / satuan</Label>
            <Input type="number" value={f.b2bPrice} onChange={(e) => set('b2bPrice', e.target.value)}
              min={1} placeholder="lebih murah dari ritel" />
          </div>
          <div>
            <Label>Minimum qty</Label>
            <Input type="number" value={f.b2bMinQty} onChange={(e) => set('b2bMinQty', e.target.value)}
              min={1} placeholder="mis. 20" />
          </div>
        </div>
        <p className="mt-1 text-xs text-ink/50">
          Diisi bila Anda siap melayani katering/restoran dalam volume. Harga grosir wajib lebih rendah dari harga ritel.
        </p>
      </div>

      <div>
        <Label>{labelWaktu} (Anda yang melaporkan)</Label>
        <Input type="datetime-local" value={f.freshAt} onChange={(e) => set('freshAt', e.target.value)} />
      </div>

      {/*
        Data mutu opsional — syarat Jalur A.

        Dua hal yang disengaja di panel ini:

        1. Bisa dilipat dan TIDAK wajib. Mengunci pendaftaran produk di balik
           data lengkap akan mengeluarkan justru petani yang jadi sasaran
           program ini. Produk tanpa data ini tetap terbit, hanya di Jalur B.

        2. Tidak ada pilihan "Jalur A / Jalur B" di sini. Strata dihitung dari
           apa yang terisi. Kalau bisa dipilih, hampir semua orang memilih yang
           paling sedikit kerjanya dan badge "Mutu Terverifikasi" berhenti
           berarti apa pun.
      */}
      <div className="rounded-lg border border-leaf-100 p-3">
        <button
          type="button"
          onClick={() => setBukaMutu((v) => !v)}
          className="flex w-full items-center justify-between gap-2 text-left"
          aria-expanded={bukaMutu}
        >
          <span className="text-sm font-medium">
            Data mutu <span className="font-normal text-ink/50">(opsional)</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="text-xs text-ink/50">{done} dari {total}</span>
            <span className="text-ink/40" aria-hidden="true">{bukaMutu ? '▴' : '▾'}</span>
          </span>
        </button>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StratumBadge stratum={stratum} />
          <span className="text-xs text-ink/50">
            {stratum === 'MUTU_TERVERIFIKASI'
              ? 'Produk ini akan tampil dengan badge terverifikasi.'
              : 'Lengkapi keempatnya untuk mendapat badge Mutu Terverifikasi.'}
          </span>
        </div>

        {bukaMutu && (
          <div className="mt-3 space-y-3 border-t border-leaf-100 pt-3">
            <div>
              <Label>Metode budidaya</Label>
              <Select value={metode} onChange={(e) => setMetode(e.target.value as CultivationMethod | '')}>
                <option value="">— belum diisi —</option>
                {(Object.keys(CULTIVATION_LABEL) as CultivationMethod[]).map((k) => (
                  <option key={k} value={k}>{CULTIVATION_LABEL[k]}</option>
                ))}
              </Select>
            </div>

            <div>
              <Label>Lokasi lahan / tambak</Label>
              {gps ? (
                <p className="font-mono text-xs text-ink/70">
                  {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
                </p>
              ) : (
                <p className="text-xs text-ink/50">Belum ada koordinat.</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="px-2 py-1 text-xs" onClick={ambilLokasi}>
                  Gunakan lokasi saya sekarang
                </Button>
                <Button type="button" variant="ghost" className="px-2 py-1 text-xs" onClick={pakaiLokasiProfil}>
                  Pakai lokasi profil
                </Button>
              </div>
              {gpsMsg && <p className="mt-1 text-xs text-ink/50">{gpsMsg}</p>}
              <p className="mt-1 text-xs text-ink/45">
                Terisi otomatis dari profil Anda. Ubah hanya bila produk ini berasal dari lahan yang
                berbeda. Pembeli hanya melihat peta sebatas tingkat kecamatan.
              </p>
            </div>

            {/* Sertifikat tidak diunggah dari sini: satu sertifikat berlaku
                untuk seluruh produk dan harus diverifikasi dinas, jadi
                tempatnya di halaman sertifikasi — bukan per produk. */}
            <div>
              <Label>Sertifikat</Label>
              {producer.certVerified ? (
                <p className="text-xs text-leaf-700">Sertifikat Anda sudah terverifikasi dinas.</p>
              ) : (
                <p className="text-xs text-ink/60">
                  Belum ada sertifikat terverifikasi.{' '}
                  <Link href="/app/produsen/sertifikasi" className="text-leaf-700 underline">
                    Ajukan di halaman sertifikasi
                  </Link>
                  .
                </p>
              )}
            </div>

            <ul className="space-y-1 rounded-lg bg-leaf-50 p-2 text-xs">
              {STRATUM_REQUIREMENTS.map((r) => (
                <li key={r.key} className="flex items-center gap-2">
                  <span className={checklist[r.key] ? 'text-leaf-700' : 'text-ink/30'} aria-hidden="true">
                    {checklist[r.key] ? '✓' : '○'}
                  </span>
                  <span className={checklist[r.key] ? 'text-ink/70' : 'text-ink/45'}>{r.label}</span>
                </li>
              ))}
            </ul>

            {basis === 'TRANSAKSI' && (
              <p className="rounded-lg bg-blue-50 p-2 text-xs text-ink/60">
                Sebagai penjual kios pasar Anda melaporkan waktu kulakan, bukan waktu panen — jadi
                produk Anda memang berada di Jalur B. Itu jalur yang sah: kepatuhan HET dan asal
                pasar tetap ditampilkan penuh kepada pembeli.
              </p>
            )}
          </div>
        )}
      </div>

      {msg && <p className={`text-sm ${msg.includes('ditambahkan') ? 'text-leaf-700' : 'text-red-600'}`}>{msg}</p>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Menyimpan…' : 'Tambah produk'}
      </Button>
    </form>
  );
}

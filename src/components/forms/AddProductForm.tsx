'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Input';

type Cat = { id: string; name: string; unit: string };

export function AddProductForm({ categories }: { categories: Cat[] }) {
  const router = useRouter();
  const [f, setF] = useState({
    name: '', categoryId: categories[0]?.id ?? '', unit: categories[0]?.unit ?? 'kg',
    price: '', stock: '', harvestedAt: new Date().toISOString().slice(0, 16),
    b2bPrice: '', b2bMinQty: '',
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg('');

    // 1) Unggah foto lebih dulu (jika ada) → dapat URL.
    let photoUrl: string | undefined;
    if (photo) {
      const fd = new FormData();
      fd.append('file', photo);
      const up = await fetch('/api/upload', { method: 'POST', body: fd });
      const uj = await up.json().catch(() => ({}));
      if (!up.ok) { setMsg(uj.error || 'Gagal mengunggah foto.'); setLoading(false); return; }
      photoUrl = uj.url;
    }

    // 2) Buat produk (harga divalidasi terhadap HET di server).
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: f.name, categoryId: f.categoryId, unit: f.unit,
        price: Number(f.price), stock: Number(f.stock),
        harvestedAt: new Date(f.harvestedAt).toISOString(),
        photoUrl,
        b2bPrice: f.b2bPrice ? Number(f.b2bPrice) : undefined,
        b2bMinQty: f.b2bMinQty ? Number(f.b2bMinQty) : undefined,
      }),
    });
    setLoading(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(j.error || 'Gagal menambahkan produk.'); return; }

    setF((s) => ({ ...s, name: '', price: '', stock: '', b2bPrice: '', b2bMinQty: '' }));
    setPhoto(null);
    setMsg('Produk ditambahkan.');
    router.refresh();
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
        <Label>Waktu panen (Anda yang melaporkan)</Label>
        <Input type="datetime-local" value={f.harvestedAt} onChange={(e) => set('harvestedAt', e.target.value)} />
      </div>
      {msg && <p className={`text-sm ${msg.includes('ditambahkan') ? 'text-leaf-700' : 'text-red-600'}`}>{msg}</p>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Menyimpan…' : 'Tambah produk'}
      </Button>
    </form>
  );
}

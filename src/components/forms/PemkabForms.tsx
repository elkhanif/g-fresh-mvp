'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Input';

type Cat = { id: string; name: string; unit: string };

export function HetForm({ categories }: { categories: Cat[] }) {
  const router = useRouter();
  const [f, setF] = useState({
    categoryId: categories[0]?.id ?? '', maxPrice: '', floorPrice: '',
    effectiveOn: new Date().toISOString().slice(0, 10),
  });
  const [msg, setMsg] = useState('');
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    const res = await fetch('/api/het', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoryId: f.categoryId, maxPrice: Number(f.maxPrice),
        floorPrice: f.floorPrice ? Number(f.floorPrice) : undefined,
        effectiveOn: new Date(f.effectiveOn).toISOString(),
      }),
    });
    if (res.ok) { setMsg('HET tersimpan.'); router.refresh(); }
    else { const j = await res.json().catch(() => ({})); setMsg(j.error || 'Gagal.'); }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label>Kategori</Label>
        <Select value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name} (/{c.unit})</option>)}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>HET / batas atas (Rp)</Label>
          <Input type="number" value={f.maxPrice} onChange={(e) => set('maxPrice', e.target.value)} required min={1} />
        </div>
        <div>
          <Label>Harga dasar / batas bawah (opsional)</Label>
          <Input type="number" value={f.floorPrice} onChange={(e) => set('floorPrice', e.target.value)} min={0} />
        </div>
      </div>
      <div>
        <Label>Berlaku mulai</Label>
        <Input type="date" value={f.effectiveOn} onChange={(e) => set('effectiveOn', e.target.value)} />
      </div>
      {msg && <p className={`text-sm ${msg.includes('tersimpan') ? 'text-leaf-700' : 'text-red-600'}`}>{msg}</p>}
      <Button type="submit">Tetapkan HET</Button>
    </form>
  );
}

export function CertVerifyForm({ producerId, currentType }: { producerId: string; currentType?: string | null }) {
  const router = useRouter();
  const [type, setType] = useState(currentType ?? 'P-IRT');
  const [loading, setLoading] = useState('');
  async function decide(status: 'TERVERIFIKASI' | 'DITOLAK') {
    setLoading(status);
    await fetch('/api/cert', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ producerId, status, certType: type }),
    });
    setLoading('');
    router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={type} onChange={(e) => setType(e.target.value)} className="w-32">
        <option>P-IRT</option><option>Halal</option><option>BPOM</option>
      </Select>
      <Button onClick={() => decide('TERVERIFIKASI')} disabled={!!loading}>Verifikasi</Button>
      <Button variant="outline" onClick={() => decide('DITOLAK')} disabled={!!loading}>Tolak</Button>
    </div>
  );
}

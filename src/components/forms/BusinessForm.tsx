'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Input';

const TIPE = ['Katering', 'Restoran', 'Hotel', 'Retail / Toko', 'Kantin institusi'];

export function BusinessForm({ initial }: {
  initial?: {
    companyName: string; businessType: string; npwp: string;
    picName: string; picPhone: string; billingAddress: string;
  };
}) {
  const router = useRouter();
  const [f, setF] = useState({
    companyName: initial?.companyName ?? '',
    businessType: initial?.businessType ?? TIPE[0],
    npwp: initial?.npwp ?? '',
    picName: initial?.picName ?? '',
    picPhone: initial?.picPhone ?? '',
    billingAddress: initial?.billingAddress ?? '',
  });
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg('');
    const res = await fetch('/api/business', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f),
    });
    setLoading(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setMsg(j.error || 'Gagal menyimpan.'); return; }
    setMsg('Tersimpan. Menunggu verifikasi admin.');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label>Nama usaha / badan</Label>
        <Input value={f.companyName} onChange={(e) => set('companyName', e.target.value)} required
          placeholder="mis. Katering Bu Sri" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Jenis usaha</Label>
          <Select value={f.businessType} onChange={(e) => set('businessType', e.target.value)}>
            {TIPE.map((t) => <option key={t}>{t}</option>)}
          </Select>
        </div>
        <div>
          <Label>NPWP (opsional)</Label>
          <Input value={f.npwp} onChange={(e) => set('npwp', e.target.value)} placeholder="00.000.000.0-000.000" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Nama PIC</Label>
          <Input value={f.picName} onChange={(e) => set('picName', e.target.value)} required />
        </div>
        <div>
          <Label>No. HP PIC</Label>
          <Input value={f.picPhone} onChange={(e) => set('picPhone', e.target.value)} required />
        </div>
      </div>
      <div>
        <Label>Alamat penagihan</Label>
        <Input value={f.billingAddress} onChange={(e) => set('billingAddress', e.target.value)} required
          placeholder="Jl. …, Kec. …, Gresik" />
      </div>
      {msg && <p className={`text-sm ${msg.includes('Tersimpan') ? 'text-leaf-700' : 'text-red-600'}`}>{msg}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? 'Menyimpan…' : initial ? 'Perbarui profil bisnis' : 'Daftar sebagai pembeli B2B'}
      </Button>
      {initial && (
        <p className="text-xs text-ink/50">
          Mengubah data akan mengembalikan status ke menunggu verifikasi.
        </p>
      )}
    </form>
  );
}

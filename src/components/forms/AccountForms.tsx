'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';

export function ProfileForm({
  role, name, phone, defaultAddress,
}: { role: string; name: string; phone: string; defaultAddress: string }) {
  const router = useRouter();
  const [f, setF] = useState({ name, phone, defaultAddress });
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg('');
    const body: Record<string, string> = { name: f.name, phone: f.phone };
    if (role === 'KONSUMEN') body.defaultAddress = f.defaultAddress;
    const res = await fetch('/api/account', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    setLoading(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setMsg(j.error || 'Gagal menyimpan.'); return; }
    setMsg('Profil tersimpan.');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label>Nama</Label>
        <Input value={f.name} onChange={(e) => set('name', e.target.value)} required />
      </div>
      <div>
        <Label>No. HP</Label>
        <Input value={f.phone} onChange={(e) => set('phone', e.target.value)} required />
      </div>
      {role === 'KONSUMEN' && (
        <div>
          <Label>Alamat tersimpan (otomatis terisi saat checkout)</Label>
          <Input value={f.defaultAddress} onChange={(e) => set('defaultAddress', e.target.value)}
            placeholder="Jl. …, Kec. …" />
        </div>
      )}
      {msg && <p className={`text-sm ${msg.includes('tersimpan') ? 'text-leaf-700' : 'text-red-600'}`}>{msg}</p>}
      <Button type="submit" disabled={loading}>{loading ? 'Menyimpan…' : 'Simpan profil'}</Button>
    </form>
  );
}

export function PasswordForm() {
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    if (f.next !== f.confirm) { setMsg('Konfirmasi kata sandi tidak cocok.'); return; }
    setLoading(true);
    const res = await fetch('/api/account/password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current: f.current, next: f.next }),
    });
    setLoading(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setMsg(j.error || 'Gagal mengganti sandi.'); return; }
    setF({ current: '', next: '', confirm: '' });
    setMsg('Kata sandi berhasil diganti.');
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label>Kata sandi lama</Label>
        <Input type="password" value={f.current} onChange={(e) => set('current', e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Kata sandi baru</Label>
          <Input type="password" value={f.next} onChange={(e) => set('next', e.target.value)} required minLength={6} />
        </div>
        <div>
          <Label>Ulangi</Label>
          <Input type="password" value={f.confirm} onChange={(e) => set('confirm', e.target.value)} required />
        </div>
      </div>
      {msg && <p className={`text-sm ${msg.includes('berhasil') ? 'text-leaf-700' : 'text-red-600'}`}>{msg}</p>}
      <Button type="submit" disabled={loading}>{loading ? 'Memproses…' : 'Ganti kata sandi'}</Button>
    </form>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Logo } from '@/components/ui/Logo';

export default function RegisterPage() {
  const router = useRouter();
  const [kecamatanList, setKecamatanList] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '',
    role: 'KONSUMEN', kecamatan: '', farmName: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Daftar kecamatan diambil dari Admin (dikelola di dashboard Admin), bukan
  // hardcoded, supaya cakupan pilot bisa diperluas tanpa mengubah kode.
  useEffect(() => {
    fetch('/api/service-areas')
      .then((r) => r.json())
      .then((list: string[]) => {
        setKecamatanList(list);
        if (list.length > 0) setForm((f) => ({ ...f, kecamatan: list[0] }));
      })
      .catch(() => {});
  }, []);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || 'Gagal mendaftar.');
      setLoading(false);
      return;
    }
    await signIn('credentials', { email: form.email, password: form.password, redirect: false });
    router.push('/app');
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-8">
      <Link href="/" className="mb-6 inline-flex">
        <Logo className="h-8" />
      </Link>
      <Card>
        <h1 className="text-xl font-semibold">Buat akun</h1>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div>
            <Label>Saya adalah</Label>
            <Select value={form.role} onChange={(e) => set('role', e.target.value)}>
              <option value="KONSUMEN">Konsumen (rumah tangga / katering)</option>
              <option value="PRODUSEN">Produsen (petani / petambak / peternak / UMKM)</option>
              <option value="KURIR">Mitra kurir</option>
            </Select>
          </div>
          <div>
            <Label>Nama</Label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </div>
          {form.role === 'PRODUSEN' && (
            <div>
              <Label>Nama usaha / kelompok tani</Label>
              <Input value={form.farmName} onChange={(e) => set('farmName', e.target.value)} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />
            </div>
            <div>
              <Label>No. HP</Label>
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Kecamatan</Label>
              {kecamatanList.length === 0 ? (
                <Input value="Memuat…" disabled />
              ) : (
                <Select value={form.kecamatan} onChange={(e) => set('kecamatan', e.target.value)}>
                  {kecamatanList.map((k) => <option key={k}>{k}</option>)}
                </Select>
              )}
            </div>
            <div>
              <Label>Kata sandi</Label>
              <Input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required minLength={6} />
            </div>
          </div>
          {kecamatanList.length > 0 && (
            <p className="text-xs text-ink/45">
              Belum melayani kecamatan Anda? Layanan akan diperluas bertahap oleh operator.
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading || kecamatanList.length === 0} className="w-full">
            {loading ? 'Memproses…' : 'Daftar & masuk'}
          </Button>
        </form>
        <p className="mt-4 text-sm text-ink/60">
          Sudah punya akun?{' '}
          <Link href="/login" className="font-medium text-leaf-700">Masuk</Link>
        </p>
      </Card>
    </main>
  );
}

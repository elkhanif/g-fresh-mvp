'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';

export function KtpSubmitForm({ currentNik }: { currentNik: string | null }) {
  const router = useRouter();
  const [nik, setNik] = useState(currentNik ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg('');
    if (!/^\d{16}$/.test(nik)) {
      setMsg('NIK harus tepat 16 digit angka.');
      setLoading(false);
      return;
    }
    if (!file) {
      setMsg('Foto KTP wajib diunggah.');
      setLoading(false);
      return;
    }
    const fd = new FormData();
    fd.append('nik', nik);
    fd.append('photo', file);
    const res = await fetch('/api/courier/ktp', { method: 'POST', body: fd });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error || 'Gagal mengirim pengajuan.');
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label>Nomor Induk Kependudukan (NIK)</Label>
        <Input
          value={nik}
          onChange={(e) => setNik(e.target.value.replace(/\D/g, '').slice(0, 16))}
          placeholder="16 digit sesuai KTP"
          inputMode="numeric"
          required
        />
      </div>
      <div>
        <Label>Foto KTP</Label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-ink/70 file:mr-3 file:rounded-lg file:border-0 file:bg-leaf-100 file:px-3 file:py-1.5 file:text-sm file:text-leaf-800"
          required
        />
        <p className="mt-1 text-xs text-ink/45">Pastikan seluruh data pada KTP terbaca jelas.</p>
      </div>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? 'Mengirim…' : 'Kirim untuk diverifikasi'}
      </Button>
    </form>
  );
}

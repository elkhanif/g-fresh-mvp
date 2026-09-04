'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';

type Area = { id: string; name: string; active: boolean };

export function ServiceAreaPanel({ areas }: { areas: Area[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState('');
  const [msg, setMsg] = useState('');

  async function toggle(id: string, active: boolean) {
    setLoading(id);
    await fetch('/api/admin/service-areas', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active }),
    });
    setLoading('');
    router.refresh();
  }

  async function addArea(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading('add');
    setMsg('');
    const res = await fetch('/api/admin/service-areas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    setLoading('');
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error || 'Gagal menambah.');
      return;
    }
    setName('');
    router.refresh();
  }

  const aktifCount = areas.filter((a) => a.active).length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink/60">
        {aktifCount} dari {areas.length} kecamatan aktif — hanya yang aktif muncul di formulir pendaftaran.
      </p>
      <form onSubmit={addArea} className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama kecamatan baru" />
        <Button type="submit" disabled={loading === 'add'}>
          {loading === 'add' ? '…' : 'Tambah'}
        </Button>
      </form>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      <div className="flex flex-wrap gap-2">
        {areas.map((a) => (
          <button
            key={a.id}
            onClick={() => toggle(a.id, !a.active)}
            disabled={loading === a.id}
            className="cursor-pointer"
            title={a.active ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}
          >
            <Badge tone={a.active ? 'green' : 'neutral'}>
              {a.name} {a.active ? '✓' : ''}
            </Badge>
          </button>
        ))}
      </div>
    </div>
  );
}

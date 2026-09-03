'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export function ComplaintRespondForm({ complaintId }: { complaintId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<'' | 'SETUJU' | 'TOLAK'>('');
  const [response, setResponse] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function submit(stance: 'SETUJU' | 'TOLAK') {
    setLoading(true);
    setMsg('');
    const fd = new FormData();
    fd.append('stance', stance);
    fd.append('response', response);
    files.slice(0, 4).forEach((f) => fd.append('evidence', f));
    const res = await fetch(`/api/complaints/${complaintId}/respond`, { method: 'POST', body: fd });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error || 'Gagal mengirim tanggapan.');
      return;
    }
    router.refresh();
  }

  if (!mode) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setMode('SETUJU')}>
            Saya setuju — proses refund
          </Button>
          <Button onClick={() => setMode('TOLAK')}>Saya menyanggah</Button>
        </div>
        <p className="text-xs text-ink/50">
          Menyetujui akan langsung mengembalikan dana ke konsumen tanpa menunggu admin.
          Menyanggah akan meneruskan kasus ini ke admin beserta bukti Anda.
        </p>
        {msg && <p className="text-sm text-red-600">{msg}</p>}
      </div>
    );
  }

  const setuju = mode === 'SETUJU';
  return (
    <div className="space-y-3 rounded-lg border border-leaf-100 p-3">
      <p className="text-sm font-medium">
        {setuju ? 'Menyetujui komplain' : 'Menyanggah komplain'}
      </p>

      <textarea
        className="w-full rounded-lg border border-leaf-200 px-3 py-2 text-sm outline-none focus:border-leaf-500"
        rows={3}
        placeholder={
          setuju
            ? 'Catatan untuk konsumen (opsional)'
            : 'Jelaskan mengapa komplain ini tidak tepat (wajib, min. 10 karakter)'
        }
        value={response}
        onChange={(e) => setResponse(e.target.value)}
      />

      {!setuju && (
        <div>
          <label className="mb-1 block text-xs font-medium text-ink/70">
            Bukti tandingan (opsional — foto saat pengemasan, dsb.)
          </label>
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="block w-full text-sm text-ink/70 file:mr-3 file:rounded-lg file:border-0 file:bg-leaf-100 file:px-3 file:py-1.5 file:text-sm file:text-leaf-800"
          />
          {files.length > 0 && <p className="mt-1 text-xs text-ink/50">{files.length} file dipilih.</p>}
        </div>
      )}

      {msg && <p className="text-sm text-red-600">{msg}</p>}

      <div className="flex gap-2">
        <Button
          variant={setuju ? 'danger' : 'primary'}
          onClick={() => submit(mode)}
          disabled={loading || (!setuju && response.trim().length < 10)}
        >
          {loading ? 'Mengirim…' : setuju ? 'Konfirmasi & refund' : 'Kirim sanggahan'}
        </Button>
        <Button variant="ghost" onClick={() => setMode('')}>
          Batal
        </Button>
      </div>
    </div>
  );
}

'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { rupiah } from '@/lib/utils';

type Mode = '' | 'SETUJU' | 'TAWAR' | 'TOLAK';

export function ComplaintRespondForm({
  complaintId, orderTotal, suggestedRefund,
}: { complaintId: string; orderTotal: number; suggestedRefund?: number | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('');
  const [response, setResponse] = useState('');
  const [amount, setAmount] = useState(suggestedRefund ? String(suggestedRefund) : '');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function submit(stance: 'SETUJU' | 'TAWAR' | 'TOLAK') {
    setLoading(true);
    setMsg('');
    const fd = new FormData();
    fd.append('stance', stance);
    fd.append('response', response);
    if (stance === 'TAWAR') fd.append('amount', amount);
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
            Setuju penuh — refund {rupiah(orderTotal)}
          </Button>
          <Button variant="outline" onClick={() => setMode('TAWAR')}>
            Tawar sebagian
          </Button>
          <Button onClick={() => setMode('TOLAK')}>Menyanggah</Button>
        </div>
        {suggestedRefund != null && (
          <p className="text-xs text-leaf-700">
            💡 Berdasarkan jumlah yang dilaporkan kurang, saran refund sekitar {rupiah(suggestedRefund)}.
          </p>
        )}
        <p className="text-xs text-ink/50">
          Setuju penuh & tawar sebagian langsung diproses tanpa menunggu admin. Menyanggah akan
          meneruskan kasus ke admin sebagai keputusan final.
        </p>
        {msg && <p className="text-sm text-red-600">{msg}</p>}
      </div>
    );
  }

  const label = mode === 'SETUJU' ? 'Menyetujui penuh' : mode === 'TAWAR' ? 'Menawar sebagian' : 'Menyanggah';

  return (
    <div className="space-y-3 rounded-lg border border-leaf-100 p-3">
      <p className="text-sm font-medium">{label}</p>

      {mode === 'TAWAR' && (
        <div>
          <label className="mb-1 block text-xs font-medium text-ink/70">
            Nominal yang ditawarkan (dari total {rupiah(orderTotal)})
          </label>
          <input
            type="number" min={1} max={orderTotal - 1} value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-leaf-200 px-3 py-2 text-sm outline-none focus:border-leaf-500"
            placeholder={`1 – ${orderTotal - 1}`}
          />
          {suggestedRefund != null && Number(amount) !== suggestedRefund && (
            <button
              type="button"
              onClick={() => setAmount(String(suggestedRefund))}
              className="mt-1 text-xs text-leaf-700 hover:underline"
            >
              Pakai saran sistem: {rupiah(suggestedRefund)}
            </button>
          )}
        </div>
      )}

      <textarea
        className="w-full rounded-lg border border-leaf-200 px-3 py-2 text-sm outline-none focus:border-leaf-500"
        rows={3}
        placeholder={
          mode === 'SETUJU' ? 'Catatan untuk konsumen (opsional)'
          : mode === 'TAWAR' ? 'Jelaskan alasan tawaran ini (opsional)'
          : 'Jelaskan mengapa komplain ini tidak tepat (wajib, min. 10 karakter)'
        }
        value={response}
        onChange={(e) => setResponse(e.target.value)}
      />

      {mode !== 'SETUJU' && (
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
          variant={mode === 'TOLAK' ? 'primary' : 'danger'}
          onClick={() => submit(mode)}
          disabled={
            loading ||
            (mode === 'TOLAK' && response.trim().length < 10) ||
            (mode === 'TAWAR' && (!amount || Number(amount) < 1 || Number(amount) >= orderTotal))
          }
        >
          {loading ? 'Mengirim…'
            : mode === 'SETUJU' ? 'Konfirmasi & refund penuh'
            : mode === 'TAWAR' ? 'Kirim tawaran'
            : 'Kirim sanggahan'}
        </Button>
        <Button variant="ghost" onClick={() => setMode('')}>Batal</Button>
      </div>
    </div>
  );
}

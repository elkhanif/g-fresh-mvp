'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { OrderStatus } from '@prisma/client';

// Aksi milik KONSUMEN pada halaman detail pesanan.
export function OrderActions({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const router = useRouter();
  const [loading, setLoading] = useState('');
  const [showComplaint, setShowComplaint] = useState(false);
  const [reason, setReason] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [msg, setMsg] = useState('');

  async function call(path: string, key = 'x') {
    setLoading(key);
    setMsg('');
    const res = await fetch(path, { method: 'POST' });
    setLoading('');
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error || 'Gagal.');
      return;
    }
    router.refresh();
  }

  async function submitComplaint() {
    setLoading('cmp');
    setMsg('');
    const fd = new FormData();
    fd.append('orderId', orderId);
    fd.append('reason', reason);
    files.slice(0, 4).forEach((f) => fd.append('evidence', f));
    const res = await fetch('/api/complaints', { method: 'POST', body: fd }); // JANGAN set Content-Type manual
    setLoading('');
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error || 'Gagal mengirim komplain.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {status === 'MENUNGGU_BAYAR' && (
        <Button onClick={() => call(`/api/orders/${orderId}/pay`, 'pay')} disabled={loading === 'pay'}>
          {loading === 'pay' ? 'Memproses…' : 'Bayar sekarang'}
        </Button>
      )}

      {status === 'DITERIMA' && (
        <div className="space-y-2">
          <Button onClick={() => call(`/api/orders/${orderId}/complete`, 'done')} disabled={loading === 'done'}>
            Konfirmasi pesanan baik → selesaikan
          </Button>

          {!showComplaint ? (
            <Button variant="outline" onClick={() => setShowComplaint(true)}>
              Ada masalah? Ajukan komplain
            </Button>
          ) : (
            <div className="space-y-2 rounded-lg border border-leaf-100 p-3">
              <Input
                placeholder="Ceritakan masalahnya (mis. sayur layu)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div>
                <label className="mb-1 block text-xs font-medium text-ink/70">
                  Bukti foto/video (maks. 4 file, 15 MB/file)
                </label>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                  className="block w-full text-sm text-ink/70 file:mr-3 file:rounded-lg file:border-0 file:bg-leaf-100 file:px-3 file:py-1.5 file:text-sm file:text-leaf-800"
                />
                {files.length > 0 && (
                  <p className="mt-1 text-xs text-ink/50">{files.length} file dipilih.</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  onClick={submitComplaint}
                  disabled={loading === 'cmp' || reason.length < 5}
                >
                  {loading === 'cmp' ? 'Mengirim…' : 'Kirim komplain'}
                </Button>
                <Button variant="ghost" onClick={() => setShowComplaint(false)}>Batal</Button>
              </div>
            </div>
          )}

          <p className="text-xs text-ink/50">
            Komplain hanya berlaku selama masa garansi 2 jam sejak barang diterima. Sertakan foto/video
            agar lebih cepat divalidasi admin.
          </p>
        </div>
      )}

      {msg && <p className="text-sm text-red-600">{msg}</p>}
    </div>
  );
}

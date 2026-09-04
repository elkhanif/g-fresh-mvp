'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Input';
import { rupiah } from '@/lib/utils';
import { CATEGORY_LABEL, CATEGORIES } from '@/lib/negotiation';
import type { OrderStatus } from '@prisma/client';

type ActiveOffer = { id: string; amount: number; note: string | null; round: number };
type ComplaintInfo = {
  id: string;
  status: string;
  reason: string;
  suggestedRefund: number | null;
  round: number;
  producerResponse: string | null;
  reviewNote: string | null;
  activeOffer: ActiveOffer | null;
} | null;

// Aksi milik KONSUMEN pada halaman detail pesanan — mencakup seluruh siklus
// negosiasi komplain: ajukan → tunggu produsen → terima/tolak tawaran → hasil.
export function OrderActions({
  orderId, status, complaint,
  itemQty, itemUnit,
}: {
  orderId: string; status: OrderStatus; complaint: ComplaintInfo;
  itemQty?: number; itemUnit?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState('');
  const [msg, setMsg] = useState('');

  async function call(path: string, key = 'x', body?: object) {
    setLoading(key);
    setMsg('');
    const res = await fetch(path, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setLoading('');
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error || 'Gagal.');
      return;
    }
    router.refresh();
  }

  if (status === 'MENUNGGU_BAYAR') {
    return (
      <Button onClick={() => call(`/api/orders/${orderId}/pay`, 'pay')} disabled={loading === 'pay'}>
        {loading === 'pay' ? 'Memproses…' : 'Bayar sekarang'}
      </Button>
    );
  }

  if (status !== 'DITERIMA' && status !== 'SENGKETA') return null;

  // ---- Ada komplain aktif: tampilkan sesuai tahap negosiasinya ----
  if (complaint) {
    return (
      <div className="space-y-3">
        {complaint.status === 'MENUNGGU_SANGGAHAN' && (
          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            <p className="font-medium">Menunggu tanggapan produsen</p>
            <p className="mt-1 text-xs">
              {complaint.round > 0
                ? 'Tawaran sebelumnya Anda tolak. Produsen diberi kesempatan menawar ulang.'
                : 'Produsen punya waktu 12 jam untuk menyetujui, menawar, atau menyanggah.'}
            </p>
          </div>
        )}

        {complaint.status === 'MENUNGGU_PERSETUJUAN' && complaint.activeOffer && (
          <OfferCard
            complaintId={complaint.id}
            offer={complaint.activeOffer}
            round={complaint.round}
            onDone={() => router.refresh()}
          />
        )}

        {complaint.status === 'DITINJAU' && (
          <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
            <p className="font-medium">Sedang ditinjau admin</p>
            <p className="mt-1 text-xs">
              Kasus ini dieskalasi ke operator G-Fresh untuk keputusan final. Anda akan diberi tahu
              begitu ada keputusan.
            </p>
          </div>
        )}

        {complaint.status === 'VALID' && (
          <div className="rounded-lg bg-leaf-50 p-3 text-sm text-leaf-800">
            <p className="font-medium">Komplain disetujui</p>
            <p className="mt-1 text-xs">Dana telah/akan dikembalikan sesuai keputusan.</p>
          </div>
        )}

        {complaint.status === 'DITOLAK' && (
          <div className="rounded-lg bg-gray-50 p-3 text-sm text-ink/70">
            <p className="font-medium">Komplain ditolak</p>
            {complaint.reviewNote && <p className="mt-1 text-xs">{complaint.reviewNote}</p>}
          </div>
        )}

        {msg && <p className="text-sm text-red-600">{msg}</p>}
      </div>
    );
  }

  // ---- Belum ada komplain: tampilkan tombol konfirmasi + form ajukan ----
  return (
    <div className="space-y-2">
      {status === 'DITERIMA' && (
        <Button onClick={() => call(`/api/orders/${orderId}/complete`, 'done')} disabled={loading === 'done'}>
          Konfirmasi pesanan baik → selesaikan
        </Button>
      )}
      <ComplaintForm orderId={orderId} itemQty={itemQty} itemUnit={itemUnit} onSent={() => router.refresh()} />
      {msg && <p className="text-sm text-red-600">{msg}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- Form ajukan komplain
function ComplaintForm({
  orderId, itemQty, itemUnit, onSent,
}: { orderId: string; itemQty?: number; itemUnit?: string; onSent: () => void }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>('LAINNYA');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function submit() {
    setLoading(true);
    setMsg('');
    const fd = new FormData();
    fd.append('orderId', orderId);
    fd.append('reason', reason);
    fd.append('category', category);
    if (category === 'KURANG_TIMBANGAN' && qty) fd.append('qtyAffected', qty);
    files.slice(0, 4).forEach((f) => fd.append('evidence', f));
    const res = await fetch('/api/complaints', { method: 'POST', body: fd }); // JANGAN set Content-Type manual
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error || 'Gagal mengirim komplain.');
      return;
    }
    onSent();
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Ada masalah? Ajukan komplain
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-leaf-100 p-3">
      <div>
        <Label>Jenis masalah</Label>
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </Select>
      </div>

      {category === 'KURANG_TIMBANGAN' && (
        <div>
          <Label>
            Jumlah yang kurang {itemUnit ? `(${itemUnit})` : ''}
            {itemQty ? <span className="font-normal text-ink/45"> — dari {itemQty} yang dipesan</span> : null}
          </Label>
          <Input type="number" min={0} step="0.1" value={qty} onChange={(e) => setQty(e.target.value)}
            placeholder="mis. 1" />
        </div>
      )}

      <div>
        <Label>Ceritakan detailnya</Label>
        <Input
          placeholder="mis. sayur layu, beras kurang dari yang tertera"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

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
        {files.length > 0 && <p className="mt-1 text-xs text-ink/50">{files.length} file dipilih.</p>}
      </div>

      {msg && <p className="text-sm text-red-600">{msg}</p>}

      <div className="flex gap-2">
        <Button variant="danger" onClick={submit} disabled={loading || reason.length < 5}>
          {loading ? 'Mengirim…' : 'Kirim komplain'}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
      </div>

      <p className="text-xs text-ink/50">
        Komplain hanya berlaku selama masa garansi 2 jam sejak barang diterima.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- Kartu tawaran aktif
function OfferCard({
  complaintId, offer, round, onDone,
}: { complaintId: string; offer: ActiveOffer; round: number; onDone: () => void }) {
  const [loading, setLoading] = useState('');
  const [msg, setMsg] = useState('');
  const [showReject, setShowReject] = useState(false);

  async function respond(accept: boolean, forceEscalate = false) {
    setLoading(accept ? 'terima' : 'tolak');
    setMsg('');
    const res = await fetch(`/api/complaints/${complaintId}/offer-response`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accept, forceEscalate }),
    });
    setLoading('');
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error || 'Gagal mengirim tanggapan.');
      return;
    }
    onDone();
  }

  return (
    <div className="rounded-lg border border-leaf-200 bg-leaf-50 p-3">
      <p className="text-sm font-medium text-leaf-800">
        Produsen menawarkan refund {rupiah(offer.amount)}
      </p>
      {offer.note && <p className="mt-1 text-sm text-ink/70">"{offer.note}"</p>}
      <p className="mt-1 text-xs text-ink/45">Tawaran putaran ke-{round}</p>

      {!showReject ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => respond(true)} disabled={!!loading}>
            {loading === 'terima' ? 'Memproses…' : `Terima ${rupiah(offer.amount)}`}
          </Button>
          <Button variant="outline" onClick={() => setShowReject(true)} disabled={!!loading}>
            Tolak tawaran
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-2 rounded-lg bg-white p-2">
          <p className="text-xs text-ink/60">
            Produsen bisa menawar ulang, atau Anda bisa langsung minta admin memutuskan.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => respond(false, false)} disabled={!!loading}>
              {loading === 'tolak' ? 'Memproses…' : 'Tolak, biar produsen menawar ulang'}
            </Button>
            <Button variant="danger" onClick={() => respond(false, true)} disabled={!!loading}>
              Minta admin putuskan
            </Button>
            <Button variant="ghost" onClick={() => setShowReject(false)}>Batal</Button>
          </div>
        </div>
      )}
      {msg && <p className="mt-2 text-sm text-red-600">{msg}</p>}
    </div>
  );
}

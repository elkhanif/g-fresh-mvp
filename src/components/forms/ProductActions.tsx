'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { rupiah } from '@/lib/utils';
import {
  MANUAL_STOCK_REASONS,
  STOCK_REASON_LABEL,
  noteRequiredFor,
  type ManualStockReason,
} from '@/lib/inventory';

type P = {
  id: string;
  name: string;
  unit: string;
  price: number;
  stock: number;
  b2bPrice: number | null;
  b2bMinQty: number | null;
  active: boolean;
};

/**
 * Dua aksi dipisah — "Ubah harga" (nilai absolut, dicatat riwayatnya) dan
 * "Sesuaikan stok" (delta +/- dengan alasan). Bukan satu form "edit produk",
 * karena keduanya beda sifat: harga itu keputusan, stok itu kejadian.
 */
export function ProductActions({
  product,
  hetMax,
  hetFloor,
}: {
  product: P;
  hetMax: number | null;
  hetFloor: number | null;
}) {
  const [open, setOpen] = useState<null | 'harga' | 'stok' | 'riwayat'>(null);

  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="outline" className="px-3 py-1 text-xs" onClick={() => setOpen('harga')}>
          Ubah harga
        </Button>
        <Button variant="outline" className="px-3 py-1 text-xs" onClick={() => setOpen('stok')}>
          Sesuaikan stok
        </Button>
        <Button variant="ghost" className="px-3 py-1 text-xs" onClick={() => setOpen('riwayat')}>
          Riwayat
        </Button>
        <ActiveToggle product={product} />
      </div>

      {open === 'harga' && (
        <Modal title={`Ubah harga — ${product.name}`} onClose={() => setOpen(null)}>
          <PriceForm
            product={product}
            hetMax={hetMax}
            hetFloor={hetFloor}
            onDone={() => setOpen(null)}
          />
        </Modal>
      )}
      {open === 'stok' && (
        <Modal title={`Sesuaikan stok — ${product.name}`} onClose={() => setOpen(null)}>
          <StockForm product={product} onDone={() => setOpen(null)} />
        </Modal>
      )}
      {open === 'riwayat' && (
        <Modal title={`Riwayat — ${product.name}`} onClose={() => setOpen(null)}>
          <HistoryPanel productId={product.id} unit={product.unit} />
        </Modal>
      )}
    </>
  );
}

// --- Shell modal sederhana (tanpa dependensi tambahan) -------------------
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 shadow-lg sm:rounded-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="text-xl leading-none text-ink/50" aria-label="Tutup">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// --- Aktif / nonaktif ----------------------------------------------------
function ActiveToggle({ product }: { product: P }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    await fetch(`/api/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !product.active }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <Button variant="ghost" className="px-3 py-1 text-xs" disabled={busy} onClick={toggle}>
      {product.active ? 'Nonaktifkan' : 'Aktifkan'}
    </Button>
  );
}

// --- Ubah harga ----------------------------------------------------------
function PriceForm({
  product,
  hetMax,
  hetFloor,
  onDone,
}: {
  product: P;
  hetMax: number | null;
  hetFloor: number | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [price, setPrice] = useState(String(product.price));
  const [b2bPrice, setB2bPrice] = useState(product.b2bPrice ? String(product.b2bPrice) : '');
  const [b2bMinQty, setB2bMinQty] = useState(product.b2bMinQty ? String(product.b2bMinQty) : '');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const n = Number(price);
  const diff = Number.isFinite(n) && n > 0 ? n - product.price : 0;
  const pct = product.price > 0 ? Math.round((diff / product.price) * 100) : 0;
  const overHet = hetMax != null && Number.isFinite(n) && n > hetMax;
  const underFloor = hetFloor != null && Number.isFinite(n) && n > 0 && n < hetFloor;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const res = await fetch(`/api/products/${product.id}/price`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price: Number(price),
        // String kosong = hapus penawaran grosir (kirim null, bukan undefined).
        b2bPrice: b2bPrice ? Number(b2bPrice) : null,
        b2bMinQty: b2bMinQty ? Number(b2bMinQty) : null,
        note: note || undefined,
      }),
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(j.error || 'Gagal menyimpan harga.');
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-ink/60">
        Harga sekarang <strong>{rupiah(product.price)}</strong>/{product.unit}
        {hetMax != null && <> · HET {rupiah(hetMax)}</>}
        {hetFloor != null && <> · dasar {rupiah(hetFloor)}</>}
      </p>

      <div>
        <Label>Harga baru / {product.unit} (Rp)</Label>
        <Input type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} required />
        {diff !== 0 && Number.isFinite(n) && (
          <p className="mt-1 text-xs text-ink/60">
            {diff > 0 ? 'Naik' : 'Turun'} {rupiah(Math.abs(diff))} ({Math.abs(pct)}%)
          </p>
        )}
        {overHet && (
          <p className="mt-1 text-xs text-red-600">
            Di atas HET — server akan menolak. Turunkan ke maks {rupiah(hetMax!)}.
          </p>
        )}
        {underFloor && (
          <p className="mt-1 text-xs text-red-600">
            Di bawah harga dasar {rupiah(hetFloor!)} yang melindungi produsen.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-leaf-100 p-3">
        <p className="mb-2 text-sm font-medium">Harga grosir B2B</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Harga grosir</Label>
            <Input
              type="number"
              min={1}
              value={b2bPrice}
              onChange={(e) => setB2bPrice(e.target.value)}
              placeholder="kosongkan = tidak ada"
            />
          </div>
          <div>
            <Label>Minimum qty</Label>
            <Input
              type="number"
              min={1}
              value={b2bMinQty}
              onChange={(e) => setB2bMinQty(e.target.value)}
              placeholder="mis. 20"
            />
          </div>
        </div>
        <p className="mt-1 text-xs text-ink/50">
          Dikosongkan berarti penawaran grosir dihapus. Harga grosir wajib lebih rendah dari ritel.
        </p>
      </div>

      <div>
        <Label>Catatan (opsional)</Label>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="mis. panen melimpah, harga pasar turun"
          maxLength={200}
        />
      </div>

      <p className="text-xs text-ink/50">
        Perubahan harga tercatat di riwayat produk — bisa dilihat kembali kapan dan dari berapa ke berapa.
      </p>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? 'Menyimpan…' : 'Simpan harga'}
      </Button>
    </form>
  );
}

// --- Sesuaikan stok -----------------------------------------------------
function StockForm({ product, onDone }: { product: P; onDone: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState<ManualStockReason>('RESTOCK');
  const [qty, setQty] = useState('');
  const [sign, setSign] = useState<1 | -1>(1); // hanya dipakai untuk KOREKSI
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Arah ditentukan alasannya; KOREKSI bebas karena bisa dua arah.
  const fixedSign: 1 | -1 | null =
    reason === 'RESTOCK' ? 1 : reason === 'TERJUAL_MANUAL' || reason === 'RUSAK' ? -1 : null;
  const effSign = fixedSign ?? sign;
  const q = Number(qty);
  const delta = Number.isFinite(q) && q > 0 ? effSign * Math.trunc(q) : 0;
  const after = product.stock + delta;
  const kurang = after < 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const res = await fetch(`/api/products/${product.id}/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta, reason, note: note || undefined }),
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(j.error || 'Gagal menyesuaikan stok.');
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-ink/60">
        Stok sekarang <strong>{product.stock}</strong> {product.unit}
      </p>

      <div>
        <Label>Alasan</Label>
        <Select value={reason} onChange={(e) => setReason(e.target.value as ManualStockReason)}>
          {MANUAL_STOCK_REASONS.map((r) => (
            <option key={r} value={r}>
              {STOCK_REASON_LABEL[r]}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-[auto,1fr] items-end gap-3">
        {fixedSign === null ? (
          <div>
            <Label>Arah</Label>
            <Select value={String(sign)} onChange={(e) => setSign(Number(e.target.value) as 1 | -1)}>
              <option value="1">Tambah (+)</option>
              <option value="-1">Kurangi (−)</option>
            </Select>
          </div>
        ) : (
          <div>
            <Label>Arah</Label>
            <div className="py-2">
              <Badge tone={fixedSign > 0 ? 'green' : 'amber'}>
                {fixedSign > 0 ? 'Menambah stok' : 'Mengurangi stok'}
              </Badge>
            </div>
          </div>
        )}
        <div>
          <Label>Jumlah ({product.unit})</Label>
          <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} required />
        </div>
      </div>

      {delta !== 0 && (
        <p className={`text-sm ${kurang ? 'text-red-600' : 'text-ink/70'}`}>
          {product.stock} → <strong>{after}</strong> {product.unit}
          {kurang && ' — tidak boleh sampai minus.'}
        </p>
      )}

      <div>
        <Label>
          Catatan {noteRequiredFor(reason) ? '(wajib)' : '(opsional)'}
        </Label>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          required={noteRequiredFor(reason)}
          placeholder={
            reason === 'RUSAK'
              ? 'mis. kena hujan saat panen'
              : reason === 'KOREKSI'
                ? 'mis. salah input 100 padahal 10'
                : 'mis. panen pagi 30 kg'
          }
          maxLength={200}
        />
      </div>

      <p className="text-xs text-ink/50">
        Stok diubah sebagai selisih (+/−), bukan ditimpa — supaya pesanan yang masuk di detik yang
        sama tidak ikut terhapus.
      </p>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <Button type="submit" disabled={busy || delta === 0 || kurang} className="w-full">
        {busy ? 'Menyimpan…' : 'Simpan penyesuaian'}
      </Button>
    </form>
  );
}

// --- Riwayat -------------------------------------------------------------
type HistoryData = {
  prices: Array<{
    id: string;
    oldPrice: number;
    newPrice: number;
    note: string | null;
    createdAt: string;
  }>;
  movements: Array<{
    id: string;
    delta: number;
    before: number;
    after: number;
    reason: keyof typeof STOCK_REASON_LABEL;
    note: string | null;
    createdAt: string;
  }>;
};

function HistoryPanel({ productId, unit }: { productId: string; unit: string }) {
  const [tab, setTab] = useState<'harga' | 'stok'>('stok');
  const [data, setData] = useState<HistoryData | null>(null);
  const [err, setErr] = useState('');

  // Diambil saat panel dibuka, bukan saat halaman dirender — daftar produk
  // bisa panjang, tidak perlu semua riwayatnya ikut terkirim.
  useEffect(() => {
    let alive = true;
    fetch(`/api/products/${productId}/history`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('gagal'))))
      .then((j) => alive && setData(j))
      .catch(() => alive && setErr('Gagal memuat riwayat.'));
    return () => {
      alive = false;
    };
  }, [productId]);

  const fmt = (s: string) =>
    new Date(s).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <Button
          variant={tab === 'stok' ? 'primary' : 'outline'}
          className="px-3 py-1 text-xs"
          onClick={() => setTab('stok')}
        >
          Mutasi stok
        </Button>
        <Button
          variant={tab === 'harga' ? 'primary' : 'outline'}
          className="px-3 py-1 text-xs"
          onClick={() => setTab('harga')}
        >
          Perubahan harga
        </Button>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}
      {!data && !err && <p className="text-sm text-ink/50">Memuat…</p>}

      {data && tab === 'stok' && (
        data.movements.length ? (
          <ul className="space-y-2">
            {data.movements.map((m) => (
              <li key={m.id} className="rounded-lg border border-leaf-100 p-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {m.delta > 0 ? '+' : ''}
                    {m.delta} {unit}
                  </span>
                  <Badge tone={m.delta > 0 ? 'green' : 'amber'}>
                    {STOCK_REASON_LABEL[m.reason]}
                  </Badge>
                </div>
                <p className="text-xs text-ink/60">
                  {m.before} → {m.after} · {fmt(m.createdAt)}
                </p>
                {m.note && <p className="text-xs text-ink/60">{m.note}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink/50">Belum ada mutasi stok.</p>
        )
      )}

      {data && tab === 'harga' && (
        data.prices.length ? (
          <ul className="space-y-2">
            {data.prices.map((p) => (
              <li key={p.id} className="rounded-lg border border-leaf-100 p-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span>
                    {rupiah(p.oldPrice)} → <strong>{rupiah(p.newPrice)}</strong>
                  </span>
                  <Badge tone={p.newPrice > p.oldPrice ? 'amber' : 'green'}>
                    {p.newPrice > p.oldPrice ? 'naik' : 'turun'}
                  </Badge>
                </div>
                <p className="text-xs text-ink/60">{fmt(p.createdAt)}</p>
                {p.note && <p className="text-xs text-ink/60">{p.note}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink/50">Harga belum pernah diubah.</p>
        )
      )}
    </div>
  );
}

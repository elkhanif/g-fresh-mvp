'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Label, Select } from '@/components/ui/Input';
import { CertBadge } from '@/components/CertBadge';
import {
  CERT_ACTION_LABEL,
  CERT_ISSUERS,
  CERT_STATUS_LABEL,
  CERT_TYPES,
  CERT_QUEUE_RANK,
  allowedActions,
  daysUntil,
  isExpiringSoon,
  needsAction,
  needsCertDataForAction,
  noteRequiredForAction,
  type CertAction,
} from '@/lib/cert';

export type CertRow = {
  id: string;
  farmName: string;
  ownerName: string;
  kecamatan: string;
  certStatus: any;
  certType: string | null;
  certNumber: string | null;
  certIssuer: string | null;
  certExpiresAt: string | null;
  certSubmittedAt: string | null;
  certDocUrl: string | null;
  certNote: string | null;
};

type Tab = 'antrean' | 'kedaluwarsa' | 'semua';

function fmt(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID', { dateStyle: 'medium' });
}

/**
 * Panel sertifikasi dinas.
 *
 * Perbedaan pokok dari versi lama: aksi ditentukan oleh status (produsen yang
 * sudah terverifikasi tidak lagi ditawari "Verifikasi"), keputusan yang
 * merugikan wajib beralasan, dan setiap kartu menampilkan bukti yang jadi
 * dasar keputusan — bukan sekadar dua tombol.
 */
export function CertReviewPanel({ rows }: { rows: CertRow[] }) {
  const [tab, setTab] = useState<Tab>('antrean');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const term = q.trim().toLowerCase();
    return [...rows]
      .filter((r) => {
        if (tab === 'antrean' && !needsAction(r.certStatus)) return false;
        if (tab === 'kedaluwarsa') {
          const soon = isExpiringSoon(r.certStatus, r.certExpiresAt);
          if (!soon && r.certStatus !== 'KEDALUWARSA') return false;
        }
        if (!term) return true;
        return (
          r.farmName.toLowerCase().includes(term) ||
          r.ownerName.toLowerCase().includes(term) ||
          r.kecamatan.toLowerCase().includes(term) ||
          (r.certNumber ?? '').toLowerCase().includes(term)
        );
      })
      .sort(
        (a, b) =>
          (CERT_QUEUE_RANK[a.certStatus as keyof typeof CERT_QUEUE_RANK] ?? 9) -
          (CERT_QUEUE_RANK[b.certStatus as keyof typeof CERT_QUEUE_RANK] ?? 9),
      );
  }, [rows, tab, q]);

  const counts = useMemo(
    () => ({
      antrean: rows.filter((r) => needsAction(r.certStatus)).length,
      kedaluwarsa: rows.filter(
        (r) => isExpiringSoon(r.certStatus, r.certExpiresAt) || r.certStatus === 'KEDALUWARSA',
      ).length,
      semua: rows.length,
    }),
    [rows],
  );

  const tabs: Array<[Tab, string, number]> = [
    ['antrean', 'Perlu tindakan', counts.antrean],
    ['kedaluwarsa', 'Kedaluwarsa & segera', counts.kedaluwarsa],
    ['semua', 'Semua produsen', counts.semua],
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map(([key, label, n]) => (
          <Button
            key={key}
            variant={tab === key ? 'primary' : 'outline'}
            className="px-3 py-1 text-xs"
            onClick={() => setTab(key)}
          >
            {label} ({n})
          </Button>
        ))}
        <div className="ml-auto w-56">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama, kecamatan, no. sertifikat"
          />
        </div>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <p className="text-ink/60">
            {tab === 'antrean'
              ? 'Tidak ada pengajuan yang menunggu keputusan.'
              : 'Tidak ada data pada tampilan ini.'}
          </p>
        </Card>
      ) : (
        sorted.map((r) => (
          <ProducerCard
            key={r.id}
            row={r}
            open={openId === r.id}
            onToggle={() => setOpenId(openId === r.id ? null : r.id)}
          />
        ))
      )}
    </div>
  );
}

function ProducerCard({
  row,
  open,
  onToggle,
}: {
  row: CertRow;
  open: boolean;
  onToggle: () => void;
}) {
  const [action, setAction] = useState<CertAction | null>(null);
  const actions = allowedActions(row.certStatus);
  const sisa = daysUntil(row.certExpiresAt);
  const soon = isExpiringSoon(row.certStatus, row.certExpiresAt);

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{row.farmName}</p>
          <p className="text-sm text-ink/60">
            {row.ownerName} · Kec. {row.kecamatan} ·{' '}
            <CertBadge status={row.certStatus} type={row.certType} />
          </p>
          <p className="mt-1 text-xs text-ink/50">
            {row.certNumber ? `No. ${row.certNumber}` : 'Nomor sertifikat belum ada'}
            {row.certIssuer ? ` · ${row.certIssuer}` : ''}
            {row.certExpiresAt ? ` · berlaku s/d ${fmt(row.certExpiresAt)}` : ''}
          </p>
          {soon && sisa !== null && (
            <p className="mt-1 text-xs text-amber-700">Kedaluwarsa dalam {sisa} hari.</p>
          )}
          {row.certNote && (
            <p className="mt-1 text-xs text-ink/60">Catatan terakhir: {row.certNote}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {row.certDocUrl ? (
            <a
              href={row.certDocUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-leaf-200 px-3 py-1 text-xs hover:bg-leaf-50"
            >
              Lihat dokumen
            </a>
          ) : (
            <span className="text-xs text-ink/40">Tanpa dokumen</span>
          )}
          <Button variant="ghost" className="px-3 py-1 text-xs" onClick={onToggle}>
            {open ? 'Tutup riwayat' : 'Riwayat'}
          </Button>
          {actions.length === 0 ? (
            <span className="text-xs text-ink/50">
              Menunggu pengajuan ulang dari produsen
            </span>
          ) : (
            actions.map((a) => (
              <Button
                key={a}
                variant={a === 'VERIFIKASI' ? 'primary' : 'outline'}
                className="px-3 py-1 text-xs"
                onClick={() => setAction(a)}
              >
                {CERT_ACTION_LABEL[a]}
              </Button>
            ))
          )}
        </div>
      </div>

      {open && <HistoryList producerId={row.id} />}

      {action && (
        <DecisionModal row={row} action={action} onClose={() => setAction(null)} />
      )}
    </Card>
  );
}

function HistoryList({ producerId }: { producerId: string }) {
  const [items, setItems] = useState<any[] | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    fetch(`/api/cert/history?producerId=${producerId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('gagal'))))
      .then((j) => alive && setItems(j.reviews))
      .catch(() => alive && setErr('Gagal memuat riwayat.'));
    return () => {
      alive = false;
    };
  }, [producerId]);

  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!items) return <p className="text-sm text-ink/50">Memuat riwayat…</p>;
  if (items.length === 0) return <p className="text-sm text-ink/50">Belum ada keputusan tercatat.</p>;

  return (
    <ul className="space-y-2 border-t border-leaf-50 pt-3">
      {items.map((it) => (
        <li key={it.id} className="text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">
              {CERT_STATUS_LABEL[it.fromStatus as keyof typeof CERT_STATUS_LABEL]} →{' '}
              {CERT_STATUS_LABEL[it.toStatus as keyof typeof CERT_STATUS_LABEL]}
            </Badge>
            <span className="text-xs text-ink/50">
              {new Date(it.createdAt).toLocaleString('id-ID', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}{' '}
              · {it.actorName ?? 'Sistem'}
            </span>
          </div>
          {it.note && <p className="text-xs text-ink/60">{it.note}</p>}
        </li>
      ))}
    </ul>
  );
}

function DecisionModal({
  row,
  action,
  onClose,
}: {
  row: CertRow;
  action: CertAction;
  onClose: () => void;
}) {
  const router = useRouter();
  const withData = needsCertDataForAction(action);
  const noteWajib = noteRequiredForAction(action);

  const [certType, setCertType] = useState(row.certType ?? '');
  const [certNumber, setCertNumber] = useState(row.certNumber ?? '');
  const [certIssuer, setCertIssuer] = useState(row.certIssuer ?? '');
  const [expiresAt, setExpiresAt] = useState(
    row.certExpiresAt ? row.certExpiresAt.slice(0, 10) : '',
  );
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const res = await fetch('/api/cert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        producerId: row.id,
        action,
        note: note || undefined,
        certType: withData ? certType : undefined,
        certNumber: withData ? certNumber : undefined,
        certIssuer: withData ? certIssuer : undefined,
        expiresAt: withData && expiresAt ? expiresAt : undefined,
        expectedStatus: row.certStatus,
      }),
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(j.error || 'Gagal menyimpan keputusan.');
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 shadow-lg sm:rounded-2xl">
        <div className="mb-1 flex items-start justify-between gap-3">
          <h3 className="font-semibold">
            {CERT_ACTION_LABEL[action]} — {row.farmName}
          </h3>
          <button onClick={onClose} className="text-xl leading-none text-ink/50" aria-label="Tutup">
            ×
          </button>
        </div>
        <p className="mb-3 text-xs text-ink/50">
          Keputusan ini tercatat atas nama Anda dan dapat dilihat produsen.
        </p>

        <form onSubmit={submit} className="space-y-3">
          {withData && (
            <>
              <div>
                <Label>Jenis sertifikat</Label>
                <Select value={certType} onChange={(e) => setCertType(e.target.value)} required>
                  <option value="">Pilih jenis…</option>
                  {CERT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Nomor sertifikat</Label>
                <Input
                  value={certNumber}
                  onChange={(e) => setCertNumber(e.target.value)}
                  required
                  placeholder="mis. 2063525011234-27"
                />
              </div>
              <div>
                <Label>Penerbit</Label>
                <Select value={certIssuer} onChange={(e) => setCertIssuer(e.target.value)}>
                  <option value="">Pilih penerbit…</option>
                  {CERT_ISSUERS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Berlaku sampai</Label>
                <Input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  required
                />
                <p className="mt-1 text-xs text-ink/50">
                  P-IRT umumnya 5 tahun, sertifikat halal 4 tahun.
                </p>
              </div>
            </>
          )}

          <div>
            <Label>{noteWajib ? 'Alasan (wajib)' : 'Catatan (opsional)'}</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              required={noteWajib}
              maxLength={500}
              placeholder={
                action === 'MINTA_PERBAIKAN'
                  ? 'mis. foto sertifikat buram, nomor tidak terbaca'
                  : action === 'TOLAK'
                    ? 'mis. nomor tidak terdaftar di Dinkes'
                    : action === 'CABUT'
                      ? 'mis. hasil sidak lapangan tidak sesuai'
                      : 'opsional'
              }
            />
            {noteWajib && (
              <p className="mt-1 text-xs text-ink/50">
                Alasan ini dikirim ke produsen supaya bisa diperbaiki atau dibanding.
              </p>
            )}
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy} className="flex-1">
              {busy ? 'Menyimpan…' : `Konfirmasi ${CERT_ACTION_LABEL[action].toLowerCase()}`}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

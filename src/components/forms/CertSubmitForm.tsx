'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Input';
import { CERT_ISSUERS, CERT_TYPES } from '@/lib/cert';

/**
 * Form pengajuan sertifikasi oleh produsen.
 *
 * Nomor sertifikat WAJIB, dokumen OPSIONAL. Alasannya: banyak produsen kecil
 * memotret sertifikat dengan HP atau belum punya salinan digital sama sekali.
 * Mewajibkan unggahan akan mengunci mereka dari sistem, sementara nomor masih
 * bisa diverifikasi silang manual oleh petugas ke penerbitnya.
 */
export function CertSubmitForm({ defaults }: { defaults: { certType: string | null } }) {
  const router = useRouter();
  const [certType, setCertType] = useState(defaults.certType ?? '');
  const [certNumber, setCertNumber] = useState('');
  const [certIssuer, setCertIssuer] = useState('');
  const [issuedAt, setIssuedAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const fd = new FormData();
    fd.set('certType', certType);
    fd.set('certNumber', certNumber);
    fd.set('certIssuer', certIssuer);
    fd.set('issuedAt', issuedAt);
    fd.set('expiresAt', expiresAt);
    if (file) fd.set('doc', file);

    const res = await fetch('/api/cert/submit', { method: 'POST', body: fd });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(j.error || 'Gagal mengirim pengajuan.');
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
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
          placeholder="salin persis seperti tertulis di sertifikat"
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Tanggal terbit</Label>
          <Input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
        </div>
        <div>
          <Label>Berlaku sampai</Label>
          <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </div>
      </div>

      <div>
        <Label>Salinan sertifikat (opsional)</Label>
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-ink/70 file:mr-3 file:rounded-lg file:border-0 file:bg-leaf-50 file:px-3 file:py-2 file:text-sm file:text-leaf-700"
        />
        <p className="mt-1 text-xs text-ink/50">
          Foto dari HP juga diterima. Tanpa dokumen pun pengajuan tetap diproses — petugas akan
          mengecek nomornya ke penerbit.
        </p>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? 'Mengirim…' : 'Kirim pengajuan ke dinas'}
      </Button>
    </form>
  );
}
